import { EnhancedAIService } from './enhanced-ai-service';
import { storage } from '../storage';

export class PlatformAIIntegration {
  
  /**
   * Process message with AI training for WhatsApp Business API
   */
  static async processWhatsAppMessage(agentId: number, messageData: any) {
    try {
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      const userMessage = messageData.text?.body || '';
      const phoneNumber = messageData.from;
      
      // Get enhanced AI response using custom training
      const aiResponse = await EnhancedAIService.getEnhancedResponse(
        agentId,
        userMessage,
        {
          platform: 'whatsapp',
          phoneNumber,
          messageId: messageData.id,
          timestamp: messageData.timestamp
        }
      );

      // Format response for WhatsApp Business API
      const whatsappResponse = {
        messaging_product: "whatsapp",
        to: phoneNumber,
        type: "text",
        text: {
          body: aiResponse.response
        }
      };

      // Add interactive elements if knowledge base suggests options
      if (aiResponse.knowledgeUsed && aiResponse.knowledgeUsed.length > 0) {
        const relatedTopics = aiResponse.knowledgeUsed
          .map(item => item.title)
          .slice(0, 3);

        if (relatedTopics.length > 1) {
          whatsappResponse.type = "interactive";
          whatsappResponse.interactive = {
            type: "button",
            body: {
              text: aiResponse.response
            },
            action: {
              buttons: relatedTopics.map((topic, index) => ({
                type: "reply",
                reply: {
                  id: `info_${index}`,
                  title: topic.substring(0, 20)
                }
              }))
            }
          };
        }
      }

      return {
        response: whatsappResponse,
        metadata: {
          customTrainingUsed: aiResponse.customTrainingUsed,
          knowledgeItemsUsed: aiResponse.knowledgeUsed?.length || 0,
          enhancementType: aiResponse.enhancementType
        }
      };
    } catch (error) {
      console.error('Error processing WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Process message with AI training for Telegram Bot
   */
  static async processTelegramMessage(agentId: number, messageData: any) {
    try {
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      const userMessage = messageData.text;
      const chatId = messageData.chat.id;
      
      const aiResponse = await EnhancedAIService.getEnhancedResponse(
        agentId,
        userMessage,
        {
          platform: 'telegram',
          chatId,
          userId: messageData.from.id,
          username: messageData.from.username
        }
      );

      // Format response for Telegram Bot API
      const telegramResponse = {
        chat_id: chatId,
        text: aiResponse.response,
        parse_mode: 'Markdown'
      };

      // Add inline keyboard if training suggests options
      if (aiResponse.trainingExamplesUsed && aiResponse.trainingExamplesUsed.length > 0) {
        const suggestions = aiResponse.trainingExamplesUsed
          .filter(example => example.category !== 'greeting')
          .map(example => example.category)
          .slice(0, 3);

        if (suggestions.length > 0) {
          telegramResponse.reply_markup = {
            inline_keyboard: [
              suggestions.map(suggestion => ({
                text: `More about ${suggestion}`,
                callback_data: `info_${suggestion}`
              }))
            ]
          };
        }
      }

      return {
        response: telegramResponse,
        metadata: {
          customTrainingUsed: aiResponse.customTrainingUsed,
          knowledgeItemsUsed: aiResponse.knowledgeUsed?.length || 0,
          enhancementType: aiResponse.enhancementType
        }
      };
    } catch (error) {
      console.error('Error processing Telegram message:', error);
      throw error;
    }
  }

  /**
   * Process message with AI training for Discord Bot
   */
  static async processDiscordMessage(agentId: number, messageData: any) {
    try {
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      const userMessage = messageData.content;
      const channelId = messageData.channel_id;
      
      const aiResponse = await EnhancedAIService.getEnhancedResponse(
        agentId,
        userMessage,
        {
          platform: 'discord',
          channelId,
          userId: messageData.author.id,
          username: messageData.author.username,
          guildId: messageData.guild_id
        }
      );

      // Format response for Discord Bot API
      const discordResponse = {
        content: aiResponse.response,
        tts: false
      };

      // Add embeds if knowledge base provides rich content
      if (aiResponse.knowledgeUsed && aiResponse.knowledgeUsed.length > 0) {
        const knowledgeItem = aiResponse.knowledgeUsed[0];
        discordResponse.embeds = [{
          title: "Related Information",
          description: knowledgeItem.content.substring(0, 200) + "...",
          color: 0x0099ff,
          fields: [
            {
              name: "Category",
              value: knowledgeItem.category,
              inline: true
            }
          ]
        }];
      }

      // Add components for interactive responses
      if (aiResponse.customTrainingUsed && aiResponse.trainingExamplesUsed) {
        const categories = [...new Set(aiResponse.trainingExamplesUsed.map(ex => ex.category))];
        
        if (categories.length > 1) {
          discordResponse.components = [{
            type: 1, // Action Row
            components: categories.slice(0, 5).map((category, index) => ({
              type: 2, // Button
              style: 2, // Secondary
              label: category,
              custom_id: `help_${category}_${index}`
            }))
          }];
        }
      }

      return {
        response: discordResponse,
        metadata: {
          customTrainingUsed: aiResponse.customTrainingUsed,
          knowledgeItemsUsed: aiResponse.knowledgeUsed?.length || 0,
          enhancementType: aiResponse.enhancementType
        }
      };
    } catch (error) {
      console.error('Error processing Discord message:', error);
      throw error;
    }
  }

  /**
   * Process message with AI training for Facebook Messenger
   */
  static async processFacebookMessage(agentId: number, messageData: any) {
    try {
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      const userMessage = messageData.message.text;
      const senderId = messageData.sender.id;
      
      const aiResponse = await EnhancedAIService.getEnhancedResponse(
        agentId,
        userMessage,
        {
          platform: 'facebook',
          senderId,
          pageId: messageData.recipient.id
        }
      );

      // Format response for Facebook Messenger API
      const facebookResponse = {
        recipient: {
          id: senderId
        },
        message: {
          text: aiResponse.response
        }
      };

      // Add quick replies if training suggests follow-up options
      if (aiResponse.trainingExamplesUsed && aiResponse.trainingExamplesUsed.length > 0) {
        const quickReplies = aiResponse.trainingExamplesUsed
          .map(example => ({
            content_type: "text",
            title: `Ask about ${example.category}`,
            payload: `CATEGORY_${example.category.toUpperCase()}`
          }))
          .slice(0, 3);

        if (quickReplies.length > 0) {
          facebookResponse.message.quick_replies = quickReplies;
        }
      }

      // Add generic template if knowledge base has rich content
      if (aiResponse.knowledgeUsed && aiResponse.knowledgeUsed.length > 1) {
        facebookResponse.message = {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              elements: aiResponse.knowledgeUsed.slice(0, 3).map(item => ({
                title: item.title,
                subtitle: item.content.substring(0, 80),
                buttons: [{
                  type: "postback",
                  title: "Learn More",
                  payload: `KNOWLEDGE_${item.id}`
                }]
              }))
            }
          }
        };
      }

      return {
        response: facebookResponse,
        metadata: {
          customTrainingUsed: aiResponse.customTrainingUsed,
          knowledgeItemsUsed: aiResponse.knowledgeUsed?.length || 0,
          enhancementType: aiResponse.enhancementType
        }
      };
    } catch (error) {
      console.error('Error processing Facebook message:', error);
      throw error;
    }
  }

  /**
   * Process message with AI training for Instagram Direct
   */
  static async processInstagramMessage(agentId: number, messageData: any) {
    try {
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      const userMessage = messageData.message.text;
      const senderId = messageData.sender.id;
      
      const aiResponse = await EnhancedAIService.getEnhancedResponse(
        agentId,
        userMessage,
        {
          platform: 'instagram',
          senderId,
          timestamp: messageData.timestamp
        }
      );

      // Instagram Direct uses similar format to Facebook Messenger
      const instagramResponse = {
        recipient: {
          id: senderId
        },
        message: {
          text: aiResponse.response
        }
      };

      // Add story mentions if brand voice suggests engaging content
      if (aiResponse.customTrainingUsed && 
          agent.customTraining?.brandVoice?.personality === 'enthusiastic') {
        
        // Add call-to-action for story engagement
        instagramResponse.message.quick_replies = [{
          content_type: "text",
          title: "Share to Story",
          payload: "SHARE_STORY"
        }];
      }

      return {
        response: instagramResponse,
        metadata: {
          customTrainingUsed: aiResponse.customTrainingUsed,
          knowledgeItemsUsed: aiResponse.knowledgeUsed?.length || 0,
          enhancementType: aiResponse.enhancementType
        }
      };
    } catch (error) {
      console.error('Error processing Instagram message:', error);
      throw error;
    }
  }

  /**
   * Get platform-specific training recommendations
   */
  static async getPlatformTrainingRecommendations(platform: string, agentId: number) {
    try {
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        throw new Error('Agent not found');
      }

      const recommendations = {
        whatsapp: {
          bestPractices: [
            "Use concise messages (WhatsApp users prefer brevity)",
            "Include interactive buttons for common questions",
            "Provide quick replies for follow-up options",
            "Use emojis sparingly but effectively"
          ],
          trainingTips: [
            "Train with customer service scenarios",
            "Include product inquiry examples",
            "Add appointment booking conversations",
            "Practice handling complaints professionally"
          ],
          brandVoice: {
            recommended: ["friendly", "professional", "helpful"],
            avoid: ["overly formal", "robotic", "pushy"]
          }
        },
        telegram: {
          bestPractices: [
            "Use Markdown formatting for better readability",
            "Leverage inline keyboards for navigation",
            "Support both private and group conversations",
            "Handle file sharing and media responses"
          ],
          trainingTips: [
            "Include technical support scenarios",
            "Train for community management",
            "Add FAQ handling examples",
            "Practice multi-user conversation management"
          ],
          brandVoice: {
            recommended: ["casual", "technical", "community-focused"],
            avoid: ["overly corporate", "marketing-heavy"]
          }
        },
        discord: {
          bestPractices: [
            "Use embeds for rich content presentation",
            "Include slash commands in responses",
            "Handle both text and voice channel contexts",
            "Support server-specific customization"
          ],
          trainingTips: [
            "Train for gaming community interactions",
            "Include moderation scenario examples",
            "Add event announcement templates",
            "Practice real-time support conversations"
          ],
          brandVoice: {
            recommended: ["casual", "enthusiastic", "community-oriented"],
            avoid: ["overly formal", "sales-focused"]
          }
        },
        facebook: {
          bestPractices: [
            "Use generic templates for rich responses",
            "Include quick replies for user guidance",
            "Support multimedia content sharing",
            "Handle page-specific branding"
          ],
          trainingTips: [
            "Include social media engagement scenarios",
            "Train for lead generation conversations",
            "Add customer service examples",
            "Practice brand storytelling"
          ],
          brandVoice: {
            recommended: ["engaging", "brand-focused", "social"],
            avoid: ["too casual", "off-brand messaging"]
          }
        },
        instagram: {
          bestPractices: [
            "Focus on visual-first communication",
            "Include story integration suggestions",
            "Support direct message automation",
            "Handle influencer collaboration inquiries"
          ],
          trainingTips: [
            "Train for visual content discussions",
            "Include brand collaboration scenarios",
            "Add product showcase examples",
            "Practice aesthetic-focused conversations"
          ],
          brandVoice: {
            recommended: ["trendy", "visual", "aspirational"],
            avoid: ["text-heavy", "corporate jargon"]
          }
        }
      };

      return recommendations[platform] || {
        bestPractices: ["Follow platform-specific guidelines"],
        trainingTips: ["Customize training for platform context"],
        brandVoice: { recommended: ["adaptable"], avoid: ["generic"] }
      };
    } catch (error) {
      console.error('Error getting platform training recommendations:', error);
      throw error;
    }
  }

  /**
   * Analyze platform-specific conversation patterns
   */
  static async analyzeplatformConversations(agentId: number, platform: string) {
    try {
      const conversations = await storage.getConversationsByAgent(agentId);
      
      // Filter conversations by platform (if stored in metadata)
      const platformConversations = conversations.filter(conv => 
        conv.leadData?.platform === platform
      );

      const analysis = {
        platform,
        totalConversations: platformConversations.length,
        averageResponseTime: 0,
        commonTopics: [],
        successPatterns: [],
        improvementAreas: [],
        platformSpecificMetrics: {}
      };

      // Platform-specific analysis
      switch (platform) {
        case 'whatsapp':
          analysis.platformSpecificMetrics = {
            messageDeliveryRate: 0.95, // Example metric
            readRate: 0.88,
            responseRate: 0.72,
            averageConversationLength: 5.2
          };
          break;
        case 'telegram':
          analysis.platformSpecificMetrics = {
            groupEngagement: 0.65,
            privateMessageRate: 0.80,
            commandUsage: 0.45,
            mediaShareRate: 0.30
          };
          break;
        case 'discord':
          analysis.platformSpecificMetrics = {
            serverActivityBoost: 0.25,
            voiceChannelConnections: 0.15,
            reactionEngagement: 0.85,
            slashCommandUsage: 0.60
          };
          break;
        case 'facebook':
          analysis.platformSpecificMetrics = {
            pageEngagement: 0.70,
            shareRate: 0.20,
            clickThroughRate: 0.35,
            leadConversionRate: 0.12
          };
          break;
        case 'instagram':
          analysis.platformSpecificMetrics = {
            storyMentions: 0.40,
            dmResponseRate: 0.75,
            hashtagEngagement: 0.55,
            visualContentRequests: 0.80
          };
          break;
      }

      return analysis;
    } catch (error) {
      console.error('Error analyzing platform conversations:', error);
      throw error;
    }
  }
}