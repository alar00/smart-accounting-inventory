$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\نظام المحاسبة والمخزون الذكي.lnk")
$Shortcut.TargetPath = "$DesktopPath\تشغيل_نظام_المحاسبة_والمخزون.bat"
$Shortcut.WorkingDirectory = "C:\Users\Alar\.gemini\antigravity\scratch\accounting_system"
$Shortcut.Description = "نظام المحاسبة وإدارة المخزون والمستودعات الذكي - تشغيل أوفلاين"
$Shortcut.Save()
Write-Host "[OK] Desktop Shortcut Created Successfully!"
