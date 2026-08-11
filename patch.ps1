$file = "D:\Skripsi\Next Js\bimbel-new\src\components\dashboard-guru\sections\DetailKelasGuruSection.tsx"
$content = Get-Content -Raw $file

# Change 1
$content = $content -replace '(?s)(const \[tugasAttachmentMarkedForRemoval, setTugasAttachmentMarkedForRemoval\] =\s*useState\(false\);)', "$1
  const [tugasKunciJawabanFile, setTugasKunciJawabanFile] = useState<File | null>(null);
  const [tugasKunciJawabanMarkedForRemoval, setTugasKunciJawabanMarkedForRemoval] = useState(false);"

# Change 2
$content = $content -replace '(?s)(setTugasAttachmentMarkedForRemoval\(false\);)', "$1
      setTugasKunciJawabanFile(null);
      setTugasKunciJawabanMarkedForRemoval(false);"

# Change 3
$content = $content -replace '(?s)(deadline: draft\.deadline,)(\s*};)', "$1
        durationMinutes: draft.durasiMenit,
        questionCount: draft.jumlahSoal,
        passingGrade: draft.batasLulus,$2"

# Change 4
$content = $content -replace '(?s)(} else if \(tugasAttachmentMarkedForRemoval\) \{\s*body\.removeAttachment = true;\s*\})', "$1

      if (tugasKunciJawabanFile) {
        body.kunciJawabanFileName = tugasKunciJawabanFile.name;
        body.kunciJawabanMimeType = normalizeText(tugasKunciJawabanFile.type) || "application/octet-stream";
        body.kunciJawabanFileDataBase64 = await readFileAsBase64(tugasKunciJawabanFile);
      } else if (tugasKunciJawabanMarkedForRemoval) {
        body.removeKunciJawaban = true;
      }"

# Change 5
$content = $content -replace '(?s)(function handleRemoveExistingTugasAttachment\(\) \{.*?\}\s*\n\s*\})', "$1

  function handleKunciJawabanChange(file: File | null) {
    if (file && file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      toast.error(`Ukuran kunci jawaban maksimal ${ATTACHMENT_LIMIT_LABEL}.`);
      return;
    }

    setTugasKunciJawabanFile(file);
    if (file) {
      setTugasKunciJawabanMarkedForRemoval(false);
    }
  }

  function handleClearSelectedKunciJawaban() {
    setTugasKunciJawabanFile(null);
  }

  function handleRemoveExistingKunciJawaban() {
    setTugasKunciJawabanFile(null);
    setTugasKunciJawabanMarkedForRemoval(true);
    setTugasDraft((current) =>
      current
        ? {
            ...current,
            kunciJawabanName: undefined,
            kunciJawabanFile: undefined,
          }
        : null,
    );
  }"

# Change 6
$content = $content -replace '(?s)(onRemoveExistingAttachment=\{handleRemoveExistingTugasAttachment\})', "$1
        onKunciJawabanChange={handleKunciJawabanChange}
        onClearSelectedKunciJawaban={handleClearSelectedKunciJawaban}
        onRemoveExistingKunciJawaban={handleRemoveExistingKunciJawaban}
        selectedKunciJawabanName={tugasKunciJawabanFile?.name}
        existingKunciJawabanName={tugasDraft?.kunciJawabanName}
        kunciJawabanMarkedForRemoval={tugasKunciJawabanMarkedForRemoval}"

# Change 7 (remove Ujian Link block)
$content = $content -replace '(?s)\{isUtbkClass \? \(\s*<div className="mt-4">\s*<Link\s*href=\{buildGuruUrl\("/dashboard-guru/ujian", searchParams\)\}.*?</Link>\s*</div>\s*\) : null\}', ""

Set-Content -Path $file -Value $content
