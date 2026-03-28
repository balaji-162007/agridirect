# AgriDirect Frontend Startup Script
# This script ensures that any processes blocking port 5500 are killed before starting the server.

$port = 5500
$process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($process) {
    Write-Host "Cleaning up port $port (Killing process $($process.OwningProcess))..." -ForegroundColor Yellow
    Stop-Process -Id $process.OwningProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
}

Write-Host "Starting AgriDirect Frontend on port $port..." -ForegroundColor Green
& "..\.venv\Scripts\python.exe" -m http.server $port
