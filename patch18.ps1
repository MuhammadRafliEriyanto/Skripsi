$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\sections\DetailKelasGuruSection.tsx"
$content = Get-Content -Raw $file

$content = $content -replace [regex]::Escape("        onKunciJawabanChange={handleKunciJawabanChange}`n"), ""
$content = $content -replace [regex]::Escape("        onClearSelectedKunciJawaban={handleClearSelectedKunciJawaban}`n"), ""
$content = $content -replace [regex]::Escape("        onRemoveExistingKunciJawaban={handleRemoveExistingKunciJawaban}`n"), ""
$content = $content -replace [regex]::Escape("        selectedKunciJawabanName={tugasKunciJawabanFile?.name ?? null}`n"), ""
$content = $content -replace [regex]::Escape("        existingKunciJawabanName={tugasDraft?.kunciJawabanName ?? null}`n"), ""
$content = $content -replace [regex]::Escape("        kunciJawabanMarkedForRemoval={tugasKunciJawabanMarkedForRemoval}`n"), ""

Set-Content -Path $file -Value $content
