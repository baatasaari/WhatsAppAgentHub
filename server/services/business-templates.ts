import { BusinessTemplate } from '@shared/schema';

export interface BusinessTemplateData {
  name: string;
  description: string;
  category: string;
  systemPrompt: string;
  welcomeMessage: string;
  sampleFaqs: Array<{ question: string; answer: string }>;
  sampleProducts: Array<{ name: string; description: string; price?: number }>;
  leadQualificationFlow: Array<{
    question: string;
    type: string;
    required: boolean;
  }>;
  customizations: {
    widgetColor?: string;
    brandingOptions?: Record<string, any>;
  };
}

export const businessTemplates: BusinessTemplateData[] = [
  {
    name: "E-commerce Store",
    description: "Perfect for online retailers and product-based businesses",
    category: "ecommerce",
    systemPrompt: `You are a helpful sales assistant for an e-commerce store. Your main goals are to:
1. Help customers find the right products for their needs
2. Answer questions about products, pricing, and availability
3. Assist with order inquiries and shipping information
4. Collect customer information for follow-up and remarketing
5. Provide excellent customer service to drive sales

Always be friendly, knowledgeable about the products, and ready to make recommendations based on customer needs. If you don't know something specific, offer to connect them with a human representative.`,
    welcomeMessage: "Hi! 👋 Welcome to our store! I'm here to help you find exactly what you're looking for. What can I help you with today?",
    sampleFaqs: [
      {
        question: "What are your shipping options?",
        answer: "We offer standard shipping (5-7 business days) for $5.99 and express shipping (2-3 business days) for $12.99. Free shipping on orders over $75!"
      },
      {
        question: "What's your return policy?",
        answer: "We offer a 30-day return policy for all items in original condition. Returns are free and easy - just contact us to start the process."
      },
      {
        question: "Do you offer international shipping?",
        answer: "Yes! We ship worldwide. International shipping costs vary by location and typically takes 7-14 business days."
      }
    ],
    sampleProducts: [
      { name: "Premium Wireless Headphones", description: "High-quality wireless headphones with noise cancellation", price: 199 },
      { name: "Smartphone Case", description: "Durable protective case for latest smartphones", price: 29 },
      { name: "Wireless Charger", description: "Fast wireless charging pad for all compatible devices", price: 39 }
    ],
    leadQualificationFlow: [
      { question: "What type of product are you looking for?", type: "text", required: true },
      { question: "What's your budget range?", type: "choice", required: false },
      { question: "When do you need this by?", type: "text", required: false }
    ],
    customizations: {
      widgetColor: "#FF6B35",
      brandingOptions: { showLogo: true, theme: "modern" }
    }
  },
  {
    name: "SaaS Product",
    description: "Ideal for software companies and digital service providers",
    category: "saas",
    systemPrompt: `You are a knowledgeable product specialist for a SaaS company. Your objectives are to:
1. Explain product features and benefits clearly
2. Understand customer pain points and how the software solves them
3. Qualify leads based on company size, needs, and budget
4. Schedule demos and trials for qualified prospects
5. Provide technical information and answer integration questions

Be consultative in your approach, focus on understanding their business needs first, then explain how the software can help them achieve their goals.`,
    welcomeMessage: "Hello! I'm here to help you discover how our software can streamline your business operations. What challenges are you currently facing?",
    sampleFaqs: [
      {
        question: "How much does your software cost?",
        answer: "Our pricing starts at $29/month for small teams. We also offer Professional and Enterprise plans. I'd be happy to discuss which plan fits your needs best!"
      },
      {
        question: "Do you offer a free trial?",
        answer: "Yes! We offer a 14-day free trial with full access to all features. No credit card required to get started."
      },
      {
        question: "What integrations do you support?",
        answer: "We integrate with 100+ popular business tools including Slack, Salesforce, HubSpot, Google Workspace, and Microsoft 365. What tools are you currently using?"
      }
    ],
    sampleProducts: [
      { name: "Starter Plan", description: "Perfect for small teams up to 10 users", price: 29 },
      { name: "Professional Plan", description: "Advanced features for growing businesses", price: 99 },
      { name: "Enterprise Plan", description: "Custom solutions for large organizations", price: 299 }
    ],
    leadQualificationFlow: [
      { question: "What's your company size?", type: "choice", required: true },
      { question: "What's your current solution?", type: "text", required: true },
      { question: "What's your timeline for implementation?", type: "text", required: false }
    ],
    customizations: {
      widgetColor: "#4A90E2",
      brandingOptions: { showLogo: true, theme: "professional" }
    }
  },
  {
    name: "Restaurant",
    description: "Great for restaurants, cafes, and food service businesses",
    category: "restaurant",
    systemPrompt: `You are a friendly restaurant host helping customers with their dining experience. Your main responsibilities are to:
1. Help customers with menu questions and recommendations
2. Take reservation requests and provide availability
3. Inform about special offers, events, and promotions
4. Assist with dietary restrictions and allergen information
5. Provide location and contact information

Be warm and welcoming, just like you would be greeting guests at the restaurant. Make them excited about their dining experience!`,
    welcomeMessage: "Welcome! 🍽️ We're excited to serve you! I can help with reservations, menu questions, or anything else you need to know about dining with us.",
    sampleFaqs: [
      {
        question: "Do you take reservations?",
        answer: "Yes! We take reservations for parties of all sizes. I can help you book a table - what date and time works best for you?"
      },
      {
        question: "Do you have vegetarian options?",
        answer: "Absolutely! We have many delicious vegetarian and vegan options. Our chef specializes in creative plant-based dishes that even meat-lovers enjoy!"
      },
      {
        question: "What are your hours?",
        answer: "We're open Tuesday-Sunday: Lunch 11:30am-3pm, Dinner 5pm-10pm. We're closed Mondays. Kitchen closes 30 minutes before closing time."
      }
    ],
    sampleProducts: [
      { name: "Signature Pasta", description: "House-made pasta with seasonal vegetables", price: 18 },
      { name: "Grilled Salmon", description: "Fresh Atlantic salmon with lemon herb butter", price: 26 },
      { name: "Artisan Pizza", description: "Wood-fired pizza with premium toppings", price: 16 }
    ],
    leadQualificationFlow: [
      { question: "How many people in your party?", type: "number", required: true },
      { question: "What date would you like to dine?", type: "text", required: true },
      { question: "Any special dietary requirements?", type: "text", required: false }
    ],
    customizations: {
      widgetColor: "#8B4513",
      brandingOptions: { showLogo: true, theme: "warm" }
    }
  },
  {
    name: "Professional Services",
    description: "Perfect for consultants, agencies, and service-based businesses",
    category: "services",
    systemPrompt: `You are a professional consultant representative helping potential clients understand our services. Your goals are to:
1. Understand the client's business challenges and objectives
2. Explain how our services can address their specific needs
3. Qualify leads based on budget, timeline, and project scope
4. Schedule consultations with the appropriate team members
5. Provide case studies and examples of successful projects

Maintain a professional, consultative tone. Focus on building trust and demonstrating expertise through thoughtful questions and relevant insights.`,
    welcomeMessage: "Hello! I'd love to learn about your business and see how we can help you achieve your goals. What challenges are you currently facing?",
    sampleFaqs: [
      {
        question: "What services do you offer?",
        answer: "We provide strategic consulting, digital transformation, marketing strategy, and business development services. Each engagement is customized to your specific needs and objectives."
      },
      {
        question: "How do you price your services?",
        answer: "Our pricing depends on project scope and complexity. We offer both project-based and retainer arrangements. I'd be happy to discuss your needs and provide a custom quote."
      },
      {
        question: "What's your typical project timeline?",
        answer: "Project timelines vary based on scope, but most engagements range from 3-6 months. We'll provide a detailed timeline during our initial consultation."
      }
    ],
    sampleProducts: [
      { name: "Strategy Consultation", description: "3-month strategic planning engagement", price: 15000 },
      { name: "Digital Transformation", description: "6-month digital optimization project", price: 35000 },
      { name: "Marketing Audit", description: "Comprehensive marketing assessment", price: 5000 }
    ],
    leadQualificationFlow: [
      { question: "What type of business do you run?", type: "text", required: true },
      { question: "What's your main business challenge?", type: "text", required: true },
      { question: "What's your timeline for getting started?", type: "text", required: false }
    ],
    customizations: {
      widgetColor: "#2C3E50",
      brandingOptions: { showLogo: true, theme: "corporate" }
    }
  },
  {
    name: "Real Estate",
    description: "Designed for real estate agents and property management companies",
    category: "real_estate",
    systemPrompt: `You are a knowledgeable real estate professional helping clients with their property needs. Your responsibilities include:
1. Understanding client requirements for buying, selling, or renting
2. Providing market insights and property information
3. Scheduling property viewings and consultations
4. Qualifying leads based on budget, location, and timeline
5. Offering guidance through the real estate process

Be helpful, trustworthy, and knowledgeable about the local market. Focus on understanding their specific needs and connecting them with the right properties or services.`,
    welcomeMessage: "Hi! I'm here to help with all your real estate needs. Whether you're buying, selling, or renting, I can guide you through the process. What can I help you with?",
    sampleFaqs: [
      {
        question: "How much is my home worth?",
        answer: "I'd be happy to help you determine your home's value! I can arrange a complimentary market analysis. Could you tell me a bit about your property - location, size, and when it was built?"
      },
      {
        question: "What are current mortgage rates?",
        answer: "Mortgage rates change daily, but I can connect you with trusted lenders who offer competitive rates. What type of property are you looking to finance?"
      },
      {
        question: "How long does it take to sell a house?",
        answer: "In our current market, well-priced homes typically sell within 30-45 days. The exact timeline depends on location, price, and condition. I can provide a detailed market analysis for your area."
      }
    ],
    sampleProducts: [
      { name: "Home Valuation", description: "Comprehensive market analysis of your property", price: 0 },
      { name: "Listing Service", description: "Full-service home selling with marketing", price: 0 },
      { name: "Buyer Consultation", description: "Personalized home buying guidance", price: 0 }
    ],
    leadQualificationFlow: [
      { question: "Are you looking to buy, sell, or rent?", type: "choice", required: true },
      { question: "What's your preferred location?", type: "text", required: true },
      { question: "What's your timeline?", type: "text", required: false }
    ],
    customizations: {
      widgetColor: "#27AE60",
      brandingOptions: { showLogo: true, theme: "professional" }
    }
  }
];

export class BusinessTemplateService {
  
  getTemplatesByCategory(category: string): BusinessTemplateData[] {
    return businessTemplates.filter(template => template.category === category);
  }
  
  getTemplateByName(name: string): BusinessTemplateData | undefined {
    return businessTemplates.find(template => template.name === name);
  }
  
  getAllTemplates(): BusinessTemplateData[] {
    return businessTemplates;
  }
  
  getCategories(): string[] {
    const categorySet = new Set(businessTemplates.map(template => template.category));
    return Array.from(categorySet);
  }
  
  customizeTemplateForBusiness(templateName: string, businessData: {
    businessName?: string;
    website?: string;
    phone?: string;
    email?: string;
    products?: Array<any>;
    faqs?: Array<any>;
    brandColor?: string;
  }): BusinessTemplateData | null {
    
    const template = this.getTemplateByName(templateName);
    if (!template) return null;
    
    const customized = { ...template };
    
    // Customize system prompt with business name
    if (businessData.businessName) {
      customized.systemPrompt = customized.systemPrompt.replace(
        /You are a/g, 
        `You are a helpful representative for ${businessData.businessName}, a`
      );
    }
    
    // Customize welcome message
    if (businessData.businessName) {
      customized.welcomeMessage = customized.welcomeMessage.replace(
        /our store|our software|dining with us/g,
        businessData.businessName
      );
    }
    
    // Replace sample products with actual products if provided
    if (businessData.products && businessData.products.length > 0) {
      customized.sampleProducts = businessData.products;
    }
    
    // Replace sample FAQs with actual FAQs if provided
    if (businessData.faqs && businessData.faqs.length > 0) {
      customized.sampleFaqs = businessData.faqs;
    }
    
    // Customize branding
    if (businessData.brandColor) {
      customized.customizations.widgetColor = businessData.brandColor;
    }
    
    // Add contact information to system prompt
    let contactInfo = "";
    if (businessData.website) contactInfo += `Website: ${businessData.website}\n`;
    if (businessData.phone) contactInfo += `Phone: ${businessData.phone}\n`;
    if (businessData.email) contactInfo += `Email: ${businessData.email}\n`;
    
    if (contactInfo) {
      customized.systemPrompt += `\n\nCONTACT INFORMATION:\n${contactInfo}`;
    }
    
    return customized;
  }
}