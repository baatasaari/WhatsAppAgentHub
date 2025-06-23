import { Request, Response } from 'express';
import { DatabaseHealth } from '../config/database';
import { pool } from '../db';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      error?: string;
    };
    memory: {
      usage: number;
      limit: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
  };
}

export class HealthMonitor {
  private static instance: HealthMonitor;
  private startTime = Date.now();

  static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  async getHealthStatus(): Promise<HealthStatus> {
    const dbHealth = DatabaseHealth.getInstance();
    const memUsage = process.memoryUsage();
    
    // Test database connection with timing
    const dbStart = Date.now();
    const isDatabaseHealthy = await dbHealth.checkHealth(pool);
    const dbResponseTime = Date.now() - dbStart;
    
    const dbStatus = dbHealth.getHealthStatus();
    
    const status: HealthStatus = {
      status: isDatabaseHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: {
          status: isDatabaseHealthy ? 'healthy' : 'unhealthy',
          responseTime: dbResponseTime,
          error: dbStatus.lastError,
        },
        memory: {
          usage: memUsage.heapUsed,
          limit: memUsage.heapTotal,
          percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
        },
        cpu: {
          usage: process.cpuUsage().user / 1000000, // Convert to seconds
        },
      },
    };

    return status;
  }

  async handleHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health = await this.getHealthStatus();
      const statusCode = health.status === 'healthy' ? 200 : 503;
      
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      });
    }
  }

  async handleReadiness(req: Request, res: Response): Promise<void> {
    try {
      const dbHealth = DatabaseHealth.getInstance();
      const isDatabaseReady = await dbHealth.checkHealth(pool);
      
      if (isDatabaseReady) {
        res.status(200).json({
          status: 'ready',
          timestamp: new Date().toISOString(),
          services: ['database'],
        });
      } else {
        res.status(503).json({
          status: 'not ready',
          timestamp: new Date().toISOString(),
          reason: 'Database not available',
        });
      }
    } catch (error) {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: 'Readiness check failed',
      });
    }
  }

  async handleLiveness(req: Request, res: Response): Promise<void> {
    // Simple liveness check - if this endpoint responds, the app is alive
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
    });
  }
}

export class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics = new Map<string, number>();
  private startTime = Date.now();

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  incrementCounter(name: string, value = 1): void {
    const current = this.metrics.get(name) || 0;
    this.metrics.set(name, current + value);
  }

  setGauge(name: string, value: number): void {
    this.metrics.set(name, value);
  }

  getMetrics(): Record<string, any> {
    const memUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime;
    
    return {
      // System metrics
      'system_uptime_ms': uptime,
      'system_memory_heap_used_bytes': memUsage.heapUsed,
      'system_memory_heap_total_bytes': memUsage.heapTotal,
      'system_memory_external_bytes': memUsage.external,
      'system_memory_rss_bytes': memUsage.rss,
      
      // Application metrics
      ...Object.fromEntries(this.metrics),
      
      // Timestamp
      'metrics_timestamp': new Date().toISOString(),
    };
  }

  async handleMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = this.getMetrics();
      
      // Return in Prometheus format if requested
      if (req.headers.accept?.includes('text/plain')) {
        const prometheusMetrics = Object.entries(metrics)
          .filter(([_, value]) => typeof value === 'number')
          .map(([key, value]) => `${key} ${value}`)
          .join('\n');
        
        res.setHeader('Content-Type', 'text/plain');
        res.send(prometheusMetrics);
      } else {
        res.json(metrics);
      }
    } catch (error) {
      res.status(500).json({
        error: 'Failed to collect metrics',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Track HTTP requests
  trackRequest(method: string, path: string, statusCode: number, duration: number): void {
    this.incrementCounter(`http_requests_total`);
    this.incrementCounter(`http_requests_${method.toLowerCase()}_total`);
    this.incrementCounter(`http_responses_${statusCode}_total`);
    this.setGauge(`http_request_duration_ms`, duration);
  }

  // Track database operations
  trackDatabaseOperation(operation: string, duration: number, success: boolean): void {
    this.incrementCounter(`database_operations_total`);
    this.incrementCounter(`database_operations_${operation}_total`);
    this.incrementCounter(`database_operations_${success ? 'success' : 'error'}_total`);
    this.setGauge(`database_operation_duration_ms`, duration);
  }

  // Track business metrics
  trackAgentInteraction(agentId: number): void {
    this.incrementCounter('agent_interactions_total');
    this.incrementCounter(`agent_${agentId}_interactions_total`);
  }

  trackConversion(agentId: number): void {
    this.incrementCounter('conversions_total');
    this.incrementCounter(`agent_${agentId}_conversions_total`);
  }
}