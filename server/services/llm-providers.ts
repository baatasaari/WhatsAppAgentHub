import OpenAI from "openai";
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
// the newest Anthropic model is "claude-sonnet-4-20250514" which was released May 14, 2025. Use this by default unless user has already selected claude-3-7-sonnet-20250219

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LeadQualification {
  score: number; // 0-100
  recommendation: 'continue' | 'call' | 'qualify';
  extractedData: Record<string, any>;
  reasoning: string;
}

// OpenAI Provider
export class OpenAIProvider {
  private client: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required');
    }
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async generateResponse(messages: ChatMessage[], model: string = 'gpt-4o'): Promise<LLMResponse> {
    const response = await this.client.chat.completions.create({
      model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      temperature: 0.7,
      max_tokens: 1000,
    });

    return {
      content: response.choices[0].message.content || '',
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      }
    };
  }

  async qualifyLead(conversationText: string, questions: string[]): Promise<LeadQualification> {
    const prompt = `Analyze this WhatsApp conversation and qualify the lead:

Conversation:
${conversationText}

Lead Qualification Questions:
${questions.map(q => `- ${q}`).join('\n')}

Extract key information and score the lead quality (0-100). Respond with JSON format:
{
  "score": number,
  "recommendation": "continue" | "call" | "qualify",
  "extractedData": {},
  "reasoning": "string"
}`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }
}

// Anthropic Provider
export class AnthropicProvider {
  private client: Anthropic;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is required');
    }
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async generateResponse(messages: ChatMessage[], model: string = 'claude-sonnet-4-20250514'): Promise<LLMResponse> {
    // Extract system message
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const response = await this.client.messages.create({
      model,
      system: systemMessage,
      messages: conversationMessages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      max_tokens: 1000,
      temperature: 0.7,
    });

    const content = response.content[0];
    return {
      content: content.type === 'text' ? content.text : '',
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      }
    };
  }

  async qualifyLead(conversationText: string, questions: string[]): Promise<LeadQualification> {
    const prompt = `Analyze this WhatsApp conversation and qualify the lead:

Conversation:
${conversationText}

Lead Qualification Questions:
${questions.map(q => `- ${q}`).join('\n')}

Extract key information and score the lead quality (0-100). Respond with JSON format:
{
  "score": number,
  "recommendation": "continue" | "call" | "qualify",
  "extractedData": {},
  "reasoning": "string"
}`;

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      system: 'You are a Customer Insights AI. Analyze this feedback and output in JSON format.',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.3,
    });

    const content = response.content[0];
    const jsonText = content.type === 'text' ? content.text : '{}';
    return JSON.parse(jsonText);
  }
}

// Google AI Provider
export class GoogleAIProvider {
  private client: GoogleGenerativeAI;

  constructor() {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY is required');
    }
    this.client = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
  }

  async generateResponse(messages: ChatMessage[], model: string = 'gemini-1.5-pro'): Promise<LLMResponse> {
    const genAI = this.client.getGenerativeModel({ model });
    
    // Convert messages to Google AI format
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const conversationMessages = messages.filter(m => m.role !== 'system');
    
    const history = conversationMessages.slice(0, -1).map(msg => ({
      role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: msg.content }]
    }));

    const lastMessage = conversationMessages[conversationMessages.length - 1];
    const prompt = systemMessage ? `${systemMessage}\n\n${lastMessage.content}` : lastMessage.content;

    const chat = genAI.startChat({ history });
    const result = await chat.sendMessage(prompt);
    const response = await result.response;

    return {
      content: response.text(),
      usage: {
        promptTokens: 0, // Google AI doesn't provide detailed token usage
        completionTokens: 0,
        totalTokens: 0,
      }
    };
  }

  async qualifyLead(conversationText: string, questions: string[]): Promise<LeadQualification> {
    const genAI = this.client.getGenerativeModel({ model: 'gemini-1.5-pro' });
    
    const prompt = `Analyze this WhatsApp conversation and qualify the lead:

Conversation:
${conversationText}

Lead Qualification Questions:
${questions.map(q => `- ${q}`).join('\n')}

Extract key information and score the lead quality (0-100). Respond with JSON format:
{
  "score": number,
  "recommendation": "continue" | "call" | "qualify",
  "extractedData": {},
  "reasoning": "string"
}`;

    const result = await genAI.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    try {
      return JSON.parse(text);
    } catch {
      // Fallback if JSON parsing fails
      return {
        score: 50,
        recommendation: 'continue',
        extractedData: {},
        reasoning: 'Unable to parse lead qualification response'
      };
    }
  }
}

// LLM Provider Factory
export class LLMProviderFactory {
  static createProvider(provider: string) {
    switch (provider.toLowerCase()) {
      case 'gpt-4o':
      case 'gpt-3.5-turbo':
      case 'openai':
        return new OpenAIProvider();
      
      case 'claude-sonnet-4-20250514':
      case 'claude-3-7-sonnet-20250219':
      case 'claude-3':
      case 'anthropic':
        return new AnthropicProvider();
      
      case 'gemini-1.5-pro':
      case 'gemini-pro':
      case 'google':
        return new GoogleAIProvider();
      
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }

  static getModelForProvider(provider: string): string {
    switch (provider.toLowerCase()) {
      case 'gpt-4o':
        return 'gpt-4o';
      case 'gpt-3.5-turbo':
        return 'gpt-3.5-turbo';
      case 'claude-sonnet-4-20250514':
        return 'claude-sonnet-4-20250514';
      case 'claude-3-7-sonnet-20250219':
        return 'claude-3-7-sonnet-20250219';
      case 'claude-3':
        return 'claude-3-sonnet-20240229';
      case 'gemini-1.5-pro':
        return 'gemini-1.5-pro';
      case 'gemini-pro':
        return 'gemini-pro';
      default:
        return provider;
    }
  }
}

// Main interface for generating responses
export async function generateChatResponse(
  messages: ChatMessage[], 
  llmProvider: string
): Promise<LLMResponse> {
  const provider = LLMProviderFactory.createProvider(llmProvider);
  const model = LLMProviderFactory.getModelForProvider(llmProvider);
  return await provider.generateResponse(messages, model);
}

// Main interface for lead qualification
export async function qualifyLead(
  conversationText: string, 
  questions: string[], 
  llmProvider: string = 'gpt-4o'
): Promise<LeadQualification> {
  const provider = LLMProviderFactory.createProvider(llmProvider);
  return await provider.qualifyLead(conversationText, questions);
}