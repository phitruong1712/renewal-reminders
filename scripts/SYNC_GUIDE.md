# Supabase <-> CSV Sync Guide

This guide explains how to manually sync data between your local CSV files and Supabase.

## Prerequisites

1.  **Credentials**: You MUST have your Supabase credentials in `.env.local`.
    ```env
    SUPABASE_URL=your_url
    SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
    ```
    *(Note: Service Role Key is required to bypass Row Level Security if enabled, otherwise Anon key might work but Service Role is safer for admin tasks)*

## Workflow

### 1. Upload to Supabase (Push)
When you have added new rows to `New_Updates/customers_rows.csv` and want to send them to Supabase:

```bash
npm run import-csv
```
*This adds new customers and updates existing ones based on email.*

### 2. Download from Supabase (Pull)
When you want to update your local CSV with the latest data from Supabase (e.g. after someone else made changes or the app updated data):

```bash
npm run export-csv
```
*   **Warning**: This overwrites `New_Updates/customers_rows.csv`.
*   **Safety**: A backup of your old file is automatically created in the same folder (e.g., `customers_rows.backup.123456789.csv`).

## Summary of Commands

| Action | Command | Description |
| :--- | :--- | :--- |
| **Push** | `npm run import-csv` | CSV -> Supabase |
| **Pull** | `npm run export-csv` | Supabase -> CSV |
| **Local**| `npm run local-import`| CSV -> Local DB (No Supabase) |
