#!/usr/bin/env node

import * as process from 'node:process';
import * as fs from 'node:fs';
import { execSync } from 'node:child_process';
import { parseGitDiff } from './diff.js';
import { packGitDiff } from './packer.js';

function printHelp() {
  console.log(`
@swaraj792725/git-diff-context-packer - Zero-dependency Git diff parser & AI context prompt generator

Usage:
  git-diff-context-packer [options]

Options:
  --file <path>         Read raw diff from file instead of executing 'git diff'
  --staged              Package staged uncommitted changes ('git diff --staged')
  --commit <hash>       Package specific git commit ('git show <hash>')
  --format <fmt>        Output format: xml | markdown | json (default: xml)
  --max-tokens <num>    Maximum token budget
  --preset <name>       Prompt preset: pr-review | commit-msg | summary (default: pr-review)
  --help                Show help message

Examples:
  npx @swaraj792725/git-diff-context-packer --staged --format xml
  npx @swaraj792725/git-diff-context-packer --file patch.diff --max-tokens 4000
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  let filePath: string | null = null;
  let useStaged = false;
  let commitHash: string | null = null;
  let format: 'xml' | 'markdown' | 'json' = 'xml';
  let maxTokenBudget = Number.POSITIVE_INFINITY;
  let preset: 'pr-review' | 'commit-msg' | 'summary' = 'pr-review';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--file' && args[i + 1]) {
      filePath = args[++i];
    } else if (arg === '--staged') {
      useStaged = true;
    } else if (arg === '--commit' && args[i + 1]) {
      commitHash = args[++i];
    } else if (arg === '--format' && args[i + 1]) {
      const fmt = args[++i].toLowerCase();
      if (fmt === 'xml' || fmt === 'markdown' || fmt === 'json') format = fmt;
    } else if (arg === '--max-tokens' && args[i + 1]) {
      maxTokenBudget = parseInt(args[++i], 10);
    } else if (arg === '--preset' && args[i + 1]) {
      const p = args[++i].toLowerCase();
      if (p === 'pr-review' || p === 'commit-msg' || p === 'summary') preset = p;
    }
  }

  let rawDiff = '';

  if (filePath) {
    rawDiff = fs.readFileSync(filePath, 'utf8');
  } else {
    try {
      if (commitHash) {
        rawDiff = execSync(`git show ${commitHash}`, { encoding: 'utf8' });
      } else if (useStaged) {
        rawDiff = execSync('git diff --staged', { encoding: 'utf8' });
      } else {
        rawDiff = execSync('git diff', { encoding: 'utf8' });
      }
    } catch {
      console.error('[ERROR] Failed to run git command. Ensure git repository exists or pass --file patch.diff');
      process.exit(1);
    }
  }

  const parsed = parseGitDiff(rawDiff);
  const result = packGitDiff(parsed, {
    maxTokenBudget,
    format,
    systemPromptPreset: preset
  });

  console.error(`[INFO] Packed ${result.includedFiles.length} file diffs (~${result.totalTokens} tokens)`);
  console.log(result.formattedOutput);
}

main().catch(err => {
  console.error('Error running git-diff-context-packer CLI:', err);
  process.exit(1);
});
