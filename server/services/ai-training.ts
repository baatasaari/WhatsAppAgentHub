import OpenAI from 'openai';
import { db } from '../db';
import { agents, trainingSessions, trainingExamples, knowledgeItems } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class AITrainingService {
  
  /**
   * Generate embeddings for knowledge base content
   */
  static async generateEmbeddings(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
      });
      
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error generating embeddings:', error);
      throw new Error('Failed to generate embeddings');
    }
  }

  /**
   * Add knowledge item to agent's knowledge base
   */
  static async addKnowledgeItem(agentId: number, userId: number, data: {
    title: string;
    content: string;
    category: string;
    tags: string[];
    metadata?: Record<string, any>;
  }) {
    try {
      // Generate embeddings for the content
      const embedding = await this.generateEmbeddings(`${data.title}\n${data.content}`);
      
      const [knowledgeItem] = await db
        .insert(knowledgeItems)
        .values({
          agentId,
          userId,
          title: data.title,
          content: data.content,
          category: data.category,
          tags: data.tags,
          embedding,
          metadata: data.metadata || {},
        })
        .returning();

      return knowledgeItem;
    } catch (error) {
      console.error('Error adding knowledge item:', error);
      throw new Error('Failed to add knowledge item');
    }
  }

  /**
   * Search knowledge base using semantic similarity
   */
  static async searchKnowledgeBase(agentId: number, query: string, limit: number = 5) {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbeddings(query);
      
      // Get all knowledge items for the agent
      const items = await db
        .select()
        .from(knowledgeItems)
        .where(and(
          eq(knowledgeItems.agentId, agentId),
          eq(knowledgeItems.isActive, true)
        ));

      // Calculate cosine similarity and rank results
      const results = items
        .map(item => ({
          ...item,
          similarity: this.cosineSimilarity(queryEmbedding, item.embedding || [])
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      return results;
    } catch (error) {
      console.error('Error searching knowledge base:', error);
      throw new Error('Failed to search knowledge base');
    }
  }

  /**
   * Create a custom training session
   */
  static async createTrainingSession(agentId: number, userId: number, data: {
    sessionName: string;
    trainingData: Array<{
      input: string;
      expectedOutput: string;
      category: string;
      weight?: number;
    }>;
    brandVoiceConfig: {
      tone: string;
      personality: string;
      communicationStyle: string;
      dosList: string[];
      dontsList: string[];
    };
    businessContextConfig: {
      industry: string;
      companySize: string;
      targetAudience: string;
      keyProducts: string[];
      valueProposition: string;
    };
  }) {
    try {
      // Create training session
      const [session] = await db
        .insert(trainingSessions)
        .values({
          agentId,
          userId,
          sessionName: data.sessionName,
          trainingData: data.trainingData.map(item => ({
            id: uuidv4(),
            ...item,
            weight: item.weight || 1
          })),
          brandVoiceConfig: data.brandVoiceConfig,
          businessContextConfig: data.businessContextConfig,
          status: 'pending',
          progressPercentage: 0,
        })
        .returning();

      // Add individual training examples
      const examples = data.trainingData.map(item => ({
        agentId,
        userId,
        sessionId: session.id,
        inputText: item.input,
        expectedOutput: item.expectedOutput,
        category: item.category,
        weight: item.weight || 1,
      }));

      await db.insert(trainingExamples).values(examples);

      // Start training process (async)
      this.processTrainingSession(session.id);

      return session;
    } catch (error) {
      console.error('Error creating training session:', error);
      throw new Error('Failed to create training session');
    }
  }

  /**
   * Process training session (simulated training pipeline)
   */
  static async processTrainingSession(sessionId: number) {
    try {
      // Update status to processing
      await db
        .update(trainingSessions)
        .set({ 
          status: 'processing',
          progressPercentage: 10 
        })
        .where(eq(trainingSessions.id, sessionId));

      // Get session data
      const [session] = await db
        .select()
        .from(trainingSessions)
        .where(eq(trainingSessions.id, sessionId));

      if (!session) {
        throw new Error('Training session not found');
      }

      // Simulate training progress updates
      const progressUpdates = [25, 50, 75, 90];
      for (const progress of progressUpdates) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing time
        
        await db
          .update(trainingSessions)
          .set({ progressPercentage: progress })
          .where(eq(trainingSessions.id, sessionId));
      }

      // Generate training metrics (simulated)
      const metrics = {
        accuracy: Math.random() * 0.3 + 0.7, // 70-100%
        trainingTime: Math.floor(Math.random() * 300 + 60), // 1-5 minutes
        dataPoints: session.trainingData.length,
        improvementScore: Math.random() * 0.4 + 0.6, // 60-100%
      };

      // Update agent with custom training data
      await db
        .update(agents)
        .set({
          customTraining: {
            trainingData: session.trainingData,
            brandVoice: session.brandVoiceConfig!,
            businessContext: session.businessContextConfig!,
            trainingStatus: 'trained',
            lastTrainingDate: new Date().toISOString(),
            modelVersion: `custom-${sessionId}`,
          }
        })
        .where(eq(agents.id, session.agentId));

      // Complete training session
      await db
        .update(trainingSessions)
        .set({ 
          status: 'completed',
          progressPercentage: 100,
          metrics,
          completedAt: new Date(),
          modelCheckpoint: `checkpoint-${sessionId}-${Date.now()}`
        })
        .where(eq(trainingSessions.id, sessionId));

    } catch (error) {
      console.error('Error processing training session:', error);
      
      // Mark session as failed
      await db
        .update(trainingSessions)
        .set({ 
          status: 'failed',
          errorLog: error instanceof Error ? error.message : 'Unknown error'
        })
        .where(eq(trainingSessions.id, sessionId));
    }
  }

  /**
   * Get enhanced agent response using custom training
   */
  static async getEnhancedResponse(agentId: number, userMessage: string, context: any = {}) {
    try {
      // Get agent with custom training data
      const [agent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, agentId));

      if (!agent || !agent.customTraining || agent.customTraining.trainingStatus !== 'trained') {
        return null; // Use default LLM response
      }

      // Search knowledge base for relevant context
      const knowledgeContext = await this.searchKnowledgeBase(agentId, userMessage, 3);
      
      // Build enhanced prompt with custom training context
      const systemPrompt = this.buildEnhancedSystemPrompt(agent, knowledgeContext);
      
      // Get LLM response with enhanced context
      const response = await openai.chat.completions.create({
        model: agent.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      return {
        response: response.choices[0].message.content,
        knowledgeUsed: knowledgeContext,
        customTrainingUsed: true,
        modelVersion: agent.customTraining.modelVersion
      };

    } catch (error) {
      console.error('Error getting enhanced response:', error);
      return null;
    }
  }

  /**
   * Build enhanced system prompt with custom training context
   */
  private static buildEnhancedSystemPrompt(agent: any, knowledgeContext: any[]) {
    const { brandVoice, businessContext } = agent.customTraining;
    
    let prompt = agent.systemPrompt + '\n\n';
    
    // Add brand voice guidelines
    prompt += `BRAND VOICE & COMMUNICATION STYLE:
- Tone: ${brandVoice.tone}
- Personality: ${brandVoice.personality}
- Communication Style: ${brandVoice.communicationStyle}
`;

    if (brandVoice.dosList.length > 0) {
      prompt += `- Always: ${brandVoice.dosList.join(', ')}\n`;
    }
    
    if (brandVoice.dontsList.length > 0) {
      prompt += `- Never: ${brandVoice.dontsList.join(', ')}\n`;
    }

    // Add business context
    prompt += `\nBUSINESS CONTEXT:
- Industry: ${businessContext.industry}
- Company Size: ${businessContext.companySize}
- Target Audience: ${businessContext.targetAudience}
- Value Proposition: ${businessContext.valueProposition}
`;

    if (businessContext.keyProducts.length > 0) {
      prompt += `- Key Products/Services: ${businessContext.keyProducts.join(', ')}\n`;
    }

    // Add relevant knowledge base context
    if (knowledgeContext.length > 0) {
      prompt += '\nRELEVANT KNOWLEDGE BASE:\n';
      knowledgeContext.forEach((item, index) => {
        prompt += `${index + 1}. ${item.title}\n${item.content}\n\n`;
      });
    }

    prompt += '\nUse this context to provide accurate, on-brand responses that align with the business goals and communication style.';

    return prompt;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Get training session status
   */
  static async getTrainingSessionStatus(sessionId: number) {
    try {
      const [session] = await db
        .select()
        .from(trainingSessions)
        .where(eq(trainingSessions.id, sessionId));

      return session;
    } catch (error) {
      console.error('Error getting training session status:', error);
      throw new Error('Failed to get training session status');
    }
  }

  /**
   * Validate training data quality
   */
  static validateTrainingData(trainingData: Array<{ input: string; expectedOutput: string; category: string }>) {
    const issues = [];
    
    trainingData.forEach((item, index) => {
      if (!item.input || item.input.trim().length < 5) {
        issues.push(`Item ${index + 1}: Input too short (minimum 5 characters)`);
      }
      
      if (!item.expectedOutput || item.expectedOutput.trim().length < 10) {
        issues.push(`Item ${index + 1}: Expected output too short (minimum 10 characters)`);
      }
      
      if (!item.category || item.category.trim().length === 0) {
        issues.push(`Item ${index + 1}: Category is required`);
      }
    });

    if (trainingData.length < 5) {
      issues.push('Minimum 5 training examples required for effective training');
    }

    if (trainingData.length > 1000) {
      issues.push('Maximum 1000 training examples allowed per session');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }
}