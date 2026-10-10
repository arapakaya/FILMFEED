$ErrorActionPreference = 'Stop'
$p = 'C:\Users\akash\Desktop\sinhalasub.lk'
if (-not (Test-Path $p)) { Write-Host 'TARGET_MISSING'; exit 1 }
Write-Host 'TARGET_PRESENT'
$items = Get-ChildItem $p | Sort-Object Name
$items | Format-Table Name, Length, LastWriteTime -AutoSize
Write-Host 'Count:' $items.Count
