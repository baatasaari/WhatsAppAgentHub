import { Pool } from '@neondatabase/serverless';

// Database configuration with connection pooling and retry logic
export interface DatabaseConfig {
  connectionString: string;
  maxConnections: number;
  idleTimeout: number;
  connectionTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export const databaseConfig: DatabaseConfig = {
  connectionString: process.env.DATABASE_URL!,
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
  idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
  retryAttempts: parseInt(process.env.DB_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.DB_RETRY_DELAY || '1000'),
};

// Connection health monitoring
export class DatabaseHealth {
  private static instance: DatabaseHealth;
  private connectionStatus: 'healthy' | 'degraded' | 'down' = 'healthy';
  private lastCheck: number = 0;
  private checkInterval: number = 30000; // 30 seconds

  static getInstance(): DatabaseHealth {
    if (!DatabaseHealth.instance) {
      DatabaseHealth.instance = new DatabaseHealth();
    }
    return DatabaseHealth.instance;
  }

  async checkConnection(pool: Pool): Promise<boolean> {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.connectionStatus = 'healthy';
      this.lastCheck = Date.now();
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      this.connectionStatus = 'down';
      this.lastCheck = Date.now();
      return false;
    }
  }

  getStatus() {
    return {
      status: this.connectionStatus,
      lastCheck: this.lastCheck,
      nextCheck: this.lastCheck + this.checkInterval,
    };
  }

  startHealthChecks(pool: Pool) {
    setInterval(async () => {
      await this.checkConnection(pool);
    }, this.checkInterval);
  }
}

// Connection retry mechanism
export async function createConnectionWithRetry(config: DatabaseConfig): Promise<Pool> {
  let attempts = 0;
  
  while (attempts < config.retryAttempts) {
    try {
      const pool = new Pool({
        connectionString: config.connectionString,
        max: config.maxConnections,
        idleTimeoutMillis: config.idleTimeout,
        connectionTimeoutMillis: config.connectionTimeout,
      });

      // Test connection
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();

      console.log('Database connection established successfully');
      return pool;
    } catch (error) {
      attempts++;
      console.error(`Database connection attempt ${attempts} failed:`, error);
      
      if (attempts >= config.retryAttempts) {
        throw new Error(`Failed to connect to database after ${config.retryAttempts} attempts`);
      }
      
      await new Promise(resolve => setTimeout(resolve, config.retryDelay * attempts));
    }
  }
  
  throw new Error('Maximum connection attempts exceeded');
}

// Graceful shutdown handler
export async function gracefulShutdown(pool: Pool): Promise<void> {
  console.log('Initiating database connection shutdown...');
  try {
    await pool.end();
    console.log('Database connections closed successfully');
  } catch (error) {
    console.error('Error during database shutdown:', error);
  }
}