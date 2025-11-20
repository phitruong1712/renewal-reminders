# Local PostgreSQL Setup Guide

This guide will help you run the renewal-reminders project locally using a local PostgreSQL database instead of Supabase.

## Prerequisites

1. **PostgreSQL** installed on your machine
   - Download from: https://www.postgresql.org/download/
   - Or use: `choco install postgresql` (Windows) or `brew install postgresql` (Mac)

2. **Node.js** and **npm** installed

## Step 1: Set Up Local PostgreSQL Database

1. Navigate to the `database` folder (in the parent directory or wherever you have the database files):
   ```powershell
   cd "C:\Users\phi.truong\Documents\Keep Version\database"
   ```

2. Run the database setup script:
   ```powershell
   .\setup.bat
   ```
   
   Or manually:
   ```powershell
   .\setup-database.ps1
   ```
   
   This will:
   - Create the `renewal_reminders` database
   - Run all migrations
   - Import all data from CSV files

3. Note down your PostgreSQL password (you'll need it for the next step)

## Step 2: Configure Environment Variables

1. In the `renewal-reminders` project root, create a `.env.local` file (if it doesn't exist)

2. Add the following configuration to enable local PostgreSQL:

   ```env
   # Enable local PostgreSQL mode
   USE_LOCAL_DB=true
   
   # PostgreSQL connection details
   DATABASE_HOST=localhost
   DATABASE_PORT=5432
   DATABASE_NAME=renewal_reminders
   DATABASE_USER=postgres
   DATABASE_PASSWORD=your_postgres_password_here
   ```

   Replace `your_postgres_password_here` with your actual PostgreSQL password.

   **Alternative variable names** (also supported):
   ```env
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_DATABASE=renewal_reminders
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=your_postgres_password_here
   ```

## Step 3: Install Dependencies

If you haven't already, install project dependencies:

```powershell
cd "C:\Users\phi.truong\renewal-reminders"
npm install
```

The `pg` (PostgreSQL client) package should already be installed.

## Step 4: Run the Development Server

Start the Next.js development server:

```powershell
npm run dev
```

The application will start on http://localhost:3000

## Verification

1. **Check database connection:**
   - The console should show: `Using local PostgreSQL database`
   - If you see errors about missing credentials, check your `.env.local` file

2. **Test the application:**
   - Open http://localhost:3000 in your browser
   - Navigate to the admin page
   - Check if customer data is visible (should match the data from your CSV files)

3. **Verify database:**
   ```powershell
   psql -U postgres -d renewal_reminders -c "SELECT COUNT(*) FROM customers;"
   ```

## Troubleshooting

### "Connection refused" error
- Make sure PostgreSQL is running:
  - Windows: `Get-Service postgresql*`
  - Start the service if it's stopped

### "Authentication failed" error
- Check your PostgreSQL password in `.env.local`
- Verify the database user has access to the database

### "Database does not exist" error
- Run the database setup script again:
  ```powershell
  cd "C:\Users\phi.truong\Documents\Keep Version\database"
  .\setup.bat
  ```

### Still connecting to Supabase
- Make sure `.env.local` has `USE_LOCAL_DB=true`
- Check that the file is in the project root directory
- Restart the development server after changing environment variables

## Switching Between Local and Supabase

To switch back to Supabase:
1. Remove or comment out `USE_LOCAL_DB=true` in `.env.local`
2. Add your Supabase credentials:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```
3. Restart the development server

To use local PostgreSQL again:
1. Set `USE_LOCAL_DB=true` in `.env.local`
2. Configure local database connection details
3. Restart the development server

## Database Files Location

The database setup files are located at:
- `C:\Users\phi.truong\Documents\Keep Version\database\`

This folder contains:
- `schema.sql` - Database schema
- `customers_rows.csv` - Customer data
- `reminders_rows.csv` - Reminders data
- `send_logs_rows.csv` - Send logs data
- `setup-database.ps1` - Setup script
- `setup.bat` - Batch file wrapper

