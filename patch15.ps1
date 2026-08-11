$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\detail-kelas\types.ts"
$content = Get-Content -Raw $file
$content = $content -replace [regex]::Escape("  kunciJawabanFile?: string;`n"), ""
$content = $content -replace [regex]::Escape("  kunciJawabanName?: string;`n"), ""
Set-Content -Path $file -Value $content

$file2 = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\sections\DetailKelasGuruSection.tsx"
$content2 = Get-Content -Raw $file2
$content2 = $content2 -replace [regex]::Escape("    kunciJawabanName: normalizeText(task.kunciJawaban?.fileName) || undefined,`n"), ""
$content2 = $content2 -replace [regex]::Escape("    kunciJawabanFile: normalizeText(task.kunciJawaban?.url) || undefined,`n"), ""
Set-Content -Path $file2 -Value $content2
