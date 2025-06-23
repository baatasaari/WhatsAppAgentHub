import { ChatMessage, LLMResponse } from './llm-providers';
import { Agent } from '@shared/schema';

export interface BusinessContext {
  businessType: string;
  products: Array<{ name: string; description: string; price?: number }>;
  faqs: Array<{ question: string; answer: string }>;
  businessHours: Record<string, any>;
  contactInfo: Record<string, any>;
  targetAudience: string;
}

export interface BusinessIntelligenceService {
  enhanceResponseWithBusinessContext(
    messages: ChatMessage[],
    agent: Agent,
    userQuery: string
  ): Promise<LLMResponse>;
  
  generateBusinessSpecificPrompt(agent: Agent): string;
  extractLeadInformation(conversation: string, agent: Agent): Promise<Record<string, any>>;
  suggestProductRecommendations(userQuery: string, agent: Agent): Array<any>;
}

export class EnhancedBusinessIntelligence implements BusinessIntelligenceService {
  
  async enhanceResponseWithBusinessContext(
    messages: ChatMessage[],
    agent: Agent,
    userQuery: string
  ): Promise<LLMResponse> {
    
    const businessPrompt = this.generateBusinessSpecificPrompt(agent);
    const contextualMessages: ChatMessage[] = [
      {
        role: 'system',
        content: businessPrompt
      },
      ...messages,
      {
        role: 'user',
        content: userQuery
      }
    ];

    // This would integrate with your existing LLM provider
    // For now, returning a structured response format
    return {
      content: "Enhanced business-specific response based on context",
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0
      }
    };
  }

  generateBusinessSpecificPrompt(agent: Agent): string {
    const basePrompt = agent.systemPrompt || "";
    
    let enhancedPrompt = `${basePrompt}\n\n`;
    
    // Add business-specific context
    enhancedPrompt += `BUSINESS CONTEXT:\n`;
    
    if (agent.businessType) {
      enhancedPrompt += `Business Type: ${agent.businessType}\n`;
    }
    
    if (agent.targetAudience) {
      enhancedPrompt += `Target Audience: ${agent.targetAudience}\n`;
    }
    
    if (agent.productCatalog && Array.isArray(agent.productCatalog)) {
      enhancedPrompt += `\nPRODUCT CATALOG:\n`;
      agent.productCatalog.forEach((product: any) => {
        enhancedPrompt += `- ${product.name}: ${product.description}`;
        if (product.price) enhancedPrompt += ` (${product.price})`;
        enhancedPrompt += '\n';
      });
    }
    
    if (agent.faqData && Array.isArray(agent.faqData)) {
      enhancedPrompt += `\nFREQUENTLY ASKED QUESTIONS:\n`;
      agent.faqData.forEach((faq: any) => {
        enhancedPrompt += `Q: ${faq.question}\nA: ${faq.answer}\n\n`;
      });
    }
    
    if (agent.businessHours) {
      enhancedPrompt += `\nBUSINESS HOURS:\n`;
      Object.entries(agent.businessHours).forEach(([day, hours]: [string, any]) => {
        if (hours.closed) {
          enhancedPrompt += `${day}: Closed\n`;
        } else {
          enhancedPrompt += `${day}: ${hours.open} - ${hours.close}\n`;
        }
      });
    }
    
    if (agent.contactInfo) {
      enhancedPrompt += `\nCONTACT INFORMATION:\n`;
      if (agent.contactInfo.email) enhancedPrompt += `Email: ${agent.contactInfo.email}\n`;
      if (agent.contactInfo.phone) enhancedPrompt += `Phone: ${agent.contactInfo.phone}\n`;
      if (agent.contactInfo.address) enhancedPrompt += `Address: ${agent.contactInfo.address}\n`;
    }
    
    enhancedPrompt += `\nINSTRUCTIONS:\n`;
    enhancedPrompt += `- Always respond as a helpful representative of this business\n`;
    enhancedPrompt += `- Use the product catalog to make relevant recommendations\n`;
    enhancedPrompt += `- Reference FAQs when appropriate\n`;
    enhancedPrompt += `- If asked about business hours or contact info, provide accurate details\n`;
    enhancedPrompt += `- Qualify leads by asking relevant questions about their needs\n`;
    enhancedPrompt += `- Be professional but friendly, matching the business tone\n`;
    enhancedPrompt += `- If you cannot answer something, offer to connect them with a human representative\n`;
    
    return enhancedPrompt;
  }

  async extractLeadInformation(conversation: string, agent: Agent): Promise<Record<string, any>> {
    const leadData: Record<string, any> = {
      extractedAt: new Date().toISOString(),
      businessType: agent.businessType,
      leadSource: 'whatsapp_widget'
    };
    
    // Extract basic contact information patterns
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const phonePattern = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
    const namePattern = /(?:my name is|i'm|i am|this is)\s+([A-Za-z\s]+)/gi;
    
    const emails = conversation.match(emailPattern);
    const phones = conversation.match(phonePattern);
    const names = conversation.match(namePattern);
    
    if (emails) leadData.email = emails[0];
    if (phones) leadData.phone = phones[0];
    if (names) leadData.name = names[0].split(' ').slice(-1).join(' ');
    
    // Extract business-specific information based on lead qualification questions
    if (agent.leadQualificationQuestions && Array.isArray(agent.leadQualificationQuestions)) {
      agent.leadQualificationQuestions.forEach((q: any) => {
        const questionKeyword = q.question.toLowerCase().split(' ')[0];
        if (conversation.toLowerCase().includes(questionKeyword)) {
          leadData[questionKeyword] = 'mentioned';
        }
      });
    }
    
    // Extract product interest
    if (agent.productCatalog && Array.isArray(agent.productCatalog)) {
      const mentionedProducts = agent.productCatalog.filter((product: any) => 
        conversation.toLowerCase().includes(product.name.toLowerCase())
      );
      if (mentionedProducts.length > 0) {
        leadData.interestedProducts = mentionedProducts.map((p: any) => p.name);
      }
    }
    
    return leadData;
  }

  suggestProductRecommendations(userQuery: string, agent: Agent): Array<any> {
    if (!agent.productCatalog || !Array.isArray(agent.productCatalog)) {
      return [];
    }
    
    const queryLower = userQuery.toLowerCase();
    const recommendations: Array<any> = [];
    
    // Simple keyword matching for product recommendations
    agent.productCatalog.forEach((product: any) => {
      const productKeywords = `${product.name} ${product.description}`.toLowerCase();
      const queryWords = queryLower.split(' ');
      
      let relevanceScore = 0;
      queryWords.forEach(word => {
        if (productKeywords.includes(word)) {
          relevanceScore++;
        }
      });
      
      if (relevanceScore > 0) {
        recommendations.push({
          ...product,
          relevanceScore
        });
      }
    });
    
    // Sort by relevance score and return top 3
    return recommendations
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3);
  }
}

export const businessIntelligence = new EnhancedBusinessIntelligence();