import { Client } from 'pg';

async function check() {
    const client = new Client({
        user: 'postgres',
        host: 'localhost',
        database: 'renewal_reminders',
        password: 'N@kivo123',
        port: 5432
    });

    await client.connect();

    const res = await client.query(`
        SELECT r.id, r.offset_days, r.status, r.scheduled_at, c.primary_email 
        FROM reminders r 
        JOIN customers c ON r.customer_id = c.id 
        WHERE c.primary_email = 'phitruong1712@gmail.com'
        ORDER BY r.offset_days
    `);

    console.log('Reminders for phitruong1712@gmail.com:');
    console.log(JSON.stringify(res.rows, null, 2));

    await client.end();
}

check().catch(console.error);
