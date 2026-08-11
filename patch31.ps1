$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-siswa\pages\ActiveLatihanPageView.tsx"
$content = Get-Content -Raw $file

$content = $content -replace "\battemptId\b", "taskId"
$content = $content -replace "\bactiveAttemptId\b", "activeTaskId"

Set-Content -Path $file -Value $content
