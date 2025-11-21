import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const DB_CONFIG = {
    user: 'postgres',
    host: 'localhost',
    database: 'renewal_reminders',
    password: 'N@kivo123',
    port: 5432,
};

async function runMigration() {
    const client = new Client(DB_CONFIG);

    try {
        await client.connect();
        console.log('Connected to local database.');

        // Add distributor_cc_emails column
        await client.query(`
            ALTER TABLE customers 
            ADD COLUMN IF NOT EXISTS distributor_cc_emails TEXT[];
        `);

        console.log('✓ Added distributor_cc_emails column');

        // Verify the column was added
        const result = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'customers' 
            AND column_name = 'distributor_cc_emails';
        `);

        if (result.rows.length > 0) {
            console.log('✓ Column verified:', result.rows[0]);
        }

    } catch (error: any) {
        console.error('Migration failed:', error.message);
        throw error;
    } finally {
        await client.end();
    }
}

runMigration().catch(console.error);
