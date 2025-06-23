import { Request, Response } from 'express';
import { DatabaseHealth } from '../config/database';
import { pool } from '../db';

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: string;
  uptime: number;
  checks: {
    database: {
      status: 'healthy' | 'degraded' | 'down';
      responseTime?: number;
      lastCheck?: number;
    };
    memory: {
      status: 'healthy' | 'degraded' | 'down';
      usage: {
        used: number;
        total: number;
        percentage: number;
      };
    };
    services: {
      openai: boolean;
      anthropic: boolean;
      whatsapp: boolean;
    };
  };
  version: string;
  environment: string;
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

  async getHealthStatus(): Promise<HealthCheck> {
    const memoryUsage = process.memoryUsage();
    const dbHealth = DatabaseHealth.getInstance();
    
    // Check database connectivity
    const dbStartTime = Date.now();
    let dbStatus: 'healthy' | 'degraded' | 'down' = 'healthy';
    let dbResponseTime: number | undefined;
    
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      dbResponseTime = Date.now() - dbStartTime;
      dbStatus = dbResponseTime > 1000 ? 'degraded' : 'healthy';
    } catch (error) {
      dbStatus = 'down';
    }

    // Check memory usage
    const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    const memoryStatus = memoryPercentage > 90 ? 'down' : memoryPercentage > 70 ? 'degraded' : 'healthy';

    // Check external services
    const services = {
      openai: !!process.env.OPENAI_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      whatsapp: true, // Simplified check
    };

    // Overall status determination
    let overallStatus: 'healthy' | 'degraded' | 'down' = 'healthy';
    if (dbStatus === 'down' || memoryStatus === 'down') {
      overallStatus = 'down';
    } else if (dbStatus === 'degraded' || memoryStatus === 'degraded') {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      checks: {
        database: {
          status: dbStatus,
          responseTime: dbResponseTime,
          lastCheck: Date.now(),
        },
        memory: {
          status: memoryStatus,
          usage: {
            used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            percentage: Math.round(memoryPercentage),
          },
        },
        services,
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  }

  async handleHealthCheck(req: Request, res: Response) {
    try {
      const health = await this.getHealthStatus();
      const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
      
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(503).json({
        status: 'down',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      });
    }
  }

  async handleReadiness(req: Request, res: Response) {
    try {
      const health = await this.getHealthStatus();
      if (health.status === 'down') {
        res.status(503).json({ ready: false, reason: 'Service unavailable' });
      } else {
        res.status(200).json({ ready: true });
      }
    } catch (error) {
      res.status(503).json({ ready: false, reason: 'Readiness check failed' });
    }
  }

  handleLiveness(req: Request, res: Response) {
    // Simple liveness check - if we can respond, we're alive
    res.status(200).json({ 
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
    });
  }
}

// Metrics collection for monitoring
export class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics = new Map<string, any>();
  private counters = new Map<string, number>();

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  incrementCounter(name: string, value: number = 1) {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
  }

  setGauge(name: string, value: number) {
    this.metrics.set(name, { value, timestamp: Date.now() });
  }

  recordTiming(name: string, duration: number) {
    const timings = this.metrics.get(`${name}_timings`) || [];
    timings.push({ duration, timestamp: Date.now() });
    
    // Keep only last 100 measurements
    if (timings.length > 100) {
      timings.shift();
    }
    
    this.metrics.set(`${name}_timings`, timings);
  }

  getMetrics() {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.metrics),
      timestamp: new Date().toISOString(),
    };
  }

  async handleMetrics(req: Request, res: Response) {
    try {
      const metrics = this.getMetrics();
      res.status(200).json(metrics);
    } catch (error) {
      res.status(500).json({ error: 'Failed to collect metrics' });
    }
  }
}