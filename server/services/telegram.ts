import axios from 'axios';
import { Agent } from "@shared/schema";
import { generateChatResponse } from "./llm-providers";
import { storage } from "../storage";
import { logger } from "./logging";

export interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
  };
  chat: {
    id: number;
    type: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  };
  date: number;
  text?: string;
  photo?: Array<{
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    file_size?: number;
  }>;
  document?: {
    file_id: string;
    file_unique_id: string;
    file_name?: string;
    mime_type?: string;
    file_size?: number;
  };
}

export interface TelegramWebhookPayload {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: {
      id: number;
      first_name: string;
      username?: string;
    };
    message?: TelegramMessage;
    data?: string;
  };
}

export class TelegramService {
  private readonly baseUrl = 'https://api.telegram.org/bot';

  async sendMessage(botToken: string, chatId: number | string, text: string): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}${botToken}/sendMessage`, {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      });
      return response.data;
    } catch (error: any) {
      await logger.logError(error, 'telegram_send_message', undefined, undefined, { chatId, textLength: text.length });
      throw new Error(`Failed to send Telegram message: ${error.response?.data?.description || error.message}`);
    }
  }

  async setWebhook(botToken: string, webhookUrl: string): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}${botToken}/setWebhook`, {
        url: webhookUrl
      });
      return response.data;
    } catch (error: any) {
      await logger.logError(error, 'telegram_set_webhook', undefined, undefined, { webhookUrl });
      throw new Error(`Failed to set Telegram webhook: ${error.response?.data?.description || error.message}`);
    }
  }

  async getBotInfo(botToken: string): Promise<any> {
    try {
      const response = await axios.get(`${this.baseUrl}${botToken}/getMe`);
      return response.data;
    } catch (error: any) {
      await logger.logError(error, 'telegram_get_bot_info', undefined, undefined, {});
      throw new Error(`Failed to get Telegram bot info: ${error.response?.data?.description || error.message}`);
    }
  }

  async processWebhookPayload(payload: TelegramWebhookPayload, agent: Agent): Promise<void> {
    try {
      const message = payload.message || payload.edited_message;
      if (!message || !message.text) return;

      await logger.logAgent('telegram_message_received', undefined, agent.id, true, {
        chatId: message.chat.id,
        messageId: message.message_id,
        from: message.from.first_name,
        textLength: message.text.length
      });

      // Find or create conversation
      const sessionId = `telegram_${message.chat.id}_${agent.id}`;
      let conversation = await storage.getConversationBySession(sessionId);
      
      if (!conversation) {
        conversation = await storage.createConversation({
          agentId: agent.id,
          sessionId,
          messages: [],
          leadData: {
            name: `${message.from.first_name} ${message.from.last_name || ''}`.trim(),
            phone: null,
            email: null,
            source: 'telegram',
            chatId: message.chat.id.toString(),
            username: message.from.username
          },
          status: "active",
          platform: "telegram"
        });
      }

      // Add user message to conversation
      const userMessage = {
        role: 'user',
        content: message.text,
        timestamp: new Date(message.date * 1000).toISOString()
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

      // Send response via Telegram
      if (agent.telegramBotToken) {
        await this.sendMessage(agent.telegramBotToken, message.chat.id, aiResponse);
        
        await logger.logAgent('telegram_response_sent', undefined, agent.id, true, {
          chatId: message.chat.id,
          responseLength: aiResponse.length
        });
      }

    } catch (error) {
      await logger.logError(error as Error, 'telegram_webhook_processing', undefined, agent.id, {
        updateId: payload.update_id
      });
    }
  }
}

export const telegramService = new TelegramService();