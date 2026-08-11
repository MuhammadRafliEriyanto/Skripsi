$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\sections\DetailKelasGuruSection.tsx"
$content = Get-Content -Raw $file

$target6 = "        onRemoveExistingAttachment={handleRemoveExistingTugasAttachment}`n        onSubmit={handleSaveTugas}`n        open={isTugasDialogOpen}`n        selectedAttachmentName={tugasAttachmentFile?.name}`n      />"
$replace6 = "        onRemoveExistingAttachment={handleRemoveExistingTugasAttachment}`n        onKunciJawabanChange={handleKunciJawabanChange}`n        onClearSelectedKunciJawaban={handleClearSelectedKunciJawaban}`n        onRemoveExistingKunciJawaban={handleRemoveExistingKunciJawaban}`n        onSubmit={handleSaveTugas}`n        open={isTugasDialogOpen}`n        selectedAttachmentName={tugasAttachmentFile?.name}`n        selectedKunciJawabanName={tugasKunciJawabanFile?.name}`n        existingKunciJawabanName={tugasDraft?.kunciJawabanName}`n        kunciJawabanMarkedForRemoval={tugasKunciJawabanMarkedForRemoval}`n      />"
$content = $content -replace [regex]::Escape($target6), $replace6

Set-Content -Path $file -Value $content
