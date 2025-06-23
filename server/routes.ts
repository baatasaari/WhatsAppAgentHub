import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAgentSchema, insertConversationSchema, insertUserSchema, loginSchema } from "@shared/schema";
import { generateChatResponse, qualifyLead } from "./services/llm-providers";
import { authenticate, requireAdmin, requireApproved, AuthenticatedRequest, AuthService } from "./auth";
import { nanoid } from "nanoid";
import { createSecureWidgetConfig } from "./encryption";
import { whatsappService, type WhatsAppWebhookPayload } from "./services/whatsapp-business";
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
      const userData = insertUserSchema.parse(req.body);
      
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

  app.post('/api/admin/users/:id/approve', authenticate, requireAdmin, async (req: AuthenticatedRequest, res) => {
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

  app.post('/api/admin/users/:id/suspend', authenticate, requireAdmin, async (req: AuthenticatedRequest, res) => {
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

  app.delete('/api/admin/users/:id', authenticate, requireAdmin, async (req: AuthenticatedRequest, res) => {
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
  
  // LLM Models configuration endpoints
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

  app.post("/api/models", async (req, res) => {
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

  app.put("/api/models/:id", async (req, res) => {
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

  app.delete("/api/models/:id", async (req, res) => {
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

  app.put("/api/models/reorder", async (req, res) => {
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

  // Protected agent routes - require approved users
  app.get("/api/agents", authenticate, requireApproved, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.role === 'admin' ? undefined : req.user!.id;
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
      if (req.user!.role !== 'admin' && agent.userId !== req.user!.id) {
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
        return res.status(404).send('Agent not found');
      }

      if (mode === 'subscribe' && token === agent.whatsappWebhookVerifyToken) {
        console.log('WhatsApp webhook verified for agent:', agentId);
        res.status(200).send(challenge);
      } else {
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
        return res.status(404).json({ error: "Agent not found" });
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

                // Update conversation with the new message
                await storage.updateConversation(conversation.id, {
                  messages: [
                    ...(conversation.messages || []),
                    {
                      role: 'user',
                      content: message.text?.body || `[${message.type} message]`,
                      timestamp: new Date().toISOString()
                    }
                  ]
                });

                // Process message with AI agent using full conversation context
                const { response, shouldSend } = await whatsappService.processIncomingMessage(
                  agent,
                  message,
                  senderName,
                  conversation.id
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
                      conversationId: conversation.id,
                      whatsappMessageId: sendResult.messageId,
                      fromPhoneNumber: agent.whatsappNumber || change.value.metadata.display_phone_number,
                      toPhoneNumber: message.from,
                      messageType: 'text',
                      content: response,
                      direction: 'outbound',
                      status: 'sent'
                    });

                    // Update conversation with AI response
                    await storage.updateConversation(conversation.id, {
                      messages: [
                        ...(conversation.messages || []),
                        {
                          role: 'user',
                          content: message.text?.body || `[${message.type} message]`,
                          timestamp: new Date().toISOString()
                        },
                        {
                          role: 'assistant',
                          content: response,
                          timestamp: new Date().toISOString()
                        }
                      ]
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
