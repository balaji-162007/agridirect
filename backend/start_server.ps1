# AgriDirect Backend Startup Script
# This script ensures that any processes blocking port 8000 are killed before starting the server.

$port = 8000
$process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($process) {
    Write-Host "Cleaning up port $port (Killing process $($process.OwningProcess))..." -ForegroundColor Yellow
    Stop-Process -Id $process.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

Write-Host "Starting AgriDirect Backend on port $port..." -ForegroundColor Green
# Using uvicorn with reloader, watching only .py files to avoid reload loops from DB/uploads
# Use --reload-dir instead of --reload-include if include is problematic with shell expansion
& "..\.venv\Scripts\python.exe" -m uvicorn main:app --port $port --reload --reload-dir .
