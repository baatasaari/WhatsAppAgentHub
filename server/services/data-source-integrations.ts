import OpenAI from 'openai';
import { storage } from '../storage';
import { AITrainingService } from './ai-training';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class DataSourceIntegrations {
  
  /**
   * Import training data from CSV file
   */
  static async importFromCSV(agentId: number, userId: number, csvData: string) {
    try {
      const lines = csvData.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      // Expected columns: input, expected_output, category, weight
      const requiredColumns = ['input', 'expected_output', 'category'];
      const missingColumns = requiredColumns.filter(col => !headers.includes(col));
      
      if (missingColumns.length > 0) {
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
      }
      
      const trainingData = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const inputIndex = headers.indexOf('input');
        const outputIndex = headers.indexOf('expected_output');
        const categoryIndex = headers.indexOf('category');
        const weightIndex = headers.indexOf('weight');
        
        if (values[inputIndex] && values[outputIndex] && values[categoryIndex]) {
          trainingData.push({
            inputText: values[inputIndex],
            expectedOutput: values[outputIndex],
            category: values[categoryIndex],
            weight: weightIndex >= 0 ? parseInt(values[weightIndex]) || 1 : 1,
            agentId,
            userId
          });
        }
      }
      
      // Batch insert training examples
      const results = await Promise.all(
        trainingData.map(data => storage.addTrainingExample(data))
      );
      
      return {
        imported: results.length,
        total: lines.length - 1,
        examples: results
      };
    } catch (error) {
      console.error('Error importing CSV data:', error);
      throw new Error('Failed to import CSV data');
    }
  }

  /**
   * Import knowledge base from JSON file
   */
  static async importKnowledgeFromJSON(agentId: number, userId: number, jsonData: any) {
    try {
      let knowledgeItems = [];
      
      if (Array.isArray(jsonData)) {
        knowledgeItems = jsonData;
      } else if (jsonData.knowledgeBase && Array.isArray(jsonData.knowledgeBase)) {
        knowledgeItems = jsonData.knowledgeBase;
      } else {
        throw new Error('Invalid JSON format. Expected array or object with knowledgeBase array.');
      }
      
      const results = [];
      
      for (const item of knowledgeItems) {
        if (item.title && item.content && item.category) {
          const knowledgeItem = await AITrainingService.addKnowledgeItem(
            agentId,
            userId,
            {
              title: item.title,
              content: item.content,
              category: item.category,
              tags: item.tags || [],
              metadata: item.metadata || {}
            }
          );
          results.push(knowledgeItem);
        }
      }
      
      return {
        imported: results.length,
        total: knowledgeItems.length,
        items: results
      };
    } catch (error) {
      console.error('Error importing JSON knowledge:', error);
      throw new Error('Failed to import JSON knowledge base');
    }
  }

  /**
   * Connect to external CRM system (Salesforce, HubSpot, etc.)
   */
  static async connectToCRM(agentId: number, userId: number, crmConfig: {
    type: 'salesforce' | 'hubspot' | 'pipedrive';
    apiKey: string;
    baseUrl?: string;
  }) {
    try {
      const { type, apiKey, baseUrl } = crmConfig;
      
      let crmData = [];
      
      switch (type) {
        case 'salesforce':
          crmData = await this.fetchSalesforceData(apiKey, baseUrl);
          break;
        case 'hubspot':
          crmData = await this.fetchHubSpotData(apiKey);
          break;
        case 'pipedrive':
          crmData = await this.fetchPipedriveData(apiKey, baseUrl);
          break;
        default:
          throw new Error(`Unsupported CRM type: ${type}`);
      }
      
      // Convert CRM data to knowledge items
      const knowledgeItems = await this.convertCRMToKnowledge(crmData, agentId, userId);
      
      return {
        source: type,
        imported: knowledgeItems.length,
        items: knowledgeItems
      };
    } catch (error) {
      console.error('Error connecting to CRM:', error);
      throw new Error(`Failed to connect to ${crmConfig.type} CRM`);
    }
  }

  /**
   * Import from website content (web scraping)
   */
  static async importFromWebsite(agentId: number, userId: number, websiteConfig: {
    url: string;
    selectors: string[];
    maxPages: number;
  }) {
    try {
      const { url, selectors, maxPages } = websiteConfig;
      
      // This would typically use a web scraping library like Puppeteer or Cheerio
      // For now, we'll simulate the process
      const scrapedContent = await this.scrapeWebsiteContent(url, selectors, maxPages);
      
      const knowledgeItems = [];
      
      for (const content of scrapedContent) {
        if (content.text && content.text.length > 50) {
          const knowledgeItem = await AITrainingService.addKnowledgeItem(
            agentId,
            userId,
            {
              title: content.title || `Content from ${new URL(url).hostname}`,
              content: content.text,
              category: 'website',
              tags: ['scraped', 'website', new URL(url).hostname],
              metadata: {
                source: content.url,
                scrapedAt: new Date().toISOString()
              }
            }
          );
          knowledgeItems.push(knowledgeItem);
        }
      }
      
      return {
        source: url,
        imported: knowledgeItems.length,
        items: knowledgeItems
      };
    } catch (error) {
      console.error('Error importing from website:', error);
      throw new Error('Failed to import website content');
    }
  }

  /**
   * Connect to help desk systems (Zendesk, Freshdesk, etc.)
   */
  static async connectToHelpDesk(agentId: number, userId: number, helpdeskConfig: {
    type: 'zendesk' | 'freshdesk' | 'intercom';
    apiKey: string;
    domain: string;
  }) {
    try {
      const { type, apiKey, domain } = helpdeskConfig;
      
      let tickets = [];
      let articles = [];
      
      switch (type) {
        case 'zendesk':
          [tickets, articles] = await Promise.all([
            this.fetchZendeskTickets(apiKey, domain),
            this.fetchZendeskArticles(apiKey, domain)
          ]);
          break;
        case 'freshdesk':
          [tickets, articles] = await Promise.all([
            this.fetchFreshdeskTickets(apiKey, domain),
            this.fetchFreshdeskArticles(apiKey, domain)
          ]);
          break;
        case 'intercom':
          [tickets, articles] = await Promise.all([
            this.fetchIntercomConversations(apiKey),
            this.fetchIntercomArticles(apiKey)
          ]);
          break;
      }
      
      // Convert to training data
      const trainingData = this.convertTicketsToTraining(tickets);
      const knowledgeItems = await this.convertArticlesToKnowledge(articles, agentId, userId);
      
      return {
        source: type,
        trainingExamples: trainingData.length,
        knowledgeItems: knowledgeItems.length,
        data: { trainingData, knowledgeItems }
      };
    } catch (error) {
      console.error('Error connecting to help desk:', error);
      throw new Error(`Failed to connect to ${helpdeskConfig.type}`);
    }
  }

  /**
   * Import from Google Sheets
   */
  static async importFromGoogleSheets(agentId: number, userId: number, sheetConfig: {
    spreadsheetId: string;
    range: string;
    apiKey: string;
  }) {
    try {
      const { spreadsheetId, range, apiKey } = sheetConfig;
      
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch Google Sheets data');
      }
      
      const data = await response.json();
      const rows = data.values || [];
      
      if (rows.length === 0) {
        throw new Error('No data found in the specified range');
      }
      
      const headers = rows[0].map((h: string) => h.toLowerCase().trim());
      const trainingData = [];
      
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const inputIndex = headers.indexOf('input') || headers.indexOf('question');
        const outputIndex = headers.indexOf('output') || headers.indexOf('answer');
        const categoryIndex = headers.indexOf('category') || headers.indexOf('type');
        
        if (row[inputIndex] && row[outputIndex]) {
          const example = await storage.addTrainingExample({
            agentId,
            userId,
            inputText: row[inputIndex],
            expectedOutput: row[outputIndex],
            category: row[categoryIndex] || 'general',
            weight: 1
          });
          trainingData.push(example);
        }
      }
      
      return {
        source: 'Google Sheets',
        imported: trainingData.length,
        total: rows.length - 1,
        examples: trainingData
      };
    } catch (error) {
      console.error('Error importing from Google Sheets:', error);
      throw new Error('Failed to import from Google Sheets');
    }
  }

  /**
   * Real-time conversation learning
   */
  static async enableRealTimeLearning(agentId: number, userId: number, config: {
    autoApprove: boolean;
    feedbackThreshold: number;
    learningRate: number;
  }) {
    try {
      // Get recent conversations for the agent
      const conversations = await storage.getConversationsByAgent(agentId);
      
      // Analyze conversations for training opportunities
      const trainingCandidates = [];
      
      for (const conv of conversations.slice(-50)) { // Last 50 conversations
        const messages = conv.messages as any[];
        
        for (let i = 0; i < messages.length - 1; i += 2) {
          const userMessage = messages[i];
          const botResponse = messages[i + 1];
          
          if (userMessage?.role === 'user' && botResponse?.role === 'assistant') {
            // Check if this interaction has positive feedback
            const hasPositiveFeedback = conv.leadData?.feedback === 'positive' || 
                                      conv.conversionScore > config.feedbackThreshold;
            
            if (hasPositiveFeedback && config.autoApprove) {
              const example = await storage.addTrainingExample({
                agentId,
                userId,
                inputText: userMessage.content,
                expectedOutput: botResponse.content,
                category: 'real_conversation',
                weight: Math.floor(config.learningRate * 10),
                isValidated: true,
                validationScore: conv.conversionScore
              });
              trainingCandidates.push(example);
            }
          }
        }
      }
      
      return {
        enabled: true,
        autoApprove: config.autoApprove,
        learningCandidates: trainingCandidates.length,
        examples: trainingCandidates
      };
    } catch (error) {
      console.error('Error enabling real-time learning:', error);
      throw new Error('Failed to enable real-time learning');
    }
  }

  // Helper methods for external API integrations
  private static async fetchSalesforceData(apiKey: string, baseUrl?: string) {
    // Salesforce API integration implementation
    return [];
  }

  private static async fetchHubSpotData(apiKey: string) {
    // HubSpot API integration implementation
    return [];
  }

  private static async fetchPipedriveData(apiKey: string, baseUrl?: string) {
    // Pipedrive API integration implementation
    return [];
  }

  private static async scrapeWebsiteContent(url: string, selectors: string[], maxPages: number) {
    // Web scraping implementation
    return [];
  }

  private static async fetchZendeskTickets(apiKey: string, domain: string) {
    // Zendesk tickets API integration
    return [];
  }

  private static async fetchZendeskArticles(apiKey: string, domain: string) {
    // Zendesk knowledge base API integration
    return [];
  }

  private static async fetchFreshdeskTickets(apiKey: string, domain: string) {
    // Freshdesk tickets API integration
    return [];
  }

  private static async fetchFreshdeskArticles(apiKey: string, domain: string) {
    // Freshdesk knowledge base API integration
    return [];
  }

  private static async fetchIntercomConversations(apiKey: string) {
    // Intercom conversations API integration
    return [];
  }

  private static async fetchIntercomArticles(apiKey: string) {
    // Intercom articles API integration
    return [];
  }

  private static convertCRMToKnowledge(crmData: any[], agentId: number, userId: number) {
    // Convert CRM data to knowledge base format
    return [];
  }

  private static convertTicketsToTraining(tickets: any[]) {
    // Convert support tickets to training examples
    return [];
  }

  private static async convertArticlesToKnowledge(articles: any[], agentId: number, userId: number) {
    // Convert help articles to knowledge base items
    return [];
  }
}