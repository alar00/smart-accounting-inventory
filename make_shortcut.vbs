Set WshShell = CreateObject("WScript.Shell")
strDesktop = WshShell.SpecialFolders("Desktop")
Set oShortcut = WshShell.CreateShortcut(strDesktop & "\Smart_Accounting.lnk")
oShortcut.TargetPath = "C:\Users\Alar\Desktop\Run_Accounting.bat"
oShortcut.WorkingDirectory = "C:\Users\Alar\.gemini\antigravity\scratch\accounting_system"
oShortcut.WindowStyle = 1
oShortcut.Description = "Smart Accounting and Inventory System"
oShortcut.Save
