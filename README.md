# `@swaraj792725/git-diff-context-packer`

> **Zero-dependency Git diff parser, patch analyzer, and token-budgeted AI prompt context generator for Claude, Gemini, and Cursor code reviews.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub Packages](https://img.shields.io/badge/registry-GitHub_Packages-green.svg)](https://github.com/swaraj792725?tab=packages)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)

---

## 🌟 Overview

When generating automated code reviews, PR summaries, or commit messages with LLMs like Claude 3.5 Sonnet or GPT-4o, passing unformatted raw git diffs often overflows token context windows or misses essential change structures.

`@swaraj792725/git-diff-context-packer` parses Unified Git Diffs, extracts hunk additions/deletions, and formats token-budgeted AI prompt payloads in XML, Markdown, or JSON formats.

### Key Features
- 🌲 **Unified Diff Parser**: Parses `git diff`, `git show`, or patch files line-by-line into structured file objects.
- ✂️ **Token Budget Enforcer**: Fits diff payloads into configurable token budgets, prioritizing critical file changes.
- 🎯 **AI Prompt Formatters**: Generates XML tags (`<git_diff_context>`), Markdown codeblocks, or JSON payloads for Claude and Cursor.
- 🛡️ **Zero Runtime Dependencies**: Ultra-fast execution in Node.js, CJS, and ESM environments.

---

## 📦 Installation

Install via GitHub Packages registry:

```bash
npm install @swaraj792725/git-diff-context-packer --registry=https://npm.pkg.github.com
```

---

## 🚀 Programmatic Usage

### 1. Parse & Pack Git Diff into AI Prompt

```typescript
import { parseGitDiff, packGitDiff } from '@swaraj792725/git-diff-context-packer';

const rawDiff = getGitDiffOutput();
const parsed = parseGitDiff(rawDiff);

const packed = packGitDiff(parsed, {
  maxTokenBudget: 8000,
  format: 'xml',
  systemPromptPreset: 'pr-review'
});

console.log(`Tokens: ~${packed.totalTokens} | Truncated: ${packed.truncated}`);
console.log(packed.formattedOutput);
```

---

## 🖥️ CLI Usage

```bash
# Package uncommitted staged changes into XML prompt for Claude
npx @swaraj792725/git-diff-context-packer --staged --format xml

# Package specific git commit hash in Markdown format
npx @swaraj792725/git-diff-context-packer --commit abc1234 --format markdown
```

---

## 📜 License

MIT © [Swaraj](https://github.com/swaraj792725)
