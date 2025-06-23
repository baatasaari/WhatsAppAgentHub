import { Agent } from "@shared/schema";
import { generateChatResponse } from "./llm-providers";

export interface WhatsAppMessage {
  id: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video';
  timestamp: string;
  from: string;
  text?: {
    body: string;
  };
  image?: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  document?: {
    id: string;
    filename: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
  audio?: {
    id: string;
    mime_type: string;
    sha256: string;
  };
  video?: {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
  };
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: {
            name: string;
          };
          wa_id: string;
        }>;
        messages?: WhatsAppMessage[];
        statuses?: Array<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

export class WhatsAppBusinessService {
  private readonly baseUrl = 'https://graph.facebook.com/v18.0';

  async sendMessage(
    accessToken: string,
    phoneNumberId: string,
    to: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: {
            body: message
          }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || 'Failed to send message'
        };
      }

      return {
        success: true,
        messageId: data.messages?.[0]?.id
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async sendTemplateMessage(
    accessToken: string,
    phoneNumberId: string,
    to: string,
    templateName: string,
    templateParams: string[] = []
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: 'en_US'
            },
            components: templateParams.length > 0 ? [{
              type: 'body',
              parameters: templateParams.map(param => ({
                type: 'text',
                text: param
              }))
            }] : []
          }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || 'Failed to send template message'
        };
      }

      return {
        success: true,
        messageId: data.messages?.[0]?.id
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async markMessageAsRead(
    accessToken: string,
    phoneNumberId: string,
    messageId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        return {
          success: false,
          error: data.error?.message || 'Failed to mark message as read'
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async processIncomingMessage(
    agent: Agent,
    message: WhatsAppMessage,
    senderName?: string
  ): Promise<{ response: string; shouldSend: boolean }> {
    try {
      // Extract message content
      let messageContent = '';
      if (message.type === 'text' && message.text?.body) {
        messageContent = message.text.body;
      } else if (message.type === 'image' && message.image?.caption) {
        messageContent = `[Image] ${message.image.caption}`;
      } else if (message.type === 'document' && message.document?.caption) {
        messageContent = `[Document: ${message.document.filename}] ${message.document.caption}`;
      } else if (message.type === 'audio') {
        messageContent = '[Voice message received]';
      } else if (message.type === 'video' && message.video?.caption) {
        messageContent = `[Video] ${message.video.caption}`;
      } else {
        messageContent = `[${message.type} message received]`;
      }

      // Build conversation context
      const conversationHistory = [
        {
          role: 'system' as const,
          content: `${agent.systemPrompt}\n\nYou are responding to ${senderName || 'a customer'} via WhatsApp. Keep responses concise and conversational.`
        },
        {
          role: 'user' as const,
          content: messageContent
        }
      ];

      // Generate AI response
      const aiResponse = await generateChatResponse(
        conversationHistory,
        agent.llmProvider
      );

      return {
        response: aiResponse.content,
        shouldSend: true
      };
    } catch (error) {
      console.error('Error processing incoming message:', error);
      return {
        response: 'I apologize, but I encountered an error processing your message. Please try again.',
        shouldSend: true
      };
    }
  }

  validateWebhookSignature(
    payload: string,
    signature: string,
    appSecret: string
  ): boolean {
    try {
      const crypto = require('crypto');
      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', appSecret)
        .update(payload)
        .digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('Error validating webhook signature:', error);
      return false;
    }
  }

  async getPhoneNumberInfo(
    accessToken: string,
    phoneNumberId: string
  ): Promise<{
    success: boolean;
    data?: {
      verified_name: string;
      display_phone_number: string;
      quality_rating: string;
    };
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/${phoneNumberId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error?.message || 'Failed to get phone number info'
        };
      }

      return {
        success: true,
        data: {
          verified_name: data.verified_name,
          display_phone_number: data.display_phone_number,
          quality_rating: data.quality_rating
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const whatsappService = new WhatsAppBusinessService();