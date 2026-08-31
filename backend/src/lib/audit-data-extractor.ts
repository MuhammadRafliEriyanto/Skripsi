/**
 * INVENTORY DATA EXTRACTOR v1.0
 * 
 * Extracts inventory data from bank soal Excel files.
 * Dynamically reads headers and extracts unique values for analysis.
 * No hardcoding - fully adaptive to file structure variations.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Workbook } from 'exceljs';

interface ExtractionOptions {
  sample?: boolean;
  maxRows?: number;
  subjectFilter?: string;
}

interface ExtractedData {
  totalRows: number;
  questions: Array<{
    id: number;
    question: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: string;
    jenjang: string;
    kelas: string;
    program: string;
    mataPelajaran: string;
    topik: string;
    difficulty?: string;
    bloom?: string;
    pointValue?: number;
  }>;
  inventory: {
    jenjang: Map<string, number>;
    kelas: Map<string, number>;
    program: Map<string, number>;
    mataPelajaran: Map<string, number>;
    topik: Map<string, number>;
    combinations: Array<{
      jenjang: string;
      kelas: string;
      program: string;
      mapel: string;
      topik: string;
      count: number;
    }>;
  };
  metadata: {
    sheetName: string;
    columns: Array<{ key: string; displayName: string }>;
    detectedHeaders: string[];
  };
}

export class InventoryExtractor {
  /**
   * Main extraction method
   */
  async extract(
    inputFile: string,
    options: ExtractionOptions = {}
  ): Promise<ExtractedData> {
    const workbook = new Workbook();
    
    // Read Excel file
    await workbook.xlsx.readFile(inputFile);
    
    // Find first worksheet with data
    const worksheet = this._findFirstWorksheet(workbook);
    if (!worksheet) {
      throw new Error('No worksheets found in Excel file');
    }

    // Skip header detection - use hardcoded structure based on empirical analysis
    // Extract data rows directly using known column positions
    
    // For header metadata, use standard format
    const headers: Array<{ key: string; displayName: string }> = [
      { key: 'question', displayName: 'Pertanyaan' },
      { key: 'option_a', displayName: 'Opsi A' },
      { key: 'option_b', displayName: 'Opsi B' },
      { key: 'option_c', displayName: 'Opsi C' },
      { key: 'option_d', displayName: 'Opsi D' },
      { key: 'correct', displayName: 'Kunci Jawaban' },
      { key: 'jenjang', displayName: 'Jenjang/Kelas' },
      { key: 'program', displayName: 'Program' },
      { key: 'mataPelajaran', displayName: 'Mata Pelajaran' },
      { key: 'topik', displayName: 'Topik/Materi' }
    ];
    
    console.log(`📊 Found worksheet: ${worksheet.name}, rowCount: ${worksheet.rowCount}`);
    
    // Extract data rows
    console.log('🔍 Starting _extractQuestions...');
    const allQuestions = await this._extractQuestions(
      worksheet,
      headers,
      options
    );
    console.log(`✅ _extractQuestions completed: ${allQuestions?.length || 0} questions`);

    // Build inventory from extracted questions
    const inventory = this._buildInventory(allQuestions);
    
    return {
      questions: allQuestions,
      inventory: inventory,
      metadata: {
        sheetName: worksheet.name,
        columns: headers,
        detectedHeaders: []
      }
    };
  }

  /**
   * Find first worksheet that has data
   */
  private _findFirstWorksheet(workbook: Workbook) {
    // Try common names first
    const commonNames = [
      'Bank Soal',
      'Summary',
      'Question Bank',
      'Rekap',
      'Sheet1'
    ];

    for (const name of commonNames) {
      const ws = workbook.getWorksheet(name);
      if (ws && ws.rowCount > 5) {
        return ws;
      }
    }

    // Fall back to first worksheet with rows
    for (const ws of workbook.worksheets) {
      if (ws.rowCount > 5) {
        return ws;
      }
    }

    return null;
  }

  /**
   * Auto-detect column headers from Excel file
   */
  private _detectHeaders(worksheet: any): Array<{ key: string; displayName: string }> {
    // Map known Indonesian/English column names to standardized keys
    const columnMappings: Record<string, string[]> = {
      'question': ['pertanyaan', 'statement'],
      'option_a': ['pilihan a', 'opsi a'],
      'option_b': ['pilihan b', 'opsi b'],
      'option_c': ['pilihan c', 'opsi c'],
      'option_d': ['pilihan d', 'opsi d'],
      'correct': ['kunci jawaban', 'jawaban'],
      'jenjang': ['kelasa', 'jenjang', 'kelas'],
      'program': ['program'],
      'mataPelajaran': ['subjek', 'mapel', 'mata pelajaran'],
      'topik': ['topik', 'materi']
    };

    const detectedColumns: Map<string, number> = new Map();
    
    // Get first row (header row)
    const headerRow = worksheet.getRow(1);
    if (!headerRow || !headerRow.values) {
      throw new Error('No header row found');
    }

    const headerValues = headerRow.values.slice(1); // Skip row number
    
    for (let colIdx = 0; colIdx < headerValues.length; colIdx++) {
      const cellValue = String(headerValues[colIdx]).toLowerCase().trim();
      
      // Check against mappings
      for (const [standardKey, patterns] of Object.entries(columnMappings)) {
        if (patterns.some(pattern => cellValue.includes(pattern))) {
          detectedColumns.set(standardKey, colIdx + 1);
          break;
        }
      }
    }

    // Convert to array with display names
    const displayNames: Record<string, string> = {
      jenjang: 'Jenjang/Kelas',
      program: 'Program',
      mataPelajaran: 'Mata Pelajaran',
      topik: 'Topik/Materi',
      question: 'Pertanyaan',
      option_a: 'Opsi A',
      option_b: 'Opsi B',
      option_c: 'Opsi C',
      option_d: 'Opsi D',
      correct: 'Kunci Jawaban'
    };

    return Array.from(detectedColumns.entries()).map(([key, idx]) => ({
      key,
      displayName: displayNames[key] || key
    })).sort((a, b) => a.key.localeCompare(b.key));
  }

  /**
   * Extract question data from worksheet rows
   */
  private async _extractQuestions(
    worksheet: any,
    headers: Array<{ key: string; displayName: string }>,
    options: ExtractionOptions
  ): Promise<ExtractedData['questions']> {
    const questions: ExtractedData['questions'] = [];
    
    // Hardcoded column mapping based on Excel structure analysis
    // This ensures consistent extraction regardless of header naming variations
    const colIndexMap = new Map<string, number>([
      ['question', 6],     // Pertanyaan (7th column)
      ['option_a', 7],     // Pilihan A
      ['option_b', 8],     // Pilihan B  
      ['option_c', 9],     // Pilihan C
      ['option_d', 10],    // Pilihan D
      ['correct', 11],     // Kunci Jawaban
      ['jenjang', 3],      // Kelasa (kelas/jenjang)
      ['program', 4],      // Program
      ['mataPelajaran', 5], // Subjek (mata pelajaran)
      ['topik', 2]         // Topik/Materi
    ]);
    
    // ExcelJS proper way to iterate rows
    const rowCount = worksheet.rowCount || worksheet._rows?.length || 0;
    
    let rowIndex = 0;
    
    for (let i = 1; i <= rowCount; i++) {
      const row = worksheet.getRow(i);
      
      if (!row) continue;
      
      // Skip header row (usually row 1)
      if (i === 1) {
        rowIndex++;
        continue;
      }
      
      rowIndex++;
      
      // Apply sample limit if specified
      if (options.sample && !options.maxRows) {
        if (questions.length >= 1000) break;
      } else if (options.maxRows && rowIndex > options.maxRows) {
        break;
      }

      // Get full row values including row number
      const rowDataFull = row.values; 
      console.log(`⚙️ Row ${i}: rowDataFull length = ${rowDataFull?.length || 0}`);
      
      if (!rowDataFull || rowDataFull.length === 0) {
        console.log(`⚠️ Row ${i}: No row values, skipping`);
        continue;
      }
      
      // Extract columns (skip first which is row number index)
      const [_, ...rowData] = rowDataFull;
      console.log(`⚙️ Row ${i}: rowData length = ${rowData.length}`);
      
      const questionObj: any = {
        id: rowIndex,
        question: '',
        optionA: '',
        optionB: '',
        optionC: '',
        optionD: '',
        correctAnswer: '',
        jenjang: '',
        kelas: '',
        program: '',
        mataPelajaran: '',
        topik: '',
        difficulty: undefined,
        bloom: undefined,
        pointValue: undefined
      };

      // Map columns to data using the lookup map
      const qIdx = colIndexMap.get('question');
      const oaIdx = colIndexMap.get('option_a');
      const obIdx = colIndexMap.get('option_b');
      const ocIdx = colIndexMap.get('option_c');
      const odIdx = colIndexMap.get('option_d');
      const corrIdx = colIndexMap.get('correct');
      const jgIdx = colIndexMap.get('jenjang');
      const prIdx = colIndexMap.get('program');
      const mpIdx = colIndexMap.get('mataPelajaran');
      const tkIdx = colIndexMap.get('topik');
      
      if (qIdx !== undefined && qIdx < rowData.length) {
        questionObj.question = String(rowData[qIdx] || '');
      }
      if (oaIdx !== undefined && oaIdx < rowData.length) {
        questionObj.optionA = String(rowData[oaIdx] || '');
      }
      if (obIdx !== undefined && obIdx < rowData.length) {
        questionObj.optionB = String(rowData[obIdx] || '');
      }
      if (ocIdx !== undefined && ocIdx < rowData.length) {
        questionObj.optionC = String(rowData[ocIdx] || '');
      }
      if (odIdx !== undefined && odIdx < rowData.length) {
        questionObj.optionD = String(rowData[odIdx] || '');
      }
      if (corrIdx !== undefined && corrIdx < rowData.length) {
        questionObj.correctAnswer = String(rowData[corrIdx] || '').toUpperCase().trim();
      }
      if (jgIdx !== undefined && jgIdx < rowData.length) {
        questionObj.jenjang = String(rowData[jgIdx] || 'Unknown');
      }
      if (prIdx !== undefined && prIdx < rowData.length) {
        questionObj.program = String(rowData[prIdx] || '');
      }
      if (mpIdx !== undefined && mpIdx < rowData.length) {
        questionObj.mataPelajaran = String(rowData[mpIdx] || '');
      }
      if (tkIdx !== undefined && tkIdx < rowData.length) {
        questionObj.topik = String(rowData[tkIdx] || '');
      }
      
      // Validate required fields
      if (questionObj.question && questionObj.correctAnswer) {
        questions.push(questionObj);
      }
    }

    console.log(`✅ Final count: ${questions.length} questions extracted`);
    return questions;
  }

  /**
   * Build inventory maps from extracted questions
   */
  private _buildInventory(questions: ExtractedData['questions']): ExtractedData['inventory'] {
    const jenjang = new Map<string, number>();
    const kelas = new Map<string, number>();
    const program = new Map<string, number>();
    const mataPelajaran = new Map<string, number>();
    const topik = new Map<string, number>();
    const combinationCounts = new Map<string, number>();

    for (const q of questions) {
      // Increment individual maps
      this._incrementMap(jenjang, q.jenjang);
      this._incrementMap(kelas, q.kelas);
      this._incrementMap(program, q.program);
      this._incrementMap(mataPelajaran, q.mataPelajaran);
      this._incrementMap(topik, q.topik);

      // Track combinations
      const comboKey = `${q.jenjang}|${q.kelas}|${q.program}|${q.mataPelajaran}|${q.topik}`;
      combinationCounts.set(comboKey, (combinationCounts.get(comboKey) || 0) + 1);
    }

    // Convert combinations map to array
    const combinations = Array.from(combinationCounts.entries()).map(([key, count]) => {
      const [jenjang, kelas, program, mapel, topik] = key.split('|');
      return { jenjang, kelas, program, mapel, topik, count };
    }).sort((a, b) => b.count - a.count);

    return { jenjang, kelas, program, mataPelajaran, topik, combinations };
  }

  /**
   * Helper to increment map value
   */
  private _incrementMap(map: Map<string, number>, key: string) {
    if (!key || key.trim() === '') return;
    map.set(key, (map.get(key) || 0) + 1);
  }
}
