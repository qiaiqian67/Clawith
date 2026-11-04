# Releasing the ZeroX desktop client

This file explains the two things a release needs that are not in the code: a
certificate, and a place to put the builds. Both are optional for an install
that a user runs, and both matter for an install that just works.

## What a user sees

| The build | Windows | macOS | Linux |
| --- | --- | --- | --- |
| Unsigned | "Unknown publisher", and SmartScreen asks to confirm | The app is blocked; the user must right-click, then Open | The app runs |
| Signed | The publisher name, no warning | The app opens | The app runs |

An unsigned build is not broken. It installs and runs. Every user sees one
extra warning, and macOS needs one extra step.

## The certificate

A certificate is a paid identity from a signing authority. It says who made
the program, and the system believes it.

**Windows.** A code signing certificate from an authority such as DigiCert,
Sectigo, GlobalSign, or SSL.com. An EV certificate removes the SmartScreen
warning at once. A standard one needs a few hundred downloads before the
reputation clears the warning.

**macOS.** An Apple Developer Program membership, which costs $99 a year.

Buy them under the name you want the user to see. The name on the certificate
is the publisher name in the warning.

## Signing a build

`electron-builder` reads the certificate from the environment, so nothing
about it goes into the repository.

### Windows

```powershell
$env:CSC_LINK = 'C:\path\to\certificate.pfx'
$env:CSC_KEY_PASSWORD = 'the-password-of-the-pfx'
node scripts/package.mjs --win
```

### macOS

```bash
export CSC_LINK=/path/to/DeveloperIDApplication.p12
export CSC_KEY_PASSWORD='the-password-of-the-p12'
export APPLE_ID='you@example.com'
export APPLE_APP_SPECIFIC_PASSWORD='abcd-efgh-ijkl-mnop'
export APPLE_TEAM_ID='ABCDE12345'
node scripts/package.mjs --mac
```

The three Apple values notarize the build: Apple scans it and stamps it, and
a Mac opens it with a double-click. Without them the build is signed but not
notarized, and a Mac still asks the user to allow it.

## The update feed

The update feed is a place on the network that holds the builds and one small
file that names the newest version. The client reads that file, and downloads
a new build when there is one.

The client needs no feed to work. Without one it never updates itself, and the
user installs a new version by hand.

### What the feed holds

```
latest.yml                     the newest version, for Windows
latest-mac.yml                 the newest version, for macOS
latest-linux.yml               the newest version, for Linux
ZeroX-1.0.0-x64.exe            the installer
ZeroX-1.0.0-x64.exe.blockmap   the difference from the last version
ZeroX-1.0.0.dmg                the image, for macOS
ZeroX-1.0.0.AppImage           the image, for Linux
```

`electron-builder` writes these files next to the installer. Upload all of
them to one directory.

### Where the feed lives

Any static file host that serves those files over HTTPS. There is no server
to write:

- A bucket on Amazon S3, Cloudflare R2, or Google Cloud Storage behind a
  public HTTPS address.
- A directory on the same server that runs ZeroX, served by nginx.
- GitHub Releases, which is free for a public repository.

### Pointing the client at the feed

Set `ZEROX_UPDATE_URL` before the package:

```powershell
$env:ZEROX_UPDATE_URL = 'https://releases.example.com/desktop'
node scripts/package.mjs --win
```

The address is written into the build. A later release with a different
address is a new install, not an update.

### Publishing a release

1. Raise `version` in `package.json`.
2. Build with `ZEROX_UPDATE_URL` set.
3. Upload every file of `dist/` that the summary above names to the feed.
4. The clients that run the previous version offer the new one on their next
   start.

## Without any of this

The client still installs and works. Run:

```bash
node scripts/package.mjs
```

The script says which files it made, and which of the two pieces above are
missing from this build.
