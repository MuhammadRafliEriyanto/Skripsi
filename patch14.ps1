$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\detail-kelas\TugasPertemuanTable.tsx"
$content = Get-Content -Raw $file

$content = $content -replace [regex]::Escape("<th className=`"px-4 py-3 font-semibold`">Lampiran Kunci</th>`n"), ""

$target2 = "<td className=`"px-4 py-4 text-slate-600`">`n                      {task.kunciJawabanFile && task.kunciJawabanName ? (`n                        <a`n                          href={task.kunciJawabanFile}`n                          target=`"_blank`"`n                          rel=`"noreferrer`"`n                          className=`"inline-flex items-center gap-2 text-orange-600 hover:underline`"`n                          title={task.kunciJawabanName}`n                        >`n                          <FileText className=`"h-4 w-4 shrink-0`" />`n                          <span className=`"max-w-[120px] truncate`">`n                            {task.kunciJawabanName}`n                          </span>`n                        </a>`n                      ) : (`n                        <span className=`"text-xs text-slate-400`">Tidak ada</span>`n                      )}`n                    </td>"
$content = $content -replace [regex]::Escape($target2), ""

Set-Content -Path $file -Value $content
