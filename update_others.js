const fs = require('fs');

// 1. types.ts
const typesFile = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\detail-kelas\\types.ts';
let types = fs.readFileSync(typesFile, 'utf8');
types = types.replace(/  note: string;\r?\n}/, '  note: string;\n  pertemuanScores?: Record<number, number | null>;\n}');
fs.writeFileSync(typesFile, types, 'utf8');

// 2. TabelNilaiTable.tsx
const tableFile = 'D:\\Skripsi\\Next Js\\bimbel-new\\src\\components\\dashboard-guru\\detail-kelas\\TabelNilaiTable.tsx';
let table = fs.readFileSync(tableFile, 'utf8');

const theadOld = `          <TableHead className="w-[120px]">Latihan Soal</TableHead>
          {includeTaskScore &&
            ACADEMIC_SCORE_KEYS.filter((key) => scheme[key]).map((key) => (
              <TableHead key={key} className="w-[120px]">
                {ACADEMIC_SCORE_LABELS[key]}
              </TableHead>
            ))}
          <TableHead className="w-[100px]">Total</TableHead>
          <TableHead className="w-[100px]">Rata-rata</TableHead>`;
const theadNew = `          <TableHead className="w-[120px]">Latihan Soal</TableHead>
          {Array.from({ length: 24 }).map((_, i) => (
            <TableHead key={i} className="w-[80px]">
              P{i + 1}
            </TableHead>
          ))}
          <TableHead className="w-[100px]">Total</TableHead>
          <TableHead className="w-[100px]">Rata-rata</TableHead>`;
table = table.replace(theadOld, theadNew);

const tbodyOld = `                <TableCell>
                  <div className="flex items-center gap-2">
                    {formatScore(row.tugas)}
                    <button
                      onClick={() => onEditNilai(row.studentId)}
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                </TableCell>
                {includeTaskScore &&
                  ACADEMIC_SCORE_KEYS.filter((key) => scheme[key]).map(
                    (key) => (
                      <TableCell key={key}>
                        {formatScore(row.scores[key])}
                      </TableCell>
                    ),
                  )}
                <TableCell className="font-medium text-primary">
                  {formatScore(calculateTotalScore(row, scheme))}
                </TableCell>
                <TableCell className="font-medium">
                  {formatScore(calculateAverageScore(row, scheme))}
                </TableCell>`;
const tbodyNew = `                <TableCell>
                  {formatScore(row.tugas)}
                </TableCell>
                {Array.from({ length: 24 }).map((_, i) => (
                  <TableCell key={i}>
                    {formatScore(row.pertemuanScores?.[i + 1] ?? null)}
                  </TableCell>
                ))}
                <TableCell className="font-medium text-primary">
                  {formatScore(
                    Object.values(row.pertemuanScores || {}).reduce((acc: number, val) => acc + (val || 0), 0)
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {formatScore(
                    Object.values(row.pertemuanScores || {}).filter(val => val !== null).length > 0 
                      ? Object.values(row.pertemuanScores || {}).reduce((acc: number, val) => acc + (val || 0), 0) / Object.values(row.pertemuanScores || {}).filter(val => val !== null).length
                      : null
                  )}
                </TableCell>`;
table = table.replace(tbodyOld, tbodyNew);

fs.writeFileSync(tableFile, table, 'utf8');
console.log('types.ts and TabelNilaiTable.tsx updated');
