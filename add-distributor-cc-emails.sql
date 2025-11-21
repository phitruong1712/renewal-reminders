-- Add distributor_cc_emails column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS distributor_cc_emails TEXT[];

-- Comment for documentation
COMMENT ON COLUMN customers.distributor_cc_emails IS 'CC email addresses for distributor communications';
