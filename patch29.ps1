$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-siswa\pages\TugasSiswaPageView.tsx"
$content = Get-Content -Raw $file

$content = $content -replace "\/dashboard-siswa\/tugas\/mulai\?taskId=`\$\{task\.id\}`&userId=`\$\{student\?\.id\}", "/dashboard-siswa/latihan/`${task.id}/cbt"
$content = $content -replace "\/dashboard-siswa\/tugas\/mulai\?taskId=`\$\{selectedTask\.id\}`&userId=`\$\{student\?\.id\}", "/dashboard-siswa/latihan/`${selectedTask.id}/cbt"

Set-Content -Path $file -Value $content
