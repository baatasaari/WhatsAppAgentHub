import { AITrainingService } from './ai-training';
import { storage } from '../storage';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const googleAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

export class EnhancedAIService {
  
  /**
   * Get AI response with custom training enhancement
   */
  static async getEnhancedResponse(agentId: number, userMessage: string, context: any = {}) {
    try {
      // Get agent with custom training data
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      // Check if agent has custom training
      if (agent.customTraining?.trainingStatus === 'trained') {
        return await this.getCustomTrainedResponse(agent, userMessage, context);
      }

      // Use standard LLM response
      return await this.getStandardResponse(agent, userMessage, context);
    } catch (error) {
      console.error('Error getting enhanced response:', error);
      throw new Error('Failed to get AI response');
    }
  }

  /**
   * Get response using custom training data
   */
  private static async getCustomTrainedResponse(agent: any, userMessage: string, context: any) {
    try {
      // Search knowledge base for relevant context
      const knowledgeContext = await AITrainingService.searchKnowledgeBase(agent.id, userMessage, 3);
      
      // Find relevant training examples
      const relevantExamples = this.findRelevantTrainingExamples(
        agent.customTraining.trainingData,
        userMessage
      );

      // Build enhanced system prompt
      const systemPrompt = this.buildEnhancedSystemPrompt(
        agent,
        knowledgeContext,
        relevantExamples
      );

      // Get response based on LLM provider
      const response = await this.getLLMResponse(
        agent.llmProvider,
        agent.model,
        systemPrompt,
        userMessage
      );

      return {
        response,
        knowledgeUsed: knowledgeContext,
        trainingExamplesUsed: relevantExamples,
        customTrainingUsed: true,
        modelVersion: agent.customTraining.modelVersion,
        enhancementType: 'custom_trained'
      };
    } catch (error) {
      console.error('Error getting custom trained response:', error);
      // Fallback to standard response
      return await this.getStandardResponse(agent, userMessage, context);
    }
  }

  /**
   * Get standard LLM response without custom training
   */
  private static async getStandardResponse(agent: any, userMessage: string, context: any) {
    try {
      const response = await this.getLLMResponse(
        agent.llmProvider,
        agent.model,
        agent.systemPrompt,
        userMessage
      );

      return {
        response,
        customTrainingUsed: false,
        enhancementType: 'standard'
      };
    } catch (error) {
      console.error('Error getting standard response:', error);
      throw error;
    }
  }

  /**
   * Get response from specific LLM provider
   */
  private static async getLLMResponse(
    provider: string,
    model: string,
    systemPrompt: string,
    userMessage: string
  ): Promise<string> {
    switch (provider) {
      case 'openai':
        const openaiResponse = await openai.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 500,
        });
        return openaiResponse.choices[0].message.content || '';

      case 'anthropic':
        const anthropicResponse = await anthropic.messages.create({
          model,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
          max_tokens: 500,
        });
        return anthropicResponse.content[0].type === 'text' ? anthropicResponse.content[0].text : '';

      case 'google':
        const googleModel = googleAI.getGenerativeModel({ model });
        const googleResponse = await googleModel.generateContent(`${systemPrompt}\n\nUser: ${userMessage}`);
        return googleResponse.response.text();

      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }

  /**
   * Find relevant training examples using similarity matching
   */
  private static findRelevantTrainingExamples(
    trainingData: any[],
    userMessage: string,
    limit: number = 3
  ) {
    if (!trainingData || trainingData.length === 0) {
      return [];
    }

    // Simple keyword-based matching (could be enhanced with embeddings)
    const userWords = userMessage.toLowerCase().split(' ');
    
    const scoredExamples = trainingData.map(example => {
      const inputWords = example.input.toLowerCase().split(' ');
      const commonWords = userWords.filter(word => inputWords.includes(word));
      const similarity = commonWords.length / Math.max(userWords.length, inputWords.length);
      
      return {
        ...example,
        similarity: similarity * example.weight
      };
    });

    return scoredExamples
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .filter(example => example.similarity > 0.1); // Minimum similarity threshold
  }

  /**
   * Build enhanced system prompt with training context
   */
  private static buildEnhancedSystemPrompt(
    agent: any,
    knowledgeContext: any[],
    trainingExamples: any[]
  ): string {
    const { brandVoice, businessContext } = agent.customTraining;
    
    let prompt = agent.systemPrompt + '\n\n';
    
    // Add brand voice guidelines
    prompt += `BRAND VOICE & COMMUNICATION STYLE:
- Tone: ${brandVoice.tone}
- Personality: ${brandVoice.personality}
- Communication Style: ${brandVoice.communicationStyle}
`;

    if (brandVoice.dosList && brandVoice.dosList.length > 0) {
      prompt += `- Always: ${brandVoice.dosList.join(', ')}\n`;
    }
    
    if (brandVoice.dontsList && brandVoice.dontsList.length > 0) {
      prompt += `- Never: ${brandVoice.dontsList.join(', ')}\n`;
    }

    // Add business context
    prompt += `\nBUSINESS CONTEXT:
- Industry: ${businessContext.industry}
- Company Size: ${businessContext.companySize}
- Target Audience: ${businessContext.targetAudience}
- Value Proposition: ${businessContext.valueProposition}
`;

    if (businessContext.keyProducts && businessContext.keyProducts.length > 0) {
      prompt += `- Key Products/Services: ${businessContext.keyProducts.join(', ')}\n`;
    }

    // Add relevant knowledge base context
    if (knowledgeContext.length > 0) {
      prompt += '\nRELEVANT KNOWLEDGE BASE:\n';
      knowledgeContext.forEach((item, index) => {
        prompt += `${index + 1}. ${item.title}\n${item.content}\n\n`;
      });
    }

    // Add training examples for reference
    if (trainingExamples.length > 0) {
      prompt += '\nTRAINING EXAMPLES FOR REFERENCE:\n';
      trainingExamples.forEach((example, index) => {
        prompt += `Example ${index + 1}:\n`;
        prompt += `Customer: ${example.input}\n`;
        prompt += `Response: ${example.expectedOutput}\n\n`;
      });
    }

    prompt += '\nUse this context to provide accurate, on-brand responses that align with the business goals and communication style. Follow the training examples as guidance for response quality and tone.';

    return prompt;
  }

  /**
   * Analyze conversation for training improvements
   */
  static async analyzeConversationForTraining(
    agentId: number,
    conversations: Array<{ input: string; response: string; feedback?: string }>
  ) {
    try {
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      const analysis = {
        totalConversations: conversations.length,
        improvementSuggestions: [],
        newTrainingCandidates: [],
        brandVoiceConsistency: 0,
        responseQuality: 0
      };

      // Analyze each conversation
      for (const conv of conversations) {
        // Check brand voice consistency
        if (agent.customTraining?.brandVoice) {
          const consistency = this.analyzeBrandVoiceConsistency(
            conv.response,
            agent.customTraining.brandVoice
          );
          analysis.brandVoiceConsistency += consistency;
        }

        // Identify potential training examples
        if (conv.feedback && conv.feedback === 'positive') {
          analysis.newTrainingCandidates.push({
            input: conv.input,
            expectedOutput: conv.response,
            category: 'successful_interaction',
            weight: 1
          });
        }
      }

      // Calculate averages
      analysis.brandVoiceConsistency /= conversations.length;
      analysis.responseQuality = analysis.newTrainingCandidates.length / conversations.length;

      return analysis;
    } catch (error) {
      console.error('Error analyzing conversation for training:', error);
      throw new Error('Failed to analyze conversation');
    }
  }

  /**
   * Analyze brand voice consistency in response
   */
  private static analyzeBrandVoiceConsistency(response: string, brandVoice: any): number {
    let score = 0.5; // Base score

    // Check tone keywords
    const toneKeywords = {
      professional: ['please', 'thank you', 'appreciate', 'assist'],
      friendly: ['happy', 'glad', 'excited', 'wonderful'],
      casual: ['hey', 'cool', 'awesome', 'no problem'],
      formal: ['kindly', 'respectfully', 'accordingly', 'furthermore']
    };

    const responseLower = response.toLowerCase();
    const relevantKeywords = toneKeywords[brandVoice.tone as keyof typeof toneKeywords] || [];
    
    const matchedKeywords = relevantKeywords.filter(keyword => 
      responseLower.includes(keyword)
    );

    if (matchedKeywords.length > 0) {
      score += 0.3;
    }

    // Check for prohibited words/phrases
    if (brandVoice.dontsList) {
      const prohibitedFound = brandVoice.dontsList.some((item: string) =>
        responseLower.includes(item.toLowerCase())
      );
      if (prohibitedFound) {
        score -= 0.4;
      }
    }

    // Check for required elements
    if (brandVoice.dosList) {
      const requiredFound = brandVoice.dosList.some((item: string) =>
        responseLower.includes(item.toLowerCase())
      );
      if (requiredFound) {
        score += 0.2;
      }
    }

    return Math.max(0, Math.min(1, score));
  }
}