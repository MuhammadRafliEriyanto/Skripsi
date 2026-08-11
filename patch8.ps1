$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\sections\DetailKelasGuruSection.tsx"
$content = Get-Content -Raw $file

$target1 = "      deadline: draft.deadline,"
$replace1 = "      deadline: draft.tanggalSelesai,`n      startAt: draft.tanggalMulai,`n      endAt: draft.tanggalSelesai,"
$content = $content -replace [regex]::Escape($target1), $replace1

Set-Content -Path $file -Value $content
