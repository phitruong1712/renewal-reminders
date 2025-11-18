# Import CSV on Vercel - Quick Guide

## ✅ Changes Pushed to GitHub
All updates have been committed and pushed. Vercel will automatically deploy the new version.

## 📋 Prerequisites (Do This First!)

### Step 1: Run Supabase Migration
**IMPORTANT:** You must run the database migration before importing data.

1. Go to: https://supabase.com/dashboard
2. Select: **NAKIVO Reminder Project**
3. Navigate to: **SQL Editor** → **New Query**
4. Open: `supabase-add-distributor-reseller-fields.sql`
5. Copy the entire SQL content and paste it
6. Click **Run** (or press Ctrl+Enter)
7. Verify the columns were added in **Table Editor** → `customers` table

### Step 2: Wait for Vercel Deployment
1. Go to: https://vercel.com/dashboard
2. Select your **renewal-reminders** project
3. Wait for the deployment to complete (usually 1-2 minutes)
4. You'll see a green checkmark when it's ready

## 🚀 Import CSV Data on Vercel

### Step 1: Access Admin UI
1. Go to your Vercel deployment URL (e.g., `https://renewal-reminders.vercel.app`)
2. Navigate to: `/admin` (e.g., `https://renewal-reminders.vercel.app/admin`)
3. Enter your admin password (from `.env.local`: `N@kivo123`)

### Step 2: Import CSV
1. Click the **"Import CSV"** button
2. Open the file: `New_Updates/customers_rows.csv`
3. Copy the **entire contents** (including the header row):
   ```
   id,distributor_name,distributor_contact_name,distributor_primary_email,reseller_name,reseller_contact_name,reseller_primary_email,reseller_cc_emails,end_user_company_name,end_user_contact_name,end_user_primary_email,end_user_cc_emails,edition,licensing,expires_on,paused,last_reminder_status,last_reminder_sent_at,updated_at
   1,Not Applicable,Not Applicable,Not Applicable,Not Applicable,Not Applicable,Not Applicable,Not Applicable,Example Test,Phi,phitruong1712@gmail.com,"truongphiace@gmail.com, phitruong1712@icloud.com",Enterprise Plus,Subscription for 50 workloads,17-12-25,,,,,
   2,Not Applicable,Not Applicable,Not Applicable,"	PT. MARTUNAS TAMITA INDONESIA",Zulfikar,zulfikar.jafar@mti.co.id,phitruong1712@gmail.com,PT. Andalan Furnindo,Andreas Agung,andreasa@afsugar.com,"itsupport@afsugar.com, phitruong1712@gmail.com",Pro Essentials,4 CPU sockets for VM backup,04-12-25,,,,,
   3,,,,, Lee,LZY@mightresources.com,Not Applicable,Mapo Industries Sdn. Bhd.,Sam Tan,IT@mapo.com.my,Not Applicable,Enterprise Essentials,2 CPU sockets for VM backup,06-12-25,,,,,
   ```
4. Paste into the import dialog
5. Click **"Import"**

### Step 3: Verify Import
1. After import, you should see a success message
2. The customers table should show:
   - **Row 1:** Example Test (end_user) → sends to `phitruong1712@gmail.com`
   - **Row 2:** PT. Andalan Furnindo → sends to reseller `zulfikar.jafar@mti.co.id`
   - **Row 3:** Mapo Industries → sends to reseller `LZY@mightresources.com`

## 🔧 Vercel Environment Variables

Make sure your Vercel project has these environment variables configured:

1. Go to: https://vercel.com/dashboard → Your Project → **Settings** → **Environment Variables**
2. Ensure these are set:
   - `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` = `https://vnitqugocqtrvkmanucq.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = (your service_role key)
   - `ADMIN_PASS` = `N@kivo123`
   - `REMINDER_OFFSETS` = `-30,-7,-3,-1,1` (optional, has default)
   - `CRON_SECRET` = (for cron job authentication)
   - `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `GMAIL_SENDER` (for email sending)

3. After adding/updating variables, **redeploy** the project

## 📝 Notes

- The import will automatically:
  - Convert dates from `DD-MM-YY` to `YYYY-MM-DD`
  - Determine recipients based on: Distributor → Reseller → End User
  - Create reminder schedules
  - Handle "Not Applicable" values

- If you get errors, check:
  - Supabase migration was run successfully
  - Vercel environment variables are set correctly
  - The CSV format matches exactly (including quotes around email lists)

## 🎉 Success!

Once imported, your renewal reminders will be sent to the correct recipients based on the relationship hierarchy!

