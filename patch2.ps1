$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\sections\DetailKelasGuruSection.tsx"
$content = Get-Content -Raw $file

$target2 = "      setTugasAttachmentFile(null);`n      setTugasAttachmentMarkedForRemoval(false);"
$replace2 = "      setTugasAttachmentFile(null);`n      setTugasAttachmentMarkedForRemoval(false);`n      setTugasKunciJawabanFile(null);`n      setTugasKunciJawabanMarkedForRemoval(false);"
$content = $content -replace [regex]::Escape($target2), $replace2

$target3 = "      const body: Record<string, string | number | boolean> = {`n        meetingNumber: draft.pertemuanKe,`n        title: draft.judulTugas,`n        description: draft.deskripsi,`n        deadline: draft.deadline,`n      };"
$replace3 = "      const body: Record<string, string | number | boolean> = {`n        meetingNumber: draft.pertemuanKe,`n        title: draft.judulTugas,`n        description: draft.deskripsi,`n        deadline: draft.deadline,`n        durationMinutes: draft.durasiMenit,`n        questionCount: draft.jumlahSoal,`n        passingGrade: draft.batasLulus,`n      };"
$content = $content -replace [regex]::Escape($target3), $replace3

Set-Content -Path $file -Value $content
