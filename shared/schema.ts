import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, unique, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User management tables for RBAC
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: varchar("first_name", { length: 100 }),
  lastName: varchar("last_name", { length: 100 }),
  role: text("role").notNull().default("business_user"), // "system_admin", "business_manager", "business_user"
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
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  businessCategory: text("business_category"),
  llmProvider: text("llm_provider").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  leadQualificationQuestions: jsonb("lead_qualification_questions").$type<Array<{
    question: string,
    questionType: 'text' | 'choice' | 'number', 
    required: boolean,
    options?: string[]
  }>>().default([]),
  voiceProvider: text("voice_provider").default("elevenlabs"),
  voiceModel: text("voice_model").default("professional-male"),
  callScript: text("call_script"),
  widgetPosition: text("widget_position").default("bottom-right"),
  widgetColor: text("widget_color").default("#25D366"),
  welcomeMessage: text("welcome_message").default("Hi! How can I help you today?"),
  whatsappNumber: text("whatsapp_number"),
  whatsappMode: text("whatsapp_mode").default("web"),
  whatsappBusinessAccountId: text("whatsapp_business_account_id"),
  whatsappPhoneNumberId: text("whatsapp_phone_number_id"),
  whatsappAccessToken: text("whatsapp_access_token"),
  whatsappWebhookVerifyToken: text("whatsapp_webhook_verify_token"),
  platformType: text("platform_type").default("whatsapp"),
  telegramBotToken: text("telegram_bot_token"),
  telegramUsername: text("telegram_username"),
  chatTheme: text("chat_theme").default("modern"),
  operatingHours: text("operating_hours").default("24/7"),
  smsNumber: text("sms_number"),
  smsProvider: text("sms_provider").default("twilio"),
  status: text("status").notNull().default("active"),
  apiKey: text("api_key").notNull(),
  businessWebsite: text("business_website"),
  businessLogo: text("business_logo"),
  businessHours: jsonb("business_hours").$type<{
    monday?: { open: string, close: string, closed?: boolean },
    tuesday?: { open: string, close: string, closed?: boolean },
    wednesday?: { open: string, close: string, closed?: boolean },
    thursday?: { open: string, close: string, closed?: boolean },
    friday?: { open: string, close: string, closed?: boolean },
    saturday?: { open: string, close: string, closed?: boolean },
    sunday?: { open: string, close: string, closed?: boolean },
    timezone?: string
  }>(),
  knowledgeBase: text("knowledge_base"),
  faqData: jsonb("faq_data").$type<Array<{ question: string, answer: string, category?: string }>>(),
  productCatalog: jsonb("product_catalog").$type<Array<{ 
    name: string, 
    description: string, 
    price?: number, 
    currency?: string,
    category?: string,
    image?: string,
    inStock?: boolean 
  }>>(),
  contactInfo: jsonb("contact_info").$type<{
    email?: string,
    phone?: string,
    address?: string,
    supportHours?: string,
    departments?: Array<{ name: string, contact: string }>
  }>(),
  customBranding: jsonb("custom_branding").$type<{
    primaryColor?: string,
    secondaryColor?: string,
    fontFamily?: string,
    logoUrl?: string,
    companyName?: string
  }>(),
  autoResponseTemplates: jsonb("auto_response_templates").$type<{
    greeting?: string,
    businessHours?: string,
    afterHours?: string,
    fallback?: string,
    handoff?: string
  }>(),
  businessType: text("business_type"),
  targetAudience: text("target_audience"),
  maxMonthlyMessages: integer("max_monthly_messages").default(1000),
  pricingTier: text("pricing_tier").default("starter"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  sessionId: text("session_id").notNull(),
  messages: jsonb("messages").$type<Array<{role: string, content: string, timestamp: string}>>().default([]),
  leadData: jsonb("lead_data").$type<Record<string, any>>().default({}),
  status: text("status").default("active"),
  conversionScore: integer("conversion_score").default(0),
  callScheduled: boolean("call_scheduled").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const analytics = pgTable("analytics", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  date: text("date").notNull(),
  totalInteractions: integer("total_interactions").default(0),
  whatsappRedirects: integer("whatsapp_redirects").default(0),
  totalConversations: integer("total_conversations").default(0),
  qualifiedLeads: integer("qualified_leads").default(0),
  conversions: integer("conversions").default(0),
  aiCalls: integer("ai_calls").default(0),
  conversionRate: integer("conversion_rate").default(0),
  avgResponseTime: integer("avg_response_time").default(0),
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

export const whatsappMessages = pgTable("whatsapp_messages", {
  id: text("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  conversationId: integer("conversation_id").references(() => conversations.id),
  whatsappMessageId: text("whatsapp_message_id").notNull(),
  direction: text("direction").notNull(), // "inbound", "outbound"
  fromNumber: text("from_number").notNull(),
  toNumber: text("to_number").notNull(),
  messageText: text("message_text"),
  messageType: text("message_type").default("text"),
  status: text("status").default("sent"),
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
  timestamp: timestamp("timestamp").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const voiceCalls = pgTable("voice_calls", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  conversationId: integer("conversation_id").references(() => conversations.id),
  callId: text("call_id"),
  phoneNumber: text("phone_number").notNull(),
  triggeredBy: text("triggered_by").notNull(),
  status: text("status").default("initiated"),
  duration: integer("duration"),
  cost: integer("cost"),
  currency: text("currency").default("USD"),
  voiceModel: text("voice_model"),
  systemPrompt: text("system_prompt"),
  callScript: text("call_script"),
  callData: jsonb("call_data").$type<Record<string, any>>().default({}),
  transcription: text("transcription"),
  outcome: text("outcome"),
  leadScore: integer("lead_score"),
  callbackScheduled: boolean("callback_scheduled").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const voiceCallTriggers = pgTable("voice_call_triggers", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  enabled: boolean("enabled").default(false),
  delayMinutes: integer("delay_minutes").default(5),
  maxAttemptsPerLead: integer("max_attempts_per_lead").default(3),
  requirePhoneCapture: boolean("require_phone_capture").default(true),
  requireEmailCapture: boolean("require_email_capture").default(false),
  minEngagementScore: integer("min_engagement_score").default(50),
  voicePersona: text("voice_persona"),
  callObjective: text("call_objective"),
  businessHoursOnly: boolean("business_hours_only").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const voiceCallAnalytics = pgTable("voice_call_analytics", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  date: text("date").notNull(),
  totalCalls: integer("total_calls").default(0),
  successfulConnections: integer("successful_connections").default(0),
  failedCalls: integer("failed_calls").default(0),
  noAnswers: integer("no_answers").default(0),
  conversions: integer("conversions").default(0),
  callbacksScheduled: integer("callbacks_scheduled").default(0),
  notInterested: integer("not_interested").default(0),
  avgCallDuration: integer("avg_call_duration").default(0),
  avgLeadScore: integer("avg_lead_score").default(0),
  totalCost: integer("total_cost").default(0),
  currency: text("currency").default("USD"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  tier: text("tier").notNull().default("starter"),
  status: text("status").notNull().default("active"),
  monthlyMessageLimit: integer("monthly_message_limit").default(1000),
  monthlyVoiceCallLimit: integer("monthly_voice_call_limit").default(50),
  agentLimit: integer("agent_limit").default(5),
  features: jsonb("features").$type<string[]>().default([]),
  billingCycle: text("billing_cycle").default("monthly"),
  price: integer("price").default(0),
  currency: text("currency").default("USD"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usageMetrics = pgTable("usage_metrics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  month: text("month").notNull(),
  messagesUsed: integer("messages_used").default(0),
  voiceCallsUsed: integer("voice_calls_used").default(0),
  leadsGenerated: integer("leads_generated").default(0),
  conversions: integer("conversions").default(0),
  totalCost: integer("total_cost").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Business Templates Configuration
export const businessTemplates = pgTable("business_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  welcomeMessage: text("welcome_message").notNull(),
  sampleQuestions: jsonb("sample_questions").$type<Array<{
    question: string,
    questionType: 'text' | 'choice' | 'number',
    required: boolean,
    options?: string[]
  }>>().default([]),
  sampleFaqs: jsonb("sample_faqs").$type<Array<{ question: string, answer: string }>>().default([]),
  sampleProducts: jsonb("sample_products").$type<Array<{ name: string, description: string, price?: number }>>().default([]),
  customizations: jsonb("customizations").$type<Record<string, any>>().default({}),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  details: jsonb("details").$type<Record<string, any>>().default({}),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  success: boolean("success").default(true),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type UpdateUser = Partial<InsertUser>;

export type Session = typeof sessions.$inferSelect;
export type InsertSession = typeof sessions.$inferInsert;

export type Agent = typeof agents.$inferSelect;
export type InsertAgent = typeof agents.$inferInsert;
export type UpdateAgent = Partial<InsertAgent>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = typeof conversations.$inferInsert;

export type Analytics = typeof analytics.$inferSelect;
export type InsertAnalytics = typeof analytics.$inferInsert;

export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = typeof whatsappMessages.$inferInsert;

export type VoiceCall = typeof voiceCalls.$inferSelect;
export type InsertVoiceCall = typeof voiceCalls.$inferInsert;

export type VoiceCallTrigger = typeof voiceCallTriggers.$inferSelect;
export type InsertVoiceCallTrigger = typeof voiceCallTriggers.$inferInsert;

export type VoiceCallAnalytics = typeof voiceCallAnalytics.$inferSelect;
export type InsertVoiceCallAnalytics = typeof voiceCallAnalytics.$inferInsert;

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

export type UsageMetrics = typeof usageMetrics.$inferSelect;
export type InsertUsageMetrics = typeof usageMetrics.$inferInsert;

export type BusinessTemplate = typeof businessTemplates.$inferSelect;
export type InsertBusinessTemplate = typeof businessTemplates.$inferInsert;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// Comprehensive logging table for system operations
export const logs = pgTable("logs", {
  id: varchar("id").primaryKey().notNull(),
  level: text("level").notNull(), // debug, info, warn, error, critical
  category: text("category").notNull(), // agent, auth, api, cost, webhook, voice, whatsapp, system, security
  message: text("message").notNull(),
  userId: integer("user_id").references(() => users.id),
  agentId: integer("agent_id").references(() => agents.id),
  sessionId: varchar("session_id"),
  metadata: jsonb("metadata").default({}),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertLog = typeof logs.$inferInsert;
export type Log = typeof logs.$inferSelect;



// Create insert schemas
export const insertUserSchema = createInsertSchema(users);
export const insertAgentSchema = createInsertSchema(agents).omit({ 
  id: true, 
  createdAt: true, 
  apiKey: true,
  userId: true 
});
export const insertConversationSchema = createInsertSchema(conversations);
export const insertAnalyticsSchema = createInsertSchema(analytics);
export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages);
export const insertVoiceCallSchema = createInsertSchema(voiceCalls);
export const insertVoiceCallTriggerSchema = createInsertSchema(voiceCallTriggers);
export const insertVoiceCallAnalyticsSchema = createInsertSchema(voiceCallAnalytics);
export const insertSubscriptionSchema = createInsertSchema(subscriptions);
export const insertUsageMetricsSchema = createInsertSchema(usageMetrics);
export const insertBusinessTemplateSchema = createInsertSchema(businessTemplates);
export const insertAuditLogSchema = createInsertSchema(auditLogs);


// Login schema for authentication
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});