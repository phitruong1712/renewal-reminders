-- Migration: Add distributor, reseller, and end-user fields to customers table
-- Run this in your Supabase SQL Editor

-- Add new columns for distributor
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS distributor_name TEXT,
ADD COLUMN IF NOT EXISTS distributor_contact_name TEXT,
ADD COLUMN IF NOT EXISTS distributor_primary_email TEXT;

-- Add new columns for reseller
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS reseller_name TEXT,
ADD COLUMN IF NOT EXISTS reseller_contact_name TEXT,
ADD COLUMN IF NOT EXISTS reseller_primary_email TEXT,
ADD COLUMN IF NOT EXISTS reseller_cc_emails TEXT[];

-- Add new columns for end user
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS end_user_company_name TEXT,
ADD COLUMN IF NOT EXISTS end_user_contact_name TEXT,
ADD COLUMN IF NOT EXISTS end_user_primary_email TEXT,
ADD COLUMN IF NOT EXISTS end_user_cc_emails TEXT[];

-- Add new columns for edition and licensing
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS edition TEXT,
ADD COLUMN IF NOT EXISTS licensing TEXT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_customers_distributor_email ON customers(distributor_primary_email) WHERE distributor_primary_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_reseller_email ON customers(reseller_primary_email) WHERE reseller_primary_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_end_user_email ON customers(end_user_primary_email) WHERE end_user_primary_email IS NOT NULL;

-- Note: The primary_email field remains as the main identifier for the customer record
-- It will be set based on the relationship hierarchy: distributor > reseller > end_user

