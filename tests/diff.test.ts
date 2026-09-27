import { describe, it, expect } from 'vitest';
import { parseGitDiff, packGitDiff } from '../src/index.js';

describe('git-diff-context-packer', () => {
  const sampleDiff = `
diff --git a/src/index.ts b/src/index.ts
index 8338483..9494949 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,4 +1,5 @@
-import { oldFn } from './old';
+import { newFn } from './new';
 export function main() {
+  console.log('updated');
 }
diff --git a/src/utils.ts b/src/utils.ts
new file mode 100644
--- /dev/null
+++ b/src/utils.ts
@@ -0,0 +1,3 @@
+export function helper() {
+  return true;
+}
  `.trim();

  it('parses unified git diff string accurately', () => {
    const parsed = parseGitDiff(sampleDiff);

    expect(parsed.totalFiles).toBe(2);
    expect(parsed.totalAdditions).toBe(5);
    expect(parsed.totalDeletions).toBe(1);

    expect(parsed.files[0].oldPath).toBe('src/index.ts');
    expect(parsed.files[0].newPath).toBe('src/index.ts');
    expect(parsed.files[0].additions).toBe(2);
    expect(parsed.files[0].deletions).toBe(1);

    expect(parsed.files[1].newPath).toBe('src/utils.ts');
    expect(parsed.files[1].status).toBe('added');
  });

  it('packs git diff into XML format for Claude AI prompts', () => {
    const parsed = parseGitDiff(sampleDiff);
    const packed = packGitDiff(parsed, { format: 'xml' });

    expect(packed.formattedOutput).toContain('<git_diff_context');
    expect(packed.formattedOutput).toContain('path="src/index.ts"');
    expect(packed.formattedOutput).toContain('+export function helper()');
  });

  it('enforces token budget and marks truncated files', () => {
    const parsed = parseGitDiff(sampleDiff);
    const packed = packGitDiff(parsed, { maxTokenBudget: 5, format: 'json' });

    expect(packed.truncated).toBe(true);
    expect(packed.omittedFiles.length).toBeGreaterThan(0);
  });
});
