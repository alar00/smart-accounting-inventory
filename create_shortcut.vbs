Set WshShell = CreateObject("WScript.Shell")
strDesktop = WshShell.SpecialFolders("Desktop")
Set oShortcut = WshShell.CreateShortcut(strDesktop & "\Accounting_App.lnk")
oShortcut.TargetPath = strDesktop & "\تشغيل_نظام_المحاسبة_والمخزون.bat"
oShortcut.WorkingDirectory = "C:\Users\Alar\.gemini\antigravity\scratch\accounting_system"
oShortcut.Description = "Smart Accounting and Inventory System"
oShortcut.Save
