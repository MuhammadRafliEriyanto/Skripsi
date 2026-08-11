$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\detail-kelas\TugasFormDialog.tsx"
$content = Get-Content -Raw $file

$target = "            <div className=`"grid gap-4 md:grid-cols-2`">`n              <div className=`"grid gap-3 border border-slate-200 bg-slate-50/40 p-4 text-sm font-medium text-slate-700`">`n                <span>File Soal Excel</span>"
$replace = "            <div className=`"grid gap-4`">`n              <div className=`"rounded-2xl border border-orange-100 bg-orange-50/30 p-4 text-sm font-medium text-slate-700`">`n                <span className=`"text-xs font-semibold uppercase tracking-wider text-orange-600`">Unggah Template Excel</span>"
$content = $content -replace [regex]::Escape($target), $replace

Set-Content -Path $file -Value $content
