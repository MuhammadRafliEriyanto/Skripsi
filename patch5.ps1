$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\sections\DetailKelasGuruSection.tsx"
$content = Get-Content -Raw $file

$target = "      jumlahMengumpulkan: Math.max(toSafeNumber(task.submittedCount), 0),"
$replace = "      durasiMenit: toSafeNumber(task.durationMinutes) || 60,`n      jumlahSoal: toSafeNumber(task.questionCount) || 10,`n      batasLulus: toSafeNumber(task.passingGrade) || 70,`n      jumlahMengumpulkan: Math.max(toSafeNumber(task.submittedCount), 0),"

$content = $content -replace [regex]::Escape($target), $replace

$target2 = "      attachmentUrl: normalizeText(task.attachment?.url) || undefined,`n    };"
$replace2 = "      attachmentUrl: normalizeText(task.attachment?.url) || undefined,`n      kunciJawabanName: normalizeText(task.kunciJawaban?.fileName) || undefined,`n      kunciJawabanFile: undefined,`n    };"

$content = $content -replace [regex]::Escape($target2), $replace2

Set-Content -Path $file -Value $content
