# Build-Database.ps1
# PowerShell script to build the optimized database

Write-Host "Starting ParcelApp Database Generation Script" -ForegroundColor Cyan

# Check if Python is installed
try {
    $pythonVersion = python --version 2>&1
    Write-Host "Using Python: $pythonVersion" -ForegroundColor Green
}
catch {
    Write-Host "Python is not installed or not in PATH. Please install Python 3.6+ and try again." -ForegroundColor Red
    exit 1
}

# Set the path to the script
$scriptPath = Join-Path $PSScriptRoot "scripts\generate_prebuilt_db.py"

# Run the database generation script
Write-Host "Running database generation script..." -ForegroundColor Yellow
Write-Host "This may take a few minutes depending on data size..."

# Execute Python script with time measurement
$startTime = Get-Date
python $scriptPath
$endTime = Get-Date

# Calculate duration
$duration = $endTime - $startTime
Write-Host "Script completed in $($duration.TotalSeconds) seconds" -ForegroundColor Green

# Verify the database files exist
$prebuiltDb = Join-Path $PSScriptRoot "prebuilt\parcelapp.db"
$androidDb = Join-Path $PSScriptRoot "android\app\src\main\assets\parcelapp.db"

if (Test-Path $prebuiltDb) {
    $size = (Get-Item $prebuiltDb).Length / 1MB
    Write-Host "Prebuilt database created: $prebuiltDb ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
}
else {
    Write-Host "Prebuilt database was not created!" -ForegroundColor Red
}

if (Test-Path $androidDb) {
    $size = (Get-Item $androidDb).Length / 1MB
    Write-Host "Android assets database created: $androidDb ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
}
else {
    Write-Host "Android assets database was not created!" -ForegroundColor Red
}

Write-Host "Database generation completed" -ForegroundColor Cyan
