$ErrorActionPreference = "Stop"

# Configuration
$DB_NAME = "renewal_reminders"
$DB_USER = "postgres"
$DB_PASS = "N@kivo123"
$BASE_DIR = Get-Location
$SUPABASE_DIR = Join-Path $BASE_DIR "Supabase"

# Find PostgreSQL bin directory
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
$env:PGPASSWORD = $DB_PASS

Write-Host "Found PostgreSQL at $psqlPath"

# Create Database
Write-Host "Creating database '$DB_NAME'..."
try {
    & createdb -U $DB_USER $DB_NAME
} catch {
    Write-Warning "Database creation failed. It might already exist. Proceeding..."
}

# Function to run SQL file
function Run-SqlFile {
    param($file)
    Write-Host "Running $file..."
    & psql -U $DB_USER -d $DB_NAME -f $file
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to run $file"
    }
}

# Run SQL Schema Files
Run-SqlFile (Join-Path $SUPABASE_DIR "3.sql") # Base tables
Run-SqlFile (Join-Path $SUPABASE_DIR "1.sql") # Migrations
Run-SqlFile (Join-Path $SUPABASE_DIR "2.sql") # Migrations (Idempotent)
Run-SqlFile (Join-Path $SUPABASE_DIR "4.sql") # Updated_at
Run-SqlFile (Join-Path $SUPABASE_DIR "5.sql") # Trigger
Run-SqlFile (Join-Path $SUPABASE_DIR "6.sql") # Constraint

# Truncate tables to avoid duplicates
Write-Host "Truncating tables..."
& psql -U $DB_USER -d $DB_NAME -c "TRUNCATE TABLE customers, reminders, send_logs CASCADE;"

# Import CSV Data
Write-Host "Importing CSV data..."

function Clean-CsvFile {
    param($inputFile)
    Write-Host "Cleaning $inputFile..."
    $content = Get-Content $inputFile -Raw
    $cleanContent = $content.Replace("Not Applicable", "")
    $cleanContent | Set-Content $inputFile -NoNewline
}

function Import-CsvFile {
    param($table, $file)
    $csvPath = (Join-Path $SUPABASE_DIR $file).Replace("\", "/")
    Clean-CsvFile $csvPath
    
    # Read header to get column order
    $header = Get-Content $csvPath -TotalCount 1
    
    # Construct COPY command with columns
    $cmd = "\copy public.$table($header) FROM '$csvPath' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');"
    Write-Host "Importing $file into $table..."
    & psql -U $DB_USER -d $DB_NAME -c $cmd
}

# Import Files
Import-CsvFile "customers" "customers_rows.csv"
Import-CsvFile "reminders" "reminders_rows.csv"
Import-CsvFile "send_logs" "send_logs_rows.csv"

# Reset Sequence for ID columns (Important after importing data with IDs)
Write-Host "Resetting sequences..."
& psql -U $DB_USER -d $DB_NAME -c "SELECT setval('customers_id_seq', (SELECT MAX(id) FROM customers));"
& psql -U $DB_USER -d $DB_NAME -c "SELECT setval('reminders_id_seq', (SELECT MAX(id) FROM reminders));"
& psql -U $DB_USER -d $DB_NAME -c "SELECT setval('send_logs_id_seq', (SELECT MAX(id) FROM send_logs));"

Write-Host "Database setup complete!"
