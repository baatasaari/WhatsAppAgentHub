import OpenAI from "openai";
import { storage } from "../storage";
import type { VoiceCall, InsertVoiceCall, Agent, Conversation } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface VoiceCallService {
  triggerVoiceCall(params: {
    agentId: number;
    conversationId?: number;
    phoneNumber: string;
    triggerReason: string;
    triggeredBy: string;
  }): Promise<VoiceCall>;
  
  processCallWebhook(callId: string, status: string, data: any): Promise<void>;
  analyzeConversationForTrigger(conversationId: number): Promise<boolean>;
  generateCallScript(agent: Agent, conversation?: Conversation): Promise<string>;
  scheduleFollowUp(callId: number, followUpDate: Date): Promise<void>;
}

export class AIVoiceCallingService implements VoiceCallService {
  private readonly VOICE_MODELS = {
    professional: "alloy",
    friendly: "nova", 
    sales: "onyx",
    empathetic: "shimmer"
  };

  async triggerVoiceCall(params: {
    agentId: number;
    conversationId?: number;
    phoneNumber: string;
    triggerReason: string;
    triggeredBy: string;
  }): Promise<VoiceCall> {
    const agent = await storage.getAgent(params.agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }

    // Get conversation context if provided
    let conversation: Conversation | undefined;
    if (params.conversationId) {
      conversation = await storage.getConversation(params.conversationId);
    }

    // Generate AI call script based on agent and conversation context
    const callScript = await this.generateCallScript(agent, conversation);
    const systemPrompt = this.generateSystemPrompt(agent, params.triggerReason);

    // Get voice call trigger settings
    const trigger = await storage.getVoiceCallTrigger(params.agentId);
    const voiceModel = this.VOICE_MODELS[trigger?.voicePersona as keyof typeof this.VOICE_MODELS] || "alloy";

    // Create voice call record
    const voiceCall = await storage.createVoiceCall({
      agentId: params.agentId,
      conversationId: params.conversationId,
      phoneNumber: params.phoneNumber,
      triggeredBy: params.triggeredBy,
      triggerReason: params.triggerReason,
      voiceModel,
      systemPrompt,
      callScript,
      status: "pending",
    });

    // Initiate the actual voice call
    await this.initiateVoiceCall(voiceCall);

    return voiceCall;
  }

  private async initiateVoiceCall(voiceCall: VoiceCall): Promise<void> {
    try {
      // Update status to calling
      await storage.updateVoiceCallStatus(voiceCall.id, "calling");

      // For demo purposes, we'll simulate the call process
      // In production, this would integrate with a telephony provider like Twilio/Vapi
      const callResult = await this.simulateVoiceCall(voiceCall);
      
      // Update call with results
      await storage.updateVoiceCall(voiceCall.id, {
        status: callResult.status,
        callId: callResult.callId,
        transcript: callResult.transcript,
        sentiment: callResult.sentiment,
        callOutcome: callResult.outcome,
        leadScore: callResult.leadScore,
        callDuration: callResult.duration,
        completedAt: new Date(),
      });

      // Update analytics
      await this.updateCallAnalytics(voiceCall.agentId, callResult);

    } catch (error) {
      console.error("Voice call failed:", error);
      await storage.updateVoiceCallStatus(voiceCall.id, "failed");
    }
  }

  private async simulateVoiceCall(voiceCall: VoiceCall) {
    // Simulate call processing with OpenAI
    const conversationPrompt = `
${voiceCall.systemPrompt}

CALL SCRIPT:
${voiceCall.callScript}

Simulate a phone conversation where you're calling ${voiceCall.phoneNumber} regarding ${voiceCall.triggerReason}.
Respond as if you're having a real conversation with a potential customer.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: conversationPrompt },
        { role: "user", content: "Hello? Who is this?" }
      ],
      temperature: 0.7,
    });

    const aiResponse = response.choices[0].message.content || "";
    
    // Simulate conversation outcome
    const outcomes = ["conversion", "callback_scheduled", "not_interested", "no_answer"];
    const sentiments = ["positive", "neutral", "negative"];
    
    return {
      status: "completed" as const,
      callId: `call_${Date.now()}`,
      transcript: `Customer: Hello? Who is this?\nAI Agent: ${aiResponse}\nCustomer: [Simulated customer response based on trigger reason]`,
      sentiment: sentiments[Math.floor(Math.random() * sentiments.length)],
      outcome: outcomes[Math.floor(Math.random() * outcomes.length)],
      leadScore: Math.floor(Math.random() * 100),
      duration: Math.floor(Math.random() * 300) + 60, // 1-6 minutes
    };
  }

  async processCallWebhook(callId: string, status: string, data: any): Promise<void> {
    const voiceCall = await storage.getVoiceCallByCallId(callId);
    if (!voiceCall) {
      console.warn(`Voice call not found for callId: ${callId}`);
      return;
    }

    await storage.updateVoiceCall(voiceCall.id, {
      status,
      transcript: data.transcript,
      sentiment: data.sentiment,
      callOutcome: data.outcome,
      leadScore: data.leadScore,
      callDuration: data.duration,
      completedAt: status === "completed" ? new Date() : undefined,
    });

    if (status === "completed") {
      await this.updateCallAnalytics(voiceCall.agentId, data);
    }
  }

  async analyzeConversationForTrigger(conversationId: number): Promise<boolean> {
    const conversation = await storage.getConversation(conversationId);
    if (!conversation) return false;

    const trigger = await storage.getVoiceCallTrigger(conversation.agentId);
    if (!trigger?.enabled) return false;

    // Check if phone number was captured
    if (trigger.requirePhoneCapture) {
      const hasPhone = conversation.metadata?.contactInfo?.phone;
      if (!hasPhone) return false;
    }

    // Check engagement score
    const engagementScore = this.calculateEngagementScore(conversation);
    if (engagementScore < trigger.minEngagementScore) return false;

    // Check if we haven't exceeded max attempts
    const existingCalls = await storage.getVoiceCallsByConversation(conversationId);
    if (existingCalls.length >= trigger.maxAttemptsPerLead) return false;

    return true;
  }

  private calculateEngagementScore(conversation: Conversation): number {
    // Simple engagement scoring based on conversation metadata
    let score = 0;
    
    if (conversation.messagesCount > 3) score += 30;
    if (conversation.messagesCount > 10) score += 20;
    if (conversation.leadQualified) score += 40;
    if (conversation.metadata?.contactInfo?.email) score += 10;
    if (conversation.metadata?.contactInfo?.phone) score += 20;
    if (conversation.metadata?.interests?.length > 0) score += 15;
    
    return Math.min(score, 100);
  }

  async generateCallScript(agent: Agent, conversation?: Conversation): Promise<string> {
    const businessContext = this.extractBusinessContext(agent);
    const conversationContext = conversation ? this.extractConversationContext(conversation) : "";

    const scriptPrompt = `
Generate a professional phone call script for an AI agent representing ${agent.name}.

BUSINESS CONTEXT:
${businessContext}

CONVERSATION CONTEXT:
${conversationContext}

The script should:
1. Open with a warm, professional greeting
2. Reference the previous website interaction if applicable
3. Offer value and assistance
4. Include natural conversation flows
5. Have clear call-to-action options
6. Be conversational, not robotic

Keep the script under 200 words and include natural transition points.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: scriptPrompt }],
      temperature: 0.7,
    });

    return response.choices[0].message.content || "Default call script";
  }

  private generateSystemPrompt(agent: Agent, triggerReason: string): string {
    return `
You are an AI voice assistant representing ${agent.name}. You're making an outbound call to a potential customer who recently visited the website but didn't complete their inquiry.

TRIGGER REASON: ${triggerReason}

AGENT CONTEXT:
- Business: ${agent.businessType || "General Business"}
- Website: ${agent.businessWebsite || "company website"}

CALL OBJECTIVES:
1. Be warm, professional, and helpful
2. Reference their recent website visit naturally
3. Offer assistance with their inquiry
4. Gather contact information if not already obtained
5. Schedule a follow-up or close the conversation positively

CONVERSATION STYLE:
- Speak naturally and conversationally
- Listen actively and respond appropriately
- Don't sound robotic or scripted
- Be empathetic and understanding
- Keep responses concise but helpful

Remember: You're calling to help, not to be pushy or sales-heavy.
`;
  }

  private extractBusinessContext(agent: Agent): string {
    return `
Business Type: ${agent.businessType || "General"}
Website: ${agent.businessWebsite || "Not specified"}
Contact: ${agent.contactInfo ? JSON.stringify(agent.contactInfo) : "Not specified"}
Business Hours: ${agent.businessHours ? JSON.stringify(agent.businessHours) : "Standard hours"}
`;
  }

  private extractConversationContext(conversation: Conversation): string {
    return `
Previous Conversation:
- Messages exchanged: ${conversation.messagesCount}
- Lead qualified: ${conversation.leadQualified ? "Yes" : "No"}
- Contact info: ${conversation.metadata?.contactInfo ? JSON.stringify(conversation.metadata.contactInfo) : "None captured"}
- Interests: ${conversation.metadata?.interests?.join(", ") || "None identified"}
- Last activity: ${conversation.lastMessageAt || "Unknown"}
`;
  }

  async scheduleFollowUp(callId: number, followUpDate: Date): Promise<void> {
    await storage.updateVoiceCall(callId, {
      followUpRequired: true,
      followUpDate,
    });
  }

  private async updateCallAnalytics(agentId: number, callResult: any): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    let analytics = await storage.getVoiceCallAnalytics(agentId, today);
    
    if (!analytics) {
      analytics = await storage.createVoiceCallAnalytics({
        agentId,
        date: today,
        totalCalls: 0,
        successfulConnections: 0,
        failedCalls: 0,
        noAnswers: 0,
        conversions: 0,
        callbacksScheduled: 0,
        notInterested: 0,
        avgCallDuration: 0,
        totalTalkTime: 0,
        avgLeadScore: 0,
        totalCost: 0,
        costPerCall: 0,
        costPerConversion: 0,
      });
    }

    // Update metrics based on call result
    const updates: Partial<typeof analytics> = {
      totalCalls: analytics.totalCalls + 1,
      totalTalkTime: analytics.totalTalkTime + callResult.duration,
    };

    if (callResult.status === "completed") {
      updates.successfulConnections = analytics.successfulConnections + 1;
      
      switch (callResult.outcome) {
        case "conversion":
          updates.conversions = analytics.conversions + 1;
          break;
        case "callback_scheduled":
          updates.callbacksScheduled = analytics.callbacksScheduled + 1;
          break;
        case "not_interested":
          updates.notInterested = analytics.notInterested + 1;
          break;
      }
    } else if (callResult.status === "no_answer") {
      updates.noAnswers = analytics.noAnswers + 1;
    } else {
      updates.failedCalls = analytics.failedCalls + 1;
    }

    // Calculate averages
    updates.avgCallDuration = Math.round(updates.totalTalkTime! / updates.totalCalls!);
    updates.avgLeadScore = Math.round(
      ((analytics.avgLeadScore * analytics.totalCalls) + callResult.leadScore) / updates.totalCalls!
    );

    // Update cost metrics (estimated)
    const costPerCall = 50; // 50 cents per call
    updates.totalCost = analytics.totalCost + costPerCall;
    updates.costPerCall = Math.round(updates.totalCost! / updates.totalCalls!);
    
    if (updates.conversions! > 0) {
      updates.costPerConversion = Math.round(updates.totalCost! / updates.conversions!);
    }

    await storage.updateVoiceCallAnalytics(analytics.id, updates);
  }
}

export const voiceCallingService = new AIVoiceCallingService();