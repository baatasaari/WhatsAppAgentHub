import { db } from "../db";
import { logs, type InsertLog } from "@shared/schema";
import { eq, desc, and, gte, lte, like } from "drizzle-orm";

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';
export type LogCategory = 'agent' | 'auth' | 'api' | 'cost' | 'webhook' | 'voice' | 'whatsapp' | 'system' | 'security';

export interface LogData {
  level: LogLevel;
  category: LogCategory;
  message: string;
  userId?: number;
  agentId?: number;
  sessionId?: string;
  metadata?: Record<string, any>;
  costData?: {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    currency: string;
  };
  performanceData?: {
    duration: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  errorData?: {
    stack: string;
    code: string;
  };
}

export class LoggingService {
  private static instance: LoggingService;
  private logQueue: InsertLog[] = [];
  private batchSize = 10;
  private flushInterval = 5000; // 5 seconds

  constructor() {
    // Start batch processing
    this.startBatchProcessor();
  }

  static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  private startBatchProcessor() {
    setInterval(() => {
      this.flushLogs();
    }, this.flushInterval);
  }

  private async flushLogs() {
    if (this.logQueue.length === 0) return;

    const logsToFlush = this.logQueue.splice(0, this.batchSize);
    
    try {
      await db.insert(logs).values(logsToFlush);
    } catch (error) {
      console.error('Failed to flush logs to database:', error);
      // Re-add failed logs to queue (with limit to prevent memory issues)
      if (this.logQueue.length < 1000) {
        this.logQueue.unshift(...logsToFlush);
      }
    }
  }

  private async addLog(data: LogData) {
    const logEntry: InsertLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level: data.level,
      category: data.category,
      message: data.message,
      userId: data.userId || null,
      agentId: data.agentId || null,
      sessionId: data.sessionId || null,
      metadata: data.metadata || {},
      timestamp: new Date(),
    };

    this.logQueue.push(logEntry);

    // Force flush for critical logs
    if (data.level === 'critical' || data.level === 'error') {
      await this.flushLogs();
    }
  }

  // Agent Decision Logging
  async logAgentDecision(
    agentId: number,
    userId: number,
    decision: string,
    context: Record<string, any>,
    sessionId?: string
  ) {
    await this.addLog({
      level: 'info',
      category: 'agent',
      message: `Agent decision: ${decision}`,
      userId,
      agentId,
      sessionId,
      metadata: {
        decision,
        context,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Cost Tracking Logging
  async logCost(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    cost: number,
    currency: string = 'USD',
    agentId?: number,
    userId?: number,
    sessionId?: string
  ) {
    await this.addLog({
      level: 'info',
      category: 'cost',
      message: `LLM cost incurred: ${cost} ${currency} for ${provider}/${model}`,
      userId,
      agentId,
      sessionId,
      metadata: {
        provider,
        model,
        inputTokens,
        outputTokens,
        cost,
        currency,
        timestamp: new Date().toISOString(),
      },
      costData: {
        provider,
        model,
        inputTokens,
        outputTokens,
        cost,
        currency,
      },
    });
  }

  // API Request Logging
  async logApiRequest(
    method: string,
    endpoint: string,
    statusCode: number,
    duration: number,
    userId?: number,
    metadata?: Record<string, any>
  ) {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    
    await this.addLog({
      level,
      category: 'api',
      message: `${method} ${endpoint} - ${statusCode} (${duration}ms)`,
      userId,
      metadata: {
        method,
        endpoint,
        statusCode,
        duration,
        ...metadata,
      },
      performanceData: {
        duration,
        memoryUsage: process.memoryUsage().heapUsed,
        cpuUsage: process.cpuUsage().user,
      },
    });
  }

  // Authentication Logging
  async logAuth(
    action: string,
    userId?: number,
    success: boolean = true,
    metadata?: Record<string, any>
  ) {
    await this.addLog({
      level: success ? 'info' : 'warn',
      category: 'auth',
      message: `Authentication ${action}: ${success ? 'success' : 'failed'}`,
      userId,
      metadata: {
        action,
        success,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    });
  }

  // Security Event Logging
  async logSecurityEvent(
    event: string,
    severity: LogLevel,
    userId?: number,
    metadata?: Record<string, any>
  ) {
    await this.addLog({
      level: severity,
      category: 'security',
      message: `Security event: ${event}`,
      userId,
      metadata: {
        event,
        severity,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    });
  }

  // Webhook Logging
  async logWebhook(
    provider: string,
    status: string,
    agentId?: number,
    metadata?: Record<string, any>
  ) {
    await this.addLog({
      level: status === 'success' ? 'info' : 'warn',
      category: 'webhook',
      message: `Webhook ${provider}: ${status}`,
      agentId,
      metadata: {
        provider,
        status,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    });
  }

  // Error Logging
  async logError(
    error: Error,
    context: string,
    userId?: number,
    agentId?: number,
    metadata?: Record<string, any>
  ) {
    await this.addLog({
      level: 'error',
      category: 'system',
      message: `Error in ${context}: ${error.message}`,
      userId,
      agentId,
      metadata: {
        context,
        errorMessage: error.message,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
      errorData: {
        stack: error.stack || '',
        code: (error as any).code || 'UNKNOWN',
      },
    });
  }

  // System Performance Logging
  async logPerformance(
    operation: string,
    duration: number,
    metadata?: Record<string, any>
  ) {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    await this.addLog({
      level: duration > 5000 ? 'warn' : 'debug',
      category: 'system',
      message: `Performance: ${operation} took ${duration}ms`,
      metadata: {
        operation,
        duration,
        ...metadata,
      },
      performanceData: {
        duration,
        memoryUsage: memUsage.heapUsed,
        cpuUsage: cpuUsage.user,
      },
    });
  }

  // Query logs for dashboard
  async getLogs(
    filters: {
      level?: LogLevel;
      category?: LogCategory;
      userId?: number;
      agentId?: number;
      startDate?: Date;
      endDate?: Date;
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const conditions = [];

    if (filters.level) {
      conditions.push(eq(logs.level, filters.level));
    }
    if (filters.category) {
      conditions.push(eq(logs.category, filters.category));
    }
    if (filters.userId) {
      conditions.push(eq(logs.userId, filters.userId));
    }
    if (filters.agentId) {
      conditions.push(eq(logs.agentId, filters.agentId));
    }
    if (filters.startDate) {
      conditions.push(gte(logs.timestamp, filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(lte(logs.timestamp, filters.endDate));
    }
    if (filters.search) {
      conditions.push(like(logs.message, `%${filters.search}%`));
    }

    let query = db.select().from(logs);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return await query
      .orderBy(desc(logs.timestamp))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);
  }

  // Get log statistics
  async getLogStats(
    startDate?: Date,
    endDate?: Date
  ) {
    const conditions = [];
    
    if (startDate) {
      conditions.push(gte(logs.timestamp, startDate));
    }
    if (endDate) {
      conditions.push(lte(logs.timestamp, endDate));
    }

    let whereClause = undefined;
    if (conditions.length > 0) {
      whereClause = and(...conditions);
    }

    // Get level statistics
    const levelQuery = db
      .select({
        level: logs.level,
      })
      .from(logs)
      .groupBy(logs.level);
    
    const levelStats = whereClause 
      ? await levelQuery.where(whereClause)
      : await levelQuery;

    // Get category statistics  
    const categoryQuery = db
      .select({
        category: logs.category,
      })
      .from(logs)
      .groupBy(logs.category);
      
    const categoryStats = whereClause
      ? await categoryQuery.where(whereClause)
      : await categoryQuery;

    // Get total count
    const totalQuery = db.select().from(logs);
    const totalLogs = whereClause
      ? await totalQuery.where(whereClause)
      : await totalQuery;

    return {
      levelStats,
      categoryStats,
      totalLogs: totalLogs.length,
    };
  }

  // Cleanup old logs
  async cleanupOldLogs(daysToKeep: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await db
      .delete(logs)
      .where(lte(logs.timestamp, cutoffDate))
      .returning({ id: logs.id });

    const deletedCount = result.length;

    await this.addLog({
      level: 'info',
      category: 'system',
      message: `Cleaned up ${deletedCount} old logs older than ${daysToKeep} days`,
      metadata: {
        deletedCount,
        cutoffDate: cutoffDate.toISOString(),
      },
    });

    return deletedCount;
  }
}

// Export singleton instance
export const logger = LoggingService.getInstance();