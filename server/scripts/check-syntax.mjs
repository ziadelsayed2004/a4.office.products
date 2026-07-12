import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(scriptDirectory, '..');
const roots = [path.join(serverRoot, 'src'), path.join(serverRoot, 'scripts')];

function collectJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectJavaScriptFiles(candidate);
      return /\.(?:js|mjs|cjs)$/.test(entry.name) ? [candidate] : [];
    });
}

const files = roots.flatMap((root) => collectJavaScriptFiles(root)).sort();
const failures = [];

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures.push({ file, output: `${result.stdout || ''}${result.stderr || ''}`.trim() });
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`Syntax check failed: ${path.relative(serverRoot, failure.file)}`);
    console.error(failure.output);
  }
  process.exitCode = 1;
} else {
  console.log(`Syntax check passed for ${files.length} backend JavaScript files.`);
}
