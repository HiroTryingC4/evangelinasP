$response = Invoke-RestMethod -Uri "http://localhost:3000/api/bookings?view=all" -Method Get

$mayBookings = $response | Where-Object {
    $checkIn = if ($_.checkInDateKey) { $_.checkInDateKey } else { $_.checkIn.Substring(0,10) }
    $checkIn -ge '2026-05-01' -and $checkIn -le '2026-05-31'
}

# Filter to core units only
$coreUnits = @('1116','1118','1558','1845')
$coreBookings = $mayBookings | Where-Object {
    $unit = if ($_.unit) { $_.unit -replace '^Unit\s*', '' } else { '' }
    $unit -in $coreUnits
}

# Find bookings with Additional Payments (AP)
$bookingsWithAP = $coreBookings | Where-Object {
    $ap = if ($_.apAmount) { [double]$_.apAmount } else { 0 }
    $ap -gt 0
}

Write-Host "Bookings with Additional Payments (AP) in May 2026:" -ForegroundColor Yellow
Write-Host "====================================================" -ForegroundColor Yellow
Write-Host ""

$totalAP = 0

foreach ($booking in $bookingsWithAP) {
    $ap = if ($booking.apAmount) { [double]$booking.apAmount } else { 0 }
    $dp = if ($booking.dpAmount) { [double]$booking.dpAmount } else { 0 }
    $fp = if ($booking.fpAmount) { [double]$booking.fpAmount } else { 0 }
    $totalAP += $ap
    
    $checkInDisplay = if ($booking.checkInDateKey) { $booking.checkInDateKey } else { $booking.checkIn.Substring(0,10) }
    
    Write-Host "Guest: $($booking.guestName)" -ForegroundColor Cyan
    Write-Host "Unit: $($booking.unit)" -ForegroundColor White
    Write-Host "Check-in: $checkInDisplay" -ForegroundColor White
    Write-Host "DP: P$($dp.ToString('N2')) | FP: P$($fp.ToString('N2')) | AP: P$($ap.ToString('N2'))" -ForegroundColor Green
    Write-Host ""
}

Write-Host "====================================================" -ForegroundColor Yellow
Write-Host "Total bookings with AP: $($bookingsWithAP.Count)" -ForegroundColor Yellow
Write-Host "Total AP amount: P$($totalAP.ToString('N2'))" -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "This explains the difference:" -ForegroundColor Cyan
Write-Host "Dashboard (with AP): P197,640" -ForegroundColor White
Write-Host "Weekly Report (without AP): P196,213" -ForegroundColor White
Write-Host "Difference (AP total): P$($totalAP.ToString('N2'))" -ForegroundColor Green
