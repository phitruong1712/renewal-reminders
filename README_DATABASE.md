# Database Setup

## Issue
The API is returning an error: "Could not find the 'updated_at' column of 'customers' in the schema cache"

This happens because Supabase expects an `updated_at` column in the `customers` table, but it doesn't exist in your database.

## Solution

Run the SQL migration in your Supabase SQL Editor:

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Run the SQL from `supabase-migration.sql`

This will:
- Add `updated_at` column to the `customers` table
- Create a trigger to automatically update `updated_at` on UPDATE operations
- Optionally add `created_at` column as well

## Alternative: Manual SQL

If you prefer to run SQL manually, execute:

```sql
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
```

## After Adding the Column

1. The API should work without errors
2. The `updated_at` column will be automatically managed by the database trigger
3. You may need to refresh Supabase's schema cache (it usually refreshes automatically)

## Required Database Schema

### customers table
- `id` (serial, primary key)
- `company_name` (text, nullable)
- `contact_name` (text, nullable)
- `primary_email` (text, unique, not null)
- `cc_emails` (text array, nullable)
- `plan_name` (text, nullable)
- `renew_link` (text, nullable)
- `expires_on` (date, nullable)
- `paused` (boolean, default false)
- `last_reminder_status` (text, nullable)
- `last_reminder_sent_at` (timestamp, nullable)
- `created_at` (timestamp, default now()) - optional
- `updated_at` (timestamp, default now()) - required

### reminders table
- `id` (serial, primary key)
- `customer_id` (integer, foreign key to customers.id)
- `scheduled_at` (timestamp, not null)
- `status` (text, default 'pending')
- `sent_at` (timestamp, nullable)
- `provider_message_id` (text, nullable)

### send_logs table
- `id` (serial, primary key)
- `reminder_id` (integer, foreign key to reminders.id)
- `customer_id` (integer, foreign key to customers.id)
- `status` (text, not null)
- `error` (text, nullable)
- `sent_at` (timestamp, nullable)

