const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\sections\\DetailKelasGuruSection.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacement = `        onOpenChange={handleTaskSubmissionDialogOpenChange}
        onSelectSubmission={(submissionId) => {
          void handleSelectTaskSubmission(submissionId);
        }}
        open={isTaskSubmissionDialogOpen}
        selectedSubmissionId={selectedSubmissionId}
        submissionDetail={selectedTaskSubmissionDetail}
        submissions={taskSubmissionsWithLatestGrades}
        task={selectedTaskForSubmissions}
      />
    </div>
  );
}`;

// Find the last occurrence of TaskSubmissionReviewDialog
const idx = content.indexOf('onSelectSubmission={(submissionId) => {');
if (idx > -1) {
  content = content.substring(0, idx - 40) + replacement + '\n';
  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed end of file');
} else {
  console.log('Not found');
}
