$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\detail-kelas\TugasPertemuanTable.tsx"
$content = Get-Content -Raw $file

$target1 = "<th className=`"px-4 py-3 font-semibold`">Deadline</th>"
$replace1 = "<th className=`"px-4 py-3 font-semibold`">Waktu Pengerjaan</th>"
$content = $content -replace [regex]::Escape($target1), $replace1

$target2 = "                    <td className=`"px-4 py-4 text-slate-600`">`n                      {formatDisplayDate(task.deadline)}`n                    </td>"
$replace2 = "                    <td className=`"px-4 py-4 text-slate-600`">`n                      <div className=`"grid gap-1`">`n                        <span>{formatDisplayDate(task.tanggalMulai)}</span>`n                        <span className=`"text-xs text-slate-500`">s.d. {formatDisplayDate(task.tanggalSelesai)}</span>`n                      </div>`n                    </td>"
$content = $content -replace [regex]::Escape($target2), $replace2

Set-Content -Path $file -Value $content
