@echo off
chcp 65001 > nul
title نظام المحاسبة والمخزون الذكي - تشغيل أوفلاين
echo =======================================================
echo    نظام المحاسبة وإدارة المخزون والمستودعات الذكي
echo    جاري فتح التطبيق على جهاز الكمبيوتر في وضع أوفلاين...
echo =======================================================

set "APP_PATH=%~dp0index.html"
set "APP_URL=file:///%APP_PATH:\=/%"

:: 1. فحص مسارات متصفح Microsoft Edge لفتح البرنامج كنافذة تطبيق سطح مكتب مستقلة
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="%APP_URL%"
    exit
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="%APP_URL%"
    exit
)

:: 2. فحص مسارات متصفح Google Chrome لفتح البرنامج كنافذة تطبيق سطح مكتب مستقلة
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="%APP_URL%"
    exit
)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --app="%APP_URL%"
    exit
)
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" (
    start "" "%LocalAppData%\Google\Chrome\Application\chrome.exe" --app="%APP_URL%"
    exit
)

:: 3. فتح الملف مباشرة بالمتصفح الافتراضي في حال عدم توفر المسارات أعلاه
start "" "%APP_PATH%"
exit
