import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User management tables for RBAC
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  role: text("role").notNull().default("business_user"), // "admin", "business_user"
  status: text("status").notNull().default("pending"), // "pending", "approved", "suspended"
  companyName: varchar("company_name", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  approvedBy: integer("approved_by"),
  approvedAt: timestamp("approved_at"),
});

export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(), // Owner of the agent
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
  totalInteractions: integer("total_interactions").default(0),
  whatsappRedirects: integer("whatsapp_redirects").default(0),
  totalConversations: integer("total_conversations").default(0),
  qualifiedLeads: integer("qualified_leads").default(0),
  conversions: integer("conversions").default(0),
  aiCalls: integer("ai_calls").default(0),
  conversionRate: integer("conversion_rate").default(0), // percentage * 100
  avgResponseTime: integer("avg_response_time").default(0), // milliseconds
  promptTokens: integer("prompt_tokens").default(0),
  completionTokens: integer("completion_tokens").default(0),
  totalTokens: integer("total_tokens").default(0),
  llmCosts: jsonb("llm_costs").$type<{
    promptCost: number;
    completionCost: number;
    totalCost: number;
    currency: string;
  }>().default({
    promptCost: 0,
    completionCost: 0,
    totalCost: 0,
    currency: "USD"
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLogin: true,
  approvedBy: true,
  approvedAt: true,
}).extend({
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const updateUserSchema = createInsertSchema(users).omit({
  id: true,
  passwordHash: true,
  createdAt: true,
  updatedAt: true,
  lastLogin: true,
}).partial();

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
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

// User types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

// Existing types
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Analytics = typeof analytics.$inferSelect;
export type InsertAnalytics = z.infer<typeof insertAnalyticsSchema>;
