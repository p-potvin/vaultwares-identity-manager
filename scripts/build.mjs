#!/usr/bin/env node
/**
 * Production build pipeline:
 *
 *   1. Bump the patch version (third number) in package.json and manifest.json.
 *      Every build is a new build; the version is how a loaded extension tells
 *      itself apart from the previous one.
 *   2. Run webpack into dist/.
 *   3. Zip dist/ into release/ — the artifact AMO and the Chrome Web Store
 *      both accept (manifest.json at the zip root).
 *
 * The bump happens before webpack so the DefinePlugin stamps the new version
 * into the bundles. If webpack fails, the version stays bumped; the next
 * successful build increments again. That is fine — a failed build was never
 * distributed.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const RELEASE = join(ROOT, 'release');

// --- 1. bump the patch version --------------------------------------------
const pkgPath = join(ROOT, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const [major, minor, patch] = pkg.version.split('.').map(Number);
const version = `${major}.${minor}.${patch + 1}`;
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

const manifestPath = join(ROOT, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
manifest.version = version;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 4) + '\n');

console.log(`build: version ${pkg.version.split('.')[0]}.${minor}.${patch} -> ${version}`);

// --- 2. webpack ------------------------------------------------------------
const build = spawnSync('npx', ['webpack', '--mode', 'production'], {
    stdio: 'inherit',
    shell: true, // npx is a .cmd on Windows
    cwd: ROOT,
});
if (build.status !== 0) process.exit(build.status ?? 1);

// --- 3. release zip --------------------------------------------------------
mkdirSync(RELEASE, { recursive: true });
const zipPath = join(RELEASE, `vaultwares-identity-manager-v${version}.zip`);
rmSync(zipPath, { force: true }); // CreateFromDirectory refuses to overwrite

const q = s => `'${s.replaceAll("'", "''")}'`;
const psScript = [
    'Add-Type -AssemblyName System.IO.Compression.FileSystem',
    // includeBaseDirectory defaults to false: manifest.json sits at the zip
    // root, which is what both stores require. .NET Core writes entry names
    // with forward slashes, which is what AMO's unzip expects.
    `[System.IO.Compression.ZipFile]::CreateFromDirectory(${q(DIST)}, ${q(zipPath)})`,
].join('; ');

// pwsh first (PowerShell 7), fall back to Windows PowerShell.
let zipped = false;
for (const exe of ['pwsh', 'powershell.exe']) {
    const zip = spawnSync(exe, ['-NoProfile', '-Command', psScript], { cwd: ROOT });
    if (zip.status === 0) {
        zipped = true;
        break;
    }
    if (zip.error?.code === 'ENOENT') continue; // exe not installed, try next
    process.stderr.write(zip.stderr?.toString() ?? '');
    process.exit(zip.status ?? 1);
}
if (!zipped) {
    console.error('build: no PowerShell found to create the release zip');
    process.exit(1);
}

console.log(`build: packaged ${zipPath}`);
