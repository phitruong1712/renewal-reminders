# Database Sync & Location Guide

## How to Sync with Supabase

We have created a script to automatically sync your local database with your Supabase production data.

1.  **Get your Connection String**:
    *   Go to [Supabase Dashboard](https://supabase.com/dashboard).
    *   Select your project.
    *   Go to **Project Settings** (cog icon) > **Database**.
    *   Under **Connection String**, select **URI**.
    *   Copy the string. It will look like: `postgres://postgres:[YOUR-PASSWORD]@db.abcdefghijklm.supabase.co:5432/postgres`
    *   *Note: You will need to replace `[YOUR-PASSWORD]` with your actual database password.*

2.  **Run the Sync Script**:
    *   Open PowerShell or your terminal in VS Code.
    *   Run the following command:
        ```powershell
        .\scripts\sync_db.ps1
        ```
    *   Paste your connection string when prompted.

The script will download the latest data from Supabase and replace your local `renewal_reminders` database content.

---

## Where are my Local Tables?

Your local PostgreSQL tables are stored in the **PostgreSQL Data Directory** on your hard drive, but you cannot access them as regular files (like Excel or CSV). You must use a database client to view and edit them.

### Recommended Ways to View Your Data:

1.  **VS Code Extensions** (Easiest):
    *   Install the **"PostgreSQL"** extension by Chris Kolkman or **"SQLTools"**.
    *   Connect using:
        *   **Host**: `localhost`
        *   **Database**: `renewal_reminders`
        *   **User**: `postgres`
        *   **Password**: `N@kivo123` (as set in your setup script)

2.  **pgAdmin 4** (Standard Tool):
    *   If you installed PostgreSQL fully, you likely have **pgAdmin 4** installed.
    *   Open it and register a new server with the credentials above.

3.  **TablePlus / DBeaver** (Third-party Apps):
    *   These are excellent standalone apps for managing databases.
    *   Connect using the same credentials.

### Physical Location (For Reference Only)
*   The actual raw data files are typically located at:
    *   `C:\Program Files\PostgreSQL\[VERSION]\data`
    *   *WARNING: Never touch these files directly. You will corrupt your database.*
