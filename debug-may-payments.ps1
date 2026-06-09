$response = Invoke-RestMethod -Uri "http://localhost:3000/api/bookings?view=all" -Method Get

$mayBookings = $response | Where-Object {
    $checkIn = if ($_.checkInDateKey) { $_.checkInDateKey } else { $_.checkIn.Substring(0,10) }
    $checkIn -ge '2026-05-01' -and $checkIn -le '2026-05-31'
}

Write-Host "All May 2026 bookings:" -ForegroundColor Yellow
Write-Host "Total bookings: $($mayBookings.Count)" -ForegroundColor Cyan
Write-Host ""

$totalDashboard = 0
$totalSourceReport = 0

foreach ($booking in $mayBookings) {
    $unit = if ($booking.unit) { $booking.unit -replace '^Unit\s*', '' } else { '(empty)' }
    $dp = if ($booking.dpAmount) { [double]$booking.dpAmount } else { 0 }
    $fp = if ($booking.fpAmount) { [double]$booking.fpAmount } else { 0 }
    $ap = if ($booking.apAmount) { [double]$booking.apAmount } else { 0 }
    $paid = $dp + $fp + $ap
    
    $totalDashboard += $paid
    
    $isCore = $unit -in @('1116','1118','1558','1845')
    if ($isCore) {
        $totalSourceReport += $paid
    }
    
    $coreLabel = if ($isCore) { "[CORE]" } else { "[NON-CORE]" }
    
    Write-Host "$coreLabel $($booking.guestName) | Unit: $unit | Paid: P$($paid.ToString('N2'))" -ForegroundColor $(if ($isCore) { "White" } else { "Red" })
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Yellow
Write-Host "Dashboard total (all units): P$($totalDashboard.ToString('N2'))" -ForegroundColor Green
Write-Host "Source Report total (core only): P$($totalSourceReport.ToString('N2'))" -ForegroundColor Cyan
Write-Host "Difference: P$(($totalDashboard - $totalSourceReport).ToString('N2'))" -ForegroundColor Magenta
Write-Host "=====================================" -ForegroundColor Yellow
