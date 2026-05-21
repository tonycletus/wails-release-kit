# @tonycletus/wails-release-kit

Scaffold release automation for Go/Wails desktop apps.

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
```

## Init a Wails project

```bash
wails-release-kit init --app PeerDrift --binary PeerDrift --repo tonycletus/peerdrift
```

Then commit and push. Every push to `main` will build desktop packages and
publish/update a GitHub Release for the current `package.json` version.

## Stable Download URLs

Use these on your app's download page:

```text
https://github.com/<owner>/<repo>/releases/latest/download/<AppName>Setup.exe
https://github.com/<owner>/<repo>/releases/latest/download/<AppName>-macos-arm64.dmg
https://github.com/<owner>/<repo>/releases/latest/download/<app-name>-linux-amd64.deb
```

## Notes

This kit does not yet handle paid code signing certificates or Apple
notarization. It produces unsigned/community release builds.
