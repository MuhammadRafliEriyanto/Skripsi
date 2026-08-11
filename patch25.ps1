$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\sections\DetailKelasGuruSection.tsx"
$content = Get-Content -Raw $file

$target1 = "    jumlahSoal: toSafeNumber(task.questionCount) || 10,`n    batasLulus: toSafeNumber(task.passingGrade) || 70,`n"
$content = $content -replace [regex]::Escape($target1), ""

Set-Content -Path $file -Value $content
