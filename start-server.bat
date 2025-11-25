@echo off
chcp 65001 > nul
echo 모니터링 서버를 시작합니다...
echo.
echo 기존 프로세스를 확인하고 있습니다...

REM 포트 3000을 사용 중인 프로세스 찾기
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    echo 포트 3000을 사용 중인 프로세스 %%a를 종료합니다...
    taskkill /F /PID %%a >nul 2>&1
)

echo.
echo 서버를 시작합니다...
npm run start:telegram 