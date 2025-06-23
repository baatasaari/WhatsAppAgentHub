import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Rate limiting configurations for different endpoint types
export const createRateLimit = (windowMs: number, max: number, message?: string) => {
  const requests = new Map<string, { count: number; resetTime: number }>();
  
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const key = ip;
    
    const current = requests.get(key);
    if (!current || now > current.resetTime) {
      requests.set(key, { count: 1, resetTime: now + windowMs });
      next();
    } else if (current.count < max) {
      current.count++;
      next();
    } else {
      res.status(429).json({ 
        message: message || 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil((current.resetTime - now) / 1000)
      });
    }
  };
};

// Different rate limits for different endpoint types
export const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // limit each IP to 5 requests per windowMs
  'Too many authentication attempts, please try again later.'
);

export const apiRateLimit = createRateLimit(
  1 * 60 * 1000, // 1 minute
  100, // limit each IP to 100 requests per minute
  'API rate limit exceeded, please slow down.'
);

export const voiceCallRateLimit = createRateLimit(
  5 * 60 * 1000, // 5 minutes
  10, // limit voice calls to prevent abuse
  'Voice call rate limit exceeded, please wait before initiating more calls.'
);

export const widgetRateLimit = createRateLimit(
  1 * 60 * 1000, // 1 minute
  1000, // high limit for widget interactions
  'Widget interaction rate limit exceeded.'
);

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // HSTS for HTTPS
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  next();
};

// CORS middleware
export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    ...(process.env.REPLIT_DOMAINS?.split(',') || []),
    'https://localhost:3000',
    'http://localhost:3000',
  ].filter(Boolean);
  
  if (!origin || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key');
  }
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString(),
    };
    
    if (res.statusCode >= 400) {
      console.error('Request Error:', JSON.stringify(logData));
    } else if (process.env.NODE_ENV === 'development') {
      console.log('Request:', JSON.stringify(logData));
    }
  });
  
  next();
};

// Error handling middleware
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Error:', {
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    message: isDevelopment ? err.message : 'Internal Server Error',
    ...(isDevelopment && { stack: err.stack }),
  });
};

// Input validation middleware
export const validateInput = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData;
      next();
    } catch (error: any) {
      res.status(400).json({
        message: 'Validation failed',
        errors: error.errors || [{ message: error.message }],
      });
    }
  };
};

// API key validation for widget endpoints
export const validateApiKey = async (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] || req.body.apiKey || req.query.apiKey;
  
  if (!apiKey) {
    return res.status(401).json({ message: 'API key required' });
  }
  
  try {
    if (typeof apiKey !== 'string' || apiKey.length < 32) {
      return res.status(401).json({ message: 'Invalid API key format' });
    }
    
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid API key' });
  }
};

// Request size limiting
export const requestSizeLimit = (maxSizeMB: number = 10) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.get('content-length');
    if (contentLength && parseInt(contentLength) > maxSizeMB * 1024 * 1024) {
      return res.status(413).json({ message: 'Request entity too large' });
    }
    next();
  };
};

// IP whitelist middleware for admin endpoints
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (process.env.NODE_ENV === 'development' || allowedIPs.includes(clientIP || '')) {
      next();
    } else {
      res.status(403).json({ message: 'Access denied from this IP address' });
    }
  };
};

// Request ID generation for tracing
export const generateRequestId = (req: Request, res: Response, next: NextFunction) => {
  const requestId = crypto.randomUUID();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};