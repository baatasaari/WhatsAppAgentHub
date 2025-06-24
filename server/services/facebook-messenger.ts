import axios from 'axios';
import { Agent } from "@shared/schema";
import { generateChatResponse } from "./llm-providers";
import { storage } from "../storage";
import { logger } from "./logging";
import { conversationFlowService } from "./conversation-flow";

export interface MessengerMessage {
  mid: string;
  text?: string;
  attachments?: Array<{
    type: 'image' | 'video' | 'audio' | 'file';
    payload: {
      url?: string;
      sticker_id?: number;
    };
  }>;
}

export interface MessengerWebhookPayload {
  object: 'page';
  entry: Array<{
    id: string;
    time: number;
    messaging: Array<{
      sender: {
        id: string;
      };
      recipient: {
        id: string;
      };
      timestamp: number;
      message?: MessengerMessage;
      postback?: {
        title: string;
        payload: string;
      };
      delivery?: {
        mids: string[];
        watermark: number;
      };
      read?: {
        watermark: number;
      };
    }>;
  }>;
}

export class FacebookMessengerService {
  private readonly baseUrl = 'https://graph.facebook.com/v18.0';

  async sendMessage(pageAccessToken: string, recipientId: string, text: string): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/me/messages?access_token=${pageAccessToken}`, {
        recipient: {
          id: recipientId
        },
        message: {
          text: text
        }
      });
      return response.data;
    } catch (error: any) {
      await logger.logError(error, 'messenger_send_message', undefined, undefined, { 
        recipientId, 
        textLength: text.length 
      });
      throw new Error(`Failed to send Messenger message: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async getUserProfile(pageAccessToken: string, userId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${userId}?fields=first_name,last_name,profile_pic&access_token=${pageAccessToken}`
      );
      return response.data;
    } catch (error: any) {
      await logger.logError(error, 'messenger_get_user_profile', undefined, undefined, { userId });
      throw new Error(`Failed to get Messenger user profile: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async setWebhook(pageAccessToken: string, webhookUrl: string, verifyToken: string): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/me/subscribed_apps`, {
        access_token: pageAccessToken,
        subscribed_fields: ['messages', 'messaging_postbacks', 'messaging_deliveries', 'messaging_reads']
      });
      return response.data;
    } catch (error: any) {
      await logger.logError(error, 'messenger_set_webhook', undefined, undefined, { webhookUrl });
      throw new Error(`Failed to set Messenger webhook: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async getPageInfo(pageAccessToken: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/me?access_token=${pageAccessToken}`);
      return response.data;
    } catch (error: any) {
      await logger.logError(error, 'messenger_get_page_info', undefined, undefined, {});
      throw new Error(`Failed to get page info: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async processWebhookPayload(payload: MessengerWebhookPayload, agent: Agent): Promise<void> {
    try {
      for (const entry of payload.entry) {
        for (const messaging of entry.messaging) {
          if (messaging.message && messaging.message.text) {
            await this.handleMessage(messaging, agent);
          }
        }
      }
    } catch (error) {
      await logger.logError(error as Error, 'messenger_webhook_processing', undefined, agent.id, {});
    }
  }

  private async handleMessage(messaging: any, agent: Agent): Promise<void> {
    try {
      const senderId = messaging.sender.id;
      const messageText = messaging.message.text;

      await logger.logAgent('messenger_message_received', undefined, agent.id, true, {
        senderId,
        messageId: messaging.message.mid,
        textLength: messageText.length
      });

      // Find or create conversation
      const sessionId = `messenger_${senderId}_${agent.id}`;
      let conversation = await storage.getConversationBySession(sessionId);
      
      if (!conversation) {
        // Get user profile for lead data
        let userProfile = null;
        if (agent.facebookAccessToken) {
          try {
            userProfile = await this.getUserProfile(agent.facebookAccessToken, senderId);
          } catch (error) {
            // Continue without profile data if it fails
          }
        }

        conversation = await storage.createConversation({
          agentId: agent.id,
          sessionId,
          messages: [],
          leadData: {
            name: userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 'Facebook User',
            phone: null,
            email: null,
            source: 'messenger',
            senderId: senderId,
            profilePic: userProfile?.profile_pic
          },
          status: "active",
          platform: "messenger"
        });
      }

      // Add user message to conversation
      const userMessage = {
        role: 'user',
        content: messageText,
        timestamp: new Date(messaging.timestamp).toISOString()
      };

      const updatedMessages = [...(conversation.messages || []), userMessage];

      // Check if flow is enabled and process accordingly
      let aiResponse: string;
      
      if (agent.flowEnabled && agent.conversationFlow) {
        const flowContext = {
          userId: senderId,
          userName: userProfile ? `${userProfile.first_name} ${userProfile.last_name}` : 'Facebook User',
          userInput: messageText,
          conversationCount: updatedMessages.filter(m => m.role === 'user').length,
          variables: {},
          leadData: conversation.leadData
        };

        const flowResult = await conversationFlowService.executeFlow(agent, flowContext);
        aiResponse = flowResult.message;
      } else {
        // Generate AI response using traditional method
        aiResponse = await generateChatResponse(
          agent.llmProvider,
          agent.model || 'gpt-4o',
          agent.systemPrompt,
          updatedMessages
        );
      }

      // Add AI response to conversation
      const assistantMessage = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date().toISOString()
      };

      await storage.updateConversation(conversation.id, {
        messages: [...updatedMessages, assistantMessage]
      });

      // Send response via Messenger
      if (agent.facebookAccessToken) {
        await this.sendMessage(agent.facebookAccessToken, senderId, aiResponse);
        
        await logger.logAgent('messenger_response_sent', undefined, agent.id, true, {
          senderId,
          responseLength: aiResponse.length
        });
      }

    } catch (error) {
      await logger.logError(error as Error, 'messenger_message_handling', undefined, agent.id, {
        senderId: messaging.sender.id
      });
    }
  }
}

export const facebookMessengerService = new FacebookMessengerService();