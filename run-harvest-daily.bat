@echo off
rem Daily DEV/CRAFT lead harvest — run by Windows Task Scheduler
cd /d "%~dp0"
echo === %date% %time% === >> data\harvest-log.txt
call npm run harvest >> data\harvest-log.txt 2>&1
