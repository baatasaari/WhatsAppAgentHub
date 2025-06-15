import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAgentSchema, insertConversationSchema } from "@shared/schema";
import { generateChatResponse, qualifyLead } from "./services/openai";
import { nanoid } from "nanoid";
import { createSecureWidgetConfig } from "./encryption";

// WhatsApp Business API integration
async function sendWhatsAppMessage(phoneNumber: string, message: string, accessToken: string) {
  const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'text',
      text: { body: message }
    })
  });
  
  return response.json();
}

async function processWhatsAppMessage(agent: any, message: any, messageData: any) {
  const userPhone = message.from;
  const userMessage = message.text.body;
  
  // Get or create conversation
  let conversation = await storage.getConversationBySession(`whatsapp_${userPhone}_${agent.id}`);
  if (!conversation) {
    conversation = await storage.createConversation({
      agentId: agent.id,
      sessionId: `whatsapp_${userPhone}_${agent.id}`,
      messages: [],
      leadData: { phone: userPhone },
    });
  }

  // Add user message to conversation
  const userChatMessage = {
    role: 'user' as const,
    content: userMessage,
    timestamp: new Date().toISOString(),
  };

  const updatedMessages = [...(conversation.messages || []), userChatMessage];

  // Generate LLM response
  const chatMessages = [
    { role: 'system' as const, content: agent.systemPrompt },
    ...updatedMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  ];

  const aiResponse = await generateChatResponse(chatMessages, agent.llmProvider);
  
  // Add AI response to conversation
  const aiChatMessage = {
    role: 'assistant' as const,
    content: aiResponse,
    timestamp: new Date().toISOString(),
  };

  const finalMessages = [...updatedMessages, aiChatMessage];

  // Update conversation in database
  await storage.updateConversation(conversation.id, {
    messages: finalMessages,
  });

  // Send LLM response back to WhatsApp
  if (agent.whatsappAccessToken) {
    await sendWhatsAppMessage(userPhone, aiResponse, agent.whatsappAccessToken);
  }

  // Lead qualification after multiple exchanges
  if (finalMessages.length >= 4) {
    const conversationText = finalMessages.map(m => `${m.role}: ${m.content}`).join('\n');
    const qualification = await qualifyLead(conversationText, agent.leadQualificationQuestions || []);
    
    await storage.updateConversation(conversation.id, {
      leadData: { ...conversation.leadData, ...qualification.extractedData, phone: userPhone },
      conversionScore: qualification.score,
      callScheduled: qualification.recommendation === 'call',
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Agent routes
  app.get("/api/agents", async (req, res) => {
    try {
      const agents = await storage.getAllAgents();
      res.json(agents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });

  app.get("/api/agents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch agent" });
    }
  });

  app.post("/api/agents", async (req, res) => {
    try {
      const validatedData = insertAgentSchema.parse(req.body);
      const agent = await storage.createAgent(validatedData);
      res.status(201).json(agent);
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid agent data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create agent" });
    }
  });

  app.put("/api/agents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertAgentSchema.partial().parse(req.body);
      const agent = await storage.updateAgent(id, validatedData);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid agent data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update agent" });
    }
  });

  app.delete("/api/agents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteAgent(id);
      if (!deleted) {
        return res.status(404).json({ message: "Agent not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete agent" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Analytics routes
  app.get("/api/analytics/agent/:id", async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const analytics = await storage.getAnalyticsByAgent(agentId);
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // WhatsApp Business webhook for incoming messages
  app.post("/api/whatsapp/webhook/:apiKey", async (req, res) => {
    try {
      const { apiKey } = req.params;
      const webhookData = req.body;
      
      // Verify webhook (WhatsApp Business API format)
      if (webhookData.object === 'whatsapp_business_account') {
        const agent = await storage.getAgentByApiKey(apiKey);
        if (!agent || agent.status !== 'active') {
          return res.status(404).json({ message: "Agent not found or inactive" });
        }

        // Process incoming WhatsApp messages
        for (const entry of webhookData.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field === 'messages') {
              const messages = change.value.messages || [];
              
              for (const message of messages) {
                if (message.type === 'text') {
                  await processWhatsAppMessage(agent, message, change.value);
                }
              }
            }
          }
        }
      }
      
      res.status(200).json({ status: 'success' });
    } catch (error) {
      console.error("WhatsApp webhook error:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // WhatsApp webhook verification (GET request)
  app.get("/api/whatsapp/webhook/:apiKey", (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    // Verify the webhook
    if (mode === 'subscribe' && token === 'agentflow_verify_token') {
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Forbidden');
    }
  });

  // LLM-powered chat endpoint for web chat (backup)
  app.post("/api/widget/chat", async (req, res) => {
    try {
      const { apiKey, message, sessionId } = req.body;
      
      if (!apiKey || !message) {
        return res.status(400).json({ message: "API key and message are required" });
      }

      const agent = await storage.getAgentByApiKey(apiKey);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      if (agent.status !== 'active') {
        return res.status(403).json({ message: "Agent is not active" });
      }

      const currentSessionId = sessionId || nanoid();
      
      // Get or create conversation
      let conversation = await storage.getConversationBySession(currentSessionId);
      if (!conversation) {
        conversation = await storage.createConversation({
          agentId: agent.id,
          sessionId: currentSessionId,
          messages: [],
          leadData: {},
        });
      }

      // Add user message
      const userMessage = {
        role: 'user' as const,
        content: message,
        timestamp: new Date().toISOString(),
      };

      const updatedMessages = [...(conversation.messages || []), userMessage];

      // Generate AI response using LLM
      const chatMessages = [
        { role: 'system' as const, content: agent.systemPrompt },
        ...updatedMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      ];

      const aiResponse = await generateChatResponse(chatMessages, agent.llmProvider);
      
      // Add AI response
      const aiMessage = {
        role: 'assistant' as const,
        content: aiResponse,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, aiMessage];

      // Update conversation
      await storage.updateConversation(conversation.id, {
        messages: finalMessages,
      });

      // Check if we should qualify this lead
      if (finalMessages.length >= 4) {
        const conversationText = finalMessages.map(m => `${m.role}: ${m.content}`).join('\n');
        const qualification = await qualifyLead(conversationText, agent.leadQualificationQuestions || []);
        
        await storage.updateConversation(conversation.id, {
          leadData: qualification.extractedData,
          conversionScore: qualification.score,
          callScheduled: qualification.recommendation === 'call',
        });
      }

      // Generate WhatsApp handoff URL if conversation should transfer
      let whatsappHandoff = null;
      if (finalMessages.length >= 6 || aiResponse.toLowerCase().includes('contact') || aiResponse.toLowerCase().includes('speak')) {
        if (agent.whatsappNumber) {
          const handoffMessage = encodeURIComponent(`Continuing our conversation: ${finalMessages.slice(-2).map(m => m.content).join(' ')}`);
          const cleanNumber = agent.whatsappNumber.replace(/[^0-9]/g, '');
          whatsappHandoff = `https://wa.me/${cleanNumber}?text=${handoffMessage}`;
        }
      }

      res.json({
        response: aiResponse,
        sessionId: currentSessionId,
        whatsappHandoff,
        shouldTransfer: !!whatsappHandoff,
      });

    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ message: "Failed to process chat message" });
    }
  });

  // Widget tracking endpoint
  app.post("/api/widget/track", async (req, res) => {
    try {
      const { apiKey, action, timestamp } = req.body;
      
      if (!apiKey || !action) {
        return res.status(400).json({ message: "API key and action are required" });
      }

      const agent = await storage.getAgentByApiKey(apiKey);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      // Create analytics entry for tracking
      const today = new Date().toISOString().split('T')[0];
      await storage.createOrUpdateAnalytics({
        agentId: agent.id,
        date: today,
        totalInteractions: 1,
        whatsappRedirects: action === 'whatsapp_redirect' ? 1 : 0,
        conversions: 0,
        avgResponseTime: 0,
      });

      res.status(200).json({ status: 'tracked' });
    } catch (error) {
      res.status(500).json({ message: "Failed to track interaction" });
    }
  });

  // WhatsApp widget configuration endpoint
  app.get("/api/widget/config/:apiKey", async (req, res) => {
    try {
      const { apiKey } = req.params;
      const agent = await storage.getAgentByApiKey(apiKey);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      if (agent.status !== 'active') {
        return res.status(403).json({ message: "Agent is not active" });
      }

      res.json({
        welcomeMessage: agent.welcomeMessage,
        widgetColor: agent.widgetColor,
        widgetPosition: agent.widgetPosition,
        whatsappNumber: agent.whatsappNumber,
        whatsappMode: agent.whatsappMode,
        enableChat: true, // Enable LLM chat functionality
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch widget configuration" });
    }
  });

  // Generate secure embed code endpoint
  app.get("/api/agents/:id/embed-code", async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const agent = await storage.getAgent(agentId);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      // Create encrypted configuration using base64 encoding for simplicity
      const widgetConfig = {
        apiKey: agent.apiKey,
        position: agent.widgetPosition,
        color: agent.widgetColor,
        welcomeMessage: agent.welcomeMessage,
        whatsappNumber: agent.whatsappNumber,
        whatsappMode: agent.whatsappMode || 'web',
        timestamp: Date.now()
      };
      
      const encryptedConfig = btoa(JSON.stringify(widgetConfig));

      // Generate both secure and legacy embed codes
      const secureEmbedCode = `<!-- AgentFlow Secure Widget -->
<script>
(function() {
    var agentflowWidget = document.createElement('script');
    agentflowWidget.src = '${req.protocol}://${req.get('host')}/widget/agentflow-widget.js';
    agentflowWidget.setAttribute('data-agent-config', '${encryptedConfig}');
    agentflowWidget.async = true;
    document.head.appendChild(agentflowWidget);
})();
</script>
<!-- End AgentFlow Widget -->`;

      const legacyEmbedCode = `<!-- AgentFlow Widget (Legacy) -->
<script>
(function() {
    var agentflowWidget = document.createElement('script');
    agentflowWidget.src = '${req.protocol}://${req.get('host')}/widget/agentflow-widget.js';
    agentflowWidget.setAttribute('data-agent-id', '${agent.apiKey}');
    agentflowWidget.setAttribute('data-position', '${agent.widgetPosition}');
    agentflowWidget.setAttribute('data-color', '${agent.widgetColor}');
    agentflowWidget.setAttribute('data-welcome-msg', '${agent.welcomeMessage}');
    agentflowWidget.async = true;
    document.head.appendChild(agentflowWidget);
})();
</script>
<!-- End AgentFlow Widget -->`;

      res.json({
        secureEmbedCode,
        legacyEmbedCode,
        agent: {
          id: agent.id,
          name: agent.name,
          widgetPosition: agent.widgetPosition,
          widgetColor: agent.widgetColor,
          welcomeMessage: agent.welcomeMessage
        }
      });

    } catch (error) {
      console.error("Error generating embed code:", error);
      res.status(500).json({ message: "Failed to generate embed code" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
