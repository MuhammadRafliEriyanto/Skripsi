$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\detail-kelas\helpers.ts"
$content = Get-Content -Raw $file

$target1 = "      durasiMenit: 60,`n      jumlahSoal: 10,`n      batasLulus: 70,`n"
$replace1 = "      durasiMenit: 60,`n"
$content = $content -replace [regex]::Escape($target1), $replace1

$target2 = "      durasiMenit: 90,`n      jumlahSoal: 10,`n      batasLulus: 70,`n"
$replace2 = "      durasiMenit: 90,`n"
$content = $content -replace [regex]::Escape($target2), $replace2

Set-Content -Path $file -Value $content
