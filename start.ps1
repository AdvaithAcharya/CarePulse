# CarePulse Quick Start Script (PowerShell)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    CarePulse Quick Start Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is installed
Write-Host "Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version
    Write-Host "✓ $pythonVersion found" -ForegroundColor Green
} catch {
    Write-Host "✗ Python not found. Please install Python 3.8+" -ForegroundColor Red
    exit 1
}

# Check if Node.js is installed
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js $nodeVersion found" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js not found. Please install Node.js 16+" -ForegroundColor Red
    exit 1
}

# Check if MongoDB is running
Write-Host "Checking MongoDB..." -ForegroundColor Yellow
try {
    $mongoStatus = Get-Service -Name MongoDB -ErrorAction SilentlyContinue
    if ($mongoStatus.Status -eq "Running") {
        Write-Host "✓ MongoDB is running" -ForegroundColor Green
    } else {
        Write-Host "⚠ MongoDB service found but not running. Attempting to start..." -ForegroundColor Yellow
        Start-Service -Name MongoDB
        Write-Host "✓ MongoDB started" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠ MongoDB service not found. Make sure MongoDB is installed or use MongoDB Atlas" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Starting CarePulse..." -ForegroundColor Cyan
Write-Host ""

# Start Backend
Write-Host "Starting Backend API..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; python -m venv venv; venv\Scripts\activate; pip install -r requirements.txt; python main.py"

Start-Sleep -Seconds 5

# Start Frontend
Write-Host "Starting Frontend Dashboard..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm install; npm run dev"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   CarePulse is starting!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend API: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Frontend Dashboard: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the services" -ForegroundColor Yellow
