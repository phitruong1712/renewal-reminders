/**
 * Database configuration helper
 * Provides better error messages and validation
 */

export interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export function getDbConfig(): DbConfig {
  const useLocalDb = !!(
    process.env.DATABASE_HOST ||
    process.env.POSTGRES_HOST ||
    process.env.USE_LOCAL_DB === 'true'
  );

  if (!useLocalDb) {
    throw new Error('Local database is not enabled. Set USE_LOCAL_DB=true or DATABASE_HOST in .env.local');
  }

  const host = process.env.POSTGRES_HOST || process.env.DATABASE_HOST || 'localhost';
  const port = parseInt(process.env.POSTGRES_PORT || process.env.DATABASE_PORT || '5432', 10);
  const database = process.env.POSTGRES_DATABASE || process.env.DATABASE_NAME || 'renewal_reminders';
  const user = process.env.POSTGRES_USER || process.env.DATABASE_USER || 'postgres';
  
  // Get password - ensure it's always a string
  const passwordEnv = process.env.POSTGRES_PASSWORD || process.env.DATABASE_PASSWORD;
  const password = passwordEnv !== undefined && passwordEnv !== null ? String(passwordEnv) : '';

  // Validate configuration
  if (!host || !database || !user) {
    throw new Error('Database configuration is incomplete. Please check your .env.local file.');
  }

  return {
    host,
    port,
    database,
    user,
    password,
  };
}

