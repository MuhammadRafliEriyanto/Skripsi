const fs = require('fs');
const file = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-siswa\\pages\\TugasSiswaPageView.tsx';
let content = fs.readFileSync(file, 'utf8');

const importPattern = /import \{ \n\s+normalizeText,\n\s+buildSiswaApiUrl,\n\s+fetchStudentLearningJson,\n\s+type StudentLearningTask,\n\} from "\.\/learningUtils";/;

content = content.replace(
  importPattern,
  `import { 
  normalizeText,
  buildSiswaApiUrl,
  fetchStudentLearningJson,
  type StudentLearningTask,
} from "./learningUtils";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";`
);

const handleStartPattern = /const handleOpenTask = \(id: string\) => \{\n\s+setSelectedTaskId\(id\);\n\s+setIsDialogOpen\(true\);\n\s+\};/;

content = content.replace(
  handleStartPattern,
  `const handleOpenTask = (id: string) => {
    setSelectedTaskId(id);
    setIsDialogOpen(true);
  };

  const handleStartLatihanCbt = async (taskId: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    try {
      const response = await fetch(\`/api/student/me/learning/tasks/\${encodeURIComponent(taskId)}/cbt/start\`, {
        method: "POST",
      });
      const payload = await response.json();
      
      if (!response.ok || !payload.success) {
        throw new Error(payload?.message || "Gagal memulai latihan");
      }
      
      router.push(\`/dashboard-siswa/latihan/\${payload.data.attemptId}/cbt\`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Terjadi kesalahan saat memulai latihan");
    }
  };`
);

// We need to inject router
const routerPattern = /const searchParams = useSearchParams\(\);/;

content = content.replace(
  routerPattern,
  `const searchParams = useSearchParams();\n  const router = useRouter();`
);

// We need to replace the Link components for "Mulai Latihan" with buttons that call handleStartLatihanCbt
content = content.replace(
  /<Link\n\s+href=\{`\/dashboard-siswa\/latihan\/\$\{task\.id\}\/cbt`\}\n\s+onClick=\{\(e\) => e\.stopPropagation\(\)\}\n\s+className="inline-flex h-11 flex-1 md:w-\[150px\] items-center justify-center gap-2 rounded-xl \\?\n?bg-orange-500 px-4 text-\[13px\] font-semibold text-white shadow-sm transition-all hover:-translate-y-px \\?\n?hover:bg-orange-600 hover:shadow-md"\n\s+>\n\s+<Send className="h-\[18px\] w-\[18px\]" \/>\n\s+Mulai Latihan\n\s+<\/Link>/g,
  `<button
      onClick={(e) => handleStartLatihanCbt(task.id, e)}
      className="inline-flex h-11 flex-1 md:w-[150px] items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-[13px] font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:bg-orange-600 hover:shadow-md"
    >
      <Send className="h-[18px] w-[18px]" />
      Mulai Latihan
    </button>`
);

content = content.replace(
  /<Link\n\s+href=\{`\/dashboard-siswa\/latihan\/\$\{selectedTask\.id\}\/cbt`\}\n\s+className="flex-1 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 \\?\n?text-\[15px\] font-semibold text-white shadow-sm transition-all hover:-translate-y-0\.5 hover:bg-orange-600 \\?\n?hover:shadow-md"\n\s+>\n\s+<Send className="h-5 w-5" \/>\n\s+Mulai Latihan\n\s+<\/Link>/g,
  `<button
      onClick={(e) => handleStartLatihanCbt(selectedTask.id, e)}
      className="flex-1 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 text-[15px] font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-md"
    >
      <Send className="h-5 w-5" />
      Mulai Latihan
    </button>`
);

fs.writeFileSync(file, content);
console.log('Fixed CBT start logic in TugasSiswaPageView.tsx');
