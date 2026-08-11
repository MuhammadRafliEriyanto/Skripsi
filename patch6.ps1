$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\detail-kelas\helpers.ts"
$content = Get-Content -Raw $file

$target1 = "      deskripsi: assignment.teacherNote,`n      deadline: toIsoDate(assignment.deadline),"
$replace1 = "      deskripsi: assignment.teacherNote,`n      tanggalMulai: toIsoDate(assignment.deadline),`n      tanggalSelesai: toIsoDate(assignment.deadline),"
$content = $content -replace [regex]::Escape($target1), $replace1

$target2 = "      deskripsi: `"`",`n      deadline: `"`","
$replace2 = "      deskripsi: `"`",`n      tanggalMulai: `"`",`n      tanggalSelesai: `"`","
$content = $content -replace [regex]::Escape($target2), $replace2

Set-Content -Path $file -Value $content
