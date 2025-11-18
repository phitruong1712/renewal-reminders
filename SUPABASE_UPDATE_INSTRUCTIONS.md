# Supabase Database Update Instructions

## Overview
The renewal-reminders application has been updated to support distributor/reseller/end-user relationships. You need to update your Supabase database schema to add the new columns.

## Steps to Update Supabase

### 1. Open Supabase SQL Editor
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**

### 2. Run the Migration SQL
Copy and paste the contents of `supabase-add-distributor-reseller-fields.sql` into the SQL Editor, then click **Run** (or press Ctrl+Enter).

The migration will:
- Add columns for distributor information (name, contact_name, primary_email)
- Add columns for reseller information (name, contact_name, primary_email, cc_emails)
- Add columns for end-user information (company_name, contact_name, primary_email, cc_emails)
- Add columns for edition and licensing
- Create indexes for better query performance

### 3. Verify the Changes
After running the migration, verify the columns were added:
1. Go to **Table Editor** in the left sidebar
2. Select the `customers` table
3. Check that the following new columns exist:
   - `distributor_name`
   - `distributor_contact_name`
   - `distributor_primary_email`
   - `reseller_name`
   - `reseller_contact_name`
   - `reseller_primary_email`
   - `reseller_cc_emails`
   - `end_user_company_name`
   - `end_user_contact_name`
   - `end_user_primary_email`
   - `end_user_cc_emails`
   - `edition`
   - `licensing`

## How the System Works

### Relationship Hierarchy
The system determines who receives renewal reminders based on this priority:
1. **Distributor** (if present and not "Not Applicable") → receives reminder
2. **Reseller** (if distributor is "Not Applicable" and reseller is present) → receives reminder
3. **End User** (if both distributor and reseller are "Not Applicable") → receives reminder

### CSV Import Format
The CSV should have these columns:
- `distributor_name`, `distributor_contact_name`, `distributor_primary_email`
- `reseller_name`, `reseller_contact_name`, `reseller_primary_email`, `reseller_cc_emails`
- `end_user_company_name`, `end_user_contact_name`, `end_user_primary_email`, `end_user_cc_emails`
- `edition`, `licensing`
- `expires_on` (format: DD-MM-YY or YYYY-MM-DD)

### Date Format
- The system accepts dates in `DD-MM-YY` format (e.g., `17-12-25` for December 17, 2025)
- Dates are automatically converted to `YYYY-MM-DD` format for storage
- You can also use `YYYY-MM-DD` format directly

### "Not Applicable" Handling
- Use "Not Applicable" (case-insensitive) or leave blank for fields that don't apply
- The system will automatically determine the correct recipient based on which fields are populated

## Testing
After updating Supabase:
1. Import your CSV file through the admin interface
2. Verify that customers are created with the correct relationship information
3. Check that reminders are sent to the correct email addresses based on the relationship hierarchy

## Notes
- The `primary_email` field in the database will be set based on the relationship hierarchy
- Legacy fields (`company_name`, `contact_name`, `primary_email`, etc.) are maintained for backward compatibility
- The `edition` field replaces `plan_name` in the new structure, but `plan_name` is still supported

