/**
 * REPORT GENERATOR v1.0
 * 
 * Generates comprehensive audit reports in multiple formats:
 * - JSON (structured data)
 * - Markdown (human-readable summary)
 * - Console output (quick view)
 */

import * as fs from 'fs';
import * as path from 'path';

interface AuditOptions {
  sample?: boolean;
  full?: boolean;
  subject?: string;
  outputDir?: string;
}

export class ReportGenerator {
  private outputDir: string;

  constructor(outputDir: string = './outputs') {
    this.outputDir = outputDir;
    
    // Ensure directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate markdown report
   */
  generateMarkdown(
    report: any,
    inputFile: string,
    options: AuditOptions
  ): string {
    const timestamp = new Date().toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'medium'
    });

    let md = `# 📊 Bank Soal Audit Report - V6\n\n`;
    md += `**Generated:** ${timestamp}\n`;
    md += `**Input File:** \`${inputFile}\`\n`;
    md += `**Options:** ${JSON.stringify(options)}\n\n`;
    md += `---\n\n`;

    // Summary Section
    md += `## 🎯 Summary\n\n`;
    md += `${report.summary}\n\n`;

    // Quality Score Card
    const scoreColor = this._getScoreColor(report.qualityScore);
    md += `### Score: **${scoreColor}${report.qualityScore.toFixed(2)}/100**${this._getScoreEmoji(report.qualityScore)}\n\n`;

    // Issues Section
    if (report.issues.length > 0) {
      md += `## ⚠️ Issues Found (${report.issues.length})\n\n`;
      
      for (const issue of report.issues) {
        const severityEmoji = this._getSeverityEmoji(issue.severity);
        md += `### ${severityEmoji} [${issue.severity.toUpperCase()}] ${issue.type}\n\n`;
        md += "``` \n";
        md += `${issue.description}\n`;
        md += "```\n\n";
        md += `**Impact:** ${issue.impact}\n\n`;
      }
    } else {
      md += `## ✅ No Critical Issues Detected\n\nAll quality metrics are within acceptable ranges.\n\n`;
    }

    // Inventory Overview
    if (report.inventory) {
      md += `## 📦 Inventory Overview\n\n`;
      
      md += `| Dimension | Unique Values | Distribution |\n`;
      md += `|-----------|---------------|-------------|\n`;
      
      if (report.inventory.jenjang?.size) {
        md += `| Jenjang | ${report.inventory.jenjang.size} | ${this._formatDistribution(report.inventory.jenjang)} |\n`;
      }
      if (report.inventory.kelas?.size) {
        md += `| Kelas | ${report.inventory.kelas.size} | ${this._formatDistribution(report.inventory.kelas)} |\n`;
      }
      if (report.inventory.program?.size) {
        md += `| Program | ${report.inventory.program.size} | ${this._formatDistribution(report.inventory.program)} |\n`;
      }
      if (report.inventory.mataPelajaran?.size) {
        md += `| Mata Pelajaran | ${report.inventory.mataPelajaran.size} | ${this._formatDistribution(report.inventory.mataPelajaran)} |\n`;
      }
      if (report.inventory.topik?.size) {
        md += `| Topik | ${report.inventory.topik.size} | ${this._formatDistribution(report.inventory.topik)} |\n`;
      }
      
      md += `\n`;
    }

    // Quality Metrics Detail
    if (report.qualityMetrics) {
      md += `## 🔬 Quality Metrics\n\n`;
      
      const qm = report.qualityMetrics;
      
      // Opening Patterns
      if (qm.openingFrequency?.size) {
        md += `### Opening Phrase Frequency\n\n`;
        md += `Top 5 most common openings:\n\n`;
        const sorted = Array.from(qm.openingFrequency.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        
        md += '| Rank | Pattern | Count | Percentage |\n';
        md += '|------|---------|-------|------------|\n';
        
        const total = questions.reduce((sum, count) => sum + count, 0);
        sorted.forEach(([pattern, count], idx) => {
          const percentage = ((count / total) * 100).toFixed(1);
          md += `| ${idx + 1} | \`${pattern}\` | ${count} | ${percentage}% |\n`;
        });
        md += `\n`;
      }

      // Structure Distribution
      if (qm.structureDistribution?.size) {
        md += `### Question Structure Types\n\n`;
        md += `| Structure Type | Count | Percentage |\n`;
        md += `|----------------|-------|------------|\n`;
        
        const totalStructures = Array.from(qm.structureDistribution.values()).reduce((a, b) => a + b, 0);
        Array.from(qm.structureDistribution.entries())
          .sort((a, b) => b[1] - a[1])
          .forEach(([type, count]) => {
            const percentage = ((count / totalStructures) * 100).toFixed(1);
            md += `| ${type} | ${count} | ${percentage}% |\n`;
          });
        md += `\n`;
      }

      // Template Patterns
      if (qm.templatePatterns?.size) {
        md += `### Template-Like Patterns Detected\n\n`;
        md += `⚠️ Questions using these templates may feel repetitive:\n\n`;
        
        const sortedTemplates = Array.from(qm.templatePatterns.entries())
          .sort((a, b) => b[1] - a[1]);
        
        sortedTemplates.forEach(([template, count]) => {
          const percentage = ((count / qm.totalQuestions || 0) * 100).toFixed(1);
          md += `- \`${template}\`: ${count} times (${percentage}%) ${percentage > 20 ? '🔴' : percentage > 10 ? '🟡' : '🟢'}\n`;
        });
        md += `\n`;
      }

      // Duplicate Statistics
      md += `### Duplicate Analysis\n\n`;
      md += `- **Exact Duplicates**: ${qm.exactDuplicates ?? 0}\n`;
      md += `- **Near Duplicates**: ${qm.nearDuplicateCount ?? 0}\n`;
      md += `- **Unique Questions**: ${(totalQuestions - qm.exactDuplicates).toLocaleString()}\n\n`;

      // Length Analysis
      md += `### Question Length Analysis\n\n`;
      md += `- **Average Length**: ${qm.avgQuestionLength?.toFixed(0)} characters\n`;
      md += `- **Short (<50 chars)**: ${(qm.lengthDistribution?.short || 0)}\n`;
      md += `- **Medium (50-150 chars)**: ${(qm.lengthDistribution?.medium || 0)}\n`;
      md += `- **Long (>150 chars)**: ${(qm.lengthDistribution?.long || 0)}\n\n`;
    }

    // Recommendations
    if (report.recommendations?.length) {
      md += `## 💡 Recommendations\n\n`;
      
      for (const [index, rec] of report.recommendations.entries()) {
        md += `${index + 1}. ${rec}\n`;
      }
      
      md += `\n`;
    }

    // Footer
    md += `---\n\n`;
    md += `_Generated by Bank Soal Audit V6.0_  
`;
    md += `For more information about variation strategies, see \`GENERATORS-COMPLETE-GUIDE.md\``;

    return md;
  }

  /**
   * Get emoji based on score range
   */
  private _getScoreEmoji(score: number): string {
    if (score >= 90) return ' 🌟';
    if (score >= 70) return ' 👍';
    if (score >= 50) return ' 🙂';
    if (score >= 30) return ' 😐';
    return ' 😞';
  }

  /**
   * Get color coding for score
   */
  private _getScoreColor(score: number): string {
    if (score >= 80) return '✅ ';
    if (score >= 60) return '🟡 ';
    return '❌ ';
  }

  /**
   * Get emoji for severity level
   */
  private _getSeverityEmoji(severity: 'high' | 'medium' | 'low'): string {
    switch (severity) {
      case 'critical':
        return '🔴';
      case 'high':
        return '🟠';
      case 'medium':
        return '🟡';
      default:
        return '🟢';
    }
  }

  /**
   * Format distribution map for display
   */
  private _formatDistribution(map: Map<string, number>): string {
    const entries = Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    return entries.map(([key, value]) => `${key}: ${value}`).join(', ');
  }

  /**
   * Save report to file
   */
  saveReport(report: any, filename: string, format: 'json' | 'md' = 'json') {
    const filepath = path.join(this.outputDir, filename);
    
    const content = format === 'json' 
      ? JSON.stringify(report, null, 2)
      : this.generateMarkdown(report, '', {});
    
    fs.writeFileSync(filepath, content);
    console.log(`💾 Report saved to: ${filepath}`);
    
    return filepath;
  }
}
