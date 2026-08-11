$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\detail-kelas\TugasFormDialog.tsx"
$content = Get-Content -Raw $file

$startIdx = $content.IndexOf("<div className=`"grid gap-3 border border-slate-200 bg-slate-50/40 p-4 text-sm font-medium text-slate-700`">`n                <span>Lampiran Kunci Jawaban</span>")
if ($startIdx -ge 0) {
    # Find the end of this div block. We know it ends right before `</div>` then `</div>`
    $endText = "Hanya untuk guru.</p>`n                )}`n              </div>"
    $endIdx = $content.IndexOf($endText, $startIdx)
    if ($endIdx -ge 0) {
        $fullBlock = $content.Substring($startIdx, ($endIdx - $startIdx) + $endText.Length)
        $content = $content.Replace($fullBlock, "")
        Set-Content -Path $file -Value $content
        Write-Output "Removed Lampiran Kunci Jawaban."
    } else {
        Write-Output "End block not found."
    }
} else {
    Write-Output "Start block not found."
}
