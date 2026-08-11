$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\detail-kelas\TugasPertemuanTable.tsx"
$content = Get-Content -Raw $file

$startIdx = $content.IndexOf("<td className=`"px-4 py-4 text-slate-600`">`n                      {task.kunciJawabanName")
if ($startIdx -ge 0) {
    # Find the matching </td> for this block
    $endText = "                      </td>"
    $endIdx = $content.IndexOf($endText, $startIdx)
    if ($endIdx -ge 0) {
        $fullBlock = $content.Substring($startIdx, ($endIdx - $startIdx) + $endText.Length + 2) # +2 for newline
        $content = $content.Replace($fullBlock, "")
        Set-Content -Path $file -Value $content
        Write-Output "Removed Kunci Jawaban from table."
    }
}
