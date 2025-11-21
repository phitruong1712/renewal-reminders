import { Client } from 'pg';

const DB_CONFIG = {
    user: 'postgres',
    host: 'localhost',
    database: 'renewal_reminders',
    password: 'N@kivo123',
    port: 5432,
};

async function checkSpecificCustomers() {
    const client = new Client(DB_CONFIG);

    try {
        await client.connect();
        console.log('Connected to local database.\n');

        // Check the customers visible in the screenshot
        const emails = [
            'lzy@mightresources.com',
            'phitruong1712@gmail.com'
        ];

        for (const email of emails) {
            console.log(`\n========== ${email} ==========`);
            const result = await client.query(`
                SELECT * FROM customers WHERE LOWER(primary_email) = LOWER($1)
            `, [email]);

            if (result.rows.length === 0) {
                console.log('NOT FOUND');
                continue;
            }

            const row = result.rows[0];
            console.log('ID:', row.id);
            console.log('Primary Email:', row.primary_email);
            console.log('Company Name:', row.company_name);
            console.log('Contact Name:', row.contact_name);
            console.log('\n--- Distributor ---');
            console.log('Distributor Name:', row.distributor_name);
            console.log('Distributor Contact:', row.distributor_contact_name);
            console.log('Distributor Email:', row.distributor_primary_email);
            console.log('Distributor CC Emails:', row.distributor_cc_emails);
            console.log('\n--- Reseller ---');
            console.log('Reseller Name:', row.reseller_name);
            console.log('Reseller Contact:', row.reseller_contact_name);
            console.log('Reseller Email:', row.reseller_primary_email);
            console.log('Reseller CC Emails:', row.reseller_cc_emails);
            console.log('\n--- End User ---');
            console.log('End User Company:', row.end_user_company_name);
            console.log('End User Contact:', row.end_user_contact_name);
            console.log('End User Email:', row.end_user_primary_email);
            console.log('End User CC Emails:', row.end_user_cc_emails);
            console.log('\n--- Other ---');
            console.log('Edition:', row.edition);
            console.log('Licensing:', row.licensing);
            console.log('Expires On:', row.expires_on);
            console.log('Paused:', row.paused);
        }

    } catch (error: any) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

checkSpecificCustomers().catch(console.error);
