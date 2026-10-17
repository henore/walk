@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=C:\Users\henor\AppData\Local\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

set "DST=C:\dev_fast"
set "RELEASE_DIR=\\wsl.localhost\Ubuntu\root\dev\release"

rem Resolve source path without trailing backslash
pushd "%~dp0.."
set "SRC=%CD%"
popd

rem Remove old junction or directory
2>nul rmdir "%DST%"
if exist "%DST%" rmdir /s /q "%DST%"

echo Copying %SRC% to %DST% (excluding build caches)...
robocopy "%SRC%" "%DST%" /mir /xd .gradle .cxx build /njh /njs /ndl /nc /ns

cd /d "%DST%\android"
echo Building from: %CD%
call gradlew.bat bundleRelease

if not exist "%DST%\android\app\build\outputs\bundle\release\app-release.aab" (
    echo ERROR: AAB build failed.
    pause
    exit /b 1
)

rem Extract versionCode from build.gradle
for /f "tokens=2" %%v in ('findstr /r "versionCode" "%DST%\android\app\build.gradle"') do set "VCODE=%%v"

rem Get date in YYYYMMDD format
set "TODAY=%date:~0,4%%date:~5,2%%date:~8,2%"

set "AAB_NAME=WalkIntent_%TODAY%_%VCODE%.aab"

rem Ensure release directory exists
if not exist "%RELEASE_DIR%" mkdir "%RELEASE_DIR%"

rem Copy to release directory
copy "%DST%\android\app\build\outputs\bundle\release\app-release.aab" "%RELEASE_DIR%\%AAB_NAME%"

echo.
echo AAB: %RELEASE_DIR%\%AAB_NAME%
pause
