import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAgentSchema, insertConversationSchema, insertUserSchema, loginSchema } from "@shared/schema";
import { generateChatResponse, qualifyLead } from "./services/llm-providers";
import { authenticate, requireAdmin, requireApproved, requireSystemAdmin, requireBusinessManager, AuthenticatedRequest, AuthService } from "./auth";
import { nanoid } from "nanoid";
import { createSecureWidgetConfig } from "./encryption";
import { whatsappService, type WhatsAppWebhookPayload } from "./services/whatsapp-business";
import { voiceCallingService } from "./services/voice-calling";
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

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
      // First validate the input (expecting password, not passwordHash)
      const { password, ...otherData } = req.body;
      if (!password) {
        return res.status(400).json({ message: 'Password is required' });
      }

      // Hash the password
      const passwordHash = await AuthService.hashPassword(password);
      
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
    res.json({ user: req.user });
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
  app.get("/api/models", authenticate, requireApproved, async (req, res) => {
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

  // Industry verticals endpoint
  app.get("/api/industry-verticals", async (req, res) => {
    try {
      const configPath = path.join(process.cwd(), 'models', 'industry_verticals.yaml');
      const fileContents = fs.readFileSync(configPath, 'utf8');
      const config = yaml.load(fileContents) as any;
      res.json(config.industry_verticals);
    } catch (error: any) {
      console.error('Error loading industry verticals config:', error);
      res.status(500).json({ message: "Failed to load industry verticals configuration" });
    }
  });

  // Business Templates API for B2B SaaS
  app.get("/api/business-templates", authenticate, requireApproved, async (req, res) => {
    try {
      const { BusinessTemplateService } = await import('./services/business-templates');
      const templateService = new BusinessTemplateService();
      
      const category = req.query.category as string;
      const templates = category 
        ? templateService.getTemplatesByCategory(category)
        : templateService.getAllTemplates();
      
      res.json(templates);
    } catch (error: any) {
      console.error('Error loading business templates:', error);
      res.status(500).json({ message: "Failed to load business templates" });
    }
  });

  app.get("/api/business-templates/categories", authenticate, requireApproved, async (req, res) => {
    try {
      const { BusinessTemplateService } = await import('./services/business-templates');
      const templateService = new BusinessTemplateService();
      const categories = templateService.getCategories();
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
      const validatedData = insertAgentSchema.parse(req.body);
      const agentData = { ...validatedData, userId: req.user!.id };
      const agent = await storage.createAgent(agentData);
      res.status(201).json(agent);
    } catch (error: any) {
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

      res.json({
        welcomeMessage: agent.welcomeMessage,
        widgetColor: agent.widgetColor,
        widgetPosition: agent.widgetPosition,
        whatsappNumber: agent.whatsappNumber,
        whatsappMode: agent.whatsappMode,
        enableChat: true, // Enable LLM chat functionality
      });
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

      // Generate both secure and legacy embed codes
      const secureEmbedCode = `<!-- AgentFlow Secure Widget -->
<script>
(function() {
    var agentflowWidget = document.createElement('script');
    agentflowWidget.src = '${req.protocol}://${req.get('host')}/widget/agentflow-widget.js';
    agentflowWidget.setAttribute('data-agent-config', '${encryptedConfig}');
    agentflowWidget.async = true;
    document.head.appendChild(agentflowWidget);
})();
</script>
<!-- End AgentFlow Widget -->`;

      const legacyEmbedCode = `<!-- AgentFlow Widget (Legacy) -->
<script>
(function() {
    var agentflowWidget = document.createElement('script');
    agentflowWidget.src = '${req.protocol}://${req.get('host')}/widget/agentflow-widget.js';
    agentflowWidget.setAttribute('data-agent-id', '${agent.apiKey}');
    agentflowWidget.setAttribute('data-position', '${agent.widgetPosition}');
    agentflowWidget.setAttribute('data-color', '${agent.widgetColor}');
    agentflowWidget.setAttribute('data-welcome-msg', '${agent.welcomeMessage}');
    agentflowWidget.async = true;
    document.head.appendChild(agentflowWidget);
})();
</script>
<!-- End AgentFlow Widget -->`;

      res.json({
        secureEmbedCode,
        legacyEmbedCode,
        agent: {
          id: agent.id,
          name: agent.name,
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
                  fromPhoneNumber: message.from,
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

  const httpServer = createServer(app);
  return httpServer;
}
