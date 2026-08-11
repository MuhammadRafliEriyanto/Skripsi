$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\sections\DetailKelasGuruSection.tsx"
$content = Get-Content -Raw $file

$target1 = "  deadline?: string;"
$replace1 = "  deadline?: string;`n  startAt?: string | null;`n  endAt?: string | null;"
$content = $content -replace [regex]::Escape($target1), $replace1

$target2 = "    deskripsi: normalizeText(task.description),`n    deadline: normalizeText(task.deadline),"
$replace2 = "    deskripsi: normalizeText(task.description),`n    tanggalMulai: normalizeText(task.startAt) || normalizeText(task.deadline) || `"`",`n    tanggalSelesai: normalizeText(task.endAt) || normalizeText(task.deadline) || `"`","
$content = $content -replace [regex]::Escape($target2), $replace2

Set-Content -Path $file -Value $content
