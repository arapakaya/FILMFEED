$ErrorActionPreference = 'Stop'
$src = 'C:\Users\akash\Downloads\zz\sinhalasub'
$dst = 'C:\Users\akash\Desktop\sinhalasub.lk'
if (-not (Test-Path $dst)) { New-Item -ItemType Directory -Path $dst | Out-Null }
Write-Host 'Copying sinhalasub.lk scraper files to:' $dst
$candidates = @('sinhalasub_scrape.py','movies.json','movies.csv','gallery.html','all_scrape.log')
$total = 0
foreach ($name in $candidates) {
    $path = Join-Path $src $name
    if (Test-Path $path) {
        Copy-Item -Path $path -Destination (Join-Path $dst $name) -Force
        Write-Host "  copied $name" -ForegroundColor Green
        $total++
    } else {
        Write-Host "  skipped $name (not present)" -ForegroundColor DarkYellow
    }
}
Write-Host ''
Write-Host 'Files in destination:' -ForegroundColor Cyan
Get-ChildItem $dst | Sort-Object Name | Format-Table Name, Length, LastWriteTime -AutoSize
Write-Host 'Total files:' (Get-ChildItem $dst).Count
