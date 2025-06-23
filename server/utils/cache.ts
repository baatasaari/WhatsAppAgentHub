import { Request, Response, NextFunction } from 'express';

// In-memory cache with TTL support
export class CacheManager {
  private static instance: CacheManager;
  private cache = new Map<string, { data: any; expires: number }>();
  private cleanupInterval: NodeJS.Timeout;

  private constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  set(key: string, data: any, ttlSeconds: number = 300): void {
    const expires = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { data, expires });
  }

  get<T = any>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    const now = Date.now();
    let activeEntries = 0;
    let expiredEntries = 0;
    
    for (const [, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        expiredEntries++;
      } else {
        activeEntries++;
      }
    }
    
    return {
      totalEntries: this.cache.size,
      activeEntries,
      expiredEntries,
      memoryUsage: JSON.stringify([...this.cache.entries()]).length,
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

// Cache middleware factory
export function createCacheMiddleware(ttlSeconds: number = 300, keyGenerator?: (req: Request) => string) {
  const cache = CacheManager.getInstance();
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    const cacheKey = keyGenerator ? keyGenerator(req) : `${req.method}:${req.url}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cachedData);
    }
    
    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = function(data: any) {
      if (res.statusCode === 200) {
        cache.set(cacheKey, data, ttlSeconds);
        res.setHeader('X-Cache', 'MISS');
      }
      return originalJson(data);
    };
    
    next();
  };
}

// Specific cache configurations for different endpoints
export const cacheConfigs = {
  // Cache agent data for 5 minutes
  agents: createCacheMiddleware(300, (req) => `agents:${req.params.userId || 'all'}`),
  
  // Cache analytics for 2 minutes
  analytics: createCacheMiddleware(120, (req) => `analytics:${req.params.agentId}:${req.query.period}`),
  
  // Cache business templates for 10 minutes
  templates: createCacheMiddleware(600, () => 'business-templates'),
  
  // Cache model configurations for 30 minutes
  models: createCacheMiddleware(1800, () => 'model-configs'),
  
  // Cache user data for 1 minute
  user: createCacheMiddleware(60, (req) => `user:${req.headers.authorization}`),
};

// Cache invalidation helpers
export class CacheInvalidator {
  private static cache = CacheManager.getInstance();
  
  static invalidateAgent(agentId: number, userId?: number) {
    this.cache.delete(`agents:${userId || 'all'}`);
    this.cache.delete(`agents:${agentId}`);
    // Invalidate related analytics
    this.cache.delete(`analytics:${agentId}:day`);
    this.cache.delete(`analytics:${agentId}:week`);
    this.cache.delete(`analytics:${agentId}:month`);
  }
  
  static invalidateUser(userId: number) {
    this.cache.delete(`user:${userId}`);
    this.cache.delete(`agents:${userId}`);
  }
  
  static invalidateAnalytics(agentId: number) {
    this.cache.delete(`analytics:${agentId}:day`);
    this.cache.delete(`analytics:${agentId}:week`);
    this.cache.delete(`analytics:${agentId}:month`);
  }
  
  static invalidateAll() {
    this.cache.clear();
  }
}