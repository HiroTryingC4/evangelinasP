$response = Invoke-RestMethod -Uri "http://localhost:3000/api/bookings?view=all" -Method Get

$mayBookings = $response | Where-Object {
    $checkIn = if ($_.checkInDateKey) { $_.checkInDateKey } else { $_.checkIn.Substring(0,10) }
    $checkIn -ge '2026-05-01' -and $checkIn -le '2026-05-31'
}

$nonCoreBookings = $mayBookings | Where-Object {
    $unit = $_.unit -replace '^Unit\s*', ''
    $unit -notin @('1116','1118','1558','1845')
}

Write-Host "Non-core unit bookings in May 2026:" -ForegroundColor Yellow
Write-Host "=====================================" -ForegroundColor Yellow

$total = 0

foreach ($booking in $nonCoreBookings) {
    $dp = if ($booking.dpAmount) { [double]$booking.dpAmount } else { 0 }
    $fp = if ($booking.fpAmount) { [double]$booking.fpAmount } else { 0 }
    $ap = if ($booking.apAmount) { [double]$booking.apAmount } else { 0 }
    $paid = $dp + $fp + $ap
    $total += $paid
    
    $checkInDisplay = if ($booking.checkInDateKey) { $booking.checkInDateKey } else { $booking.checkIn.Substring(0,10) }
    
    Write-Host ""
    Write-Host "Guest: $($booking.guestName)" -ForegroundColor Cyan
    Write-Host "Unit: $($booking.unit)" -ForegroundColor White
    Write-Host "Check-in: $checkInDisplay" -ForegroundColor White
    Write-Host "Total Paid: P$($paid.ToString('N2'))" -ForegroundColor Green
    Write-Host "  - DP: P$($dp.ToString('N2'))"
    Write-Host "  - FP: P$($fp.ToString('N2'))"
    Write-Host "  - AP: P$($ap.ToString('N2'))"
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Yellow
Write-Host "Total bookings in non-core units: $($nonCoreBookings.Count)" -ForegroundColor Yellow
Write-Host "Total paid from non-core units: P$($total.ToString('N2'))" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Yellow
