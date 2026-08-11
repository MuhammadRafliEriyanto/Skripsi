$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\detail-kelas\TugasFormDialog.tsx"
$content = Get-Content -Raw $file

$content = $content -replace [regex]::Escape("  onKunciJawabanChange:`n    | ((file: File | null) => void)`n    | ((file: File | null) => Promise<void>);`n"), ""
$content = $content -replace [regex]::Escape("  onClearSelectedKunciJawaban: () => void;`n"), ""
$content = $content -replace [regex]::Escape("  onRemoveExistingKunciJawaban: () => void;`n"), ""
$content = $content -replace [regex]::Escape("  selectedKunciJawabanName: string | null;`n"), ""
$content = $content -replace [regex]::Escape("  existingKunciJawabanName: string | null;`n"), ""
$content = $content -replace [regex]::Escape("  kunciJawabanMarkedForRemoval: boolean;`n"), ""

$content = $content -replace [regex]::Escape("  onKunciJawabanChange,`n"), ""
$content = $content -replace [regex]::Escape("  onClearSelectedKunciJawaban,`n"), ""
$content = $content -replace [regex]::Escape("  onRemoveExistingKunciJawaban,`n"), ""
$content = $content -replace [regex]::Escape("  selectedKunciJawabanName,`n"), ""
$content = $content -replace [regex]::Escape("  existingKunciJawabanName,`n"), ""
$content = $content -replace [regex]::Escape("  kunciJawabanMarkedForRemoval,`n"), ""

Set-Content -Path $file -Value $content
