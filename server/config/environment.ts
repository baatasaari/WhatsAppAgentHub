import { z } from 'zod';

// Environment variable validation schema
const envSchema = z.object({
  // Core application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default(5000),
  
  // Database
  DATABASE_URL: z.string().min(1, 'Database URL is required'),
  DB_MAX_CONNECTIONS: z.string().transform(Number).default(20),
  DB_IDLE_TIMEOUT: z.string().transform(Number).default(30000),
  DB_CONNECTION_TIMEOUT: z.string().transform(Number).default(10000),
  DB_RETRY_ATTEMPTS: z.string().transform(Number).default(3),
  DB_RETRY_DELAY: z.string().transform(Number).default(1000),
  
  // Authentication & Security
  SESSION_SECRET: z.string().min(32, 'Session secret must be at least 32 characters'),
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters').optional(),
  ENCRYPTION_KEY: z.string().min(32, 'Encryption key must be at least 32 characters').optional(),
  
  // AI Services
  OPENAI_API_KEY: z.string().min(1, 'OpenAI API key is required'),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  
  // External Services
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  
  // Deployment
  REPLIT_DOMAINS: z.string().optional(),
  FRONTEND_URL: z.string().url().optional(),
  
  // Monitoring & Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  ENABLE_METRICS: z.string().transform(val => val === 'true').default(false),
  SENTRY_DSN: z.string().optional(),
  
  // Performance
  ENABLE_CACHING: z.string().transform(val => val === 'true').default(true),
  CACHE_TTL_SECONDS: z.string().transform(Number).default(300),
  MAX_REQUEST_SIZE: z.string().default('10mb'),
  
  // Feature Flags
  ENABLE_VOICE_CALLING: z.string().transform(val => val === 'true').default(true),
  ENABLE_WHATSAPP_API: z.string().transform(val => val === 'true').default(true),
  ENABLE_ANALYTICS: z.string().transform(val => val === 'true').default(true),
});

export type Environment = z.infer<typeof envSchema>;

// Validate and export environment variables
export function validateEnvironment(): Environment {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('Environment validation failed:', error);
    process.exit(1);
  }
}

// Environment-specific configurations
export const env = validateEnvironment();

// Configuration objects based on environment
export const config = {
  // Database configuration
  database: {
    connectionString: env.DATABASE_URL,
    maxConnections: env.DB_MAX_CONNECTIONS,
    idleTimeout: env.DB_IDLE_TIMEOUT,
    connectionTimeout: env.DB_CONNECTION_TIMEOUT,
    retryAttempts: env.DB_RETRY_ATTEMPTS,
    retryDelay: env.DB_RETRY_DELAY,
  },
  
  // Security configuration
  security: {
    sessionSecret: env.SESSION_SECRET,
    jwtSecret: env.JWT_SECRET,
    encryptionKey: env.ENCRYPTION_KEY,
    maxRequestSize: env.MAX_REQUEST_SIZE,
  },
  
  // AI service configuration
  ai: {
    openai: {
      apiKey: env.OPENAI_API_KEY,
      enabled: true,
    },
    anthropic: {
      apiKey: env.ANTHROPIC_API_KEY,
      enabled: !!env.ANTHROPIC_API_KEY,
    },
    google: {
      apiKey: env.GOOGLE_AI_API_KEY,
      enabled: !!env.GOOGLE_AI_API_KEY,
    },
  },
  
  // External services configuration
  services: {
    twilio: {
      accountSid: env.TWILIO_ACCOUNT_SID,
      authToken: env.TWILIO_AUTH_TOKEN,
      phoneNumber: env.TWILIO_PHONE_NUMBER,
      enabled: !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN),
    },
    whatsapp: {
      accessToken: env.WHATSAPP_ACCESS_TOKEN,
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
      webhookVerifyToken: env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      enabled: !!(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID),
    },
  },
  
  // Performance configuration
  performance: {
    enableCaching: env.ENABLE_CACHING,
    cacheTtlSeconds: env.CACHE_TTL_SECONDS,
    enableMetrics: env.ENABLE_METRICS,
  },
  
  // Feature flags
  features: {
    voiceCalling: env.ENABLE_VOICE_CALLING,
    whatsappApi: env.ENABLE_WHATSAPP_API,
    analytics: env.ENABLE_ANALYTICS,
  },
  
  // Environment info
  app: {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    isProduction: env.NODE_ENV === 'production',
    isDevelopment: env.NODE_ENV === 'development',
    logLevel: env.LOG_LEVEL,
  },
};

// Runtime configuration validation
export function validateRuntimeConfig() {
  const errors: string[] = [];
  
  // Check critical services
  if (!config.ai.openai.enabled) {
    errors.push('OpenAI API key is missing - core AI functionality will not work');
  }
  
  if (config.features.voiceCalling && !config.services.twilio.enabled) {
    console.warn('Voice calling is enabled but Twilio credentials are missing');
  }
  
  if (config.features.whatsappApi && !config.services.whatsapp.enabled) {
    console.warn('WhatsApp API is enabled but credentials are missing');
  }
  
  // Check production-specific requirements
  if (config.app.isProduction) {
    if (!config.security.jwtSecret) {
      errors.push('JWT secret is required in production');
    }
    
    if (!config.security.encryptionKey) {
      errors.push('Encryption key is required in production');
    }
    
    if (config.app.logLevel === 'debug') {
      console.warn('Debug logging enabled in production');
    }
  }
  
  if (errors.length > 0) {
    console.error('Configuration validation failed:');
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
  }
  
  return true;
}