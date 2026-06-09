# Check what dates the "May 3-9" week actually covers
$dates = @(
    "2026-05-03",  # May 3-9 week
    "2026-05-10",  # May 10-16 week
    "2026-05-17",  # May 17-23 week
    "2026-05-24",  # May 24-30 week
    "2026-05-01",  # May 1
    "2026-05-02",  # May 2
    "2026-05-31"   # May 31
)

Write-Host "Checking Sunday-Saturday weeks for May 2026:" -ForegroundColor Yellow
Write-Host ""

foreach ($dateStr in $dates) {
    $date = [DateTime]::Parse($dateStr)
    $dayOfWeek = $date.DayOfWeek
    
    # Calculate Sunday of that week
    $daysToSubtract = [int]$dayOfWeek
    $sunday = $date.AddDays(-$daysToSubtract)
    
    # Calculate Saturday of that week
    $saturday = $sunday.AddDays(6)
    
    Write-Host "$dateStr ($($date.ToString('ddd'))) is in week:" -ForegroundColor Cyan
    Write-Host "  Sunday: $($sunday.ToString('yyyy-MM-dd')) ($($sunday.ToString('MMM dd')))" -ForegroundColor White
    Write-Host "  Saturday: $($saturday.ToString('yyyy-MM-dd')) ($($saturday.ToString('MMM dd')))" -ForegroundColor White
    Write-Host ""
}

Write-Host "ISSUE FOUND:" -ForegroundColor Red
Write-Host "The 'May 3-9' week label is misleading!" -ForegroundColor Red
Write-Host "It actually shows the Sunday-Saturday week that CONTAINS May 3-9" -ForegroundColor Red
Write-Host "This means some days might be in April or June!" -ForegroundColor Red
