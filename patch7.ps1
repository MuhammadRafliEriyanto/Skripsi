$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\detail-kelas\TugasFormDialog.tsx"
$content = Get-Content -Raw $file

$target1 = "Lengkapi pertemuan, judul, deadline, dan instruksi."
$replace1 = "Lengkapi pertemuan, judul, jadwal, dan instruksi."
$content = $content -replace [regex]::Escape($target1), $replace1

$target2 = "              <label className=`"grid gap-2 text-sm font-medium text-slate-700`">`n                Deadline`n                <input`n                  type=`"date`"`n                  value={draft?.deadline ?? `"`"}`n                  onChange={(event) => onChange(`"deadline`", event.target.value)}`n                  className=`"border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100`"`n                />`n              </label>"
$replace2 = "              <label className=`"grid gap-2 text-sm font-medium text-slate-700`">`n                Tanggal Mulai`n                <input`n                  type=`"datetime-local`"`n                  value={draft?.tanggalMulai ?? `"`"}`n                  onChange={(event) => onChange(`"tanggalMulai`", event.target.value)}`n                  className=`"border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100`"`n                />`n              </label>`n            </div>`n`n            <div className=`"grid gap-4 md:grid-cols-2`">`n              <label className=`"grid gap-2 text-sm font-medium text-slate-700`">`n                Tanggal Selesai`n                <input`n                  type=`"datetime-local`"`n                  value={draft?.tanggalSelesai ?? `"`"}`n                  onChange={(event) => onChange(`"tanggalSelesai`", event.target.value)}`n                  className=`"border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100`"`n                />`n              </label>"
$content = $content -replace [regex]::Escape($target2), $replace2

$target3 = "              <div className=`"grid gap-3 border border-slate-200 bg-slate-50/40 p-4 text-sm font-medium text-slate-700`">`n                <span>Lampiran Soal</span>`n                <input`n                  type=`"file`"`n                  accept=`".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.txt,.csv`"`n                  onChange={(event) =>`n                    onAttachmentChange(event.target.files?.[0] ?? null)`n                  }"
$replace3 = "              <div className=`"grid gap-3 border border-slate-200 bg-slate-50/40 p-4 text-sm font-medium text-slate-700`">`n                <span>File Soal Excel</span>`n                <p className=`"text-xs font-normal leading-5 text-slate-500`">`n                  Kolom wajib: No, Pertanyaan, Opsi A, Opsi B, Opsi C, Opsi D, Jawaban Benar.`n                </p>`n                <input`n                  type=`"file`"`n                  accept=`".xlsx,.xls`"`n                  onChange={(event) =>`n                    onAttachmentChange(event.target.files?.[0] ?? null)`n                  }"
$content = $content -replace [regex]::Escape($target3), $replace3

$target4 = "                  <p className=`"text-xs text-slate-400`">Opsional, maksimal 10 MB.</p>"
$replace4 = "                  <p className=`"text-xs text-slate-400`">Maksimal 10 MB.</p>"
$content = $content -replace [regex]::Escape($target4), $replace4

Set-Content -Path $file -Value $content
