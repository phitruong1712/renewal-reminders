-- Add unique constraint to primary_email column
-- Run this in your Supabase SQL Editor

-- Add unique constraint to primary_email
ALTER TABLE customers 
ADD CONSTRAINT customers_primary_email_key UNIQUE (primary_email);

-- Verify the constraint was added
SELECT 
  conname AS constraint_name,
  contype AS constraint_type,
  a.attname AS column_name
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.conrelid = 'customers'::regclass
  AND a.attname = 'primary_email';

