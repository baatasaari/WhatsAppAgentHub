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
  userId: integer("user_id").references(() => users.id), // Owner of the agent - temporary nullable for migration
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
  
  // WhatsApp Business API configuration
  whatsappBusinessAccountId: text("whatsapp_business_account_id"),
  whatsappPhoneNumberId: text("whatsapp_phone_number_id"),
  whatsappAccessToken: text("whatsapp_access_token"),
  whatsappWebhookVerifyToken: text("whatsapp_webhook_verify_token"),
  status: text("status").notNull().default("active"), // "active", "paused", "draft"
  apiKey: text("api_key").notNull(), // unique identifier for embedding
  
  // B2B Business Enhancement Fields
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
  leadQualificationQuestions: jsonb("lead_qualification_questions").$type<Array<{
    question: string,
    questionType: 'text' | 'choice' | 'number',
    required: boolean,
    options?: string[]
  }>>(),
  autoResponseTemplates: jsonb("auto_response_templates").$type<{
    greeting?: string,
    businessHours?: string,
    afterHours?: string,
    fallback?: string,
    handoff?: string
  }>(),
  businessType: text("business_type"), // "ecommerce", "saas", "service", "restaurant", etc.
  targetAudience: text("target_audience"),
  maxMonthlyMessages: integer("max_monthly_messages").default(1000),
  pricingTier: text("pricing_tier").default("starter"), // "starter", "professional", "enterprise"
  
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

// Advanced analytics tables
export const conversionEvents = pgTable("conversion_events", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  conversationId: integer("conversation_id").references(() => conversations.id),
  eventType: text("event_type").notNull(), // "widget_view", "chat_start", "lead_qualified", "conversion", "call_scheduled"
  eventData: jsonb("event_data").$type<Record<string, any>>().default({}),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  referrer: text("referrer"),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  sessionId: text("session_id"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  firstSeen: timestamp("first_seen").defaultNow().notNull(),
  lastSeen: timestamp("last_seen").defaultNow().notNull(),
  pageViews: integer("page_views").default(1),
  totalTimeSpent: integer("total_time_spent").default(0), // seconds
  deviceType: text("device_type"), // "desktop", "mobile", "tablet"
  browser: text("browser"),
  os: text("os"),
  country: text("country"),
  city: text("city"),
  source: text("source"), // "organic", "paid", "social", "direct", "referral"
  landingPage: text("landing_page"),
  exitPage: text("exit_page"),
  converted: boolean("converted").default(false),
  conversionValue: integer("conversion_value").default(0), // cents
});

export const funnelSteps = pgTable("funnel_steps", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  sessionId: text("session_id").notNull(),
  step: text("step").notNull(), // "widget_view", "chat_open", "message_sent", "lead_captured", "conversion"
  stepOrder: integer("step_order").notNull(),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  timeFromPrevious: integer("time_from_previous").default(0), // milliseconds
  metadata: jsonb("metadata").$type<Record<string, any>>().default({}),
});

export const performanceMetrics = pgTable("performance_metrics", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD format
  hour: integer("hour").notNull(), // 0-23
  
  // Engagement metrics
  uniqueVisitors: integer("unique_visitors").default(0),
  pageViews: integer("page_views").default(0),
  avgSessionDuration: integer("avg_session_duration").default(0), // seconds
  bounceRate: integer("bounce_rate").default(0), // percentage * 100
  
  // Conversion funnel
  widgetViews: integer("widget_views").default(0),
  chatInitiations: integer("chat_initiations").default(0),
  messagesExchanged: integer("messages_exchanged").default(0),
  leadsGenerated: integer("leads_generated").default(0),
  conversionsCompleted: integer("conversions_completed").default(0),
  
  // Quality metrics
  avgConversationLength: integer("avg_conversation_length").default(0), // number of messages
  avgTimeToResponse: integer("avg_time_to_response").default(0), // milliseconds
  customerSatisfactionScore: integer("customer_satisfaction_score").default(0), // 1-5 scale * 100
  
  // Business metrics
  totalRevenue: integer("total_revenue").default(0), // cents
  avgOrderValue: integer("avg_order_value").default(0), // cents
  customerLifetimeValue: integer("customer_lifetime_value").default(0), // cents
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  passwordHash: true,
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

// WhatsApp Messages table
export const whatsappMessages = pgTable("whatsapp_messages", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  conversationId: integer("conversation_id").references(() => conversations.id),
  whatsappMessageId: text("whatsapp_message_id").unique(),
  fromPhoneNumber: text("from_phone_number").notNull(),
  toPhoneNumber: text("to_phone_number").notNull(),
  messageType: text("message_type").notNull(), // "text", "image", "document", "audio", "video"
  content: text("content"),
  mediaUrl: text("media_url"),
  status: text("status").default("sent"), // "sent", "delivered", "read", "failed"
  direction: text("direction").notNull(), // "inbound", "outbound"
  timestamp: timestamp("timestamp").defaultNow(),
  webhookData: jsonb("webhook_data"),
});

export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({
  id: true,
  timestamp: true,
});

export type WhatsappMessage = typeof whatsappMessages.$inferSelect;
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;

// B2B SaaS Business Infrastructure
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  planName: text("plan_name").notNull(), // "starter", "professional", "enterprise"
  status: text("status").notNull().default("active"), // "active", "cancelled", "past_due", "trialing"
  billingCycle: text("billing_cycle").notNull().default("monthly"), // "monthly", "yearly"
  pricePerMonth: integer("price_per_month").notNull(), // in cents
  maxAgents: integer("max_agents").notNull().default(1),
  maxMessagesPerMonth: integer("max_messages_per_month").notNull().default(1000),
  featuresIncluded: jsonb("features_included").$type<Array<string>>().default([]),
  currentPeriodStart: timestamp("current_period_start").defaultNow().notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  trialEndsAt: timestamp("trial_ends_at"),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usageMetrics = pgTable("usage_metrics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  agentId: integer("agent_id").references(() => agents.id),
  month: text("month").notNull(), // "2025-01" format
  messagesUsed: integer("messages_used").default(0),
  conversationsStarted: integer("conversations_started").default(0),
  leadsGenerated: integer("leads_generated").default(0),
  apiCallsMade: integer("api_calls_made").default(0),
  costIncurred: integer("cost_incurred").default(0), // in cents
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const businessTemplates = pgTable("business_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // "ecommerce", "saas", "restaurant", etc.
  systemPrompt: text("system_prompt").notNull(),
  welcomeMessage: text("welcome_message").notNull(),
  sampleFaqs: jsonb("sample_faqs").$type<Array<{ question: string, answer: string }>>(),
  sampleProducts: jsonb("sample_products").$type<Array<{ 
    name: string, 
    description: string, 
    price?: number 
  }>>(),
  leadQualificationFlow: jsonb("lead_qualification_flow").$type<Array<{
    question: string,
    type: string,
    required: boolean
  }>>(),
  customizations: jsonb("customizations").$type<{
    widgetColor?: string,
    brandingOptions?: Record<string, any>
  }>(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clientDomains = pgTable("client_domains", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  domain: text("domain").notNull(),
  verified: boolean("verified").default(false),
  verificationToken: text("verification_token"),
  sslEnabled: boolean("ssl_enabled").default(true),
  customCss: text("custom_css"),
  allowedIps: jsonb("allowed_ips").$type<Array<string>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueDomainAgent: unique().on(table.domain, table.agentId),
}));

// Business schema types
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBusinessTemplateSchema = createInsertSchema(businessTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertClientDomainSchema = createInsertSchema(clientDomains).omit({
  id: true,
  createdAt: true,
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type UsageMetrics = typeof usageMetrics.$inferSelect;
export type BusinessTemplate = typeof businessTemplates.$inferSelect;
export type InsertBusinessTemplate = z.infer<typeof insertBusinessTemplateSchema>;
export type ClientDomain = typeof clientDomains.$inferSelect;
export type InsertClientDomain = z.infer<typeof insertClientDomainSchema>;

// AI Voice Calling System
export const voiceCalls = pgTable("voice_calls", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  conversationId: integer("conversation_id").references(() => conversations.id),
  
  // Call details
  phoneNumber: text("phone_number").notNull(),
  callId: text("call_id"), // External service call ID
  status: text("status").notNull().default("pending"), // pending, calling, connected, completed, failed, no_answer
  
  // Call metadata
  triggeredBy: text("triggered_by").notNull(), // failed_conversion, manual, scheduled
  triggerReason: text("trigger_reason"), // cart_abandonment, form_incomplete, high_value_lead
  callDuration: integer("call_duration").default(0), // seconds
  
  // AI configuration
  voiceModel: text("voice_model").default("alloy"), // OpenAI voice models
  systemPrompt: text("system_prompt"),
  callScript: text("call_script"),
  
  // Results
  transcript: text("transcript"),
  sentiment: text("sentiment"), // positive, neutral, negative
  callOutcome: text("call_outcome"), // conversion, callback_scheduled, not_interested, no_answer
  leadScore: integer("lead_score").default(0), // 0-100
  
  // Follow-up
  followUpRequired: boolean("follow_up_required").default(false),
  followUpDate: timestamp("follow_up_date"),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const voiceCallTriggers = pgTable("voice_call_triggers", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  
  // Trigger conditions
  enabled: boolean("enabled").default(false),
  triggerType: text("trigger_type").notNull(), // time_based, behavior_based, manual
  
  // Time-based triggers
  delayMinutes: integer("delay_minutes").default(15), // Minutes after failed conversion
  businessHoursOnly: boolean("business_hours_only").default(true),
  
  // Behavior-based triggers
  minEngagementScore: integer("min_engagement_score").default(50), // 0-100
  requireEmailCapture: boolean("require_email_capture").default(false),
  requirePhoneCapture: boolean("require_phone_capture").default(true),
  
  // Call settings
  maxAttemptsPerLead: integer("max_attempts_per_lead").default(2),
  retryDelayHours: integer("retry_delay_hours").default(24),
  
  // Voice configuration
  voicePersona: text("voice_persona").default("professional"), // professional, friendly, sales
  callObjective: text("call_objective"), // schedule_demo, answer_questions, close_sale
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const voiceCallAnalytics = pgTable("voice_call_analytics", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  
  // Call volume metrics
  totalCalls: integer("total_calls").default(0),
  successfulConnections: integer("successful_connections").default(0),
  failedCalls: integer("failed_calls").default(0),
  noAnswers: integer("no_answers").default(0),
  
  // Conversation metrics
  avgCallDuration: integer("avg_call_duration").default(0), // seconds
  totalTalkTime: integer("total_talk_time").default(0), // seconds
  avgLeadScore: integer("avg_lead_score").default(0),
  
  // Outcome metrics
  conversions: integer("conversions").default(0),
  callbacksScheduled: integer("callbacks_scheduled").default(0),
  notInterested: integer("not_interested").default(0),
  
  // Cost metrics
  totalCost: integer("total_cost").default(0), // cents
  costPerCall: integer("cost_per_call").default(0), // cents
  costPerConversion: integer("cost_per_conversion").default(0), // cents
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Voice calling schemas
export const insertVoiceCallSchema = createInsertSchema(voiceCalls).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertVoiceCallTriggerSchema = createInsertSchema(voiceCallTriggers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVoiceCallAnalyticsSchema = createInsertSchema(voiceCallAnalytics).omit({
  id: true,
  createdAt: true,
});

export type VoiceCall = typeof voiceCalls.$inferSelect;
export type InsertVoiceCall = z.infer<typeof insertVoiceCallSchema>;
export type VoiceCallTrigger = typeof voiceCallTriggers.$inferSelect;
export type InsertVoiceCallTrigger = z.infer<typeof insertVoiceCallTriggerSchema>;
export type VoiceCallAnalytics = typeof voiceCallAnalytics.$inferSelect;
export type InsertVoiceCallAnalytics = z.infer<typeof insertVoiceCallAnalyticsSchema>;
