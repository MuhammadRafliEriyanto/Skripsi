$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\sections\DetailKelasGuruSection.tsx"
$content = Get-Content -Raw $file

$content = $content -replace [regex]::Escape("  const [tugasKunciJawabanFile, setTugasKunciJawabanFile] = useState<File | null>(`n    null,`n  );`n"), ""
$content = $content -replace [regex]::Escape("  const [tugasKunciJawabanMarkedForRemoval, setTugasKunciJawabanMarkedForRemoval] =`n    useState(false);`n"), ""

$startIdx = $content.IndexOf("function handleKunciJawabanChange(file: File | null) {")
if ($startIdx -ge 0) {
    $endText = "  }"
    # find the 3rd "  }" from startIdx (handleKunciJawabanChange, handleClearSelectedKunciJawaban, handleRemoveExistingKunciJawaban)
    # Actually, it's easier to just remove the exact blocks since I just added them.
}

Set-Content -Path $file -Value $content
