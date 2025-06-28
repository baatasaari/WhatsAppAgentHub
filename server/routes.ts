import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { insertAgentSchema, insertConversationSchema, insertUserSchema, loginSchema, businessTemplates } from "@shared/schema";
import { eq } from "drizzle-orm";
import { generateChatResponse, qualifyLead } from "./services/llm-providers";
import { authenticate, requireAdmin, requireApproved, requireSystemAdmin, requireBusinessManager, AuthenticatedRequest, AuthService } from "./auth";
import { nanoid } from "nanoid";
import { createSecureWidgetConfig } from "./encryption";
import { whatsappService, type WhatsAppWebhookPayload } from "./services/whatsapp-business";
import { voiceCallingService } from "./services/voice-calling";
import { logger } from "./services/logging";
import { telegramService } from "./services/telegram";
import { facebookMessengerService } from "./services/facebook-messenger";
import { instagramService } from "./services/instagram";
import { discordService } from "./services/discord";

import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';

// Helper function to generate embed code
function generateEmbedCode(platform: string, agent: any): string {
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost'}`
    : 'http://localhost:5000';
    
  const widgetUrl = `${baseUrl}/widgets/${platform}-widget.js`;
  
  return `
(function() {
  // AgentFlow ${platform.charAt(0).toUpperCase() + platform.slice(1)} Widget
  var script = document.createElement('script');
  script.src = '${widgetUrl}';
  script.async = true;
  script.onload = function() {
    if (window.AgentFlow${platform.charAt(0).toUpperCase() + platform.slice(1)}Widget) {
      window.AgentFlow${platform.charAt(0).toUpperCase() + platform.slice(1)}Widget.init({
        apiKey: '${agent.apiKey}',
        agentName: '${agent.name}',
        welcomeMessage: '${agent.welcomeMessage || 'Hello! How can I help you today?'}',
        position: '${agent.widgetPosition || 'bottom-right'}',
        color: '${agent.widgetColor || '#25D366'}'
      });
    }
  };
  document.head.appendChild(script);
})();
`.trim();
}

// WhatsApp Business API integration
async function sendWhatsAppMessage(phoneNumber: string, message: string, accessToken: string) {
  const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'text',
      text: { body: message }
    })
  });
  
  return response.json();
}

async function processWhatsAppMessage(agent: any, message: any, messageData: any) {
  const userPhone = message.from;
  const userMessage = message.text.body;
  
  // Get or create conversation
  let conversation = await storage.getConversationBySession(`whatsapp_${userPhone}_${agent.id}`);
  if (!conversation) {
    conversation = await storage.createConversation({
      agentId: agent.id,
      sessionId: `whatsapp_${userPhone}_${agent.id}`,
      messages: [],
      leadData: { phone: userPhone },
    });
  }

  // Add user message to conversation
  const userChatMessage = {
    role: 'user' as const,
    content: userMessage,
    timestamp: new Date().toISOString(),
  };

  const updatedMessages = [...(conversation.messages || []), userChatMessage];

  // Generate LLM response
  const chatMessages = [
    { role: 'system' as const, content: agent.systemPrompt },
    ...updatedMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  ];

  const aiResponse = await generateChatResponse(chatMessages, agent.llmProvider);
  
  // Add AI response to conversation
  const aiChatMessage = {
    role: 'assistant' as const,
    content: aiResponse.content,
    timestamp: new Date().toISOString(),
  };

  const finalMessages = [...updatedMessages, aiChatMessage];

  // Update conversation in database
  await storage.updateConversation(conversation.id, {
    messages: finalMessages,
  });

  // Send LLM response back to WhatsApp
  if (agent.whatsappAccessToken) {
    await sendWhatsAppMessage(userPhone, aiResponse.content, agent.whatsappAccessToken);
  }

  // Lead qualification after multiple exchanges
  if (finalMessages.length >= 4) {
    const conversationText = finalMessages.map(m => `${m.role}: ${m.content}`).join('\n');
    const qualification = await qualifyLead(conversationText, agent.leadQualificationQuestions || [], agent.llmProvider);
    
    await storage.updateConversation(conversation.id, {
      leadData: { ...conversation.leadData, ...qualification.extractedData, phone: userPhone },
      conversionScore: qualification.score,
      callScheduled: qualification.recommendation === 'call',
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post('/api/auth/register', async (req, res) => {
    try {
      console.log('Registration request body:', req.body);
      
      // First validate the input (expecting password, not passwordHash)
      const { password, ...otherData } = req.body;
      
      console.log('Extracted password:', password);
      console.log('Other data:', otherData);
      
      if (!password || typeof password !== 'string' || password.trim().length === 0) {
        return res.status(400).json({ message: 'Valid password is required' });
      }

      // Hash the password
      console.log('About to hash password...');
      const passwordHash = await AuthService.hashPassword(password.trim());
      console.log('Password hashed successfully');
      
      // Create userData with hashed password
      const userData = insertUserSchema.parse({
        ...otherData,
        passwordHash
      });
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(409).json({ message: 'User already exists with this email' });
      }

      const user = await storage.createUser(userData);
      res.status(201).json({
        message: 'Registration successful. Please wait for admin approval.',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          companyName: user.companyName,
          status: user.status,
          role: user.role
        }
      });
    } catch (error: any) {
      console.error('Registration error:', error);
      res.status(400).json({ message: 'Registration failed', error: error.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      if (user.status !== 'approved') {
        return res.status(403).json({ 
          message: user.status === 'pending' ? 'Account pending approval' : 'Account suspended'
        });
      }

      const isValidPassword = await AuthService.verifyPassword(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = await AuthService.createSession(user.id);
      
      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          companyName: user.companyName,
          role: user.role,
          status: user.status
        }
      });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(400).json({ message: 'Login failed', error: error.message });
    }
  });

  app.post('/api/auth/logout', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      
      if (token) {
        await AuthService.revokeSession(token);
      }
      
      res.json({ message: 'Logout successful' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: 'Logout failed' });
    }
  });

  app.get('/api/auth/me', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        companyName: user.companyName,
        role: user.role,
        status: user.status,
        user: user // Keep user object for backward compatibility
      });
    } catch (error) {
      console.error('Error fetching user info:', error);
      res.status(500).json({ message: 'Failed to fetch user info' });
    }
  });

  // User profile management endpoints
  app.put('/api/user/profile', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const { firstName, lastName, email, companyName } = req.body;
      
      // Check if email is already taken by another user
      if (email !== req.user!.email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== req.user!.id) {
          return res.status(400).json({ message: 'Email already in use' });
        }
      }

      const updatedUser = await storage.updateUser(req.user!.id, {
        firstName,
        lastName,
        email,
        companyName
      });

      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json(updatedUser);
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ message: 'Failed to update profile' });
    }
  });

  app.put('/api/user/change-password', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      
      const user = await storage.getUserById(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Verify current password
      const isCurrentPasswordValid = await AuthService.verifyPassword(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      // Hash new password
      const newPasswordHash = await AuthService.hashPassword(newPassword);
      
      // Update password
      const updatedUser = await storage.updateUser(req.user!.id, {
        passwordHash: newPasswordHash
      });

      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ message: 'Failed to change password' });
    }
  });

  // Admin-only user management routes
  app.get('/api/admin/users', authenticate, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const users = await storage.getAllUsers();
      const safeUsers = users.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        companyName: user.companyName,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        approvedAt: user.approvedAt
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  app.get('/api/admin/users/pending', authenticate, requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const pendingUsers = await storage.getPendingUsers();
      const safeUsers = pendingUsers.map(user => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        companyName: user.companyName,
        phone: user.phone,
        createdAt: user.createdAt
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error('Error fetching pending users:', error);
      res.status(500).json({ message: 'Failed to fetch pending users' });
    }
  });

  app.post('/api/admin/users/:id/approve', authenticate, requireBusinessManager, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      const adminId = req.user!.id;
      
      const user = await storage.approveUser(userId, adminId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json({ 
        message: 'User approved successfully',
        user: {
          id: user.id,
          email: user.email,
          status: user.status,
          approvedAt: user.approvedAt
        }
      });
    } catch (error) {
      console.error('Error approving user:', error);
      res.status(500).json({ message: 'Failed to approve user' });
    }
  });

  app.post('/api/admin/users/:id/suspend', authenticate, requireBusinessManager, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      const user = await storage.suspendUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json({ 
        message: 'User suspended successfully',
        user: {
          id: user.id,
          email: user.email,
          status: user.status
        }
      });
    } catch (error) {
      console.error('Error suspending user:', error);
      res.status(500).json({ message: 'Failed to suspend user' });
    }
  });

  app.delete('/api/admin/users/:id', authenticate, requireSystemAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      const success = await storage.deleteUser(userId);
      if (!success) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ message: 'Failed to delete user' });
    }
  });

  // System Admin only - User role management endpoints
  app.put('/api/admin/users/:id/role', authenticate, requireSystemAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      const { role } = req.body;
      
      if (!['system_admin', 'business_manager', 'business_user'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }
      
      const user = await storage.updateUser(userId, { role });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json({
        message: 'User role updated successfully',
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      res.status(500).json({ message: 'Failed to update user role' });
    }
  });

  app.post('/api/admin/users/:id/reactivate', authenticate, requireBusinessManager, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      const user = await storage.updateUser(userId, { status: 'approved' });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json({
        message: 'User reactivated successfully',
        user: {
          id: user.id,
          email: user.email,
          status: user.status
        }
      });
    } catch (error) {
      console.error('Error reactivating user:', error);
      res.status(500).json({ message: 'Failed to reactivate user' });
    }
  });
  
  // LLM Models configuration endpoints - System Admin only for modifications
  app.get("/api/models", async (req, res) => {
    try {
      const configPath = path.join(process.cwd(), 'models', 'llm_config.yaml');
      const fileContents = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(fileContents) as any;
      res.json(config.models);
    } catch (error: any) {
      console.error('Error loading model config:', error);
      res.status(500).json({ message: "Failed to load model configuration" });
    }
  });

  app.post("/api/models", authenticate, requireSystemAdmin, async (req, res) => {
    try {
      const modelData = req.body;
      const configPath = path.join(process.cwd(), 'models', 'llm_config.yaml');
      const fileContents = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(fileContents) as any;
      
      // Generate unique ID if not provided
      if (!modelData.id) {
        modelData.id = modelData.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
      }
      
      // Add to models array
      config.models.push(modelData);
      
      // Save back to file
      const updatedYaml = yaml.dump(config);
      fs.writeFileSync(configPath, updatedYaml, 'utf8');
      
      res.status(201).json(modelData);
    } catch (error: any) {
      console.error("Error creating model:", error);
      res.status(500).json({ message: "Failed to create model" });
    }
  });

  app.put("/api/models/:id", authenticate, requireSystemAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const configPath = path.join(process.cwd(), 'models', 'llm_config.yaml');
      const fileContents = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(fileContents) as any;
      
      const modelIndex = config.models.findIndex((m: any) => m.id === id);
      if (modelIndex === -1) {
        return res.status(404).json({ message: "Model not found" });
      }
      
      // Update model
      config.models[modelIndex] = { ...config.models[modelIndex], ...updateData };
      
      // Save back to file
      const updatedYaml = yaml.dump(config);
      fs.writeFileSync(configPath, updatedYaml, 'utf8');
      
      res.json(config.models[modelIndex]);
    } catch (error: any) {
      console.error("Error updating model:", error);
      res.status(500).json({ message: "Failed to update model" });
    }
  });

  app.delete("/api/models/:id", authenticate, requireSystemAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const configPath = path.join(process.cwd(), 'models', 'llm_config.yaml');
      const fileContents = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(fileContents) as any;
      
      const modelIndex = config.models.findIndex((m: any) => m.id === id);
      if (modelIndex === -1) {
        return res.status(404).json({ message: "Model not found" });
      }
      
      // Remove model
      config.models.splice(modelIndex, 1);
      
      // Save back to file
      const updatedYaml = yaml.dump(config);
      fs.writeFileSync(configPath, updatedYaml, 'utf8');
      
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting model:", error);
      res.status(500).json({ message: "Failed to delete model" });
    }
  });

  app.put("/api/models/reorder", authenticate, requireSystemAdmin, async (req, res) => {
    try {
      const { models } = req.body;
      
      if (!Array.isArray(models)) {
        return res.status(400).json({ message: "Models must be an array" });
      }
      
      const configPath = path.join(process.cwd(), 'models', 'llm_config.yaml');
      const fileContents = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(fileContents) as any;
      
      // Update models order
      config.models = models;
      
      // Save back to file
      const updatedYaml = yaml.dump(config);
      fs.writeFileSync(configPath, updatedYaml, 'utf8');
      
      res.json({ message: "Models reordered successfully" });
    } catch (error: any) {
      console.error("Error reordering models:", error);
      res.status(500).json({ message: "Failed to reorder models" });
    }
  });

  // Industry verticals endpoint with system instructions
  app.get("/api/industry-verticals", authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const yamlPath = path.join(process.cwd(), 'server', 'config', 'industry-verticals.yaml');
      
      // Check if new YAML file exists, otherwise use fallback
      if (fs.existsSync(yamlPath)) {
        const yamlContent = fs.readFileSync(yamlPath, 'utf8');
        const verticals = yaml.load(yamlContent) as any;
        console.log(`Loaded ${Array.isArray(verticals) ? verticals.length : 0} industry verticals with system instructions`);
        res.json(verticals);
      } else {
        // Fallback to old path if new one doesn't exist
        const oldConfigPath = path.join(process.cwd(), 'models', 'industry_verticals.yaml');
        if (fs.existsSync(oldConfigPath)) {
          const fileContents = fs.readFileSync(oldConfigPath, 'utf8');
          const config = yaml.load(fileContents) as any;
          res.json(config.industry_verticals);
        } else {
          // Final fallback to basic data
          console.log('No industry verticals YAML files found, using basic fallback');
          const fallbackVerticals = [
            { name: "E-Commerce & Retail", description: "Online and offline selling of goods and services", systemInstruction: "You are a professional customer service assistant for an e-commerce business." },
            { name: "Healthcare & Medical", description: "Medical services, healthcare providers, patient care", systemInstruction: "You are a healthcare customer service assistant. IMPORTANT: You cannot provide medical advice." },
            { name: "Technology & Software", description: "Software development, IT services, tech support", systemInstruction: "You are a technical support assistant for technology services." }
          ];
          res.json(fallbackVerticals);
        }
      }
    } catch (error: any) {
      console.error('Error loading industry verticals:', error);
      res.status(500).json({ message: "Failed to load industry verticals configuration" });
    }
  });

  // Business Templates API for B2B SaaS
  app.get("/api/business-templates", async (req, res) => {
    try {
      const category = req.query.category as string;
      let queryBuilder = db.select({
        id: businessTemplates.id,
        name: businessTemplates.name,
        description: businessTemplates.description,
        category: businessTemplates.category,
        systemPrompt: businessTemplates.systemPrompt,
        welcomeMessage: businessTemplates.welcomeMessage,
        sampleFaqs: businessTemplates.sampleFaqs,
        sampleProducts: businessTemplates.sampleProducts,
        customizations: businessTemplates.customizations,
        isActive: businessTemplates.isActive,
        createdAt: businessTemplates.createdAt
      }).from(businessTemplates).where(eq(businessTemplates.isActive, true));
      
      if (category) {
        queryBuilder = queryBuilder.where(eq(businessTemplates.category, category));
      }
      
      const templates = await queryBuilder;
      res.json(templates);
    } catch (error: any) {
      console.error('Error loading business templates:', error);
      res.status(500).json({ message: "Failed to load business templates" });
    }
  });

  app.get("/api/business-templates/categories", async (req, res) => {
    try {
      const templates = await db.select({ category: businessTemplates.category })
        .from(businessTemplates)
        .where(eq(businessTemplates.isActive, true))
        .groupBy(businessTemplates.category);
      
      const categories = templates.map(t => t.category);
      res.json(categories);
    } catch (error: any) {
      console.error('Error loading template categories:', error);
      res.status(500).json({ message: "Failed to load template categories" });
    }
  });

  app.post("/api/business-templates/:templateName/customize", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const { templateName } = req.params;
      const businessData = req.body;
      
      const { BusinessTemplateService } = await import('./services/business-templates');
      const templateService = new BusinessTemplateService();
      
      const customizedTemplate = templateService.customizeTemplateForBusiness(templateName, businessData);
      
      if (!customizedTemplate) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      res.json(customizedTemplate);
    } catch (error: any) {
      console.error('Error customizing business template:', error);
      res.status(500).json({ message: "Failed to customize template" });
    }
  });

  // Subscription Management API
  app.get("/api/subscription", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const subscription = await storage.getUserSubscription(userId);
      
      if (!subscription) {
        return res.status(404).json({ message: "No active subscription found" });
      }
      
      res.json(subscription);
    } catch (error: any) {
      console.error('Error fetching subscription:', error);
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });

  app.get("/api/subscription/usage", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
      
      const usage = await storage.getUserUsageMetrics(userId, currentMonth);
      res.json(usage || {
        messagesUsed: 0,
        conversationsStarted: 0,
        leadsGenerated: 0,
        apiCallsMade: 0,
        costIncurred: 0
      });
    } catch (error: any) {
      console.error('Error fetching usage metrics:', error);
      res.status(500).json({ message: "Failed to fetch usage metrics" });
    }
  });

  // Enhanced Analytics for Business Intelligence
  app.get("/api/agents/:id/business-insights", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const agent = await storage.getAgent(agentId);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      // Check ownership unless admin
      if (!['system_admin', 'business_manager'].includes(req.user!.role) && agent.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      const insights = await storage.getBusinessInsights(agentId);
      res.json(insights);
    } catch (error: any) {
      console.error('Error fetching business insights:', error);
      res.status(500).json({ message: "Failed to fetch business insights" });
    }
  });

  // Protected agent routes - require approved users
  app.get("/api/agents", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = ['system_admin', 'business_manager'].includes(req.user!.role) ? undefined : req.user!.id;
      const agents = await storage.getAllAgents(userId);
      res.json(agents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });

  app.get("/api/agents/:id", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      
      // Check ownership unless admin
      if (!['system_admin', 'business_manager'].includes(req.user!.role) && agent.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(agent);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch agent" });
    }
  });

  app.post("/api/agents", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      console.log('Agent creation request body:', JSON.stringify(req.body, null, 2));
      const { name, llmProvider, model, systemPrompt, platformType, widgetColor } = req.body;
      
      // Enhanced validation
      if (!name || name.trim().length === 0) {
        return res.status(400).json({ message: "Agent name is required and cannot be empty" });
      }
      
      if (name.length > 100) {
        return res.status(400).json({ message: "Agent name cannot exceed 100 characters" });
      }
      
      // XSS protection
      if (/<script|javascript:|on\w+=/i.test(name)) {
        return res.status(400).json({ message: "Agent name contains invalid characters" });
      }
      
      if (!systemPrompt || systemPrompt.trim().length === 0) {
        return res.status(400).json({ message: "System prompt is required and cannot be empty" });
      }
      
      if (systemPrompt.length > 5000) {
        return res.status(400).json({ message: "System prompt cannot exceed 5000 characters" });
      }
      
      // LLM provider validation - map model names to providers if needed
      const modelToProviderMapping = {
        'gpt-4o': 'openai',
        'gpt-4': 'openai', 
        'gpt-3.5-turbo': 'openai',
        'claude-sonnet-4-20250514': 'anthropic',
        'claude-3-7-sonnet-20250219': 'anthropic',
        'claude-3-sonnet-20240229': 'anthropic',
        'gemini-1.5-pro': 'google',
        'gemini-pro': 'google'
      };
      
      let actualProvider = llmProvider;
      let actualModel = model || llmProvider;
      
      // If llmProvider is actually a model name, map it to the correct provider
      if (modelToProviderMapping[llmProvider]) {
        actualProvider = modelToProviderMapping[llmProvider];
        actualModel = llmProvider;
      }
      
      const validProviders = ['openai', 'anthropic', 'google'];
      if (!validProviders.includes(actualProvider)) {
        return res.status(400).json({ message: "Invalid LLM provider. Must be one of: " + validProviders.join(', ') });
      }
      
      // Platform type validation - map frontend platform IDs to backend platform types
      const platformMapping = {
        'whatsapp-business-api': 'whatsapp',
        'facebook-messenger': 'facebook',
        'instagram-direct': 'instagram',
        'telegram': 'telegram',
        'discord': 'discord',
        'line-messaging': 'line',
        'wechat-work': 'wechat',
        // Also accept backend platform types directly
        'whatsapp': 'whatsapp',
        'facebook': 'facebook',
        'instagram': 'instagram'
      };
      
      const mappedPlatformType = platformType ? (platformMapping[platformType as keyof typeof platformMapping] || platformType) : 'whatsapp';
      const validPlatforms = ['whatsapp', 'telegram', 'discord', 'facebook', 'instagram', 'line', 'wechat'];
      
      if (mappedPlatformType && !validPlatforms.includes(mappedPlatformType)) {
        return res.status(400).json({ message: "Invalid platform type. Must be one of: " + Object.keys(platformMapping).join(', ') });
      }
      
      // Color validation (basic hex color check)
      if (widgetColor && !/^#[0-9A-F]{6}$/i.test(widgetColor)) {
        return res.status(400).json({ message: "Widget color must be a valid hex color (e.g., #FF0000)" });
      }
      
      // Validation passed, proceed with creation
      const apiKey = randomBytes(32).toString('hex');
      
      console.log('User context:', req.user);
      console.log('User ID:', req.user?.id);
      
      // Create agent data without full schema validation to allow our custom validation
      const agentData = { 
        name: name.trim(),
        llmProvider: actualProvider,
        model: actualModel,
        llmModel: actualModel, // Also store in llmModel field for compatibility
        systemPrompt: systemPrompt.trim(),
        platformType: mappedPlatformType,
        widgetColor: widgetColor || '#25D366',
        userId: req.user!.id, 
        apiKey,
        ...req.body // Include other valid fields
      };
      
      console.log('Agent data before creation:', agentData);
      
      const agent = await storage.createAgent(agentData);
      res.status(201).json(agent);
    } catch (error: any) {
      console.error('Agent creation error:', error);
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid agent data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create agent" });
    }
  });

  app.put("/api/agents/:id", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertAgentSchema.partial().parse(req.body);
      
      // Check ownership unless admin
      const existingAgent = await storage.getAgent(id);
      if (!existingAgent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      
      if (req.user!.role !== 'admin' && existingAgent.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const agent = await storage.updateAgent(id, validatedData);
      res.json(agent);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid agent data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update agent" });
    }
  });

  app.delete("/api/agents/:id", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check ownership unless admin
      const existingAgent = await storage.getAgent(id);
      if (!existingAgent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      
      if (req.user!.role !== 'admin' && existingAgent.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const deleted = await storage.deleteAgent(id);
      if (!deleted) {
        return res.status(404).json({ message: "Agent not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete agent" });
    }
  });

  app.post("/api/agents/:id/clear-token", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check ownership unless admin
      const existingAgent = await storage.getAgent(id);
      if (!existingAgent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      
      if (req.user!.role !== 'system_admin' && req.user!.role !== 'business_manager' && existingAgent.userId !== req.user!.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Generate new API key
      const newApiKey = require('crypto').randomBytes(32).toString('hex');
      
      const updatedAgent = await storage.updateAgent(id, { apiKey: newApiKey });
      res.json({ message: "Token cleared successfully", agent: updatedAgent });
    } catch (error) {
      console.error('Clear token error:', error);
      res.status(500).json({ message: "Failed to clear agent token" });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Analytics routes
  app.get("/api/analytics/agent/:id", async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const analytics = await storage.getAnalyticsByAgent(agentId);
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Agent cost analytics endpoint
  app.get("/api/analytics/agent/:id/costs", async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const costs = await storage.getAgentCostAnalytics(agentId);
      res.json(costs);
    } catch (error) {
      console.error('Error fetching cost analytics:', error);
      res.status(500).json({ message: "Failed to fetch cost analytics" });
    }
  });

  // WhatsApp Business webhook for incoming messages
  app.post("/api/whatsapp/webhook/:apiKey", async (req, res) => {
    try {
      const { apiKey } = req.params;
      const webhookData = req.body;
      
      // Verify webhook (WhatsApp Business API format)
      if (webhookData.object === 'whatsapp_business_account') {
        const agent = await storage.getAgentByApiKey(apiKey);
        if (!agent || agent.status !== 'active') {
          return res.status(404).json({ message: "Agent not found or inactive" });
        }

        // Process incoming WhatsApp messages
        for (const entry of webhookData.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field === 'messages') {
              const messages = change.value.messages || [];
              
              for (const message of messages) {
                if (message.type === 'text') {
                  await processWhatsAppMessage(agent, message, change.value);
                }
              }
            }
          }
        }
      }
      
      res.status(200).json({ status: 'success' });
    } catch (error) {
      console.error("WhatsApp webhook error:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // WhatsApp webhook verification (GET request)
  app.get("/api/whatsapp/webhook/:apiKey", (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    // Verify the webhook
    if (mode === 'subscribe' && token === 'agentflow_verify_token') {
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Forbidden');
    }
  });

  // Voice calling API endpoints
  app.get("/api/voice-calls", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = req.query.agentId as string;
      if (agentId) {
        const calls = await storage.getVoiceCallsByAgent(parseInt(agentId));
        res.json(calls);
      } else {
        // Get all calls for user's agents
        const userAgents = await storage.getUserAgents(req.user!.id);
        const allCalls = [];
        for (const agent of userAgents) {
          const calls = await storage.getVoiceCallsByAgent(agent.id);
          allCalls.push(...calls);
        }
        res.json(allCalls);
      }
    } catch (error) {
      console.error("Error fetching voice calls:", error);
      res.status(500).json({ message: "Failed to fetch voice calls" });
    }
  });

  app.get("/api/voice-calls/trigger/:agentId", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.agentId);
      const agent = await storage.getAgent(agentId);
      
      if (!agent || agent.userId !== req.user!.id) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const trigger = await storage.getVoiceCallTrigger(agentId);
      res.json(trigger || {
        agentId,
        enabled: false,
        triggerType: "time_based",
        delayMinutes: 15,
        businessHoursOnly: true,
        minEngagementScore: 50,
        requireEmailCapture: false,
        requirePhoneCapture: true,
        maxAttemptsPerLead: 2,
        retryDelayHours: 24,
        voicePersona: "professional",
        callObjective: "answer_questions"
      });
    } catch (error) {
      console.error("Error fetching voice call trigger:", error);
      res.status(500).json({ message: "Failed to fetch trigger settings" });
    }
  });

  app.put("/api/voice-calls/trigger/:agentId", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.agentId);
      const agent = await storage.getAgent(agentId);
      
      if (!agent || agent.userId !== req.user!.id) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const existingTrigger = await storage.getVoiceCallTrigger(agentId);
      
      if (existingTrigger) {
        const updated = await storage.updateVoiceCallTrigger(agentId, req.body);
        res.json(updated);
      } else {
        const created = await storage.createVoiceCallTrigger({
          agentId,
          ...req.body
        });
        res.json(created);
      }
    } catch (error) {
      console.error("Error updating voice call trigger:", error);
      res.status(500).json({ message: "Failed to update trigger settings" });
    }
  });

  app.post("/api/voice-calls/manual", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const { agentId, phoneNumber, triggerReason } = req.body;
      
      const agent = await storage.getAgent(agentId);
      if (!agent || agent.userId !== req.user!.id) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const voiceCall = await voiceCallingService.triggerVoiceCall({
        agentId,
        phoneNumber,
        triggerReason,
        triggeredBy: "manual"
      });

      res.json(voiceCall);
    } catch (error) {
      console.error("Error initiating manual voice call:", error);
      res.status(500).json({ message: "Failed to initiate voice call" });
    }
  });

  app.get("/api/voice-calls/analytics/:agentId", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.agentId);
      const agent = await storage.getAgent(agentId);
      
      if (!agent || agent.userId !== req.user!.id) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const today = new Date().toISOString().split('T')[0];
      const analytics = await storage.getVoiceCallAnalytics(agentId, today);
      
      res.json(analytics || {
        agentId,
        date: today,
        totalCalls: 0,
        successfulConnections: 0,
        failedCalls: 0,
        noAnswers: 0,
        conversions: 0,
        callbacksScheduled: 0,
        notInterested: 0,
        avgCallDuration: 0,
        totalTalkTime: 0,
        avgLeadScore: 0,
        totalCost: 0,
        costPerCall: 0,
        costPerConversion: 0
      });
    } catch (error) {
      console.error("Error fetching voice call analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // LLM-powered chat endpoint for web chat (backup)
  app.post("/api/widget/chat", async (req, res) => {
    try {
      const { apiKey, message, sessionId } = req.body;
      
      if (!apiKey || !message) {
        return res.status(400).json({ message: "API key and message are required" });
      }

      const agent = await storage.getAgentByApiKey(apiKey);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      if (agent.status !== 'active') {
        return res.status(403).json({ message: "Agent is not active" });
      }

      const currentSessionId = sessionId || nanoid();
      
      // Get or create conversation
      let conversation = await storage.getConversationBySession(currentSessionId);
      if (!conversation) {
        conversation = await storage.createConversation({
          agentId: agent.id,
          sessionId: currentSessionId,
          messages: [],
          leadData: {},
        });
      }

      // Add user message
      const userMessage = {
        role: 'user' as const,
        content: message,
        timestamp: new Date().toISOString(),
      };

      const updatedMessages = [...(conversation.messages || []), userMessage];

      // Generate AI response using LLM
      const chatMessages = [
        { role: 'system' as const, content: agent.systemPrompt },
        ...updatedMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      ];

      const aiResponse = await generateChatResponse(chatMessages, agent.llmProvider);
      
      // Add AI response
      const aiMessage = {
        role: 'assistant' as const,
        content: aiResponse.content,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, aiMessage];

      // Update conversation
      await storage.updateConversation(conversation.id, {
        messages: finalMessages,
      });

      // Check if we should qualify this lead
      if (finalMessages.length >= 4) {
        const conversationText = finalMessages.map(m => `${m.role}: ${m.content}`).join('\n');
        const qualification = await qualifyLead(conversationText, agent.leadQualificationQuestions || [], agent.llmProvider);
        
        await storage.updateConversation(conversation.id, {
          leadData: qualification.extractedData,
          conversionScore: qualification.score,
          callScheduled: qualification.recommendation === 'call',
        });
      }

      // Generate WhatsApp handoff URL if conversation should transfer
      let whatsappHandoff = null;
      if (finalMessages.length >= 6 || aiResponse.content.toLowerCase().includes('contact') || aiResponse.content.toLowerCase().includes('speak')) {
        if (agent.whatsappNumber) {
          const handoffMessage = encodeURIComponent(`Continuing our conversation: ${finalMessages.slice(-2).map(m => m.content).join(' ')}`);
          const cleanNumber = agent.whatsappNumber.replace(/[^0-9]/g, '');
          whatsappHandoff = `https://wa.me/${cleanNumber}?text=${handoffMessage}`;
        }
      }

      res.json({
        response: aiResponse.content,
        sessionId: currentSessionId,
        whatsappHandoff,
        shouldTransfer: !!whatsappHandoff,
      });

    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ message: "Failed to process chat message" });
    }
  });

  // Widget tracking endpoint
  app.post("/api/widget/track", async (req, res) => {
    try {
      const { apiKey, action, timestamp } = req.body;
      
      if (!apiKey || !action) {
        return res.status(400).json({ message: "API key and action are required" });
      }

      const agent = await storage.getAgentByApiKey(apiKey);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      // Create analytics entry for tracking
      const today = new Date().toISOString().split('T')[0];
      await storage.createOrUpdateAnalytics({
        agentId: agent.id,
        date: today,
        totalInteractions: 1,
        whatsappRedirects: action === 'whatsapp_redirect' ? 1 : 0,
        conversions: 0,
        avgResponseTime: 0,
      });

      res.status(200).json({ status: 'tracked' });
    } catch (error) {
      res.status(500).json({ message: "Failed to track interaction" });
    }
  });

  // WhatsApp widget configuration endpoint
  app.get("/api/widget/config/:apiKey", async (req, res) => {
    try {
      const { apiKey } = req.params;
      const agent = await storage.getAgentByApiKey(apiKey);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      if (agent.status !== 'active') {
        return res.status(403).json({ message: "Agent is not active" });
      }

      // Return platform-specific configuration
      const baseConfig = {
        welcomeMessage: agent.welcomeMessage,
        widgetColor: agent.widgetColor,
        widgetPosition: agent.widgetPosition,
        platformType: agent.platformType || 'whatsapp',
        enableChat: true,
      };

      // Add platform-specific configuration
      switch (agent.platformType) {
        case 'whatsapp':
          baseConfig.whatsappNumber = agent.whatsappNumber;
          baseConfig.whatsappMode = agent.whatsappMode;
          break;
        case 'telegram':
          baseConfig.telegramUsername = agent.telegramUsername;
          baseConfig.telegramBotToken = agent.telegramBotToken;
          break;
        case 'facebook-messenger':
          baseConfig.facebookPageId = agent.facebookPageId;
          break;
        case 'instagram':
          baseConfig.instagramBusinessId = agent.instagramBusinessId;
          break;
        case 'discord':
          baseConfig.discordGuildId = agent.discordGuildId;
          baseConfig.discordChannelId = agent.discordChannelId;
          break;
      }

      res.json(baseConfig);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch widget configuration" });
    }
  });

  // Generate secure embed code endpoint
  app.get("/api/agents/:id/embed-code", async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const agent = await storage.getAgent(agentId);
      
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      // Create encrypted configuration using base64 encoding for simplicity
      const widgetConfig = {
        apiKey: agent.apiKey,
        position: agent.widgetPosition,
        color: agent.widgetColor,
        welcomeMessage: agent.welcomeMessage,
        whatsappNumber: agent.whatsappNumber,
        whatsappMode: agent.whatsappMode || 'web',
        timestamp: Date.now()
      };
      
      const encryptedConfig = btoa(JSON.stringify(widgetConfig));

      // Generate platform-specific embed codes
      const platformName = agent.platformType || 'whatsapp';
      const widgetFileName = `agentflow-${platformName}-widget.js`;
      
      const secureEmbedCode = `<!-- AgentFlow ${platformName.charAt(0).toUpperCase() + platformName.slice(1)} Widget -->
<script>
(function() {
    var agentflowWidget = document.createElement('script');
    agentflowWidget.src = '${req.protocol}://${req.get('host')}/widget/${widgetFileName}';
    agentflowWidget.setAttribute('data-agent-config', '${encryptedConfig}');
    agentflowWidget.setAttribute('data-platform', '${platformName}');
    agentflowWidget.async = true;
    document.head.appendChild(agentflowWidget);
})();
</script>
<!-- End AgentFlow ${platformName.charAt(0).toUpperCase() + platformName.slice(1)} Widget -->`;

      const legacyEmbedCode = `<!-- AgentFlow ${platformName.charAt(0).toUpperCase() + platformName.slice(1)} Widget (Legacy) -->
<script>
(function() {
    var agentflowWidget = document.createElement('script');
    agentflowWidget.src = '${req.protocol}://${req.get('host')}/widget/${widgetFileName}';
    agentflowWidget.setAttribute('data-agent-id', '${agent.apiKey}');
    agentflowWidget.setAttribute('data-platform', '${platformName}');
    agentflowWidget.setAttribute('data-position', '${agent.widgetPosition}');
    agentflowWidget.setAttribute('data-color', '${agent.widgetColor}');
    agentflowWidget.setAttribute('data-welcome-msg', '${agent.welcomeMessage}');
    agentflowWidget.async = true;
    document.head.appendChild(agentflowWidget);
})();
</script>
<!-- End AgentFlow ${platformName.charAt(0).toUpperCase() + platformName.slice(1)} Widget -->`;

      res.json({
        secureEmbedCode,
        legacyEmbedCode,
        platform: platformName,
        widgetFileName,
        agent: {
          id: agent.id,
          name: agent.name,
          platformType: agent.platformType,
          widgetPosition: agent.widgetPosition,
          widgetColor: agent.widgetColor,
          welcomeMessage: agent.welcomeMessage
        }
      });

    } catch (error) {
      console.error("Error generating embed code:", error);
      res.status(500).json({ message: "Failed to generate embed code" });
    }
  });

  // WhatsApp Business API Webhook verification
  app.get("/webhook/whatsapp/:agentId", async (req, res) => {
    try {
      const { agentId } = req.params;
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      const agent = await storage.getAgent(parseInt(agentId));
      if (!agent) {
        console.log(`Webhook verification failed: Agent ${agentId} not found`);
        return res.status(404).send('Agent not found');
      }

      // Check if WhatsApp is configured for this agent
      if (!agent.whatsappWebhookVerifyToken) {
        console.log(`Webhook verification failed: Agent ${agentId} has no WhatsApp verification token configured`);
        return res.status(400).send('WhatsApp webhook not configured for this agent');
      }

      if (mode === 'subscribe' && token === agent.whatsappWebhookVerifyToken) {
        console.log('WhatsApp webhook verified for agent:', agentId);
        res.status(200).send(challenge);
      } else {
        console.log(`Webhook verification failed: Mode=${mode}, Token match=${token === agent.whatsappWebhookVerifyToken}`);
        res.status(403).send('Verification failed');
      }
    } catch (error) {
      console.error('Error verifying WhatsApp webhook:', error);
      res.status(500).send('Internal server error');
    }
  });

  // WhatsApp Business API Webhook for incoming messages
  app.post("/webhook/whatsapp/:agentId", async (req, res) => {
    try {
      const { agentId } = req.params;
      const webhookData: WhatsAppWebhookPayload = req.body;

      const agent = await storage.getAgent(parseInt(agentId));
      if (!agent) {
        console.log(`WhatsApp webhook failed: Agent ${agentId} not found`);
        return res.status(404).json({ error: "Agent not found" });
      }

      // Check if WhatsApp Business API is properly configured
      if (!agent.whatsappAccessToken || !agent.whatsappPhoneNumberId) {
        console.log(`WhatsApp webhook failed: Agent ${agentId} missing WhatsApp Business API credentials`);
        return res.status(400).json({ 
          error: "WhatsApp Business API not configured", 
          details: "Missing access token or phone number ID" 
        });
      }

      // Process each entry in the webhook payload
      for (const entry of webhookData.entry) {
        for (const change of entry.changes) {
          if (change.field === 'messages') {
            const { messages, contacts, statuses } = change.value;

            // Handle incoming messages
            if (messages) {
              for (const message of messages) {
                // Get sender contact info
                const senderContact = contacts?.find(contact => contact.wa_id === message.from);
                const senderName = senderContact?.profile?.name || 'Unknown';

                // Get or create conversation for this phone number
                let conversation = await storage.getConversationBySession(`whatsapp_${message.from}_${agent.id}`);
                if (!conversation) {
                  conversation = await storage.createConversation({
                    agentId: agent.id,
                    sessionId: `whatsapp_${message.from}_${agent.id}`,
                    messages: [],
                    leadData: {},
                  });
                }

                // Store incoming message
                const incomingMessage = await storage.createWhatsappMessage({
                  agentId: agent.id,
                  conversationId: conversation.id,
                  whatsappMessageId: message.id,
                  fromNumber: message.from,
                  toPhoneNumber: change.value.metadata.phone_number_id,
                  messageType: message.type,
                  content: message.text?.body || `[${message.type} message]`,
                  direction: 'inbound',
                  webhookData: message
                });

                // Process message with AI agent
                const { response, shouldSend } = await whatsappService.processIncomingMessage(
                  agent,
                  message,
                  senderName
                );

                // Send AI response if needed
                if (shouldSend && agent.whatsappAccessToken && agent.whatsappPhoneNumberId) {
                  const sendResult = await whatsappService.sendMessage(
                    agent.whatsappAccessToken,
                    agent.whatsappPhoneNumberId,
                    message.from,
                    response
                  );

                  if (sendResult.success && sendResult.messageId) {
                    // Store outgoing message
                    await storage.createWhatsappMessage({
                      agentId: agent.id,
                      whatsappMessageId: sendResult.messageId,
                      fromPhoneNumber: agent.whatsappNumber || change.value.metadata.display_phone_number,
                      toPhoneNumber: message.from,
                      messageType: 'text',
                      content: response,
                      direction: 'outbound',
                      status: 'sent'
                    });
                  }
                }

                // Mark original message as read
                if (agent.whatsappAccessToken && agent.whatsappPhoneNumberId) {
                  await whatsappService.markMessageAsRead(
                    agent.whatsappAccessToken,
                    agent.whatsappPhoneNumberId,
                    message.id
                  );
                }
              }
            }

            // Handle message status updates
            if (statuses) {
              for (const status of statuses) {
                await storage.updateWhatsappMessageStatus(status.id, status.status);
              }
            }
          }
        }
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error processing WhatsApp webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // WhatsApp message history endpoint
  app.get("/api/agents/:id/whatsapp-messages", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const agent = await storage.getAgent(agentId);
      
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      // Check if user owns this agent (unless admin)
      if (req.user?.role !== 'admin' && agent.userId !== req.user?.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const messages = await storage.getWhatsappMessagesByAgent(agentId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching WhatsApp messages:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // WhatsApp integration status endpoint
  app.get("/api/agents/:id/whatsapp-status", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const agent = await storage.getAgent(agentId);
      
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      // Check if user owns this agent (unless admin)
      if (req.user?.role !== 'admin' && agent.userId !== req.user?.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const status = {
        configured: false,
        issues: [] as string[],
        webhookUrl: `${req.protocol}://${req.get('host')}/webhook/whatsapp/${agentId}`,
        requirements: {
          whatsappNumber: !!agent.whatsappNumber,
          accessToken: !!agent.whatsappAccessToken,
          phoneNumberId: !!agent.whatsappPhoneNumberId,
          webhookVerifyToken: !!agent.whatsappWebhookVerifyToken,
          businessAccountId: !!agent.whatsappBusinessAccountId
        }
      };

      // Check configuration completeness
      if (!agent.whatsappNumber) status.issues.push("WhatsApp Business number not configured");
      if (!agent.whatsappAccessToken) status.issues.push("WhatsApp Business access token not configured");
      if (!agent.whatsappPhoneNumberId) status.issues.push("WhatsApp Business phone number ID not configured");
      if (!agent.whatsappWebhookVerifyToken) status.issues.push("Webhook verification token not configured");
      if (!agent.whatsappBusinessAccountId) status.issues.push("WhatsApp Business account ID not configured");

      status.configured = status.issues.length === 0;

      res.json(status);
    } catch (error) {
      console.error("Error checking WhatsApp status:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Test WhatsApp integration endpoint
  app.post("/api/agents/:id/test-whatsapp", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const agent = await storage.getAgent(agentId);
      
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      // Check if user owns this agent (unless admin)
      if (req.user?.role !== 'admin' && agent.userId !== req.user?.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      interface TestResult {
        name: string;
        passed: boolean;
        issues: string[];
      }

      const testResults = {
        success: true,
        tests: [] as TestResult[],
        summary: "",
        webhookUrl: `${req.protocol}://${req.get('host')}/webhook/whatsapp/${agentId}`
      };

      // Test 1: Configuration completeness
      const configTest: TestResult = {
        name: "Configuration Check",
        passed: true,
        issues: []
      };

      if (!agent.whatsappNumber) {
        configTest.passed = false;
        configTest.issues.push("WhatsApp Business number missing");
      }
      if (!agent.whatsappAccessToken) {
        configTest.passed = false;
        configTest.issues.push("Access token missing");
      }
      if (!agent.whatsappPhoneNumberId) {
        configTest.passed = false;
        configTest.issues.push("Phone number ID missing");
      }
      if (!agent.whatsappWebhookVerifyToken) {
        configTest.passed = false;
        configTest.issues.push("Webhook verify token missing");
      }

      if (configTest.passed) {
        configTest.issues.push("All required credentials configured");
      }

      testResults.tests.push(configTest);

      // Test 2: API connectivity (if configured)
      if (agent.whatsappAccessToken && agent.whatsappPhoneNumberId) {
        const apiTest: TestResult = {
          name: "WhatsApp API Connectivity",
          passed: false,
          issues: []
        };

        try {
          // Test API connectivity by fetching phone number info
          const testResult = await whatsappService.getPhoneNumberInfo(
            agent.whatsappAccessToken,
            agent.whatsappPhoneNumberId
          );

          if (testResult.success) {
            apiTest.passed = true;
            apiTest.issues.push("API connection successful");
          } else {
            apiTest.issues.push(`API error: ${testResult.error}`);
          }
        } catch (error: any) {
          apiTest.issues.push(`Network error: ${error.message || 'Unknown error'}`);
        }

        testResults.tests.push(apiTest);
      } else {
        const apiTest: TestResult = {
          name: "WhatsApp API Connectivity",
          passed: false,
          issues: ["Cannot test API - missing credentials"]
        };
        testResults.tests.push(apiTest);
      }

      // Generate summary
      const passedTests = testResults.tests.filter(t => t.passed).length;
      const totalTests = testResults.tests.length;
      
      if (passedTests === totalTests) {
        testResults.summary = "WhatsApp integration is properly configured and ready to use";
      } else {
        testResults.success = false;
        testResults.summary = `${totalTests - passedTests} configuration issues found. Please configure WhatsApp Business API credentials.`;
      }

      res.json(testResults);
    } catch (error) {
      console.error("Error testing WhatsApp integration:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Send WhatsApp message manually
  // System Admin Logging API Endpoints
  app.get("/api/admin/logs", authenticate, requireSystemAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const {
        level,
        category,
        userId,
        agentId,
        startDate,
        endDate,
        search,
        limit = 50,
        offset = 0
      } = req.query;

      const filters: any = {};
      if (level) filters.level = level as string;
      if (category) filters.category = category as string;
      if (userId) filters.userId = parseInt(userId as string);
      if (agentId) filters.agentId = parseInt(agentId as string);
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (search) filters.search = search as string;
      filters.limit = parseInt(limit as string);
      filters.offset = parseInt(offset as string);

      const logs = await logger.getLogs(filters);
      
      await logger.logApiRequest('GET', '/api/admin/logs', 200, Date.now(), req.user?.id, {
        filters,
        resultCount: logs.length
      });

      res.json(logs);
    } catch (error) {
      await logger.logError(error as Error, 'admin_logs_fetch', req.user?.id);
      res.status(500).json({ message: "Failed to fetch logs" });
    }
  });

  app.get("/api/admin/logs/stats", authenticate, requireSystemAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      const filters: { startDate?: Date; endDate?: Date } = {};
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      const stats = await logger.getLogStats(filters.startDate, filters.endDate);
      
      await logger.logApiRequest('GET', '/api/admin/logs/stats', 200, Date.now(), req.user?.id);

      res.json(stats);
    } catch (error) {
      await logger.logError(error as Error, 'admin_logs_stats', req.user?.id);
      res.status(500).json({ message: "Failed to fetch log statistics" });
    }
  });

  app.delete("/api/admin/logs/cleanup", authenticate, requireSystemAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { daysToKeep = 30 } = req.body;
      
      const deletedCount = await logger.cleanupOldLogs(parseInt(daysToKeep));
      
      await logger.logApiRequest('DELETE', '/api/admin/logs/cleanup', 200, Date.now(), req.user?.id, {
        daysToKeep,
        deletedCount
      });

      res.json({ message: `Cleaned up ${deletedCount} old logs`, deletedCount });
    } catch (error) {
      await logger.logError(error as Error, 'admin_logs_cleanup', req.user?.id);
      res.status(500).json({ message: "Failed to cleanup logs" });
    }
  });

  app.post("/api/agents/:id/send-whatsapp", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const { phoneNumber, message } = req.body;

      if (!phoneNumber || !message) {
        return res.status(400).json({ error: "Phone number and message are required" });
      }

      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      // Check if user owns this agent (unless admin)
      if (req.user?.role !== 'admin' && agent.userId !== req.user?.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!agent.whatsappAccessToken || !agent.whatsappPhoneNumberId) {
        return res.status(400).json({ error: "WhatsApp Business API not configured for this agent" });
      }

      const result = await whatsappService.sendMessage(
        agent.whatsappAccessToken,
        agent.whatsappPhoneNumberId,
        phoneNumber,
        message
      );

      if (result.success && result.messageId) {
        // Store outgoing message
        await storage.createWhatsappMessage({
          agentId: agent.id,
          whatsappMessageId: result.messageId,
          fromPhoneNumber: agent.whatsappNumber || (agent.whatsappPhoneNumberId || ""),
          toPhoneNumber: phoneNumber,
          messageType: 'text',
          content: message,
          direction: 'outbound',
          status: 'sent'
        });

        res.json({ success: true, messageId: result.messageId });
      } else {
        res.status(400).json({ error: result.error || "Failed to send message" });
      }
    } catch (error) {
      console.error("Error sending WhatsApp message:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });



  // Multi-platform webhook endpoints
  app.post("/webhook/telegram/:agentId", async (req, res) => {
    try {
      const agentId = parseInt(req.params.agentId);
      const agent = await storage.getAgent(agentId);
      
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      await telegramService.processWebhookPayload(req.body, agent);
      res.status(200).json({ status: "success" });
    } catch (error) {
      console.error("Telegram webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/webhook/messenger/:agentId", async (req, res) => {
    try {
      const agentId = parseInt(req.params.agentId);
      const agent = await storage.getAgent(agentId);
      
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      await facebookMessengerService.processWebhookPayload(req.body, agent);
      res.status(200).json({ status: "success" });
    } catch (error) {
      console.error("Messenger webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/webhook/messenger/:agentId", async (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe') {
      const agentId = parseInt(req.params.agentId);
      const agent = await storage.getAgent(agentId);
      
      if (agent && agent.facebookAccessToken && token === `verify_${agentId}`) {
        res.status(200).send(challenge);
      } else {
        res.status(403).send('Forbidden');
      }
    } else {
      res.status(400).send('Bad Request');
    }
  });

  app.post("/webhook/instagram/:agentId", async (req, res) => {
    try {
      const agentId = parseInt(req.params.agentId);
      const agent = await storage.getAgent(agentId);
      
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      await instagramService.processWebhookPayload(req.body, agent);
      res.status(200).json({ status: "success" });
    } catch (error) {
      console.error("Instagram webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/webhook/instagram/:agentId", async (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe') {
      const agentId = parseInt(req.params.agentId);
      const agent = await storage.getAgent(agentId);
      
      if (agent && agent.instagramAccessToken && token === `verify_${agentId}`) {
        res.status(200).send(challenge);
      } else {
        res.status(403).send('Forbidden');
      }
    } else {
      res.status(400).send('Bad Request');
    }
  });

  app.post("/webhook/discord/:agentId", async (req, res) => {
    try {
      const agentId = parseInt(req.params.agentId);
      const agent = await storage.getAgent(agentId);
      
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      await discordService.processWebhookPayload(req.body, agent);
      res.status(200).json({ status: "success" });
    } catch (error) {
      console.error("Discord webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Platform testing endpoint
  // Get conversation flow templates
  app.get("/api/conversation-flow-templates", async (req, res) => {
    try {
      const templates = [
        {
          id: 'lead-qualification',
          name: 'Lead Qualification Flow',
          description: 'Qualify potential customers by collecting contact information and understanding their needs',
          category: 'sales',
          preview: 'Welcome → Name Collection → Email Collection → Lead Qualification → Save'
        },
        {
          id: 'customer-support',
          name: 'Customer Support Triage',
          description: 'Route customer inquiries to appropriate support channels based on issue type',
          category: 'support',
          preview: 'Greeting → Issue Type Check → Route to Specialist → Create Ticket'
        },
        {
          id: 'appointment-booking',
          name: 'Appointment Booking Flow',
          description: 'Guide customers through booking an appointment or consultation',
          category: 'booking',
          preview: 'Service Selection → Availability Check → Contact Collection → Confirmation'
        },
        {
          id: 'product-recommendation',
          name: 'Product Recommendation Engine',
          description: 'Guide customers to find the right products based on their needs and preferences',
          category: 'sales',
          preview: 'Needs Assessment → Budget Discussion → Product Matching → Recommendation'
        },
        {
          id: 'feedback-collection',
          name: 'Customer Feedback Collection',
          description: 'Collect valuable customer feedback and handle complaints professionally',
          category: 'feedback',
          preview: 'Feedback Request → Sentiment Analysis → Response Routing → Follow-up'
        },
        {
          id: 'onboarding-flow',
          name: 'New Customer Onboarding',
          description: 'Welcome new customers and guide them through initial setup or first steps',
          category: 'onboarding',
          preview: 'Welcome → Customer Type → Setup Guidance → Profile Update'
        }
      ];
      
      res.json(templates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });

  // Get specific conversation flow template
  app.get("/api/conversation-flow-templates/:id", async (req, res) => {
    try {
      const templateId = req.params.id;
      
      // For now, return basic templates - in production this would load from JSON file
      const templates: any = {
        'lead-qualification': {
          nodes: [
            {
              id: 'start-1',
              type: 'start',
              position: { x: 100, y: 50 },
              data: { label: 'Start Conversation' }
            },
            {
              id: 'welcome-1',
              type: 'message',
              position: { x: 100, y: 150 },
              data: {
                label: 'Welcome Message',
                message: 'Hello! Welcome to our business. I\'m here to help you find exactly what you need. May I start by getting your name?'
              }
            },
            {
              id: 'name-check-1',
              type: 'condition',
              position: { x: 100, y: 280 },
              data: {
                label: 'Has Name?',
                condition: 'user_input length > 2'
              }
            },
            {
              id: 'collect-email-1',
              type: 'message',
              position: { x: 300, y: 380 },
              data: {
                label: 'Collect Email',
                message: 'Great to meet you! Could you please share your email address so we can send you more information?'
              }
            },
            {
              id: 'save-lead-1',
              type: 'action',
              position: { x: 300, y: 510 },
              data: {
                label: 'Save Lead Info',
                action: 'save_lead_info'
              }
            }
          ],
          edges: [
            { id: 'e1', source: 'start-1', target: 'welcome-1' },
            { id: 'e2', source: 'welcome-1', target: 'name-check-1' },
            { id: 'e3', source: 'name-check-1', target: 'collect-email-1', label: 'Yes' },
            { id: 'e4', source: 'collect-email-1', target: 'save-lead-1' }
          ]
        },
        'customer-support': {
          nodes: [
            {
              id: 'start-2',
              type: 'start',
              position: { x: 100, y: 50 },
              data: { label: 'Support Start' }
            },
            {
              id: 'support-greeting-2',
              type: 'message',
              position: { x: 100, y: 150 },
              data: {
                label: 'Support Greeting',
                message: 'Hi! I\'m here to help you with any questions or issues. Please describe what you need assistance with.'
              }
            },
            {
              id: 'issue-type-2',
              type: 'condition',
              position: { x: 100, y: 280 },
              data: {
                label: 'Issue Type Check',
                condition: 'user_input contains "billing" or "payment" or "refund"'
              }
            },
            {
              id: 'billing-support-2',
              type: 'message',
              position: { x: 300, y: 380 },
              data: {
                label: 'Billing Support',
                message: 'I understand you have a billing-related question. Let me connect you with our billing specialist.'
              }
            },
            {
              id: 'general-support-2',
              type: 'message',
              position: { x: -100, y: 380 },
              data: {
                label: 'General Support',
                message: 'Thank you for reaching out. I\'ll make sure your inquiry gets to the right person.'
              }
            }
          ],
          edges: [
            { id: 'e1', source: 'start-2', target: 'support-greeting-2' },
            { id: 'e2', source: 'support-greeting-2', target: 'issue-type-2' },
            { id: 'e3', source: 'issue-type-2', target: 'billing-support-2', label: 'Billing' },
            { id: 'e4', source: 'issue-type-2', target: 'general-support-2', label: 'Other' }
          ]
        }
      };

      const template = templates[templateId];
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      res.json(template);
    } catch (error) {
      console.error('Error fetching template:', error);
      res.status(500).json({ error: 'Failed to fetch template' });
    }
  });

  // Business onboarding routes
  app.get("/api/onboarding", authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const onboarding = await storage.getBusinessOnboarding(userId);
      
      if (!onboarding) {
        // Return default onboarding state
        res.json({
          currentStep: 1,
          totalSteps: 5,
          stepData: {},
          completedSteps: [],
          status: 'not_started'
        });
      } else {
        res.json(onboarding);
      }
    } catch (error) {
      console.error('Error fetching onboarding:', error);
      res.status(500).json({ error: 'Failed to fetch onboarding progress' });
    }
  });

  app.post("/api/onboarding/save-step", authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const { step, stepData } = req.body;
      
      if (!step || !stepData) {
        return res.status(400).json({ error: 'Step number and step data are required' });
      }

      const onboarding = await storage.saveOnboardingStep(userId, step, stepData);
      res.json(onboarding);
    } catch (error) {
      console.error('Error saving onboarding step:', error);
      res.status(500).json({ error: 'Failed to save onboarding step' });
    }
  });

  app.post("/api/onboarding/complete-step", authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const { step } = req.body;
      
      if (!step) {
        return res.status(400).json({ error: 'Step number is required' });
      }

      const onboarding = await storage.markStepCompleted(userId, step);
      res.json(onboarding);
    } catch (error) {
      console.error('Error completing onboarding step:', error);
      res.status(500).json({ error: 'Failed to complete onboarding step' });
    }
  });

  app.post("/api/onboarding/complete", authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const onboarding = await storage.completeOnboarding(userId);
      res.json(onboarding);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      res.status(500).json({ error: 'Failed to complete onboarding' });
    }
  });

  // AI Training endpoints
  app.post("/api/agents/:id/knowledge", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { title, content, category, tags, metadata } = req.body;

      const knowledgeItem = await storage.addKnowledgeItem(agentId, userId, {
        title,
        content,
        category,
        tags: tags || [],
        metadata: metadata || {},
      });

      res.json(knowledgeItem);
    } catch (error) {
      console.error("Error adding knowledge item:", error);
      res.status(500).json({ error: "Failed to add knowledge item" });
    }
  });

  app.get("/api/agents/:id/knowledge", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const knowledgeItems = await storage.getKnowledgeItems(agentId);
      res.json(knowledgeItems);
    } catch (error) {
      console.error("Error getting knowledge items:", error);
      res.status(500).json({ error: "Failed to get knowledge items" });
    }
  });

  app.post("/api/agents/:id/training", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { sessionName, trainingData, brandVoiceConfig, businessContextConfig } = req.body;

      const session = await storage.createTrainingSession({
        agentId,
        userId,
        sessionName,
        trainingData,
        brandVoiceConfig,
        businessContextConfig,
        status: 'pending',
        progressPercentage: 0,
      });

      // Start training process asynchronously
      const { AITrainingService } = await import('./services/ai-training');
      AITrainingService.processTrainingSession(session.id);

      res.json(session);
    } catch (error) {
      console.error("Error starting training:", error);
      res.status(500).json({ error: "Failed to start training" });
    }
  });

  app.get("/api/agents/:id/training-sessions", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const sessions = await storage.getTrainingSessions(agentId);
      res.json(sessions);
    } catch (error) {
      console.error("Error getting training sessions:", error);
      res.status(500).json({ error: "Failed to get training sessions" });
    }
  });

  app.get("/api/training-sessions/:id/status", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const sessionId = parseInt(req.params.id);
      const session = await storage.getTrainingSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ error: "Training session not found" });
      }

      res.json(session);
    } catch (error) {
      console.error("Error getting training session status:", error);
      res.status(500).json({ error: "Failed to get training session status" });
    }
  });

  // Enhanced AI response endpoint
  app.post("/api/agents/:id/enhanced-response", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const { message, context } = req.body;

      const { EnhancedAIService } = await import('./services/enhanced-ai-service');
      const response = await EnhancedAIService.getEnhancedResponse(agentId, message, context);

      res.json(response);
    } catch (error) {
      console.error("Error getting enhanced response:", error);
      res.status(500).json({ error: "Failed to get enhanced response" });
    }
  });

  // Training analysis endpoint
  app.post("/api/agents/:id/analyze-training", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const { conversations } = req.body;

      const { EnhancedAIService } = await import('./services/enhanced-ai-service');
      const analysis = await EnhancedAIService.analyzeConversationForTraining(agentId, conversations);

      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing training:", error);
      res.status(500).json({ error: "Failed to analyze training" });
    }
  });

  // Platform-specific training recommendations
  app.get("/api/agents/:id/platform-recommendations/:platform", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const platform = req.params.platform;

      const { PlatformAIIntegration } = await import('./services/platform-ai-integration');
      const recommendations = await PlatformAIIntegration.getPlatformTrainingRecommendations(platform, agentId);

      res.json(recommendations);
    } catch (error) {
      console.error("Error getting platform recommendations:", error);
      res.status(500).json({ error: "Failed to get platform recommendations" });
    }
  });

  // Platform conversation analysis
  app.get("/api/agents/:id/platform-analysis/:platform", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const platform = req.params.platform;

      const { PlatformAIIntegration } = await import('./services/platform-ai-integration');
      const analysis = await PlatformAIIntegration.analyzeplatformConversations(agentId, platform);

      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing platform conversations:", error);
      res.status(500).json({ error: "Failed to analyze platform conversations" });
    }
  });

  // Data source integration endpoints
  app.post("/api/agents/:id/import/csv", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { csvData } = req.body;

      const { DataSourceIntegrations } = await import('./services/data-source-integrations');
      const result = await DataSourceIntegrations.importFromCSV(agentId, userId, csvData);

      res.json(result);
    } catch (error) {
      console.error("Error importing CSV:", error);
      res.status(500).json({ error: "Failed to import CSV data" });
    }
  });

  app.post("/api/agents/:id/import/json", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { jsonData } = req.body;

      const { DataSourceIntegrations } = await import('./services/data-source-integrations');
      const result = await DataSourceIntegrations.importKnowledgeFromJSON(agentId, userId, jsonData);

      res.json(result);
    } catch (error) {
      console.error("Error importing JSON:", error);
      res.status(500).json({ error: "Failed to import JSON knowledge base" });
    }
  });

  app.post("/api/agents/:id/connect/crm", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { type, apiKey, baseUrl } = req.body;

      const { DataSourceIntegrations } = await import('./services/data-source-integrations');
      const result = await DataSourceIntegrations.connectToCRM(agentId, userId, { type, apiKey, baseUrl });

      res.json(result);
    } catch (error) {
      console.error("Error connecting to CRM:", error);
      res.status(500).json({ error: "Failed to connect to CRM system" });
    }
  });

  app.post("/api/agents/:id/import/website", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { url, selectors, maxPages } = req.body;

      const { DataSourceIntegrations } = await import('./services/data-source-integrations');
      const result = await DataSourceIntegrations.importFromWebsite(agentId, userId, { url, selectors, maxPages });

      res.json(result);
    } catch (error) {
      console.error("Error importing from website:", error);
      res.status(500).json({ error: "Failed to import website content" });
    }
  });

  app.post("/api/agents/:id/connect/helpdesk", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { type, apiKey, domain } = req.body;

      const { DataSourceIntegrations } = await import('./services/data-source-integrations');
      const result = await DataSourceIntegrations.connectToHelpDesk(agentId, userId, { type, apiKey, domain });

      res.json(result);
    } catch (error) {
      console.error("Error connecting to help desk:", error);
      res.status(500).json({ error: "Failed to connect to help desk system" });
    }
  });

  app.post("/api/agents/:id/import/google-sheets", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { spreadsheetId, range, apiKey } = req.body;

      const { DataSourceIntegrations } = await import('./services/data-source-integrations');
      const result = await DataSourceIntegrations.importFromGoogleSheets(agentId, userId, { spreadsheetId, range, apiKey });

      res.json(result);
    } catch (error) {
      console.error("Error importing from Google Sheets:", error);
      res.status(500).json({ error: "Failed to import from Google Sheets" });
    }
  });

  app.post("/api/agents/:id/enable-real-time-learning", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const userId = req.user!.id;
      const { autoApprove, feedbackThreshold, learningRate } = req.body;

      const { DataSourceIntegrations } = await import('./services/data-source-integrations');
      const result = await DataSourceIntegrations.enableRealTimeLearning(agentId, userId, {
        autoApprove: autoApprove || false,
        feedbackThreshold: feedbackThreshold || 0.7,
        learningRate: learningRate || 0.5
      });

      res.json(result);
    } catch (error) {
      console.error("Error enabling real-time learning:", error);
      res.status(500).json({ error: "Failed to enable real-time learning" });
    }
  });

  // Health monitoring endpoints
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: "1.0.0"
    });
  });

  app.get("/api/health/ready", (req, res) => {
    res.json({ 
      status: "ready", 
      database: "connected",
      timestamp: new Date().toISOString()
    });
  });

  app.get("/api/health/live", (req, res) => {
    res.json({ 
      status: "live", 
      timestamp: new Date().toISOString()
    });
  });

  app.get("/api/metrics", (req, res) => {
    res.json({
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
      nodeVersion: process.version
    });
  });

  // Analytics summary endpoint
  app.get("/api/analytics/summary", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const agents = await storage.getUserAgents(userId);
      const analytics = await storage.getAnalyticsSummary(userId);
      
      res.json({
        totalAgents: agents.length,
        activeAgents: agents.filter(a => a.status === 'active').length,
        totalConversations: analytics?.totalConversations || 0,
        totalMessages: analytics?.totalMessages || 0,
        avgResponseTime: analytics?.avgResponseTime || 0
      });
    } catch (error) {
      console.error('Error getting analytics summary:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Embed code generation endpoints
  app.get("/api/embed/:platform/:apiKey", async (req, res) => {
    try {
      const { platform, apiKey } = req.params;
      
      // Validate platform
      const validPlatforms = ['whatsapp', 'telegram', 'discord', 'facebook', 'instagram'];
      if (!validPlatforms.includes(platform)) {
        return res.status(400).json({ error: 'Invalid platform' });
      }

      // Get agent by API key
      const agent = await storage.getAgentByApiKey(apiKey);
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      // Generate embed code based on platform
      const embedCode = generateEmbedCode(platform, agent);
      
      res.setHeader('Content-Type', 'application/javascript');
      res.send(embedCode);
    } catch (error) {
      console.error('Error generating embed code:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Conversation flow templates endpoint
  app.get("/api/conversation-flow/templates", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const templates = [
        {
          id: 1,
          name: "Lead Qualification",
          description: "Qualify leads and gather contact information",
          category: "sales",
          nodes: [
            { id: "start", type: "start", data: { label: "Start" } },
            { id: "welcome", type: "message", data: { message: "Hi! How can I help you today?" } },
            { id: "end", type: "end", data: { label: "End" } }
          ],
          edges: [
            { id: "e1", source: "start", target: "welcome" },
            { id: "e2", source: "welcome", target: "end" }
          ]
        },
        {
          id: 2,
          name: "Customer Support",
          description: "Handle customer support inquiries",
          category: "support",
          nodes: [
            { id: "start", type: "start", data: { label: "Start" } },
            { id: "support", type: "message", data: { message: "I'm here to help with your support request." } },
            { id: "end", type: "end", data: { label: "End" } }
          ],
          edges: [
            { id: "e1", source: "start", target: "support" },
            { id: "e2", source: "support", target: "end" }
          ]
        }
      ];
      
      res.json(templates);
    } catch (error) {
      console.error('Error getting conversation flow templates:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post("/api/agents/:id/test-platform", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const { platform } = req.body;
      const agent = await storage.getAgent(agentId);
      
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      if (req.user?.role !== 'admin' && req.user?.role !== 'system_admin' && agent.userId !== req.user?.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const testResults: any = {
        platform,
        success: false,
        tests: [],
        webhookUrl: `${req.protocol}://${req.get('host')}/webhook/${platform}/${agentId}`
      };

      switch (platform) {
        case 'telegram':
          if (agent.telegramBotToken) {
            try {
              const botInfo = await telegramService.getBotInfo(agent.telegramBotToken);
              testResults.tests.push({
                name: "Bot Token Validation",
                passed: true,
                details: `Bot: ${botInfo.result.first_name} (@${botInfo.result.username})`
              });
              testResults.success = true;
            } catch (error: any) {
              testResults.tests.push({
                name: "Bot Token Validation",
                passed: false,
                error: error.message
              });
            }
          } else {
            testResults.tests.push({
              name: "Configuration Check",
              passed: false,
              error: "Telegram bot token not configured"
            });
          }
          break;

        case 'messenger':
          if (agent.facebookAccessToken) {
            try {
              const pageInfo = await facebookMessengerService.getPageInfo(agent.facebookAccessToken);
              testResults.tests.push({
                name: "Page Access Token Validation",
                passed: true,
                details: `Page: ${pageInfo.name} (ID: ${pageInfo.id})`
              });
              testResults.success = true;
            } catch (error: any) {
              testResults.tests.push({
                name: "Page Access Token Validation",
                passed: false,
                error: error.message
              });
            }
          } else {
            testResults.tests.push({
              name: "Configuration Check",
              passed: false,
              error: "Facebook access token not configured"
            });
          }
          break;

        case 'instagram':
          if (agent.instagramAccessToken && agent.instagramBusinessId) {
            try {
              const businessInfo = await instagramService.getBusinessAccountInfo(
                agent.instagramAccessToken, 
                agent.instagramBusinessId
              );
              testResults.tests.push({
                name: "Business Account Validation",
                passed: true,
                details: `Account: ${businessInfo.name} (@${businessInfo.username})`
              });
              testResults.success = true;
            } catch (error: any) {
              testResults.tests.push({
                name: "Business Account Validation",
                passed: false,
                error: error.message
              });
            }
          } else {
            testResults.tests.push({
              name: "Configuration Check",
              passed: false,
              error: "Instagram access token or business ID not configured"
            });
          }
          break;

        case 'discord':
          if (agent.discordBotToken) {
            try {
              const botUser = await discordService.getBotUser(agent.discordBotToken);
              testResults.tests.push({
                name: "Bot Token Validation",
                passed: true,
                details: `Bot: ${botUser.username}#${botUser.discriminator}`
              });
              
              if (agent.discordGuildId) {
                try {
                  const guild = await discordService.getGuild(agent.discordBotToken, agent.discordGuildId);
                  testResults.tests.push({
                    name: "Guild Access",
                    passed: true,
                    details: `Guild: ${guild.name}`
                  });
                } catch (error: any) {
                  testResults.tests.push({
                    name: "Guild Access",
                    passed: false,
                    error: error.message
                  });
                }
              }
              
              testResults.success = true;
            } catch (error: any) {
              testResults.tests.push({
                name: "Bot Token Validation",
                passed: false,
                error: error.message
              });
            }
          } else {
            testResults.tests.push({
              name: "Configuration Check",
              passed: false,
              error: "Discord bot token not configured"
            });
          }
          break;

        default:
          return res.status(400).json({ error: "Unsupported platform" });
      }

      res.json(testResults);
    } catch (error) {
      console.error("Platform test error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // 404 handler for unmatched API routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  const httpServer = createServer(app);
  return httpServer;
}
