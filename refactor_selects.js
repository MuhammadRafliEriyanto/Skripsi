const fs = require('fs');

const headerFile = 'src/components/dashboard-siswa/sections/HeaderAkademikSiswa.tsx';
let headerContent = fs.readFileSync(headerFile, 'utf8');

const oldHeaderSelect = `<div className="relative">
                  <select
                    value={selectedProgram?.name ?? ""}
                    onChange={(event) => setSelectedProgramName(event.target.value)}
                    className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-10 text-sm font-medium text-gray-700 transition focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  >
                    {programOptions.map((program) => (
                      <option key={program.name} value={program.name}>
                        {program.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                </div>`;

const newHeaderSelect = `<div className="relative">
                  <Select
                    value={selectedProgram?.name ?? ""}
                    onValueChange={(value) => setSelectedProgramName(value)}
                  >
                    <SelectTrigger className="w-full rounded-xl border-gray-200 bg-gray-50 h-11 px-4 text-sm font-medium text-gray-700 transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100">
                      <SelectValue placeholder="Pilih Panel" />
                    </SelectTrigger>
                    <SelectContent>
                      {programOptions.map((program) => (
                        <SelectItem key={program.name} value={program.name}>
                          {program.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>`;

if (headerContent.includes('<select')) {
  headerContent = headerContent.replace(oldHeaderSelect, newHeaderSelect);
  if (!headerContent.includes('import { Select')) {
    headerContent = headerContent.replace('import { Button }', 'import { Button } from "@/components/ui/button";\nimport { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";\n//');
  }
  fs.writeFileSync(headerFile, headerContent);
}

const tryoutFile = 'src/components/dashboard-siswa/pages/TryoutSiswaPageView.tsx';
let tryoutContent = fs.readFileSync(tryoutFile, 'utf8');

const oldTryoutSelect = `<select
                id="student-assessment-selector"
                value={activeSession.id}
                onChange={(event) => handleSelectAssessment(event.target.value)}
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              >
                {tryouts.map((item) => {
                  const session = buildSessionFromTryout(item);

                  return (
                    <option key={session.id} value={session.id}>
                      {session.assessmentLabel} · {session.title} · {session.subject}
                    </option>
                  );
                })}
              </select>`;

const newTryoutSelect = `<Select
                value={activeSession.id}
                onValueChange={(value) => handleSelectAssessment(value)}
              >
                <SelectTrigger id="student-assessment-selector" className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 focus:border-orange-300 focus:ring-2 focus:ring-orange-100">
                  <SelectValue placeholder="Pilih Ujian" />
                </SelectTrigger>
                <SelectContent>
                  {tryouts.map((item) => {
                    const session = buildSessionFromTryout(item);

                    return (
                      <SelectItem key={session.id} value={session.id}>
                        {session.assessmentLabel} · {session.title} · {session.subject}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>`;

if (tryoutContent.includes('<select')) {
  tryoutContent = tryoutContent.replace(oldTryoutSelect, newTryoutSelect);
  if (!tryoutContent.includes('import { Select')) {
    tryoutContent = tryoutContent.replace('import { Button }', 'import { Button } from "@/components/ui/button";\nimport { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";\n//');
  }
  fs.writeFileSync(tryoutFile, tryoutContent);
}
console.log('Select refactoring complete.');
