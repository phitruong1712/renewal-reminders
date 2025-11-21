import { Pool } from 'pg';
import { getDbConfig } from './dbConfig';

// Get database configuration with validation
let dbConfig;
try {
  dbConfig = getDbConfig();

  // Log connection info (without password) for debugging
  if (process.env.NODE_ENV !== 'production') {
    console.log('PostgreSQL connection config:', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      user: dbConfig.user,
      hasPassword: !!dbConfig.password,
    });
  }
} catch (error: any) {
  console.error('Database configuration error:', error.message);
  console.error('\nPlease check your .env.local file and ensure:');
  console.error('1. USE_LOCAL_DB=true is set');
  console.error('2. DATABASE_HOST, DATABASE_NAME, DATABASE_USER are configured');
  console.error('3. DATABASE_PASSWORD is set (even if empty string)');
  throw error;
}

// Create PostgreSQL connection pool with proper configuration
const poolConfig = {
  ...dbConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

const pool = new Pool(poolConfig);

// Handle pool errors
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

// Supabase-like query builder interface
class QueryBuilder {
  private table: string;
  private selectFields: string[] = ['*'];
  private whereConditions: { field: string; operator: string; value: any; orGroup?: number }[] = [];
  private orderBy: { field: string; ascending: boolean }[] = [];
  private limitCount?: number;
  private offsetCount?: number;
  private countExact: boolean = false;
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private insertData?: any | any[];
  private updateData?: any;
  private returnAfter: boolean = false;

  constructor(table: string) {
    this.table = table;
  }

  select(fields: string | string[] = '*', options?: { count?: 'exact' }) {
    if (typeof fields === 'string') {
      this.selectFields = fields === '*' ? ['*'] : [fields];
    } else {
      this.selectFields = fields;
    }
    if (options?.count === 'exact') {
      this.countExact = true;
    }
    this.operation = 'select';
    return this;
  }

  insert(data: any | any[]) {
    this.operation = 'insert';
    this.insertData = data;
    return this;
  }

  update(data: any) {
    this.operation = 'update';
    this.updateData = data;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(field: string, value: any) {
    this.whereConditions.push({ field, operator: '=', value });
    return this;
  }

  neq(field: string, value: any) {
    this.whereConditions.push({ field, operator: '!=', value });
    return this;
  }

  or(condition: string) {
    // Handle ILIKE search queries
    // Format: "field1.ilike.%value%,field2.ilike.%value%"
    const matches = condition.match(/(\w+)\.ilike\.%([^%]+)%/g);
    if (matches && matches.length > 0) {
      // Group OR conditions together
      const orGroup = Date.now();
      matches.forEach((match) => {
        const m = match.match(/(\w+)\.ilike\.%([^%]+)%/);
        if (m) {
          const [, field, value] = m;
          this.whereConditions.push({ field, operator: 'ILIKE', value: `%${value}%`, orGroup });
        }
      });
    }
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderBy.push({ field, ascending: options?.ascending !== false });
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(start: number, end: number) {
    this.offsetCount = start;
    this.limitCount = end - start + 1;
    return this;
  }

  maybeSingle() {
    this.limitCount = 1;
    return this;
  }

  single() {
    this.limitCount = 1;
    return this;
  }

  private buildWhereClause(): { sql: string; values: any[] } {
    if (this.whereConditions.length === 0) {
      return { sql: '', values: [] };
    }

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Group OR conditions
    const orGroups = new Map<number, string[]>();
    const andConditions: string[] = [];

    this.whereConditions.forEach((cond) => {
      if (cond.orGroup) {
        if (!orGroups.has(cond.orGroup)) {
          orGroups.set(cond.orGroup, []);
        }
        const condition = `${cond.field} ${cond.operator} $${paramIndex}`;
        orGroups.get(cond.orGroup)!.push(condition);
        values.push(cond.value);
        paramIndex++;
      } else {
        andConditions.push(`${cond.field} ${cond.operator} $${paramIndex}`);
        values.push(cond.value);
        paramIndex++;
      }
    });

    // Combine OR groups
    const allConditions = [...andConditions];
    orGroups.forEach((orConditions) => {
      allConditions.push(`(${orConditions.join(' OR ')})`);
    });

    return { sql: `WHERE ${allConditions.join(' AND ')}`, values };
  }

  async then<TResult1 = { data: any[] | null; error: any | null; count?: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: any[] | null; error: any | null; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    try {
      let result: { data: any[] | null; error: any | null; count?: number };

      if (this.operation === 'insert') {
        result = await this.executeInsert();
      } else if (this.operation === 'update') {
        result = await this.executeUpdate();
      } else if (this.operation === 'delete') {
        result = await this.executeDelete();
      } else {
        result = await this.executeSelect();
      }

      if (onfulfilled) {
        return onfulfilled(result) as TResult1;
      }
      return result as TResult1;
    } catch (error) {
      if (onrejected) {
        return onrejected(error) as TResult2;
      }
      throw error;
    }
  }

  private async executeSelect(): Promise<{ data: any[] | null; error: any | null; count?: number }> {
    try {
      let count: number | undefined;

      if (this.countExact) {
        const { sql: whereClause, values } = this.buildWhereClause();
        const countQuery = `SELECT COUNT(*) as count FROM ${this.table} ${whereClause}`;
        const countResult = await pool.query(countQuery, values);
        count = parseInt(countResult.rows[0].count, 10);
      }

      const selectClause = this.selectFields.join(', ');
      const { sql: whereClause, values: whereValues } = this.buildWhereClause();

      let sql = `SELECT ${selectClause} FROM ${this.table}`;
      const values = [...whereValues];

      if (whereClause) {
        sql += ` ${whereClause}`;
      }

      if (this.orderBy.length > 0) {
        const orderClauses = this.orderBy.map((o) => `${o.field} ${o.ascending ? 'ASC' : 'DESC'}`);
        sql += ` ORDER BY ${orderClauses.join(', ')}`;
      }

      if (this.limitCount) {
        sql += ` LIMIT $${values.length + 1}`;
        values.push(this.limitCount);
      }

      if (this.offsetCount !== undefined) {
        sql += ` OFFSET $${values.length + 1}`;
        values.push(this.offsetCount);
      }

      const result = await pool.query(sql, values);

      // Handle single() and maybeSingle()
      let data = result.rows;
      if (this.limitCount === 1) {
        data = data.length > 0 ? [data[0]] : [];
      }

      return {
        data: data,
        error: null,
        count,
      };
    } catch (error: any) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
        count: undefined,
      };
    }
  }

  private async executeInsert(): Promise<{ data: any[] | null; error: any | null }> {
    try {
      if (!this.insertData) {
        return { data: null, error: { message: 'No data to insert' } };
      }

      const rows = Array.isArray(this.insertData) ? this.insertData : [this.insertData];
      if (rows.length === 0) {
        return { data: [], error: null };
      }

      const keys = Object.keys(rows[0]);
      const placeholders = rows.map((_, i) => {
        const rowPlaceholders = keys.map((_, j) => `$${i * keys.length + j + 1}`).join(', ');
        return `(${rowPlaceholders})`;
      }).join(', ');

      const values = rows.flatMap((row) => keys.map((key) => row[key] ?? null));

      const sql = `
        INSERT INTO ${this.table} (${keys.join(', ')})
        VALUES ${placeholders}
        RETURNING *
      `;

      const result = await pool.query(sql, values);
      return { data: result.rows, error: null };
    } catch (error: any) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }
  }

  private async executeUpdate(): Promise<{ data: any[] | null; error: any | null }> {
    try {
      if (!this.updateData) {
        return { data: null, error: { message: 'No data to update' } };
      }

      const { sql: whereClause, values: whereValues } = this.buildWhereClause();
      if (!whereClause) {
        return { data: null, error: { message: 'Update requires WHERE clause' } };
      }

      const setKeys = Object.keys(this.updateData);
      const setClause = setKeys.map((key, index) => `${key} = $${index + 1}`).join(', ');
      const setValues = setKeys.map((key) => this.updateData![key]);

      // Adjust parameter indices for WHERE clause
      const adjustedWhereClause = whereClause.replace(/\$(\d+)/g, (_, num) => {
        return `$${parseInt(num, 10) + setValues.length}`;
      });

      const sql = `
        UPDATE ${this.table}
        SET ${setClause}
        ${adjustedWhereClause}
        RETURNING *
      `;

      const allValues = [...setValues, ...whereValues];
      const result = await pool.query(sql, allValues);
      return { data: result.rows, error: null };
    } catch (error: any) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }
  }

  private async executeDelete(): Promise<{ data: any[] | null; error: any | null }> {
    try {
      const { sql: whereClause, values } = this.buildWhereClause();
      if (!whereClause) {
        return { data: null, error: { message: 'Delete requires WHERE clause' } };
      }

      const sql = `DELETE FROM ${this.table} ${whereClause} RETURNING *`;
      const result = await pool.query(sql, values);
      return { data: result.rows, error: null };
    } catch (error: any) {
      return {
        data: null,
        error: { message: error.message, code: error.code },
      };
    }
  }
}

// Supabase-like client interface
class PostgresClient {
  from(table: string): QueryBuilder {
    return new QueryBuilder(table);
  }
}

export const postgres = new PostgresClient();

