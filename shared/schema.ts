import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  businessCategory: text("business_category"),
  llmProvider: text("llm_provider").notNull(), // "gpt-4o", "claude-3", "gpt-3.5-turbo"
  systemPrompt: text("system_prompt").notNull(),
  leadQualificationQuestions: jsonb("lead_qualification_questions").$type<string[]>().default([]),
  voiceProvider: text("voice_provider").default("elevenlabs"),
  voiceModel: text("voice_model").default("professional-male"),
  callScript: text("call_script"),
  widgetPosition: text("widget_position").default("bottom-right"),
  widgetColor: text("widget_color").default("#25D366"),
  welcomeMessage: text("welcome_message").default("Hi! How can I help you today?"),
  whatsappNumber: text("whatsapp_number"), // WhatsApp Business number
  whatsappMode: text("whatsapp_mode").default("web"), // "web", "api", "hybrid"
  status: text("status").notNull().default("active"), // "active", "paused", "draft"
  apiKey: text("api_key").notNull(), // unique identifier for embedding
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  sessionId: text("session_id").notNull(),
  messages: jsonb("messages").$type<Array<{role: string, content: string, timestamp: string}>>().default([]),
  leadData: jsonb("lead_data").$type<Record<string, any>>().default({}),
  status: text("status").default("active"), // "active", "qualified", "converted", "dropped"
  conversionScore: integer("conversion_score").default(0), // 0-100
  callScheduled: boolean("call_scheduled").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const analytics = pgTable("analytics", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format
  totalConversations: integer("total_conversations").default(0),
  qualifiedLeads: integer("qualified_leads").default(0),
  conversions: integer("conversions").default(0),
  aiCalls: integer("ai_calls").default(0),
  conversionRate: integer("conversion_rate").default(0), // percentage * 100
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  apiKey: true,
  createdAt: true,
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAnalyticsSchema = createInsertSchema(analytics).omit({
  id: true,
});

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Analytics = typeof analytics.$inferSelect;
export type InsertAnalytics = z.infer<typeof insertAnalyticsSchema>;
