@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=C:\Users\henor\AppData\Local\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

set "DST=C:\dev_sb"
set "RELEASE_DIR=\\wsl.localhost\Ubuntu\root\dev\release"

rem Resolve source path
pushd "%~dp0.."
set "SRC=%CD%"
popd

rem Clean stale Gradle/CMake caches (may contain wrong paths from WSL or previous builds)
echo Cleaning Gradle caches...
if exist "%SRC%\android\.gradle" rmdir /s /q "%SRC%\android\.gradle"
if exist "%SRC%\android\build" rmdir /s /q "%SRC%\android\build"
if exist "%SRC%\android\app\build" rmdir /s /q "%SRC%\android\app\build"
if exist "%SRC%\android\app\.cxx" rmdir /s /q "%SRC%\android\app\.cxx"

rem Stop Gradle daemon to clear stale state
cd /d "%SRC%\android"
call gradlew.bat --stop 2>nul

rem Remove old junction or directory
2>nul rmdir "%DST%"
if exist "%DST%" rmdir /s /q "%DST%"

rem Create junction (short ASCII path avoids CMake/ninja encoding issues)
mklink /j "%DST%" "%SRC%"

cd /d "%DST%\android"
echo Building AAB from: %CD%
call gradlew.bat bundleRelease --no-daemon

set "AAB_SRC=%DST%\android\app\build\outputs\bundle\release\app-release.aab"

rem Remove junction (does not delete source files)
cd /d "%~dp0"
rmdir "%DST%"

if not exist "%SRC%\android\app\build\outputs\bundle\release\app-release.aab" (
    echo ERROR: AAB build failed.
    pause
    exit /b 1
)

rem Extract versionCode from build.gradle
for /f "tokens=2" %%v in ('findstr /r "versionCode" "%SRC%\android\app\build.gradle"') do set "VCODE=%%v"

rem Get date in YYYYMMDD format
set "TODAY=%date:~0,4%%date:~5,2%%date:~8,2%"

set "AAB_NAME=WalkIntent_%TODAY%_%VCODE%.aab"

rem Ensure release directory exists
if not exist "%RELEASE_DIR%" mkdir "%RELEASE_DIR%"

rem Copy to release directory
copy "%SRC%\android\app\build\outputs\bundle\release\app-release.aab" "%RELEASE_DIR%\%AAB_NAME%"

echo.
echo AAB: %RELEASE_DIR%\%AAB_NAME%
pause
