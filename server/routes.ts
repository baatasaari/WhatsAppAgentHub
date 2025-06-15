import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAgentSchema, insertConversationSchema } from "@shared/schema";
import { generateChatResponse, qualifyLead } from "./services/openai";
import { nanoid } from "nanoid";
import { createSecureWidgetConfig } from "./encryption";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Agent routes
  app.get("/api/agents", async (req, res) => {
    try {
      const agents = await storage.getAllAgents();
      res.json(agents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });

  app.get("/api/agents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch agent" });
    }
  });

  app.post("/api/agents", async (req, res) => {
    try {
      const validatedData = insertAgentSchema.parse(req.body);
      const agent = await storage.createAgent(validatedData);
      res.status(201).json(agent);
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid agent data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create agent" });
    }
  });

  app.put("/api/agents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertAgentSchema.partial().parse(req.body);
      const agent = await storage.updateAgent(id, validatedData);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid agent data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update agent" });
    }
  });

  app.delete("/api/agents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
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

  // LLM-powered chat endpoint for WhatsApp integration
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
        content: aiResponse,
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
        const qualification = await qualifyLead(conversationText, agent.leadQualificationQuestions || []);
        
        await storage.updateConversation(conversation.id, {
          leadData: qualification.extractedData,
          conversionScore: qualification.score,
          callScheduled: qualification.recommendation === 'call',
        });
      }

      // Generate WhatsApp handoff URL if conversation should transfer
      let whatsappHandoff = null;
      if (finalMessages.length >= 6 || aiResponse.toLowerCase().includes('contact') || aiResponse.toLowerCase().includes('speak')) {
        if (agent.whatsappNumber) {
          const handoffMessage = encodeURIComponent(`Continuing our conversation: ${finalMessages.slice(-2).map(m => m.content).join(' ')}`);
          const cleanNumber = agent.whatsappNumber.replace(/[^0-9]/g, '');
          whatsappHandoff = `https://wa.me/${cleanNumber}?text=${handoffMessage}`;
        }
      }

      res.json({
        response: aiResponse,
        sessionId: currentSessionId,
        whatsappHandoff,
        shouldTransfer: !!whatsappHandoff,
      });

    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ message: "Failed to process chat message" });
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

  const httpServer = createServer(app);
  return httpServer;
}
