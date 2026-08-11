$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\sections\DetailKelasGuruSection.tsx"
$content = Get-Content -Raw $file

$target1 = "          onKunciJawabanChange={handleKunciJawabanChange}`n          onClearSelectedKunciJawaban={handleClearSelectedKunciJawaban}`n          onRemoveExistingKunciJawaban={handleRemoveExistingKunciJawaban}`n"
$content = $content -replace [regex]::Escape($target1), ""

$target2 = "          selectedKunciJawabanName={tugasKunciJawabanFile?.name}`n          existingKunciJawabanName={tugasDraft?.kunciJawabanName}`n          kunciJawabanMarkedForRemoval={tugasKunciJawabanMarkedForRemoval}`n"
$content = $content -replace [regex]::Escape($target2), ""

Set-Content -Path $file -Value $content

$file2 = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\detail-kelas\TugasPertemuanTable.tsx"
$content2 = Get-Content -Raw $file2

$target3 = "<td className=`"px-4 py-4 text-slate-600`">`n                      {task.kunciJawabanName && task.kunciJawabanFile ? (`n                        <a`n                          href={task.kunciJawabanFile}`n                          target=`"_blank`"`n                          rel=`"noreferrer`"`n                          className=`"inline-flex items-center gap-2 text-orange-600 hover:underline`"`n                          title={task.kunciJawabanName}`n                        >`n                          <FileText className=`"h-4 w-4 shrink-0`" />`n                          <span className=`"max-w-[120px] truncate`">`n                            {task.kunciJawabanName}`n                          </span>`n                        </a>`n                      ) : (`n                        <span className=`"text-xs text-slate-400`">Tidak ada</span>`n                      )}`n                    </td>"
$content2 = $content2 -replace [regex]::Escape($target3), ""

Set-Content -Path $file2 -Value $content2
