$ErrorActionPreference = "Stop"

# Configuration
$LOCAL_DB_NAME = "renewal_reminders"
$LOCAL_DB_USER = "postgres"
$LOCAL_DB_PASS = "N@kivo123" # Matches setup_local_db.ps1

# Find PostgreSQL bin directory (Reused from setup_local_db.ps1)
$possiblePaths = @(
    "C:\Program Files\PostgreSQL\18\bin",
    "C:\Program Files\PostgreSQL\17\bin",
    "C:\Program Files\PostgreSQL\16\bin",
    "C:\Program Files\PostgreSQL\15\bin",
    "C:\Program Files\PostgreSQL\14\bin",
    "C:\Program Files\PostgreSQL\13\bin"
)

$psqlPath = $null
foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $psqlPath = $path
        break
    }
}

if (-not $psqlPath) {
    Write-Error "PostgreSQL bin directory not found. Please ensure PostgreSQL is installed."
    exit 1
}

$env:PATH = "$psqlPath;$env:PATH"

# Get Supabase Connection Info
Write-Host "To sync, we need your Supabase Database Connection String."
Write-Host "You can find this in Supabase Dashboard > Project Settings > Database > Connection String > URI"
Write-Host "Format: postgres://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
$SupabaseConnString = Read-Host "Enter Supabase Connection String"

if ([string]::IsNullOrWhiteSpace($SupabaseConnString)) {
    Write-Error "Connection string is required."
    exit 1
}

# 1. Dump data from Supabase
Write-Host "`n1. Downloading data from Supabase (this may take a moment)..."
$dumpFile = "supabase_dump.sql"

# We use --clean to drop existing objects in local DB before creating new ones
# --if-exists prevents errors if they don't exist
# --no-owner --no-acl prevents permission errors on local DB
try {
    & pg_dump "$SupabaseConnString" -f $dumpFile --clean --if-exists --no-owner --no-acl --schema=public
    if ($LASTEXITCODE -ne 0) { throw "pg_dump failed" }
    Write-Host "   Download complete."
}
catch {
    Write-Error "Failed to download data from Supabase. Check your connection string and password."
    Remove-Item $dumpFile -ErrorAction SilentlyContinue
    exit 1
}

# 2. Restore to Local DB
Write-Host "`n2. Restoring to local database '$LOCAL_DB_NAME'..."
$env:PGPASSWORD = $LOCAL_DB_PASS

try {
    & psql -U $LOCAL_DB_USER -d $LOCAL_DB_NAME -f $dumpFile
    if ($LASTEXITCODE -ne 0) { throw "psql failed" }
    Write-Host "   Restore complete."
}
catch {
    Write-Error "Failed to restore data to local database."
    exit 1
}
finally {
    # Cleanup
    if (Test-Path $dumpFile) {
        Remove-Item $dumpFile
    }
    $env:PGPASSWORD = $null
}

Write-Host "`n✅ Sync complete! Your local database is now up to date with Supabase."
