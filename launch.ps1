Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "  OMAL ERP - Accra Showroom & Tema Depot" -ForegroundColor White
Write-Host "  Enterprise Inventory & Commercial Management System" -ForegroundColor Gray
Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Frontend Web: " -NoNewline; Write-Host "http://localhost:3030" -ForegroundColor Green
Write-Host "Backend API:  " -NoNewline; Write-Host "http://localhost:5000" -ForegroundColor Green
Write-Host ""
Write-Host "Starting API & Web Client..." -ForegroundColor Cyan
npm run dev
