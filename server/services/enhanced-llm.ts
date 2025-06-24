import { litellm } from './litellm';
import { logger } from './logging';
import { storage } from '../storage';
import { v4 as uuidv4 } from 'uuid';

export interface EnhancedLLMRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  userId?: number;
  agentId?: number;
  conversationId?: string;
  metadata?: Record<string, any>;
}

export interface EnhancedLLMResponse {
  id: string;
  content: string;
  model: string;
  provider: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    inputCost: number;
    outputCost: number;
    totalCost: number;
  };
  responseTime: number;
  metadata?: Record<string, any>;
}

export class EnhancedLLMService {
  // Generate AI response with comprehensive tracking
  async generateResponse(request: EnhancedLLMRequest): Promise<EnhancedLLMResponse> {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      // Log request start
      await logger.logAgent('llm_enhanced_request_start', request.userId, request.agentId, true, {
        requestId,
        model: request.model,
        messageCount: request.messages.length,
        conversationId: request.conversationId,
      });

      // Make LiteLLM request
      const litellmResponse = await litellm.chatCompletion({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        user: request.userId?.toString(),
        metadata: {
          ...request.metadata,
          agentId: request.agentId,
          conversationId: request.conversationId,
          requestId,
        },
      }, request.userId, request.agentId);

      const responseTime = Date.now() - startTime;
      const content = litellmResponse.choices[0]?.message?.content || '';

      // Calculate costs based on model pricing
      const usage = {
        promptTokens: litellmResponse.usage.prompt_tokens,
        completionTokens: litellmResponse.usage.completion_tokens,
        totalTokens: litellmResponse.usage.total_tokens,
        inputCost: litellmResponse.usage.cost ? litellmResponse.usage.cost * 0.7 : 0, // Estimate 70% input
        outputCost: litellmResponse.usage.cost ? litellmResponse.usage.cost * 0.3 : 0, // Estimate 30% output
        totalCost: litellmResponse.usage.cost || 0,
      };

      // Track usage in database
      await this.trackUsage({
        id: requestId,
        userId: request.userId,
        agentId: request.agentId,
        modelId: request.model,
        provider: litellmResponse.provider || 'unknown',
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        inputCost: usage.inputCost,
        outputCost: usage.outputCost,
        totalCost: usage.totalCost,
        responseTime,
        requestMetadata: {
          conversationId: request.conversationId,
          temperature: request.temperature,
          maxTokens: request.maxTokens,
          ...request.metadata,
        },
      });

      // Log successful response
      await logger.logAgent('llm_enhanced_response_success', request.userId, request.agentId, true, {
        requestId,
        model: request.model,
        provider: litellmResponse.provider,
        tokens: usage.totalTokens,
        cost: usage.totalCost,
        responseTime,
        responseLength: content.length,
      });

      return {
        id: requestId,
        content,
        model: request.model,
        provider: litellmResponse.provider || 'unknown',
        usage,
        responseTime,
        metadata: {
          conversationId: request.conversationId,
          finishReason: litellmResponse.choices[0]?.finish_reason,
        },
      };

    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      await logger.logError(error, 'enhanced_llm_generation', request.userId, request.agentId, {
        requestId,
        model: request.model,
        messageCount: request.messages.length,
        responseTime,
      });

      throw new Error(`Enhanced LLM generation failed: ${error.message}`);
    }
  }

  // Stream response with real-time tracking
  async streamResponse(
    request: EnhancedLLMRequest,
    onChunk: (chunk: string) => void,
    onComplete?: (response: EnhancedLLMResponse) => void
  ): Promise<void> {
    const startTime = Date.now();
    const requestId = uuidv4();
    let fullContent = '';

    try {
      await logger.logAgent('llm_enhanced_stream_start', request.userId, request.agentId, true, {
        requestId,
        model: request.model,
        messageCount: request.messages.length,
      });

      await litellm.streamChatCompletion(
        {
          model: request.model,
          messages: request.messages,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          user: request.userId?.toString(),
          metadata: {
            ...request.metadata,
            agentId: request.agentId,
            requestId,
          },
        },
        (chunk: string) => {
          fullContent += chunk;
          onChunk(chunk);
        },
        request.userId,
        request.agentId
      );

      const responseTime = Date.now() - startTime;

      // Log stream completion
      await logger.logAgent('llm_enhanced_stream_complete', request.userId, request.agentId, true, {
        requestId,
        model: request.model,
        responseTime,
        responseLength: fullContent.length,
      });

      if (onComplete) {
        onComplete({
          id: requestId,
          content: fullContent,
          model: request.model,
          provider: 'unknown', // Provider info might not be available in stream
          usage: {
            promptTokens: 0, // Tokens not available in stream mode
            completionTokens: 0,
            totalTokens: 0,
            inputCost: 0,
            outputCost: 0,
            totalCost: 0,
          },
          responseTime,
        });
      }

    } catch (error: any) {
      await logger.logError(error, 'enhanced_llm_stream', request.userId, request.agentId, {
        requestId,
        model: request.model,
        responseTime: Date.now() - startTime,
      });
      throw error;
    }
  }

  // Track usage in database
  private async trackUsage(usage: any): Promise<void> {
    try {
      await storage.createLiteLLMUsage(usage);
      
      // Update daily analytics
      await this.updateDailyAnalytics(usage);
    } catch (error) {
      await logger.logError(error as Error, 'usage_tracking', usage.userId, usage.agentId, {
        modelId: usage.modelId,
        cost: usage.totalCost,
      });
    }
  }

  // Update daily analytics aggregation
  private async updateDailyAnalytics(usage: any): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      await storage.createOrUpdateLiteLLMAnalytics({
        userId: usage.userId,
        agentId: usage.agentId,
        modelId: usage.modelId,
        provider: usage.provider,
        date: today,
        totalRequests: 1,
        successfulRequests: 1,
        failedRequests: 0,
        totalTokens: usage.totalTokens,
        totalCost: usage.totalCost,
        avgResponseTime: usage.responseTime,
      });
    } catch (error) {
      await logger.logError(error as Error, 'analytics_update', usage.userId, usage.agentId, {
        date: today,
        modelId: usage.modelId,
      });
    }
  }

  // Get model recommendations based on usage patterns
  async getModelRecommendations(userId: number, agentId?: number): Promise<{
    recommended: string[];
    reasons: Record<string, string[]>;
    costSavings?: Record<string, number>;
  }> {
    try {
      const analytics = await storage.getLiteLLMAnalyticsByUser(userId, agentId);
      
      // Analyze usage patterns
      const modelUsage = analytics.reduce((acc: any, item) => {
        if (!acc[item.modelId]) {
          acc[item.modelId] = {
            requests: 0,
            cost: 0,
            avgResponseTime: 0,
            provider: item.provider,
          };
        }
        acc[item.modelId].requests += item.totalRequests || 0;
        acc[item.modelId].cost += item.totalCost || 0;
        acc[item.modelId].avgResponseTime += item.avgResponseTime || 0;
        return acc;
      }, {});

      // Generate recommendations based on patterns
      const recommended = [];
      const reasons: Record<string, string[]> = {};

      // Most used model
      const mostUsed = Object.entries(modelUsage)
        .sort(([,a]: any, [,b]: any) => b.requests - a.requests)[0];
      
      if (mostUsed) {
        recommended.push(mostUsed[0]);
        reasons[mostUsed[0]] = ['Most frequently used model', 'Proven reliability for your use case'];
      }

      // Cost-effective alternatives
      const costEffective = Object.entries(modelUsage)
        .sort(([,a]: any, [,b]: any) => (a.cost / a.requests) - (b.cost / b.requests))
        .slice(0, 2);

      costEffective.forEach(([modelId]) => {
        if (!recommended.includes(modelId)) {
          recommended.push(modelId);
          reasons[modelId] = reasons[modelId] || [];
          reasons[modelId].push('Cost-effective option', 'Good performance-to-cost ratio');
        }
      });

      return {
        recommended: recommended.slice(0, 3),
        reasons,
      };

    } catch (error) {
      await logger.logError(error as Error, 'model_recommendations', userId, agentId, {});
      return {
        recommended: ['gpt-4o', 'claude-3-5-sonnet-20241022'],
        reasons: {
          'gpt-4o': ['High-quality responses', 'Reliable performance'],
          'claude-3-5-sonnet-20241022': ['Advanced reasoning', 'Cost-effective'],
        },
      };
    }
  }

  // Test model performance
  async testModelPerformance(modelId: string, userId?: number): Promise<{
    success: boolean;
    responseTime: number;
    qualityScore?: number;
    costEstimate?: number;
    error?: string;
  }> {
    try {
      const testResult = await litellm.testModel(modelId, 'Explain the concept of artificial intelligence in one sentence.');
      
      if (testResult.success) {
        await logger.logSystem('model_performance_test', userId, undefined, true, {
          modelId,
          responseTime: testResult.responseTime,
          tokenCount: testResult.tokenCount,
          cost: testResult.cost,
        });

        return {
          success: true,
          responseTime: testResult.responseTime,
          qualityScore: testResult.tokenCount ? Math.min(100, (testResult.tokenCount / 50) * 100) : undefined,
          costEstimate: testResult.cost,
        };
      } else {
        await logger.logSystem('model_performance_test', userId, undefined, false, {
          modelId,
          error: testResult.error,
        });

        return {
          success: false,
          responseTime: testResult.responseTime,
          error: testResult.error,
        };
      }
    } catch (error: any) {
      await logger.logError(error, 'model_performance_test', userId, undefined, { modelId });
      return {
        success: false,
        responseTime: 0,
        error: error.message,
      };
    }
  }
}

export const enhancedLLM = new EnhancedLLMService();