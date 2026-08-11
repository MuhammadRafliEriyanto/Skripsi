$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-siswa\pages\ActiveLatihanPageView.tsx"
$content = Get-Content -Raw $file

$content = $content.Replace("ActiveTryoutPageView", "ActiveLatihanPageView")
$content = $content.Replace("attemptId: string;", "taskId: string;")
$content = $content.Replace("attemptId}) {", "taskId}) {")
$content = $content.Replace("activeAttemptId = attemptId;", "activeAttemptId = taskId;")
$content = $content.Replace("attemptId)", "taskId)")
$content = $content.Replace("/api/student/me/exam-attempts/${encodeURIComponent(activeAttemptId)}", "/api/student/me/learning/tasks/${encodeURIComponent(activeAttemptId)}/cbt")

Set-Content -Path $file -Value $content
