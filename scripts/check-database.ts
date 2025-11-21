import { Client } from 'pg';

const DB_CONFIG = {
    user: 'postgres',
    host: 'localhost',
    database: 'renewal_reminders',
    password: 'N@kivo123',
    port: 5432,
};

async function checkDatabase() {
    const client = new Client(DB_CONFIG);

    try {
        await client.connect();
        console.log('Connected to local database.\n');

        // Get all customers
        const result = await client.query(`
            SELECT 
                id,
                primary_email,
                end_user_company_name,
                distributor_name,
                reseller_name,
                expires_on,
                paused,
                distributor_cc_emails,
                reseller_cc_emails,
                end_user_cc_emails
            FROM customers 
            ORDER BY id;
        `);

        console.log(`Total customers: ${result.rows.length}\n`);

        result.rows.forEach((row, index) => {
            console.log(`${index + 1}. ${row.primary_email}`);
            console.log(`   Company: ${row.end_user_company_name || 'N/A'}`);
            console.log(`   Distributor: ${row.distributor_name || 'None'}`);
            console.log(`   Reseller: ${row.reseller_name || 'None'}`);
            console.log(`   Expires: ${row.expires_on}`);
            console.log(`   Paused: ${row.paused}`);
            console.log(`   Distributor CC: ${row.distributor_cc_emails ? row.distributor_cc_emails.join(', ') : 'None'}`);
            console.log(`   Reseller CC: ${row.reseller_cc_emails ? row.reseller_cc_emails.join(', ') : 'None'}`);
            console.log(`   End User CC: ${row.end_user_cc_emails ? row.end_user_cc_emails.join(', ') : 'None'}`);
            console.log('');
        });

    } catch (error: any) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

checkDatabase().catch(console.error);
