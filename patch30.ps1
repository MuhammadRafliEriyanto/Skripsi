$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-siswa\pages\ActiveLatihanPageView.tsx"
$content = Get-Content -Raw $file

$content = $content -replace "export default function ActiveLatihanPageView\(\{ attemptId \}: ActiveLatihanPageViewProps\) \{", "export default function ActiveLatihanPageView({ taskId }: ActiveLatihanPageViewProps) {"

Set-Content -Path $file -Value $content
