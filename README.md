# @tonycletus/wails-release-kit

Scaffold release automation for Go/Wails desktop apps.

This CLI creates the release files a Wails project usually needs when you want
GitHub Actions to build desktop installers for Windows, macOS, and Linux from
the same source repository.

It generates:

- GitHub Actions workflow for Windows `.exe` installer, macOS `.dmg`, Linux `.deb`
- Inno Setup script
- Windows icon resource script
- Stable latest release asset names for download pages
- Versioned release assets for traceability

## Install

```bash
npm install -D @tonycletus/wails-release-kit
pnpm add -D @tonycletus/wails-release-kit
yarn add -D @tonycletus/wails-release-kit
```

## Init a Wails project

```bash
npx wails-release-kit init --app "My App" --binary "my-app" --repo your-name/my-app
```

Run that command in the root of an existing Wails project. It writes:

- `.github/workflows/desktop-release.yml`
- `installer/windows/App.iss`
- `scripts/prepare-windows-icon-resource.ps1`
- `RELEASE-DOWNLOADS.md`

Then commit and push. Every push to `main` builds desktop packages and creates
or updates a GitHub Release for the current `package.json` version.

## Requirements

- A Wails v2 app written in Go
- Node.js 20 or newer
- A working `npm run build:desktop` script
- A `public/icon-512.png` source icon for Windows installer/icon generation
- GitHub Actions enabled on the repository

The generated workflow installs the operating system dependencies it needs on
GitHub-hosted runners.

## Stable Download URLs

Use these on your app's download page:

```text
https://github.com/<owner>/<repo>/releases/latest/download/<AppName>Setup.exe
https://github.com/<owner>/<repo>/releases/latest/download/<AppName>-macos-arm64.dmg
https://github.com/<owner>/<repo>/releases/latest/download/<app-name>-linux-amd64.deb
```

Each release also includes versioned assets so you can keep permanent links for
older builds.

## What It Does Not Do

This kit does not buy or configure code signing certificates. It also does not
complete Apple notarization for you. The generated workflow is intended as a
practical unsigned/community release baseline that you can extend when your app
needs commercial distribution requirements.

## Notes

Always review generated workflow files before publishing a production app. They
are meant to give you a strong starting point, not hide your release process.
