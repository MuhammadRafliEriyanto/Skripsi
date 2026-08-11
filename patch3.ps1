$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\sections\DetailKelasGuruSection.tsx"
$content = Get-Content -Raw $file

$target4 = "} else if (tugasAttachmentMarkedForRemoval) {`n        body.removeAttachment = true;`n      }"
$replace4 = "} else if (tugasAttachmentMarkedForRemoval) {`n        body.removeAttachment = true;`n      }`n`n      if (tugasKunciJawabanFile) {`n        body.kunciJawabanFileName = tugasKunciJawabanFile.name;`n        body.kunciJawabanMimeType =`n          normalizeText(tugasKunciJawabanFile.type) || ""application/octet-stream"";`n        body.kunciJawabanFileDataBase64 = await readFileAsBase64(tugasKunciJawabanFile);`n      } else if (tugasKunciJawabanMarkedForRemoval) {`n        body.removeKunciJawaban = true;`n      }"
$content = $content -replace [regex]::Escape($target4), $replace4

$target5 = "  function handleRemoveExistingTugasAttachment() {`n    setTugasAttachmentFile(null);`n    setTugasAttachmentMarkedForRemoval(true);`n    setTugasDraft((current) =>`n      current`n        ? {`n            ...current,`n            attachmentFileName: undefined,`n            attachmentMimeType: undefined,`n            attachmentSize: undefined,`n            attachmentUrl: undefined,`n          }`n        : null,`n    );`n  }"
$replace5 = $target5 + "`n`n  function handleKunciJawabanChange(file: File | null) {`n    if (file && file.size > MAX_ATTACHMENT_SIZE_BYTES) {`n      toast.error(`"Ukuran kunci jawaban maksimal `" + ATTACHMENT_LIMIT_LABEL + `".`");`n      return;`n    }`n`n    setTugasKunciJawabanFile(file);`n    if (file) {`n      setTugasKunciJawabanMarkedForRemoval(false);`n    }`n  }`n`n  function handleClearSelectedKunciJawaban() {`n    setTugasKunciJawabanFile(null);`n  }`n`n  function handleRemoveExistingKunciJawaban() {`n    setTugasKunciJawabanFile(null);`n    setTugasKunciJawabanMarkedForRemoval(true);`n    setTugasDraft((current) =>`n      current`n        ? {`n            ...current,`n            kunciJawabanName: undefined,`n            kunciJawabanFile: undefined,`n          }`n        : null,`n    );`n  }"
$content = $content -replace [regex]::Escape($target5), $replace5

Set-Content -Path $file -Value $content
