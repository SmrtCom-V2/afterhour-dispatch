@echo off
echo Starting FM After-Hours System...
echo.

:: Start backend on port 3001
start "Backend Server" cmd /k "cd /d \"c:\Users\The boss\Downloads\Claude Code\After hour\web-system\backend\" && set PORT=3001 && npm run dev"

:: Wait a moment
timeout /t 3 /nobreak > nul

:: Start frontend on port 4000
start "Frontend Server" cmd /k "cd /d \"c:\Users\The boss\Downloads\Claude Code\After hour\web-system\frontend\" && npm run dev"

:: Wait for frontend to start
timeout /t 5 /nobreak > nul

:: Open browser
start http://localhost:4000

echo.
echo Servers are starting...
echo Frontend: http://localhost:4000
echo Backend:  http://localhost:3001
echo.
echo Press any key to close this window (servers will keep running)
pause > nul
