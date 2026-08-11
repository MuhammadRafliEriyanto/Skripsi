$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\detail-kelas\helpers.ts"
$content = Get-Content -Raw $file

$content = $content -replace "(?m)^\s*jumlahSoal:\s*10,\r?\n?", ""
$content = $content -replace "(?m)^\s*batasLulus:\s*70,\r?\n?", ""

Set-Content -Path $file -Value $content
