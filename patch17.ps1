$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\sections\DetailKelasGuruSection.tsx"
$content = Get-Content -Raw $file

$startIdx = $content.IndexOf("  function handleKunciJawabanChange(file: File | null) {")
if ($startIdx -ge 0) {
    $endText = "  }"
    $endIdx = $content.IndexOf("  async function handleSaveTugas() {", $startIdx)
    if ($endIdx -ge 0) {
        $fullBlock = $content.Substring($startIdx, $endIdx - $startIdx)
        $content = $content.Replace($fullBlock, "")
        Set-Content -Path $file -Value $content
        Write-Output "Removed Kunci Jawaban handlers."
    }
}
