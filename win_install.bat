@echo off
setlocal enabledelayedexpansion

:: Define variables
set REPO_URL=https://github.com/pravatus-technologies/mobile-reg.git
set APP_DIR=%USERPROFILE%\mobile-reg
set NODE_VERSION=18.17.0

:: Step 1: Check if NVM is installed
where nvm >nul 2>nul
if %errorlevel% neq 0 (
    echo Downloading and installing NVM for Windows...
    powershell -Command "& {Invoke-WebRequest -Uri https://github.com/coreybutler/nvm-windows/releases/latest/download/nvm-setup.exe -OutFile nvm-setup.exe}"
    start /wait nvm-setup.exe
    del nvm-setup.exe
    echo NVM installation complete. Restart your terminal if needed.
) else (
    echo NVM is already installed.
)

:: Step 2: Refresh environment variables
echo Refreshing environment variables...
set PATH=%PATH%;%USERPROFILE%\AppData\Roaming\nvm;%USERPROFILE%\AppData\Roaming\nvm\v%NODE_VERSION%
where nvm

:: Step 3: Install Node.js using NVM
nvm install %NODE_VERSION%
nvm use %NODE_VERSION%
echo Using Node.js version:
node -v

:: Step 4: Clone the repository
if exist "%APP_DIR%" (
    echo Repository already exists. Pulling latest changes...
    cd /d "%APP_DIR%"
    git pull
) else (
    echo Cloning repository...
    git clone %REPO_URL% "%APP_DIR%"
)

:: Step 5: Install dependencies
cd /d "%APP_DIR%"
echo Installing dependencies...
npm install

:: Step 6: Start the application
echo Starting application...
node server.js

echo Installation and setup complete!
pause
