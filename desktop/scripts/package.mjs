/**
 * Build the installer of the client.
 *
 * The script builds the bundle, packages it for this system, and says what a
 * signed install needs. It prints the files it made, so a release does not
 * depend on knowing where electron-builder puts them.
 *
 *   node scripts/package.mjs            # an installer for this system
 *   node scripts/package.mjs --dir      # the unpacked directory, no installer
 *   node scripts/package.mjs --win      # an installer for Windows
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const args = process.argv.slice(2);
const wantDir = args.includes('--dir');
const target = args.includes('--win')
  ? ['--win', '--x64']
  : args.includes('--mac')
    ? ['--mac']
    : args.includes('--linux')
      ? ['--linux']
      : [];

/** Run one command in the client directory, and stop when it fails. */
function run(command, commandArgs, extraEnv) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...(extraEnv ? { env: extraEnv } : {}),
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

// 1. The bundle.
run('npm', ['run', 'build']);

// 2. The package.
//
// The builder keeps its own cache, so a build that follows another one on
// the same computer needs the network only once. The electron binary is
// named here, so the builder does not look for it and does not download it
// again.
// The binaries come from the mirror. The default address is slow on this
// network and times out, and a build that cannot fetch the electron binary
// makes no package at all.
const env = {
  ...process.env,
  ELECTRON_MIRROR: process.env.ELECTRON_MIRROR ?? 'https://npmmirror.com/mirrors/electron/',
  ELECTRON_BUILDER_BINARIES_MIRROR:
    process.env.ELECTRON_BUILDER_BINARIES_MIRROR ??
    'https://npmmirror.com/mirrors/electron-builder-binaries/',
};

run('npx', ['electron-builder', ...target, ...(wantDir ? ['--dir'] : [])], env);

// 3. What the build made, and what a signed install would need.
const dist = join(root, 'dist');
const artifacts = existsSync(dist)
  ? readdirSync(dist)
      .filter((name) => {
        const path = join(dist, name);
        // A blockmap is a part of an installer, and a yml is the feed itself.
        if (name.endsWith('.blockmap') || name.endsWith('.yml') || name.endsWith('.yaml')) {
          return false;
        }
        // Only an installer or an image is a release artifact.
        if (!/\.(exe|dmg|zip|AppImage|deb|rpm)$/i.test(name)) {
          return false;
        }
        return statSync(path).isFile();
      })
      .map((name) => ({ name, size: statSync(join(dist, name)).size }))
  : [];

const signed =
  Boolean(process.env.CSC_LINK) ||
  Boolean(process.env.APPLE_ID) ||
  Boolean(process.env.WIN_CSC_LINK);

console.log('');
console.log('Build finished.');
for (const artifact of artifacts) {
  console.log(`  dist/${artifact.name}  ${(artifact.size / (1024 * 1024)).toFixed(1)} MB`);
}
if (!signed) {
  console.log('');
  console.log('This build is not signed.');
  console.log('  Windows shows "Unknown publisher" and SmartScreen warns before the install.');
  console.log('  macOS refuses to open it without a right-click, then Open.');
  console.log('To sign, set CSC_LINK and CSC_KEY_PASSWORD (and APPLE_ID,');
  console.log('APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID to notarize on macOS).');
  console.log('See RELEASING.md.');
}
if (!process.env.ZEROX_UPDATE_URL) {
  console.log('');
  console.log('No ZEROX_UPDATE_URL is set, so this build cannot update itself.');
  console.log('The client still installs and works. See RELEASING.md.');
}
