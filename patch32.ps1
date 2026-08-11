$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-siswa\pages\ActiveLatihanPageView.tsx"
$content = Get-Content -Raw $file

$content = $content.Replace("ActiveTryoutPageViewProps", "ActiveLatihanPageViewProps")
$content = $content.Replace("ActiveTryoutPageView", "ActiveLatihanPageView")
$content = $content.Replace("type ActiveLatihanPageViewProps = {`r`n  attemptId: string;", "type ActiveLatihanPageViewProps = {`r`n  taskId: string;")
$content = $content.Replace("type ActiveLatihanPageViewProps = {`n  attemptId: string;", "type ActiveLatihanPageViewProps = {`n  taskId: string;")
$content = $content.Replace("export default function ActiveLatihanPageView({ attemptId }: ActiveLatihanPageViewProps) {", "export default function ActiveLatihanPageView({ taskId }: ActiveLatihanPageViewProps) {")

# API Endpoints
$content = $content.Replace("`/api/student/me/exam-attempts/${encodeURIComponent(activeAttemptId)}`", "`/api/student/me/learning/tasks/${encodeURIComponent(activeAttemptId)}/cbt`")
$content = $content.Replace("`/api/student/me/exam-attempts/${encodeURIComponent(activeAttemptId)}/submission`", "`/api/student/me/learning/tasks/${encodeURIComponent(activeAttemptId)}/cbt/submission`")

# Initialize activeAttemptId with taskId
$content = $content.Replace("const [activeSession, setActiveSession]", "const activeAttemptId = taskId;`n  const [activeSession, setActiveSession]")

Set-Content -Path $file -Value $content
