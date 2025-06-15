import { agents, conversations, analytics, type Agent, type InsertAgent, type Conversation, type InsertConversation, type Analytics, type InsertAnalytics } from "@shared/schema";
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

export class MemStorage implements IStorage {
  private agents: Map<number, Agent>;
  private conversations: Map<number, Conversation>;
  private analytics: Map<string, Analytics>; // key: agentId-date
  private currentAgentId: number;
  private currentConversationId: number;
  private currentAnalyticsId: number;

  constructor() {
    this.agents = new Map();
    this.conversations = new Map();
    this.analytics = new Map();
    this.currentAgentId = 1;
    this.currentConversationId = 1;
    this.currentAnalyticsId = 1;
  }

  async getAgent(id: number): Promise<Agent | undefined> {
    return this.agents.get(id);
  }

  async getAgentByApiKey(apiKey: string): Promise<Agent | undefined> {
    return Array.from(this.agents.values()).find(agent => agent.apiKey === apiKey);
  }

  async getAllAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values());
  }

  async createAgent(insertAgent: InsertAgent): Promise<Agent> {
    const id = this.currentAgentId++;
    const apiKey = `af_${nanoid(20)}`;
    const agent: Agent = {
      ...insertAgent,
      id,
      apiKey,
      createdAt: new Date(),
    };
    this.agents.set(id, agent);
    return agent;
  }

  async updateAgent(id: number, updates: Partial<InsertAgent>): Promise<Agent | undefined> {
    const agent = this.agents.get(id);
    if (!agent) return undefined;
    
    const updatedAgent = { ...agent, ...updates };
    this.agents.set(id, updatedAgent);
    return updatedAgent;
  }

  async deleteAgent(id: number): Promise<boolean> {
    return this.agents.delete(id);
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getConversationBySession(sessionId: string): Promise<Conversation | undefined> {
    return Array.from(this.conversations.values()).find(conv => conv.sessionId === sessionId);
  }

  async getConversationsByAgent(agentId: number): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).filter(conv => conv.agentId === agentId);
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const id = this.currentConversationId++;
    const now = new Date();
    const conversation: Conversation = {
      ...insertConversation,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async updateConversation(id: number, updates: Partial<InsertConversation>): Promise<Conversation | undefined> {
    const conversation = this.conversations.get(id);
    if (!conversation) return undefined;
    
    const updatedConversation = { ...conversation, ...updates, updatedAt: new Date() };
    this.conversations.set(id, updatedConversation);
    return updatedConversation;
  }

  async getAnalyticsByAgent(agentId: number): Promise<Analytics[]> {
    return Array.from(this.analytics.values()).filter(analytics => analytics.agentId === agentId);
  }

  async getAnalyticsByDate(date: string): Promise<Analytics[]> {
    return Array.from(this.analytics.values()).filter(analytics => analytics.date === date);
  }

  async createOrUpdateAnalytics(insertAnalytics: InsertAnalytics): Promise<Analytics> {
    const key = `${insertAnalytics.agentId}-${insertAnalytics.date}`;
    const existing = this.analytics.get(key);
    
    if (existing) {
      const updated = { ...existing, ...insertAnalytics };
      this.analytics.set(key, updated);
      return updated;
    } else {
      const id = this.currentAnalyticsId++;
      const analytics: Analytics = { ...insertAnalytics, id };
      this.analytics.set(key, analytics);
      return analytics;
    }
  }

  async getDashboardStats(): Promise<{
    totalAgents: number;
    activeAgents: number;
    totalConversations: number;
    averageConversionRate: number;
  }> {
    const allAgents = Array.from(this.agents.values());
    const totalAgents = allAgents.length;
    const activeAgents = allAgents.filter(agent => agent.status === 'active').length;
    const totalConversations = this.conversations.size;
    
    const allAnalytics = Array.from(this.analytics.values());
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

export const storage = new MemStorage();
