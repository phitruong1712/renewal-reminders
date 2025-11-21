-- Migration: Change unique identifier to end_user_primary_email
-- Run this in your Supabase SQL Editor

-- Drop the existing unique constraint on primary_email
ALTER TABLE customers
DROP CONSTRAINT IF EXISTS customers_primary_email_key;

-- Add unique constraint on end_user_primary_email
-- Note: This will fail if there are existing duplicates in end_user_primary_email
ALTER TABLE customers
ADD CONSTRAINT customers_end_user_primary_email_key UNIQUE (end_user_primary_email);
