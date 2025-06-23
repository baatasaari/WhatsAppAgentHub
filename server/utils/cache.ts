import { Request, Response, NextFunction } from 'express';

export class CacheManager {
  private static instance: CacheManager;
  private cache = new Map<string, { data: any; expires: number }>();
  private cleanupInterval: NodeJS.Timeout;

  private constructor() {
    // Cleanup expired entries every 5 minutes
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
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.cache.delete(key));
    
    if (expiredKeys.length > 0) {
      console.log(`Cache cleanup: removed ${expiredKeys.length} expired entries`);
    }
  }

  getStats() {
    const now = Date.now();
    let activeEntries = 0;
    let expiredEntries = 0;
    
    for (const [_, entry] of this.cache.entries()) {
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
      memoryUsage: process.memoryUsage(),
    };
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
  }
}

export function createCacheMiddleware(ttlSeconds: number = 300, keyGenerator?: (req: Request) => string) {
  const cache = CacheManager.getInstance();
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = keyGenerator ? keyGenerator(req) : `${req.method}:${req.url}`;
    const cachedData = cache.get(cacheKey);

    if (cachedData) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cachedData);
    }

    // Store original json method
    const originalJson = res.json.bind(res);
    
    // Override json method to cache response
    res.json = function(data: any) {
      cache.set(cacheKey, data, ttlSeconds);
      res.setHeader('X-Cache', 'MISS');
      return originalJson(data);
    };

    next();
  };
}

export const cacheConfigs = {
  // Short-term cache for frequently accessed data
  shortTerm: { ttl: 60 }, // 1 minute
  
  // Medium-term cache for moderately changing data
  mediumTerm: { ttl: 300 }, // 5 minutes
  
  // Long-term cache for rarely changing data
  longTerm: { ttl: 3600 }, // 1 hour
  
  // Static data cache for configuration
  static: { ttl: 86400 }, // 24 hours
};

export class CacheInvalidator {
  private static cache = CacheManager.getInstance();

  static invalidateAgent(agentId: number, userId?: number) {
    const patterns = [
      `GET:/api/agents/${agentId}`,
      `GET:/api/agents`,
      `GET:/api/agents/${agentId}/analytics`,
      `GET:/api/agents/${agentId}/conversations`,
    ];

    if (userId) {
      patterns.push(`GET:/api/users/${userId}/agents`);
    }

    patterns.forEach(pattern => {
      this.cache.delete(pattern);
    });

    console.log(`Cache invalidated for agent ${agentId}`);
  }

  static invalidateUser(userId: number) {
    const patterns = [
      `GET:/api/users/${userId}`,
      `GET:/api/users/${userId}/agents`,
      `GET:/api/users/${userId}/analytics`,
    ];

    patterns.forEach(pattern => {
      this.cache.delete(pattern);
    });

    console.log(`Cache invalidated for user ${userId}`);
  }

  static invalidateAnalytics(agentId: number) {
    const patterns = [
      `GET:/api/agents/${agentId}/analytics`,
      `GET:/api/analytics`,
      `GET:/api/agents/${agentId}/business-insights`,
    ];

    patterns.forEach(pattern => {
      this.cache.delete(pattern);
    });

    console.log(`Analytics cache invalidated for agent ${agentId}`);
  }

  static invalidateAll() {
    this.cache.clear();
    console.log('All cache entries invalidated');
  }
}