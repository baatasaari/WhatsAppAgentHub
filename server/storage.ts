import { agents, conversations, analytics, type Agent, type InsertAgent, type Conversation, type InsertConversation, type Analytics, type InsertAnalytics } from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export interface IStorage {
  // Agent operations
  getAgent(id: number): Promise<Agent | undefined>;
  getAgentByApiKey(apiKey: string): Promise<Agent | undefined>;
  getAllAgents(): Promise<Agent[]>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: number, updates: Partial<InsertAgent>): Promise<Agent | undefined>;
  deleteAgent(id: number): Promise<boolean>;

  // Conversation operations
  getConversation(id: number): Promise<Conversation | undefined>;
  getConversationBySession(sessionId: string): Promise<Conversation | undefined>;
  getConversationsByAgent(agentId: number): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: number, updates: Partial<InsertConversation>): Promise<Conversation | undefined>;

  // Analytics operations
  getAnalyticsByAgent(agentId: number): Promise<Analytics[]>;
  getAnalyticsByDate(date: string): Promise<Analytics[]>;
  createOrUpdateAnalytics(analytics: InsertAnalytics): Promise<Analytics>;
  getDashboardStats(): Promise<{
    totalAgents: number;
    activeAgents: number;
    totalConversations: number;
    averageConversionRate: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getAgent(id: number): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent || undefined;
  }

  async getAgentByApiKey(apiKey: string): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.apiKey, apiKey));
    return agent || undefined;
  }

  async getAllAgents(): Promise<Agent[]> {
    return await db.select().from(agents);
  }

  async createAgent(insertAgent: InsertAgent): Promise<Agent> {
    const apiKey = `af_${nanoid(20)}`;
    const [agent] = await db
      .insert(agents)
      .values({
        name: insertAgent.name,
        businessCategory: insertAgent.businessCategory || null,
        llmProvider: insertAgent.llmProvider,
        systemPrompt: insertAgent.systemPrompt,
        leadQualificationQuestions: insertAgent.leadQualificationQuestions || [],
        voiceProvider: insertAgent.voiceProvider || 'elevenlabs',
        voiceModel: insertAgent.voiceModel || 'professional-male',
        callScript: insertAgent.callScript || null,
        widgetPosition: insertAgent.widgetPosition || 'bottom-right',
        widgetColor: insertAgent.widgetColor || '#25D366',
        welcomeMessage: insertAgent.welcomeMessage || 'Hi! How can I help you today?',
        status: insertAgent.status || 'active',
        apiKey
      })
      .returning();
    return agent;
  }

  async updateAgent(id: number, updates: Partial<InsertAgent>): Promise<Agent | undefined> {
    const [agent] = await db
      .update(agents)
      .set(updates)
      .where(eq(agents.id, id))
      .returning();
    return agent || undefined;
  }

  async deleteAgent(id: number): Promise<boolean> {
    const result = await db.delete(agents).where(eq(agents.id, id));
    return (result as any).rowCount > 0;
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conversation || undefined;
  }

  async getConversationBySession(sessionId: string): Promise<Conversation | undefined> {
    const [conversation] = await db.select().from(conversations).where(eq(conversations.sessionId, sessionId));
    return conversation || undefined;
  }

  async getConversationsByAgent(agentId: number): Promise<Conversation[]> {
    return await db.select().from(conversations).where(eq(conversations.agentId, agentId));
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const [conversation] = await db
      .insert(conversations)
      .values({
        agentId: insertConversation.agentId,
        sessionId: insertConversation.sessionId,
        messages: insertConversation.messages || [],
        leadData: insertConversation.leadData || {},
        status: insertConversation.status || 'active',
        conversionScore: insertConversation.conversionScore || 0,
        callScheduled: insertConversation.callScheduled || false
      })
      .returning();
    return conversation;
  }

  async updateConversation(id: number, updates: Partial<InsertConversation>): Promise<Conversation | undefined> {
    const [conversation] = await db
      .update(conversations)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return conversation || undefined;
  }

  async getAnalyticsByAgent(agentId: number): Promise<Analytics[]> {
    return await db.select().from(analytics).where(eq(analytics.agentId, agentId));
  }

  async getAnalyticsByDate(date: string): Promise<Analytics[]> {
    return await db.select().from(analytics).where(eq(analytics.date, date));
  }

  async createOrUpdateAnalytics(insertAnalytics: InsertAnalytics): Promise<Analytics> {
    const existing = await db
      .select()
      .from(analytics)
      .where(and(eq(analytics.agentId, insertAnalytics.agentId), eq(analytics.date, insertAnalytics.date)));

    if (existing.length > 0) {
      const [updated] = await db
        .update(analytics)
        .set(insertAnalytics)
        .where(eq(analytics.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(analytics)
        .values(insertAnalytics)
        .returning();
      return created;
    }
  }

  async getDashboardStats(): Promise<{
    totalAgents: number;
    activeAgents: number;
    totalConversations: number;
    averageConversionRate: number;
  }> {
    const allAgents = await db.select().from(agents);
    const totalAgents = allAgents.length;
    const activeAgents = allAgents.filter(agent => agent.status === 'active').length;
    
    const allConversations = await db.select().from(conversations);
    const totalConversations = allConversations.length;
    
    const allAnalytics = await db.select().from(analytics);
    const totalConversions = allAnalytics.reduce((sum, a) => sum + (a.conversions || 0), 0);
    const totalConvs = allAnalytics.reduce((sum, a) => sum + (a.totalConversations || 0), 0);
    const averageConversionRate = totalConvs > 0 ? Math.round((totalConversions / totalConvs) * 100) : 0;

    return {
      totalAgents,
      activeAgents,
      totalConversations,
      averageConversionRate,
    };
  }
}

export const storage = new DatabaseStorage();
