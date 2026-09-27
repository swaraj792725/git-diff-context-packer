import { ParsedDiffResult, FileDiff } from './diff.js';

export interface PackDiffOptions {
  maxTokenBudget?: number;
  format?: 'xml' | 'markdown' | 'json';
  onlyAdditions?: boolean;
  filterPathPatterns?: string[];
  systemPromptPreset?: 'pr-review' | 'commit-msg' | 'summary';
}

export interface PackedDiffResult {
  formattedOutput: string;
  includedFiles: string[];
  omittedFiles: string[];
  totalTokens: number;
  truncated: boolean;
}

/**
 * Packs structured git diffs into token-budgeted AI prompts for Claude, Gemini, and Cursor code reviews.
 */
export function packGitDiff(parsedDiff: ParsedDiffResult, options: PackDiffOptions = {}): PackedDiffResult {
  const maxTokenBudget = options.maxTokenBudget || Number.POSITIVE_INFINITY;
  const format = options.format || 'xml';
  const preset = options.systemPromptPreset || 'pr-review';

  const includedFiles: FileDiff[] = [];
  const omittedFiles: string[] = [];

  let accumulatedTokens = 0;

  for (const file of parsedDiff.files) {
    if (options.filterPathPatterns && options.filterPathPatterns.length > 0) {
      const match = options.filterPathPatterns.some(pat => file.newPath.includes(pat) || file.oldPath.includes(pat));
      if (!match) {
        omittedFiles.push(file.newPath || file.oldPath);
        continue;
      }
    }

    if (accumulatedTokens + file.estimatedTokens <= maxTokenBudget) {
      includedFiles.push(file);
      accumulatedTokens += file.estimatedTokens;
    } else {
      omittedFiles.push(file.newPath || file.oldPath);
    }
  }

  const truncated = omittedFiles.length > 0;
  const formattedOutput = formatDiffPrompt(includedFiles, omittedFiles, format, preset, accumulatedTokens, parsedDiff);

  return {
    formattedOutput,
    includedFiles: includedFiles.map(f => f.newPath || f.oldPath),
    omittedFiles,
    totalTokens: accumulatedTokens,
    truncated
  };
}

function formatDiffPrompt(
  includedFiles: FileDiff[],
  omittedFiles: string[],
  format: 'xml' | 'markdown' | 'json',
  preset: string,
  accumulatedTokens: number,
  parsedDiff: ParsedDiffResult
): string {
  if (format === 'json') {
    return JSON.stringify(
      {
        preset,
        totalTokens: accumulatedTokens,
        totalAdditions: parsedDiff.totalAdditions,
        totalDeletions: parsedDiff.totalDeletions,
        includedFilesCount: includedFiles.length,
        omittedFilesCount: omittedFiles.length,
        files: includedFiles.map(f => ({
          path: f.newPath || f.oldPath,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          hunks: f.hunks
        }))
      },
      null,
      2
    );
  }

  if (format === 'markdown') {
    const lines: string[] = [];
    lines.push(`# Git Diff AI Context Prompt`);
    lines.push(`- **Preset Target**: \`${preset}\``);
    lines.push(`- **Files Modified**: ${includedFiles.length} included (${omittedFiles.length} omitted)`);
    lines.push(`- **Changes**: +${parsedDiff.totalAdditions} / -${parsedDiff.totalDeletions} lines`);
    lines.push(`- **Estimated Tokens**: ~${accumulatedTokens}`);
    lines.push(``);

    for (const file of includedFiles) {
      lines.push(`## File: \`${file.newPath || file.oldPath}\` [${file.status.toUpperCase()}]`);
      lines.push(`\`\`\`diff`);
      for (const hunk of file.hunks) {
        lines.push(hunk.header);
        for (const l of hunk.lines) {
          const prefix = l.type === 'add' ? '+' : l.type === 'delete' ? '-' : ' ';
          lines.push(`${prefix}${l.content}`);
        }
      }
      lines.push(`\`\`\``);
      lines.push(``);
    }

    return lines.join('\n');
  }

  // Default XML for Claude
  const lines: string[] = [];
  lines.push(`<git_diff_context preset="${preset}">`);
  lines.push(`  <summary>`);
  lines.push(`    <included_files_count>${includedFiles.length}</included_files_count>`);
  lines.push(`    <omitted_files_count>${omittedFiles.length}</omitted_files_count>`);
  lines.push(`    <total_additions>${parsedDiff.totalAdditions}</total_additions>`);
  lines.push(`    <total_deletions>${parsedDiff.totalDeletions}</total_deletions>`);
  lines.push(`    <estimated_tokens>${accumulatedTokens}</estimated_tokens>`);
  lines.push(`  </summary>`);
  lines.push(`  <diff_files>`);

  for (const file of includedFiles) {
    lines.push(`    <file path="${file.newPath || file.oldPath}" status="${file.status}">`);
    lines.push(`      <hunks>`);
    for (const hunk of file.hunks) {
      lines.push(`        <hunk header="${escapeXml(hunk.header)}">`);
      for (const l of hunk.lines) {
        const prefix = l.type === 'add' ? '+' : l.type === 'delete' ? '-' : ' ';
        lines.push(`${prefix}${escapeXml(l.content)}`);
      }
      lines.push(`        </hunk>`);
    }
    lines.push(`      </hunks>`);
    lines.push(`    </file>`);
  }

  lines.push(`  </diff_files>`);
  lines.push(`</git_diff_context>`);

  return lines.join('\n');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&rawgt;')
    .replace(/"/g, '&quot;');
}
