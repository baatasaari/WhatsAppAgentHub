import { Pool } from '@neondatabase/serverless';
import { config } from './environment';

export interface DatabaseConfig {
  connectionString: string;
  pool: {
    min: number;
    max: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  };
}

export const databaseConfig: DatabaseConfig = {
  connectionString: config.database.url,
  pool: {
    min: config.database.pool.min,
    max: config.database.pool.max,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  },
};

export async function createConnectionWithRetry(retries = 3): Promise<Pool> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const pool = new Pool(databaseConfig);
      
      // Test the connection
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      console.log(`✓ Database connection established (attempt ${attempt})`);
      return pool;
    } catch (error) {
      console.error(`Database connection attempt ${attempt} failed:`, error);
      
      if (attempt === retries) {
        throw new Error(`Failed to connect to database after ${retries} attempts`);
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  throw new Error('Unexpected error in connection retry logic');
}

export class DatabaseHealth {
  private static instance: DatabaseHealth;
  private healthCheckInterval?: NodeJS.Timeout;
  private isHealthy = true;
  private lastError?: Error;

  static getInstance(): DatabaseHealth {
    if (!DatabaseHealth.instance) {
      DatabaseHealth.instance = new DatabaseHealth();
    }
    return DatabaseHealth.instance;
  }

  async checkHealth(pool: Pool): Promise<boolean> {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      this.isHealthy = true;
      this.lastError = undefined;
      return true;
    } catch (error) {
      this.isHealthy = false;
      this.lastError = error as Error;
      console.error('Database health check failed:', error);
      return false;
    }
  }

  startHealthChecks(pool: Pool, intervalMs = 30000): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.checkHealth(pool);
    }, intervalMs);
    
    console.log(`✓ Database health monitoring started (${intervalMs}ms interval)`);
  }

  stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
  }

  getHealthStatus(): { healthy: boolean; lastError?: string } {
    return {
      healthy: this.isHealthy,
      lastError: this.lastError?.message,
    };
  }
}

export async function gracefulShutdown(pool: Pool): Promise<void> {
  console.log('Closing database connections...');
  
  try {
    DatabaseHealth.getInstance().stopHealthChecks();
    await pool.end();
    console.log('✓ Database connections closed gracefully');
  } catch (error) {
    console.error('Error during database shutdown:', error);
  }
}