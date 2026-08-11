$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-siswa\pages\ActiveLatihanPageView.tsx"
$content = Get-Content -Raw $file

$old = @"
type ActiveTryoutPageViewProps = {
  attemptId: string;
};

export default function ActiveTryoutPageView({ attemptId }: ActiveTryoutPageViewProps) {
  const router = useRouter();
"@

$new = @"
type ActiveLatihanPageViewProps = {
  taskId: string;
};

export default function ActiveLatihanPageView({ taskId }: ActiveLatihanPageViewProps) {
  const router = useRouter();
  const attemptId = taskId; // Alias so we don't have to change the rest of the file
"@

$content = $content.Replace($old, $new)

$oldApi1 = "`/api/student/me/exam-attempts/`${encodeURIComponent(attemptId)}`"
$newApi1 = "`/api/student/me/learning/tasks/`${encodeURIComponent(taskId)}/cbt`"
$content = $content.Replace($oldApi1, $newApi1)

$oldApi2 = "`/api/student/me/exam-attempts/`${encodeURIComponent(activeAttemptId)}/submission`"
$newApi2 = "`/api/student/me/learning/tasks/`${encodeURIComponent(activeAttemptId)}/cbt/submission`"
$content = $content.Replace($oldApi2, $newApi2)

Set-Content -Path $file -Value $content
