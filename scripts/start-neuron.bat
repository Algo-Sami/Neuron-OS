@echo off
title Neuron OS Launcher

cd /d "D:\FYP Project\neuron"

:: Start Next.js server silently in background
start /min cmd /c "npm run dev"

:: Wait for server startup
timeout /t 8 /nobreak >nul

:: Open Chrome directly
start chrome http://localhost:3000

:: Close launcher automatically
exit