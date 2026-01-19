/*
  Lightweight secret scanner for this repo.
  Goal: catch accidental commits of API keys/tokens/private keys.

  Usage:
    node scripts/scan_secrets.js

  Notes:
  - This is heuristic (not perfect). It intentionally focuses on common patterns.
  - Prefer GitHub Secret Scanning + Push Protection + gitleaks in CI if possible.
*/

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');

const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  '.expo',
  '.expo-shared',
  'android',
  'ios',
  'build',
  'dist',
  'out',
  'extracted_apk',
  'tmp_apk_extracted',
  'android-bundle',
  'prebuilt',
]);

const IGNORE_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bundle.android.js',
]);

const INCLUDE_EXT = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.txt', '.yml', '.yaml', '.properties', '.gradle', '.env',
]);

const PATTERNS = [
  { name: 'Google Maps / Google API key', re: /AIza[0-9A-Za-z\-_]{10,}/g },
  { name: 'GitHub token (classic)', re: /\bghp_[0-9A-Za-z]{20,}\b/g },
  { name: 'GitHub fine-grained token', re: /\bgithub_pat_[0-9A-Za-z_]{20,}\b/g },
  { name: 'AWS access key id', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'Slack token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g },
  { name: 'Stripe key', re: /\bsk_(?:live|test)_[0-9a-zA-Z]{10,}\b/g },
  { name: 'Private key header', re: /-----BEGIN (?:RSA|EC|OPENSSH|PGP) PRIVATE KEY-----/g },
  // Generic “looks like secret” assignments (kept narrow to reduce noise)
  { name: 'Generic secret assignment', re: /(api[_-]?key|client_secret|access_token|refresh_token|private_key)\s*[:=]\s*['"][^'"\n]{12,}['"]/gi },
];

function shouldIgnoreDir(name) {
  return IGNORE_DIRS.has(name);
}

function shouldScanFile(filePath) {
  const base = path.basename(filePath);
  if (IGNORE_FILES.has(base)) return false;

  // Never scan local env files (they are meant to be gitignored).
  // We keep scanning `.env.example` so placeholder patterns can still be reviewed.
  if (base === '.env') return false;
  if (base.startsWith('.env.') && base !== '.env.example') return false;

  const ext = path.extname(filePath);
  return INCLUDE_EXT.has(ext);
}

function listGitTrackedFiles() {
  try {
    const out = execSync('git ls-files -z', {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const rel = out.toString('utf8').split('\0').filter(Boolean);
    return rel.map((p) => path.join(root, p));
  } catch {
    return null;
  }
}

function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (shouldIgnoreDir(ent.name)) continue;
      walk(full, out);
    } else if (ent.isFile()) {
      if (shouldScanFile(full)) out.push(full);
    }
  }
}

function scanFile(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch {
    return [];
  }

  // Skip gigantic files (bundles, dumps)
  if (content.length > 2_000_000) return [];

  const findings = [];
  for (const p of PATTERNS) {
    const matches = content.match(p.re);
    if (matches && matches.length) {
      findings.push({
        pattern: p.name,
        count: matches.length,
      });
    }
  }

  return findings;
}

function main() {
  // Prefer scanning only files tracked by git. This avoids false positives from
  // local, gitignored files (e.g. `.env` containing real credentials).
  const tracked = listGitTrackedFiles();
  const files = tracked || [];
  if (!tracked) {
    walk(root, files);
  }

  const results = [];
  for (const f of files) {
    const findings = scanFile(f);
    if (findings.length) results.push({ file: path.relative(root, f), findings });
  }

  if (!results.length) {
    console.log('✅ No obvious secrets detected.');
    process.exit(0);
  }

  console.error('❌ Potential secrets detected:');
  for (const r of results) {
    console.error(`- ${r.file}`);
    for (const f of r.findings) {
      console.error(`  - ${f.pattern} (matches: ${f.count})`);
    }
  }
  console.error('\nFix the items above before committing/pushing.');
  process.exit(1);
}

main();
