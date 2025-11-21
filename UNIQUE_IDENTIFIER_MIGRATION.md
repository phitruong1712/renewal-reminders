# SQL Changes Summary - Unique Identifier Migration

## Overview
Changed the unique identifier for the `customers` table from `primary_email` to `end_user_primary_email`.

## Database Schema Changes

### SQL Migration File: `Supabase/7.sql`

```sql
-- Migration: Change unique identifier to end_user_primary_email
-- Run this in your Supabase SQL Editor

-- Drop the existing unique constraint on primary_email
ALTER TABLE customers
DROP CONSTRAINT IF EXISTS customers_primary_email_key;

-- Add unique constraint on end_user_primary_email
-- Note: This will fail if there are existing duplicates in end_user_primary_email
ALTER TABLE customers
ADD CONSTRAINT customers_end_user_primary_email_key UNIQUE (end_user_primary_email);
```

## What This Means

1. **Before**: Each row in the `customers` table had to have a unique `primary_email`.
2. **After**: Each row must now have a unique `end_user_primary_email`.
3. **Impact**: 
   - Multiple distributor or reseller relationships can now share the same `primary_email` as long as they have different `end_user_primary_email` values.
   - All import/sync operations now use `end_user_primary_email` to identify and update existing records.

## Files Updated

### 1. `Supabase/7.sql` (NEW)
- Created the migration file to update the database schema.

### 2. `src/app/api/sync-supabase/route.ts`
- Changed line 201: Now checks for existing customers using `end_user_primary_email` instead of `primary_email`.

### 3. `src/app/api/customers/import/route.ts`
- Changed line 123: Now checks for existing customers using `end_user_primary_email` instead of `primary_email`.

## Steps to Apply on Supabase

1. Open your Supabase SQL Editor
2. Copy and paste the contents of `Supabase/7.sql` (shown above)
3. Run the SQL commands
4. Verify the constraint was created:
   ```sql
   SELECT conname, contype 
   FROM pg_constraint 
   WHERE conrelid = 'customers'::regclass;
   ```

## Important Notes

- This migration will **fail** if you have duplicate values in the `end_user_primary_email` column.
- Before running this migration on Supabase, make sure all your customer records have a valid `end_user_primary_email`.
- The `primary_email` column is still required (NOT NULL) but is no longer unique.
