import axios from 'axios';
import { Agent } from "@shared/schema";
import { generateChatResponse } from "./llm-providers";
import { storage } from "../storage";
import { logger } from "./logging";

export interface DiscordMessage {
  id: string;
  type: number;
  content: string;
  channel_id: string;
  author: {
    id: string;
    username: string;
    discriminator: string;
    avatar?: string;
    bot?: boolean;
  };
  timestamp: string;
  edited_timestamp?: string;
  tts: boolean;
  mention_everyone: boolean;
  mentions: any[];
  mention_roles: any[];
  attachments: any[];
  embeds: any[];
}

export interface DiscordWebhookPayload {
  t?: string; // Event type
  s?: number; // Sequence number
  op: number; // Opcode
  d?: any; // Event data
}

export class DiscordService {
  private readonly baseUrl = 'https://discord.com/api/v10';

  async sendMessage(botToken: string, channelId: string, content: string): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/channels/${channelId}/messages`, {
        content: content
      }, {
        headers: {
          'Authorization': `Bot ${botToken}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error: any) {
      await logger.logError(error, 'discord_send_message', undefined, undefined, { 
        channelId, 
        contentLength: content.length 
      });
      throw new Error(`Failed to send Discord message: ${error.response?.data?.message || error.message}`);
    }
  }

  async getGuild(botToken: string, guildId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/guilds/${guildId}`, {
        headers: {
          'Authorization': `Bot ${botToken}`
        }
      });
      return response.data;
    } catch (error: any) {
      await logger.logError(error, 'discord_get_guild', undefined, undefined, { guildId });
      throw new Error(`Failed to get Discord guild: ${error.response?.data?.message || error.message}`);
    }
  }

  async getChannel(botToken: string, channelId: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/channels/${channelId}`, {
        headers: {
          'Authorization': `Bot ${botToken}`
        }
      });
      return response.data;
    } catch (error: any) {
      await logger.logError(error, 'discord_get_channel', undefined, undefined, { channelId });
      throw new Error(`Failed to get Discord channel: ${error.response?.data?.message || error.message}`);
    }
  }

  async getBotUser(botToken: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}/users/@me`, {
        headers: {
          'Authorization': `Bot ${botToken}`
        }
      });
      return response.data;
    } catch (error: any) {
      await logger.logError(error, 'discord_get_bot_user', undefined, undefined, {});
      throw new Error(`Failed to get Discord bot user: ${error.response?.data?.message || error.message}`);
    }
  }

  async processMessage(message: DiscordMessage, agent: Agent): Promise<void> {
    try {
      // Ignore bot messages
      if (message.author.bot) return;

      // Ignore empty messages
      if (!message.content.trim()) return;

      await logger.logAgent('discord_message_received', undefined, agent.id, true, {
        channelId: message.channel_id,
        messageId: message.id,
        author: message.author.username,
        contentLength: message.content.length
      });

      // Find or create conversation
      const sessionId = `discord_${message.author.id}_${message.channel_id}_${agent.id}`;
      let conversation = await storage.getConversationBySession(sessionId);
      
      if (!conversation) {
        conversation = await storage.createConversation({
          agentId: agent.id,
          sessionId,
          messages: [],
          leadData: {
            name: `${message.author.username}#${message.author.discriminator}`,
            phone: null,
            email: null,
            source: 'discord',
            userId: message.author.id,
            channelId: message.channel_id,
            avatar: message.author.avatar
          },
          status: "active",
          platform: "discord"
        });
      }

      // Add user message to conversation
      const userMessage = {
        role: 'user',
        content: message.content,
        timestamp: message.timestamp
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

      // Send response via Discord
      if (agent.discordBotToken) {
        await this.sendMessage(agent.discordBotToken, message.channel_id, aiResponse);
        
        await logger.logAgent('discord_response_sent', undefined, agent.id, true, {
          channelId: message.channel_id,
          responseLength: aiResponse.length
        });
      }

    } catch (error) {
      await logger.logError(error as Error, 'discord_message_processing', undefined, agent.id, {
        messageId: message.id,
        channelId: message.channel_id
      });
    }
  }

  // Discord doesn't use traditional webhooks for message events
  // This would typically be used with Discord Gateway WebSocket connection
  // For this implementation, we'll provide a REST endpoint for manual testing
  async processWebhookPayload(payload: any, agent: Agent): Promise<void> {
    try {
      if (payload.t === 'MESSAGE_CREATE' && payload.d) {
        await this.processMessage(payload.d, agent);
      }
    } catch (error) {
      await logger.logError(error as Error, 'discord_webhook_processing', undefined, agent.id, {});
    }
  }
}

export const discordService = new DiscordService();