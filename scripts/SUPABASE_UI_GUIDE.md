# Manual Sync via Supabase Web Interface

If you prefer not to use command-line scripts, you can use the Supabase Dashboard directly.

## 1. Download Data (Supabase -> Local)

To get your latest data from Supabase into a CSV file:

1.  Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
2.  Open your project.
3.  Click on the **Table Editor** icon (looks like a spreadsheet) in the left sidebar.
4.  Select the `customers` table.
5.  Click the **"Export"** button (usually top right of the table view).
6.  Select **"Export to CSV"**.
7.  The file will download to your computer.
8.  **Important**: Rename this file to `customers_rows.csv` and move it to your `New_Updates` folder if you want to use it as your source of truth.

## 2. Upload Data (Local -> Supabase)

> [!WARNING]
> **Limitation**: The Supabase Web UI Import is generally for **adding new rows**. It does not automatically "update" existing rows if they match (upsert). If you try to upload a row with an ID that already exists, it will likely fail with an error.

### Option A: Adding New Customers Only
1.  Prepare a CSV file that contains **only the new rows** you want to add.
2.  Go to the **Table Editor** > `customers` table.
3.  Click **"Insert"** > **"Import data from CSV"**.
4.  Select your CSV file.
5.  Follow the prompts to map columns (usually automatic if headers match).

### Option B: Full Replacement (Dangerous)
If you want your local file to completely replace what is in Supabase:
1.  **Backup**: Export your current data first (see Section 1).
2.  **Delete**: Select all rows in the Supabase table and delete them (or use the SQL Editor to run `TRUNCATE customers CASCADE;`).
3.  **Import**: Use the "Import data from CSV" button to upload your full local file.

## Why use the Scripts instead?
The command-line scripts (`npm run import-csv`) are smarter:
*   They handle **Updates**: If a customer email already exists, it updates their info instead of failing.
*   They handle **Relationships**: They automatically recreate reminders when you change a customer's expiration date.
*   They are **Faster**: You don't need to click through menus.
