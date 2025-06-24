import axios from 'axios';
import { Agent } from "@shared/schema";
import { generateChatResponse } from "./llm-providers";
import { storage } from "../storage";
import { logger } from "./logging";
import { conversationFlowService } from "./conversation-flow";

export interface InstagramMessage {
  mid: string;
  text?: string;
  attachments?: Array<{
    type: 'image' | 'video' | 'story_mention' | 'share';
    payload: {
      url?: string;
    };
  }>;
}

export interface InstagramWebhookPayload {
  object: 'instagram';
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
      message?: InstagramMessage;
      postback?: {
        title: string;
        payload: string;
      };
    }>;
  }>;
}

export class InstagramService {
  private readonly baseUrl = 'https://graph.facebook.com/v18.0';

  async sendMessage(accessToken: string, recipientId: string, text: string): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/me/messages?access_token=${accessToken}`, {
        recipient: {
          id: recipientId
        },
        message: {
          text: text
        }
      });
      return response.data;
    } catch (error: any) {
      await logger.logError(error, 'instagram_send_message', undefined, undefined, { 
        recipientId, 
        textLength: text.length 
      });
      throw new Error(`Failed to send Instagram message: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async getUserProfile(accessToken: string, userId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${userId}?fields=name,profile_picture_url&access_token=${accessToken}`
      );
      return response.data;
    } catch (error: any) {
      await logger.logError(error, 'instagram_get_user_profile', undefined, undefined, { userId });
      throw new Error(`Failed to get Instagram user profile: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async getBusinessAccountInfo(accessToken: string, businessAccountId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${businessAccountId}?fields=id,username,name,profile_picture_url&access_token=${accessToken}`
      );
      return response.data;
    } catch (error: any) {
      await logger.logError(error, 'instagram_get_business_info', undefined, undefined, { businessAccountId });
      throw new Error(`Failed to get Instagram business info: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  async processWebhookPayload(payload: InstagramWebhookPayload, agent: Agent): Promise<void> {
    try {
      for (const entry of payload.entry) {
        for (const messaging of entry.messaging) {
          if (messaging.message && messaging.message.text) {
            await this.handleMessage(messaging, agent);
          }
        }
      }
    } catch (error) {
      await logger.logError(error as Error, 'instagram_webhook_processing', undefined, agent.id, {});
    }
  }

  private async handleMessage(messaging: any, agent: Agent): Promise<void> {
    try {
      const senderId = messaging.sender.id;
      const messageText = messaging.message.text;

      await logger.logAgent('instagram_message_received', undefined, agent.id, true, {
        senderId,
        messageId: messaging.message.mid,
        textLength: messageText.length
      });

      // Find or create conversation
      const sessionId = `instagram_${senderId}_${agent.id}`;
      let conversation = await storage.getConversationBySession(sessionId);
      
      if (!conversation) {
        // Get user profile for lead data
        let userProfile = null;
        if (agent.instagramAccessToken) {
          try {
            userProfile = await this.getUserProfile(agent.instagramAccessToken, senderId);
          } catch (error) {
            // Continue without profile data if it fails
          }
        }

        conversation = await storage.createConversation({
          agentId: agent.id,
          sessionId,
          messages: [],
          leadData: {
            name: userProfile?.name || 'Instagram User',
            phone: null,
            email: null,
            source: 'instagram',
            senderId: senderId,
            profilePic: userProfile?.profile_picture_url
          },
          status: "active",
          platform: "instagram"
        });
      }

      // Add user message to conversation
      const userMessage = {
        role: 'user',
        content: messageText,
        timestamp: new Date(messaging.timestamp).toISOString()
      };

      const updatedMessages = [...(conversation.messages || []), userMessage];

      // Generate AI response
      const aiResponse = await generateChatResponse(
        agent.llmProvider,
        agent.model || 'gpt-4o',
        agent.systemPrompt,
        updatedMessages
      );

      // Add AI response to conversation
      const assistantMessage = {
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date().toISOString()
      };

      await storage.updateConversation(conversation.id, {
        messages: [...updatedMessages, assistantMessage]
      });

      // Send response via Instagram
      if (agent.instagramAccessToken) {
        await this.sendMessage(agent.instagramAccessToken, senderId, aiResponse);
        
        await logger.logAgent('instagram_response_sent', undefined, agent.id, true, {
          senderId,
          responseLength: aiResponse.length
        });
      }

    } catch (error) {
      await logger.logError(error as Error, 'instagram_message_handling', undefined, agent.id, {
        senderId: messaging.sender.id
      });
    }
  }
}

export const instagramService = new InstagramService();