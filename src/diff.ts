export type LineType = 'add' | 'delete' | 'context';

export interface DiffLine {
  type: LineType;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface FileDiff {
  oldPath: string;
  newPath: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
  estimatedTokens: number;
}

export interface ParsedDiffResult {
  files: FileDiff[];
  totalFiles: number;
  totalAdditions: number;
  totalDeletions: number;
  totalEstimatedTokens: number;
}

/**
 * Parses raw git diff string in Unified Diff format into structured objects.
 */
export function parseGitDiff(rawDiff: string): ParsedDiffResult {
  const files: FileDiff[] = [];
  const lines = rawDiff.split('\n');

  let currentFile: FileDiff | null = null;
  let currentHunk: DiffHunk | null = null;

  let totalAdditions = 0;
  let totalDeletions = 0;
  let totalTokens = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // File Header: diff --git a/file b/file
    if (line.startsWith('diff --git')) {
      if (currentFile) {
        if (currentHunk) currentFile.hunks.push(currentHunk);
        currentHunk = null;
        finalizeFileDiff(currentFile);
        files.push(currentFile);
      }

      const match = line.match(/diff --git a\/(.+) b\/(.+)/);
      const oldPath = match ? match[1] : '';
      const newPath = match ? match[2] : '';

      currentFile = {
        oldPath,
        newPath,
        status: 'modified',
        additions: 0,
        deletions: 0,
        hunks: [],
        estimatedTokens: 0
      };
      continue;
    }

    if (!currentFile) continue;

    if (line.startsWith('new file mode')) {
      currentFile.status = 'added';
    } else if (line.startsWith('deleted file mode')) {
      currentFile.status = 'deleted';
    } else if (line.startsWith('rename from')) {
      currentFile.status = 'renamed';
    }

    // Hunk Header: @@ -1,5 +1,6 @@
    if (line.startsWith('@@')) {
      if (currentHunk) {
        currentFile.hunks.push(currentHunk);
      }

      const hunkMatch = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/);
      if (hunkMatch) {
        currentHunk = {
          header: line,
          oldStart: parseInt(hunkMatch[1], 10),
          oldLines: hunkMatch[2] ? parseInt(hunkMatch[2], 10) : 1,
          newStart: parseInt(hunkMatch[3], 10),
          newLines: hunkMatch[4] ? parseInt(hunkMatch[4], 10) : 1,
          lines: []
        };
      } else {
        currentHunk = {
          header: line,
          oldStart: 1,
          oldLines: 0,
          newStart: 1,
          newLines: 0,
          lines: []
        };
      }
      continue;
    }

    if (!currentHunk) continue;

    // Line changes
    if (line.startsWith('+') && !line.startsWith('+++')) {
      currentHunk.lines.push({ type: 'add', content: line.slice(1) });
      currentFile.additions++;
      totalAdditions++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      currentHunk.lines.push({ type: 'delete', content: line.slice(1) });
      currentFile.deletions++;
      totalDeletions++;
    } else if (line.startsWith(' ') || line === '') {
      currentHunk.lines.push({ type: 'context', content: line.slice(1) });
    }
  }

  if (currentFile) {
    if (currentHunk) currentFile.hunks.push(currentHunk);
    finalizeFileDiff(currentFile);
    files.push(currentFile);
  }

  for (const f of files) {
    totalTokens += f.estimatedTokens;
  }

  return {
    files,
    totalFiles: files.length,
    totalAdditions,
    totalDeletions,
    totalEstimatedTokens: totalTokens
  };
}

function finalizeFileDiff(file: FileDiff) {
  let charCount = file.newPath.length + file.status.length;
  for (const hunk of file.hunks) {
    for (const l of hunk.lines) {
      charCount += l.content.length + 2;
    }
  }
  file.estimatedTokens = Math.ceil(charCount / 4);
}
