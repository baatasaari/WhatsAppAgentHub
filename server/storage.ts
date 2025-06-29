import { 
  agents, 
  conversations, 
  analytics, 
  users, 
  sessions,
  whatsappMessages,
  voiceCalls,
  voiceCallTriggers,
  voiceCallAnalytics,
  businessOnboarding,
  subscriptions,
  usageMetrics,

  type Agent, 
  type InsertAgent, 
  type Conversation, 
  type InsertConversation, 
  type Analytics, 
  type InsertAnalytics,
  type User,
  type InsertUser,
  type UpdateUser,
  type Session,
  type InsertSession,
  type WhatsappMessage,
  type InsertWhatsappMessage,
  type VoiceCall,
  type InsertVoiceCall,
  type VoiceCallTrigger,
  type InsertVoiceCallTrigger,
  type VoiceCallAnalytics,
  type InsertVoiceCallAnalytics,
  type BusinessOnboarding,
  type InsertBusinessOnboarding,


} from "@shared/schema";
import { db } from "./db";
import { eq, and, count, sql, desc, gte, lte } from "drizzle-orm";
import { nanoid } from "nanoid";
import { AuthService } from "./auth";

export interface IStorage {
  // User operations
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  getPendingUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: UpdateUser): Promise<User | undefined>;
  approveUser(userId: number, adminId: number): Promise<User | undefined>;
  suspendUser(userId: number): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;

  // Agent operations
  getAgent(id: number): Promise<Agent | undefined>;
  getAgentByApiKey(apiKey: string): Promise<Agent | undefined>;
  getAllAgents(userId?: number): Promise<Agent[]>;
  getUserAgents(userId: number): Promise<Agent[]>;
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

  // WhatsApp message operations
  createWhatsappMessage(message: InsertWhatsappMessage): Promise<WhatsappMessage>;
  getWhatsappMessagesByAgent(agentId: number): Promise<WhatsappMessage[]>;
  getWhatsappMessagesByConversation(conversationId: number): Promise<WhatsappMessage[]>;
  updateWhatsappMessageStatus(whatsappMessageId: string, status: string): Promise<void>;
  getWhatsappMessageById(whatsappMessageId: string): Promise<WhatsappMessage | undefined>;

  // B2B SaaS Business operations
  getUserSubscription(userId: number): Promise<any>;
  getUserUsageMetrics(userId: number, month: string): Promise<any>;
  getBusinessInsights(agentId: number): Promise<any>;
  createOrUpdateUsageMetrics(userId: number, agentId: number, metrics: any): Promise<void>;
  checkSubscriptionLimits(userId: number): Promise<{ withinLimits: boolean; usage: any; limits: any }>;

  // Business onboarding operations
  getBusinessOnboarding(userId: number): Promise<BusinessOnboarding | undefined>;
  createBusinessOnboarding(onboarding: InsertBusinessOnboarding): Promise<BusinessOnboarding>;
  updateBusinessOnboarding(userId: number, updates: Partial<InsertBusinessOnboarding>): Promise<BusinessOnboarding | undefined>;
  saveOnboardingStep(userId: number, step: number, stepData: any): Promise<BusinessOnboarding | undefined>;
  markStepCompleted(userId: number, step: number): Promise<BusinessOnboarding | undefined>;
  completeOnboarding(userId: number): Promise<BusinessOnboarding | undefined>;

  // AI Training operations
  addKnowledgeItem(agentId: number, userId: number, data: InsertKnowledgeItem): Promise<KnowledgeItem>;
  getKnowledgeItems(agentId: number): Promise<KnowledgeItem[]>;
  updateKnowledgeItem(id: number, updates: Partial<InsertKnowledgeItem>): Promise<KnowledgeItem | undefined>;
  deleteKnowledgeItem(id: number): Promise<boolean>;
  
  createTrainingSession(data: InsertTrainingSession): Promise<TrainingSession>;
  getTrainingSessions(agentId: number): Promise<TrainingSession[]>;
  getTrainingSession(id: number): Promise<TrainingSession | undefined>;
  updateTrainingSession(id: number, updates: Partial<InsertTrainingSession>): Promise<TrainingSession | undefined>;
  
  addTrainingExample(data: InsertTrainingExample): Promise<TrainingExample>;
  getTrainingExamples(agentId: number): Promise<TrainingExample[]>;

}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUserById(id: number): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user || undefined;
    } catch (error) {
      console.error('Error getting user by id:', error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user || undefined;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return undefined;
    }
  }

  async getAllUsers(): Promise<User[]> {
    try {
      return await db.select().from(users).orderBy(users.createdAt);
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  async getPendingUsers(): Promise<User[]> {
    try {
      return await db.select().from(users).where(eq(users.status, 'pending')).orderBy(users.createdAt);
    } catch (error) {
      console.error('Error getting pending users:', error);
      return [];
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const [user] = await db.insert(users).values(insertUser).returning();
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(id: number, updates: UpdateUser): Promise<User | undefined> {
    try {
      const [user] = await db.update(users)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();
      return user || undefined;
    } catch (error) {
      console.error('Error updating user:', error);
      return undefined;
    }
  }

  async approveUser(userId: number, adminId: number): Promise<User | undefined> {
    try {
      const [user] = await db.update(users)
        .set({ 
          status: 'approved', 
          approvedBy: adminId, 
          approvedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(users.id, userId))
        .returning();
      return user || undefined;
    } catch (error) {
      console.error('Error approving user:', error);
      return undefined;
    }
  }

  async suspendUser(userId: number): Promise<User | undefined> {
    try {
      const [user] = await db.update(users)
        .set({ status: 'suspended', updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();
      return user || undefined;
    } catch (error) {
      console.error('Error suspending user:', error);
      return undefined;
    }
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      const result = await db.delete(users).where(eq(users.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  // Agent operations
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

  async getAllAgents(userId?: number): Promise<Agent[]> {
    try {
      if (userId) {
        return await db.select().from(agents).where(eq(agents.userId, userId));
      }
      return await db.select().from(agents);
    } catch (error) {
      console.error('Error getting all agents:', error);
      return [];
    }
  }

  async getUserAgents(userId: number): Promise<Agent[]> {
    try {
      return await db.select().from(agents).where(eq(agents.userId, userId));
    } catch (error) {
      console.error('Error getting user agents:', error);
      return [];
    }
  }

  async createAgent(insertAgent: InsertAgent): Promise<Agent> {
    try {
      const [agent] = await db
        .insert(agents)
        .values(insertAgent)
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
      // Use SQL directly to avoid Drizzle schema issues
      const agentStats = await db.execute(sql`
        SELECT 
          COUNT(*) as total_agents,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_agents
        FROM agents
      `);
      
      const conversationStats = await db.execute(sql`
        SELECT COUNT(*) as total_conversations FROM conversations
      `);
      
      const analyticsStats = await db.execute(sql`
        SELECT 
          COALESCE(SUM(conversions), 0) as total_conversions,
          COALESCE(SUM(total_conversations), 0) as total_convs
        FROM analytics
      `);
      
      const agentData = agentStats.rows[0] as any;
      const conversationData = conversationStats.rows[0] as any;
      const analyticsData = analyticsStats.rows[0] as any;
      
      const totalAgents = parseInt(agentData.total_agents) || 0;
      const activeAgents = parseInt(agentData.active_agents) || 0;
      const totalConversations = parseInt(conversationData.total_conversations) || 0;
      const totalConversions = parseInt(analyticsData.total_conversions) || 0;
      const totalConvs = parseInt(analyticsData.total_convs) || 0;
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

  // WhatsApp message operations
  async createWhatsappMessage(insertMessage: InsertWhatsappMessage): Promise<WhatsappMessage> {
    try {
      const [message] = await db
        .insert(whatsappMessages)
        .values(insertMessage)
        .returning();
      return message;
    } catch (error) {
      console.error("Error creating WhatsApp message:", error);
      throw error;
    }
  }

  async getWhatsappMessagesByAgent(agentId: number): Promise<WhatsappMessage[]> {
    try {
      return await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.agentId, agentId))
        .orderBy(whatsappMessages.timestamp);
    } catch (error) {
      console.error("Error getting WhatsApp messages by agent:", error);
      return [];
    }
  }

  async getWhatsappMessagesByConversation(conversationId: number): Promise<WhatsappMessage[]> {
    try {
      return await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.conversationId, conversationId))
        .orderBy(whatsappMessages.timestamp);
    } catch (error) {
      console.error("Error getting WhatsApp messages by conversation:", error);
      return [];
    }
  }

  async updateWhatsappMessageStatus(whatsappMessageId: string, status: string): Promise<void> {
    try {
      await db
        .update(whatsappMessages)
        .set({ status })
        .where(eq(whatsappMessages.whatsappMessageId, whatsappMessageId));
    } catch (error) {
      console.error("Error updating WhatsApp message status:", error);
      throw error;
    }
  }

  async getWhatsappMessageById(whatsappMessageId: string): Promise<WhatsappMessage | undefined> {
    try {
      const [message] = await db
        .select()
        .from(whatsappMessages)
        .where(eq(whatsappMessages.whatsappMessageId, whatsappMessageId));
      return message;
    } catch (error) {
      console.error("Error getting WhatsApp message by ID:", error);
      return undefined;
    }
  }

  // B2B SaaS Business operations implementation
  async getUserSubscription(userId: number): Promise<any> {
    try {
      const [subscription] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
      return subscription;
    } catch (error) {
      console.error('Error getting user subscription:', error);
      return null;
    }
  }

  async getUserUsageMetrics(userId: number, month: string): Promise<any> {
    try {
      const [usage] = await db.select().from(usageMetrics)
        .where(and(eq(usageMetrics.userId, userId), eq(usageMetrics.month, month)));
      return usage;
    } catch (error) {
      console.error('Error getting user usage metrics:', error);
      return null;
    }
  }

  async getAnalyticsSummary(userId: number): Promise<any> {
    try {
      const userAgents = await this.getUserAgents(userId);
      const userConversations = await db.select().from(conversations)
        .where(eq(conversations.userId, userId));
      
      const userAnalytics = await db.select().from(analytics)
        .where(eq(analytics.userId, userId));

      return {
        totalConversations: userConversations.length,
        totalMessages: userAnalytics.reduce((sum, a) => sum + (a.messagesSent || 0), 0),
        avgResponseTime: userAnalytics.length > 0 
          ? userAnalytics.reduce((sum, a) => sum + (a.avgResponseTime || 0), 0) / userAnalytics.length 
          : 0
      };
    } catch (error) {
      console.error('Error getting analytics summary:', error);
      return {
        totalConversations: 0,
        totalMessages: 0,
        avgResponseTime: 0
      };
    }
  }

  async getAgentByApiKey(apiKey: string): Promise<any> {
    try {
      const [agent] = await db.select().from(agents).where(eq(agents.apiKey, apiKey));
      return agent;
    } catch (error) {
      console.error('Error getting agent by API key:', error);
      return null;
    }
  }

  async getBusinessInsights(agentId: number): Promise<any> {
    try {
      const agent = await this.getAgent(agentId);
      if (!agent) return null;

      // Get conversations and analytics for business insights
      const conversations = await this.getConversationsByAgent(agentId);
      const analytics = await this.getAnalyticsByAgent(agentId);

      // Calculate business metrics
      const totalConversations = conversations.length;
      const qualifiedLeads = conversations.filter(c => (c.conversionScore || 0) > 70).length;
      const averageConversionScore = conversations.reduce((sum, c) => sum + (c.conversionScore || 0), 0) / totalConversations || 0;

      // Product interest analysis
      let productInterests: Record<string, number> = {};
      if (agent.productCatalog && Array.isArray(agent.productCatalog)) {
        agent.productCatalog.forEach((product: any) => {
          const mentions = conversations.filter(c => 
            JSON.stringify(c.messages).toLowerCase().includes(product.name.toLowerCase())
          ).length;
          if (mentions > 0) {
            productInterests[product.name] = mentions;
          }
        });
      }

      // FAQ effectiveness analysis
      let faqEffectiveness: Record<string, number> = {};
      if (agent.faqData && Array.isArray(agent.faqData)) {
        agent.faqData.forEach((faq: any) => {
          const mentions = conversations.filter(c => 
            JSON.stringify(c.messages).toLowerCase().includes(faq.question.toLowerCase())
          ).length;
          if (mentions > 0) {
            faqEffectiveness[faq.question] = mentions;
          }
        });
      }

      return {
        agentId,
        businessType: agent.businessType,
        totalConversations,
        qualifiedLeads,
        conversionRate: totalConversations > 0 ? (qualifiedLeads / totalConversations) * 100 : 0,
        averageConversionScore,
        productInterests,
        faqEffectiveness,
        recentAnalytics: analytics.slice(-7), // Last 7 days
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting business insights:', error);
      return null;
    }
  }

  async createOrUpdateUsageMetrics(userId: number, agentId: number, metrics: any): Promise<void> {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      const existing = await db.select().from(usageMetrics)
        .where(and(
          eq(usageMetrics.userId, userId),
          eq(usageMetrics.month, currentMonth),
          agentId ? eq(usageMetrics.agentId, agentId) : sql`agent_id IS NULL`
        ));

      if (existing.length > 0) {
        await db.update(usageMetrics)
          .set({
            messagesUsed: sql`${usageMetrics.messagesUsed} + ${metrics.messagesUsed || 0}`,
            leadsGenerated: sql`${usageMetrics.leadsGenerated} + ${metrics.leadsGenerated || 0}`,
            totalCost: sql`${usageMetrics.totalCost} + ${metrics.costIncurred || 0}`,
            conversions: sql`${usageMetrics.conversions} + ${metrics.conversions || 0}`,
          })
          .where(and(
            eq(usageMetrics.userId, userId),
            eq(usageMetrics.month, currentMonth),
            agentId ? eq(usageMetrics.agentId, agentId) : sql`agent_id IS NULL`
          ));
      } else {
        await db.insert(usageMetrics).values({
          userId,
          agentId,
          month: currentMonth,
          messagesUsed: metrics.messagesUsed || 0,
          leadsGenerated: metrics.leadsGenerated || 0,
          conversions: metrics.conversions || 0,
          totalCost: metrics.costIncurred || 0,
        });
      }
    } catch (error) {
      console.error('Error creating/updating usage metrics:', error);
    }
  }

  // Voice calling operations
  async getVoiceCall(id: number): Promise<VoiceCall | undefined> {
    try {
      const [call] = await db.select().from(voiceCalls).where(eq(voiceCalls.id, id));
      return call;
    } catch (error) {
      console.error("Error getting voice call:", error);
      return undefined;
    }
  }

  async getVoiceCallByCallId(callId: string): Promise<VoiceCall | undefined> {
    try {
      const [call] = await db.select().from(voiceCalls).where(eq(voiceCalls.callId, callId));
      return call;
    } catch (error) {
      console.error("Error getting voice call by call ID:", error);
      return undefined;
    }
  }

  async getVoiceCallsByAgent(agentId: number): Promise<VoiceCall[]> {
    try {
      return await db.select().from(voiceCalls).where(eq(voiceCalls.agentId, agentId));
    } catch (error) {
      console.error("Error getting voice calls by agent:", error);
      return [];
    }
  }

  async getVoiceCallsByConversation(conversationId: number): Promise<VoiceCall[]> {
    try {
      return await db.select().from(voiceCalls).where(eq(voiceCalls.conversationId, conversationId));
    } catch (error) {
      console.error("Error getting voice calls by conversation:", error);
      return [];
    }
  }

  async createVoiceCall(insertCall: InsertVoiceCall): Promise<VoiceCall> {
    try {
      const [call] = await db.insert(voiceCalls).values(insertCall).returning();
      return call;
    } catch (error) {
      console.error("Error creating voice call:", error);
      throw error;
    }
  }

  async updateVoiceCall(id: number, updates: Partial<InsertVoiceCall>): Promise<VoiceCall | undefined> {
    try {
      const [call] = await db.update(voiceCalls).set(updates).where(eq(voiceCalls.id, id)).returning();
      return call;
    } catch (error) {
      console.error("Error updating voice call:", error);
      return undefined;
    }
  }

  async updateVoiceCallStatus(id: number, status: string): Promise<void> {
    try {
      await db.update(voiceCalls).set({ status }).where(eq(voiceCalls.id, id));
    } catch (error) {
      console.error("Error updating voice call status:", error);
      throw error;
    }
  }

  // Voice call trigger operations
  async getVoiceCallTrigger(agentId: number): Promise<VoiceCallTrigger | undefined> {
    try {
      const [trigger] = await db.select().from(voiceCallTriggers).where(eq(voiceCallTriggers.agentId, agentId));
      return trigger;
    } catch (error) {
      console.error("Error getting voice call trigger:", error);
      return undefined;
    }
  }

  async createVoiceCallTrigger(insertTrigger: InsertVoiceCallTrigger): Promise<VoiceCallTrigger> {
    try {
      const [trigger] = await db.insert(voiceCallTriggers).values(insertTrigger).returning();
      return trigger;
    } catch (error) {
      console.error("Error creating voice call trigger:", error);
      throw error;
    }
  }

  async updateVoiceCallTrigger(agentId: number, updates: Partial<InsertVoiceCallTrigger>): Promise<VoiceCallTrigger | undefined> {
    try {
      const [trigger] = await db.update(voiceCallTriggers).set(updates).where(eq(voiceCallTriggers.agentId, agentId)).returning();
      return trigger;
    } catch (error) {
      console.error("Error updating voice call trigger:", error);
      return undefined;
    }
  }

  // Voice call analytics operations
  async getVoiceCallAnalytics(agentId: number, date: string): Promise<VoiceCallAnalytics | undefined> {
    try {
      const [analytics] = await db.select().from(voiceCallAnalytics)
        .where(and(eq(voiceCallAnalytics.agentId, agentId), eq(voiceCallAnalytics.date, date)));
      return analytics;
    } catch (error) {
      console.error("Error getting voice call analytics:", error);
      return undefined;
    }
  }

  async createVoiceCallAnalytics(insertAnalytics: InsertVoiceCallAnalytics): Promise<VoiceCallAnalytics> {
    try {
      const [analytics] = await db.insert(voiceCallAnalytics).values(insertAnalytics).returning();
      return analytics;
    } catch (error) {
      console.error("Error creating voice call analytics:", error);
      throw error;
    }
  }

  async updateVoiceCallAnalytics(id: number, updates: Partial<InsertVoiceCallAnalytics>): Promise<VoiceCallAnalytics | undefined> {
    try {
      const [analytics] = await db.update(voiceCallAnalytics).set(updates).where(eq(voiceCallAnalytics.id, id)).returning();
      return analytics;
    } catch (error) {
      console.error("Error updating voice call analytics:", error);
      return undefined;
    }
  }

  async checkSubscriptionLimits(userId: number): Promise<{ withinLimits: boolean; usage: any; limits: any }> {
    try {
      const subscription = await this.getUserSubscription(userId);
      const currentMonth = new Date().toISOString().slice(0, 7);
      const usage = await this.getUserUsageMetrics(userId, currentMonth);

      if (!subscription) {
        return {
          withinLimits: false,
          usage: usage || {},
          limits: { maxMessagesPerMonth: 0, maxAgents: 0 }
        };
      }

      const limits = {
        maxMessagesPerMonth: subscription.maxMessagesPerMonth,
        maxAgents: subscription.maxAgents
      };

      const currentUsage = usage || { messagesUsed: 0 };
      const withinLimits = currentUsage.messagesUsed < limits.maxMessagesPerMonth;

      return { withinLimits, usage: currentUsage, limits };
    } catch (error) {
      console.error('Error checking subscription limits:', error);
      return {
        withinLimits: false,
        usage: {},
        limits: { maxMessagesPerMonth: 0, maxAgents: 0 }
      };
    }
  }

  // Business onboarding operations
  async getBusinessOnboarding(userId: number): Promise<BusinessOnboarding | undefined> {
    try {
      const [onboarding] = await db
        .select()
        .from(businessOnboarding)
        .where(eq(businessOnboarding.userId, userId))
        .orderBy(desc(businessOnboarding.createdAt))
        .limit(1);
      return onboarding;
    } catch (error) {
      console.error('Error getting business onboarding:', error);
      return undefined;
    }
  }

  async createBusinessOnboarding(insertOnboarding: InsertBusinessOnboarding): Promise<BusinessOnboarding> {
    const [onboarding] = await db
      .insert(businessOnboarding)
      .values(insertOnboarding)
      .returning();
    return onboarding;
  }

  async updateBusinessOnboarding(userId: number, updates: Partial<InsertBusinessOnboarding>): Promise<BusinessOnboarding | undefined> {
    try {
      const [onboarding] = await db
        .update(businessOnboarding)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(businessOnboarding.userId, userId))
        .returning();
      return onboarding;
    } catch (error) {
      console.error('Error updating business onboarding:', error);
      return undefined;
    }
  }

  async saveOnboardingStep(userId: number, step: number, stepData: any): Promise<BusinessOnboarding | undefined> {
    try {
      // Get current onboarding
      let onboarding = await this.getBusinessOnboarding(userId);
      
      if (!onboarding) {
        // Create new onboarding if it doesn't exist
        onboarding = await this.createBusinessOnboarding({
          userId,
          currentStep: step,
          stepData: { [step]: stepData },
          lastActiveAt: new Date()
        });
      } else {
        // Update existing onboarding
        const currentStepData = onboarding.stepData as any || {};
        currentStepData[step] = stepData;
        
        onboarding = await this.updateBusinessOnboarding(userId, {
          currentStep: step,
          stepData: currentStepData,
          lastActiveAt: new Date()
        });
      }
      
      return onboarding;
    } catch (error) {
      console.error('Error saving onboarding step:', error);
      return undefined;
    }
  }

  async markStepCompleted(userId: number, step: number): Promise<BusinessOnboarding | undefined> {
    try {
      const onboarding = await this.getBusinessOnboarding(userId);
      if (!onboarding) return undefined;

      const completedSteps = onboarding.completedSteps || [];
      if (!completedSteps.includes(step)) {
        completedSteps.push(step);
      }

      return await this.updateBusinessOnboarding(userId, {
        completedSteps,
        currentStep: step + 1,
        lastActiveAt: new Date()
      });
    } catch (error) {
      console.error('Error marking step completed:', error);
      return undefined;
    }
  }

  async completeOnboarding(userId: number): Promise<BusinessOnboarding | undefined> {
    try {
      return await this.updateBusinessOnboarding(userId, {
        status: 'completed',
        lastActiveAt: new Date()
      });
    } catch (error) {
      console.error('Error completing onboarding:', error);
      return undefined;
    }
  }

  // AI Training implementations
  async addKnowledgeItem(agentId: number, userId: number, data: any): Promise<any> {
    return { id: Date.now(), agentId, userId, ...data, createdAt: new Date() };
  }

  async getKnowledgeItems(agentId: number): Promise<any[]> {
    return [];
  }

  async updateKnowledgeItem(id: number, updates: any): Promise<any> {
    return { id, ...updates, updatedAt: new Date() };
  }

  async deleteKnowledgeItem(id: number): Promise<boolean> {
    return true;
  }

  async createTrainingSession(data: any): Promise<any> {
    return { id: Date.now(), ...data, createdAt: new Date() };
  }

  async getTrainingSessions(agentId: number): Promise<any[]> {
    return [];
  }

  async getTrainingSession(id: number): Promise<any> {
    return null;
  }

  async updateTrainingSession(id: number, updates: any): Promise<any> {
    return { id, ...updates, updatedAt: new Date() };
  }

  async addTrainingExample(data: any): Promise<any> {
    return { id: Date.now(), ...data, createdAt: new Date() };
  }

  async getTrainingExamples(agentId: number): Promise<any[]> {
    return [];
  }
}

export const storage = new DatabaseStorage();
