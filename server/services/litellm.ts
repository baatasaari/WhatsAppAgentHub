import axios from 'axios';
import { logger } from './logging';

export interface LiteLLMConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  retries: number;
}

export interface LiteLLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LiteLLMRequest {
  model: string;
  messages: LiteLLMMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  user?: string;
  metadata?: Record<string, any>;
}

export interface LiteLLMResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost?: number;
  };
  provider?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  inputCostPer1k: number;
  outputCostPer1k: number;
  maxTokens: number;
  capabilities: string[];
  status: 'active' | 'deprecated' | 'beta';
}

export class LiteLLMService {
  private config: LiteLLMConfig;
  private client: any;

  constructor(config: LiteLLMConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // Chat completion with unified interface
  async chatCompletion(request: LiteLLMRequest, userId?: number, agentId?: number): Promise<LiteLLMResponse> {
    try {
      const startTime = Date.now();
      
      await logger.logAgent('llm_request_start', userId, agentId, true, {
        model: request.model,
        messageCount: request.messages.length,
        temperature: request.temperature,
      });

      const response = await this.client.post('/chat/completions', request);
      const duration = Date.now() - startTime;
      
      const result: LiteLLMResponse = response.data;
      
      // Log successful completion with cost tracking
      await logger.logCost('llm_completion', userId, agentId, result.usage?.cost || 0, 'USD', {
        model: request.model,
        provider: result.provider,
        promptTokens: result.usage.prompt_tokens,
        completionTokens: result.usage.completion_tokens,
        totalTokens: result.usage.total_tokens,
        duration,
      });

      await logger.logAgent('llm_request_success', userId, agentId, true, {
        model: request.model,
        provider: result.provider,
        tokens: result.usage.total_tokens,
        cost: result.usage?.cost,
        duration,
      });

      return result;
    } catch (error: any) {
      await logger.logError(error, 'litellm_chat_completion', userId, agentId, {
        model: request.model,
        messageCount: request.messages.length,
      });
      throw new Error(`LiteLLM chat completion failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // Get available models from LiteLLM
  async getAvailableModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.client.get('/models');
      return response.data.data.map((model: any) => ({
        id: model.id,
        name: model.name || model.id,
        provider: model.provider || 'unknown',
        inputCostPer1k: model.pricing?.input || 0,
        outputCostPer1k: model.pricing?.output || 0,
        maxTokens: model.max_tokens || 4096,
        capabilities: model.capabilities || [],
        status: model.status || 'active',
      }));
    } catch (error: any) {
      await logger.logError(error, 'litellm_get_models', undefined, undefined, {});
      throw new Error(`Failed to fetch LiteLLM models: ${error.response?.data?.error || error.message}`);
    }
  }

  // Get usage analytics for a specific user/agent
  async getUsageAnalytics(userId?: number, agentId?: number, startDate?: Date, endDate?: Date) {
    try {
      const params: any = {};
      if (userId) params.user_id = userId;
      if (agentId) params.agent_id = agentId;
      if (startDate) params.start_date = startDate.toISOString();
      if (endDate) params.end_date = endDate.toISOString();

      const response = await this.client.get('/analytics/usage', { params });
      return response.data;
    } catch (error: any) {
      await logger.logError(error, 'litellm_usage_analytics', userId, agentId, {});
      throw new Error(`Failed to fetch usage analytics: ${error.response?.data?.error || error.message}`);
    }
  }

  // Get cost analytics
  async getCostAnalytics(userId?: number, agentId?: number, startDate?: Date, endDate?: Date) {
    try {
      const params: any = {};
      if (userId) params.user_id = userId;
      if (agentId) params.agent_id = agentId;
      if (startDate) params.start_date = startDate.toISOString();
      if (endDate) params.end_date = endDate.toISOString();

      const response = await this.client.get('/analytics/costs', { params });
      return response.data;
    } catch (error: any) {
      await logger.logError(error, 'litellm_cost_analytics', userId, agentId, {});
      throw new Error(`Failed to fetch cost analytics: ${error.response?.data?.error || error.message}`);
    }
  }

  // Health check for LiteLLM service
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      await logger.logSystem('litellm_health_check_failed', undefined, undefined, false, { error: error.message });
      return false;
    }
  }

  // Streaming chat completion
  async streamChatCompletion(
    request: LiteLLMRequest, 
    onChunk: (chunk: string) => void,
    userId?: number, 
    agentId?: number
  ): Promise<void> {
    try {
      const streamRequest = { ...request, stream: true };
      
      await logger.logAgent('llm_stream_start', userId, agentId, true, {
        model: request.model,
        messageCount: request.messages.length,
      });

      const response = await this.client.post('/chat/completions', streamRequest, {
        responseType: 'stream',
      });

      response.data.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                onChunk(content);
              }
            } catch (e) {
              // Ignore parsing errors for incomplete chunks
            }
          }
        }
      });

      response.data.on('end', () => {
        logger.logAgent('llm_stream_complete', userId, agentId, true, {
          model: request.model,
        });
      });

    } catch (error: any) {
      await logger.logError(error, 'litellm_stream_completion', userId, agentId, {
        model: request.model,
      });
      throw new Error(`LiteLLM stream completion failed: ${error.response?.data?.error || error.message}`);
    }
  }

  // Model performance testing
  async testModel(modelId: string, testPrompt: string = "Hello, how are you?"): Promise<{
    success: boolean;
    responseTime: number;
    tokenCount?: number;
    cost?: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      const response = await this.chatCompletion({
        model: modelId,
        messages: [{ role: 'user', content: testPrompt }],
        max_tokens: 50,
      });

      return {
        success: true,
        responseTime: Date.now() - startTime,
        tokenCount: response.usage.total_tokens,
        cost: response.usage.cost,
      };
    } catch (error: any) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }
}

// Initialize LiteLLM service with environment configuration
export const createLiteLLMService = (): LiteLLMService => {
  const config: LiteLLMConfig = {
    baseUrl: process.env.LITELLM_BASE_URL || 'http://localhost:4000',
    apiKey: process.env.LITELLM_API_KEY || 'sk-1234',
    timeout: parseInt(process.env.LITELLM_TIMEOUT || '30000'),
    retries: parseInt(process.env.LITELLM_RETRIES || '3'),
  };

  return new LiteLLMService(config);
};

export const litellm = createLiteLLMService();