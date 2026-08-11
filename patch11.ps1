$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\detail-kelas\helpers.ts"
$content = Get-Content -Raw $file

$target1 = "      deskripsi: assignment.teacherNote,`n      deadline: toIsoDate(assignment.deadline),"
$replace1 = "      deskripsi: assignment.teacherNote,`n      tanggalMulai: toIsoDate(assignment.deadline),`n      tanggalSelesai: toIsoDate(assignment.deadline),"
$content = $content -replace [regex]::Escape($target1), $replace1

$target2 = "      deskripsi: `"`",`n      deadline: `"`","
$replace2 = "      deskripsi: `"`",`n      tanggalMulai: `"`",`n      tanggalSelesai: `"`","
$content = $content -replace [regex]::Escape($target2), $replace2

Set-Content -Path $file -Value $content

$file2 = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\detail-kelas\BelumDinilaiTable.tsx"
$content2 = Get-Content -Raw $file2
$target3 = "{formatDisplayDate(task.deadline)}"
$replace3 = "{formatDisplayDate(task.tanggalSelesai)}"
$content2 = $content2 -replace [regex]::Escape($target3), $replace3
Set-Content -Path $file2 -Value $content2

$file3 = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\detail-kelas\NilaiFormDialog.tsx"
$content3 = Get-Content -Raw $file3
$target4 = "{selectedTask.deadline}"
$replace4 = "{selectedTask.tanggalSelesai}"
$content3 = $content3 -replace [regex]::Escape($target4), $replace4
Set-Content -Path $file3 -Value $content3
