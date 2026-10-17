@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "ANDROID_HOME=C:\Users\henor\AppData\Local\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

set "RELEASE_DIR=\\wsl.localhost\Ubuntu\root\dev\release"

cd /d "%~dp0"
call gradlew.bat clean assembleDebug
if %ERRORLEVEL% EQU 0 (
    rem Extract versionCode from build.gradle
    for /f "tokens=2" %%v in ('findstr /r "versionCode" "%~dp0app\build.gradle"') do set "VCODE=%%v"

    rem Get date in YYYYMMDD format
    set "TODAY=%date:~0,4%%date:~5,2%%date:~8,2%"

    set "APK_NAME=WalkIntent_%TODAY%_%VCODE%.apk"

    rem Ensure release directory exists
    if not exist "%RELEASE_DIR%" mkdir "%RELEASE_DIR%"

    rem Copy to release directory
    copy "%~dp0app\build\outputs\apk\debug\app-debug.apk" "%RELEASE_DIR%\%APK_NAME%"

    echo.
    echo === BUILD SUCCESS ===
    echo APK: %RELEASE_DIR%\%APK_NAME%
    echo.
    echo Installing to device...
    "%ANDROID_HOME%\platform-tools\adb.exe" install -r app\build\outputs\apk\debug\app-debug.apk
) else (
    echo.
    echo === BUILD FAILED ===
)
