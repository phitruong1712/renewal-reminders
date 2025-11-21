-- Migration: Add distributor_cc_emails column to customers table
-- Run this in Supabase SQL Editor to keep your database schema consistent

-- Add the new column
ALTER TABLE customers ADD COLUMN IF NOT EXISTS distributor_cc_emails TEXT[];

-- Add a comment for documentation
COMMENT ON COLUMN customers.distributor_cc_emails IS 'CC email addresses for distributor communications';

-- Verify the column was added (optional check)
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'customers' AND column_name = 'distributor_cc_emails';
