import { agents, conversations, analytics, type Agent, type InsertAgent, type Conversation, type InsertConversation, type Analytics, type InsertAnalytics } from "@shared/schema";
import { db } from "./db";
import { eq, and, count, sql } from "drizzle-orm";
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
  getAnalyticsByTimeRange(agentId: number, startDate: string, endDate: string): Promise<Analytics[]>;
  createOrUpdateAnalytics(analytics: InsertAnalytics): Promise<Analytics>;
  getDashboardStats(): Promise<{
    totalAgents: number;
    activeAgents: number;
    totalConversations: number;
    averageConversionRate: number;
  }>;
  getAgentCostAnalytics(agentId: number): Promise<{
    hourly: number;
    daily: number;
    weekly: number;
    monthly: number;
    allTime: number;
    currency: string;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getAgent(id: number): Promise<Agent | undefined> {
    try {
      const [agent] = await db.select().from(agents).where(eq(agents.id, id));
      return agent || undefined;
    } catch (error) {
      console.error('Error getting agent:', error);
      return undefined;
    }
  }

  async getAgentByApiKey(apiKey: string): Promise<Agent | undefined> {
    try {
      const [agent] = await db.select().from(agents).where(eq(agents.apiKey, apiKey));
      return agent || undefined;
    } catch (error) {
      console.error('Error getting agent by API key:', error);
      return undefined;
    }
  }

  async getAllAgents(): Promise<Agent[]> {
    try {
      return await db.select().from(agents);
    } catch (error) {
      console.error('Error getting all agents:', error);
      return [];
    }
  }

  async createAgent(insertAgent: InsertAgent): Promise<Agent> {
    try {
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
          whatsappNumber: insertAgent.whatsappNumber || null,
          whatsappMode: insertAgent.whatsappMode || 'web',
          status: insertAgent.status || 'active',
          apiKey
        } as any)
        .returning();
      return agent;
    } catch (error) {
      console.error('Error creating agent:', error);
      throw error;
    }
  }

  async updateAgent(id: number, updates: Partial<InsertAgent>): Promise<Agent | undefined> {
    try {
      const [agent] = await db
        .update(agents)
        .set(updates as any)
        .where(eq(agents.id, id))
        .returning();
      return agent || undefined;
    } catch (error) {
      console.error('Error updating agent:', error);
      return undefined;
    }
  }

  async deleteAgent(id: number): Promise<boolean> {
    try {
      const result = await db.delete(agents).where(eq(agents.id, id));
      return true; // Assume success if no error thrown
    } catch (error) {
      console.error('Error deleting agent:', error);
      return false;
    }
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    try {
      const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
      return conversation || undefined;
    } catch (error) {
      console.error('Error getting conversation:', error);
      return undefined;
    }
  }

  async getConversationBySession(sessionId: string): Promise<Conversation | undefined> {
    try {
      const [conversation] = await db.select().from(conversations).where(eq(conversations.sessionId, sessionId));
      return conversation || undefined;
    } catch (error) {
      console.error('Error getting conversation by session:', error);
      return undefined;
    }
  }

  async getConversationsByAgent(agentId: number): Promise<Conversation[]> {
    try {
      return await db.select().from(conversations).where(eq(conversations.agentId, agentId));
    } catch (error) {
      console.error('Error getting conversations by agent:', error);
      return [];
    }
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    try {
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
        } as any)
        .returning();
      return conversation;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  async updateConversation(id: number, updates: Partial<InsertConversation>): Promise<Conversation | undefined> {
    try {
      const [conversation] = await db
        .update(conversations)
        .set({ ...updates, updatedAt: new Date() } as any)
        .where(eq(conversations.id, id))
        .returning();
      return conversation || undefined;
    } catch (error) {
      console.error('Error updating conversation:', error);
      return undefined;
    }
  }

  async getAnalyticsByAgent(agentId: number): Promise<Analytics[]> {
    try {
      return await db.select().from(analytics).where(eq(analytics.agentId, agentId));
    } catch (error) {
      console.error('Error getting analytics by agent:', error);
      return [];
    }
  }

  async getAnalyticsByDate(date: string): Promise<Analytics[]> {
    try {
      return await db.select().from(analytics).where(eq(analytics.date, date));
    } catch (error) {
      console.error('Error getting analytics by date:', error);
      return [];
    }
  }

  async createOrUpdateAnalytics(insertAnalytics: InsertAnalytics): Promise<Analytics> {
    try {
      const existing = await db
        .select()
        .from(analytics)
        .where(and(eq(analytics.agentId, insertAnalytics.agentId), eq(analytics.date, insertAnalytics.date)));

      if (existing.length > 0) {
        const [updated] = await db
          .update(analytics)
          .set(insertAnalytics as any)
          .where(eq(analytics.id, existing[0].id))
          .returning();
        return updated;
      } else {
        const [created] = await db
          .insert(analytics)
          .values(insertAnalytics as any)
          .returning();
        return created;
      }
    } catch (error) {
      console.error('Error creating/updating analytics:', error);
      throw error;
    }
  }

  async getAnalyticsByTimeRange(agentId: number, startDate: string, endDate: string): Promise<Analytics[]> {
    return await db.select().from(analytics)
      .where(
        and(
          eq(analytics.agentId, agentId),
          sql`${analytics.date} >= ${startDate}`,
          sql`${analytics.date} <= ${endDate}`
        )
      )
      .orderBy(analytics.date);
  }

  async getAgentCostAnalytics(agentId: number): Promise<{
    hourly: number;
    daily: number;
    weekly: number;
    monthly: number;
    allTime: number;
    currency: string;
  }> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const today = now.toISOString().split('T')[0];
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get analytics data for different time periods
      const hourlyData = await db.select().from(analytics)
        .where(
          and(
            eq(analytics.agentId, agentId),
            eq(analytics.date, today)
          )
        );

      const dailyData = await db.select().from(analytics)
        .where(
          and(
            eq(analytics.agentId, agentId),
            eq(analytics.date, today)
          )
        );

      const weeklyData = await db.select().from(analytics)
        .where(eq(analytics.agentId, agentId));

      const monthlyData = await db.select().from(analytics)
        .where(eq(analytics.agentId, agentId));

      const allTimeData = await db.select().from(analytics)
        .where(eq(analytics.agentId, agentId));

      const calculateTotalCost = (data: Analytics[]) => {
        return data.reduce((total, record) => {
          const costs = record.llmCosts as any;
          return total + (costs?.totalCost || 0);
        }, 0);
      };

      // Filter data by time periods
      const weeklyFiltered = weeklyData.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= oneWeekAgo;
      });

      const monthlyFiltered = monthlyData.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= oneMonthAgo;
      });

      return {
        hourly: calculateTotalCost(hourlyData) * 0.1, // Estimate hourly from daily
        daily: calculateTotalCost(dailyData),
        weekly: calculateTotalCost(weeklyFiltered),
        monthly: calculateTotalCost(monthlyFiltered),
        allTime: calculateTotalCost(allTimeData),
        currency: 'USD'
      };
    } catch (error) {
      console.error('Error calculating cost analytics:', error);
      return {
        hourly: 0,
        daily: 0,
        weekly: 0,
        monthly: 0,
        allTime: 0,
        currency: 'USD'
      };
    }
  }

  async getDashboardStats(): Promise<{
    totalAgents: number;
    activeAgents: number;
    totalConversations: number;
    averageConversionRate: number;
  }> {
    try {
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
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      return {
        totalAgents: 0,
        activeAgents: 0,
        totalConversations: 0,
        averageConversionRate: 0,
      };
    }
  }
}

export const storage = new DatabaseStorage();
