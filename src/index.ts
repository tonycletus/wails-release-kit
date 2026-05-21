import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type InitOptions = {
  cwd: string;
  app: string;
  binary: string;
  repo?: string;
  modulePath?: string;
  mainBranch?: string;
};

export type InitResult = {
  files: string[];
};

export async function initWailsReleaseKit(options: InitOptions): Promise<InitResult> {
  const cwd = path.resolve(options.cwd);
  const app = options.app;
  const binary = options.binary;
  const mainBranch = options.mainBranch ?? "main";
  const repo = options.repo ?? "<owner>/<repo>";
  const slug = slugify(app);
  const artifactName = app.replaceAll(/[^a-zA-Z0-9]+/g, "");
  const files = [
    [".github/workflows/desktop-release.yml", workflowTemplate({ app, artifactName, binary, slug, mainBranch })],
    ["installer/windows/App.iss", innoSetupTemplate({ app, artifactName, binary })],
    ["scripts/prepare-windows-icon-resource.ps1", windowsIconResourceScript(app)],
    ["RELEASE-DOWNLOADS.md", downloadsDocTemplate({ artifactName, repo, slug })],
  ] as const;

  for (const [file, content] of files) {
    const target = path.join(cwd, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }

  return { files: files.map(([file]) => path.join(cwd, file)) };
}

export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

function workflowTemplate({
  app,
  artifactName,
  binary,
  slug,
  mainBranch,
}: {
  app: string;
  artifactName: string;
  binary: string;
  slug: string;
  mainBranch: string;
}): string {
  return `name: Desktop Release

on:
  workflow_dispatch:
  push:
    branches:
      - ${mainBranch}

permissions:
  contents: write

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

jobs:
  build:
    name: Build \${{ matrix.name }}
    runs-on: \${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        include:
          - name: windows-amd64
            os: windows-latest
            goos: windows
            goarch: amd64
            binary: ${binary}.exe
            stable_artifact: ${artifactName}Setup.exe
            versioned_suffix: Setup.exe
            build_tags: desktop,production
          - name: macos-arm64
            os: macos-latest
            goos: darwin
            goarch: arm64
            binary: ${binary}
            stable_artifact: ${artifactName}-macos-arm64.dmg
            versioned_suffix: macos-arm64.dmg
            build_tags: desktop,production
          - name: linux-amd64
            os: ubuntu-24.04
            goos: linux
            goarch: amd64
            binary: ${binary}
            stable_artifact: ${slug}-linux-amd64.deb
            versioned_suffix: linux-amd64.deb
            build_tags: desktop,production,webkit2_41

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.23"
          cache: true
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install Linux dependencies
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y build-essential libgtk-3-dev libwebkit2gtk-4.1-dev

      - run: npm ci
      - run: npm run build:desktop

      - name: Read version
        id: version
        shell: bash
        run: |
          VERSION="$(node -p 'require("./package.json").version')"
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"

      - name: Prepare Windows icon resource
        if: runner.os == 'Windows'
        shell: pwsh
        run: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare-windows-icon-resource.ps1

      - name: Build desktop binary
        shell: bash
        run: |
          mkdir -p build/bin
          if [ "\${{ runner.os }}" = "Windows" ]; then
            go build -tags "\${{ matrix.build_tags }}" -ldflags "-H windowsgui -w -s" -o "build/bin/\${{ matrix.binary }}" .
          elif [ "\${{ runner.os }}" = "macOS" ]; then
            export CGO_LDFLAGS="\${CGO_LDFLAGS:-} -framework UniformTypeIdentifiers"
            go build -tags "\${{ matrix.build_tags }}" -ldflags "-w -s" -o "build/bin/\${{ matrix.binary }}" .
          else
            go build -tags "\${{ matrix.build_tags }}" -ldflags "-w -s" -o "build/bin/\${{ matrix.binary }}" .
          fi
        env:
          GOOS: \${{ matrix.goos }}
          GOARCH: \${{ matrix.goarch }}
          CGO_ENABLED: "1"

      - name: Package Windows installer
        if: runner.os == 'Windows'
        shell: pwsh
        run: |
          choco install innosetup --yes --no-progress
          $version = (node -p "require('./package.json').version").Trim()
          & "$env:ProgramFiles(x86)\\Inno Setup 6\\ISCC.exe" "/DMyAppVersion=$version" installer/windows/App.iss
          Copy-Item "build/installer/${artifactName}Setup.exe" "build/bin/\${{ matrix.stable_artifact }}" -Force
          Copy-Item "build/installer/${artifactName}Setup.exe" "build/bin/${artifactName}-\${{ steps.version.outputs.version }}-\${{ matrix.versioned_suffix }}" -Force

      - name: Package macOS dmg
        if: runner.os == 'macOS'
        run: |
          VERSION="\${{ steps.version.outputs.version }}"
          APP_DIR="build/${app}.app"
          mkdir -p "$APP_DIR/Contents/MacOS" "$APP_DIR/Contents/Resources"
          cp "build/bin/\${{ matrix.binary }}" "$APP_DIR/Contents/MacOS/${binary}"
          chmod +x "$APP_DIR/Contents/MacOS/${binary}"
          cat > "$APP_DIR/Contents/Info.plist" <<PLIST
          <?xml version="1.0" encoding="UTF-8"?>
          <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
          <plist version="1.0"><dict>
            <key>CFBundleDisplayName</key><string>${app}</string>
            <key>CFBundleExecutable</key><string>${binary}</string>
            <key>CFBundleIdentifier</key><string>app.${slug}.desktop</string>
            <key>CFBundleName</key><string>${app}</string>
            <key>CFBundlePackageType</key><string>APPL</string>
            <key>CFBundleShortVersionString</key><string>$VERSION</string>
            <key>CFBundleVersion</key><string>$VERSION</string>
          </dict></plist>
          PLIST
          codesign --force --deep --sign - "$APP_DIR"
          DMG_ROOT="build/dmg-root"
          mkdir -p "$DMG_ROOT"
          cp -R "$APP_DIR" "$DMG_ROOT/${app}.app"
          ln -s /Applications "$DMG_ROOT/Applications"
          hdiutil create -volname "${app}" -srcfolder "$DMG_ROOT" -ov -format UDZO "build/bin/\${{ matrix.stable_artifact }}"
          cp "build/bin/\${{ matrix.stable_artifact }}" "build/bin/${artifactName}-$VERSION-\${{ matrix.versioned_suffix }}"

      - name: Package Linux deb
        if: runner.os == 'Linux'
        run: |
          VERSION="\${{ steps.version.outputs.version }}"
          PKGROOT="build/linux-deb"
          mkdir -p "$PKGROOT/DEBIAN" "$PKGROOT/usr/bin" "$PKGROOT/usr/share/applications"
          cp "build/bin/\${{ matrix.binary }}" "$PKGROOT/usr/bin/${slug}"
          chmod 755 "$PKGROOT/usr/bin/${slug}"
          cat > "$PKGROOT/usr/share/applications/${slug}.desktop" <<DESKTOP
          [Desktop Entry]
          Type=Application
          Name=${app}
          Exec=/usr/bin/${slug}
          Terminal=false
          Categories=Utility;Network;
          DESKTOP
          cat > "$PKGROOT/DEBIAN/control" <<CONTROL
          Package: ${slug}
          Version: $VERSION
          Section: utils
          Priority: optional
          Architecture: amd64
          Maintainer: ${app}
          Depends: libgtk-3-0, libwebkit2gtk-4.1-0
          Description: ${app} desktop app
           Desktop app built with Wails.
          CONTROL
          dpkg-deb --build "$PKGROOT" "build/bin/\${{ matrix.stable_artifact }}"
          cp "build/bin/\${{ matrix.stable_artifact }}" "build/bin/${artifactName}-$VERSION-\${{ matrix.versioned_suffix }}"

      - uses: actions/upload-artifact@v4
        with:
          name: \${{ matrix.name }}
          if-no-files-found: error
          path: |
            build/bin/\${{ matrix.stable_artifact }}
            build/bin/${artifactName}-\${{ steps.version.outputs.version }}-\${{ matrix.versioned_suffix }}

  release:
    runs-on: ubuntu-24.04
    needs: build
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - uses: actions/download-artifact@v4
        with:
          path: release-assets
          merge-multiple: true
      - name: Create or update release
        env:
          GH_TOKEN: \${{ github.token }}
        run: |
          set -euo pipefail
          VERSION="$(node -p 'require("./package.json").version')"
          TAG="v$VERSION"
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git tag -f "$TAG" "$GITHUB_SHA"
          git push origin "refs/tags/$TAG" --force
          gh release view "$TAG" >/dev/null 2>&1 || gh release create "$TAG" --title "${app} $TAG" --notes "Automated desktop release."
          gh release upload "$TAG" release-assets/* --clobber
`;
}

function innoSetupTemplate({ app, artifactName, binary }: { app: string; artifactName: string; binary: string }): string {
  return `#define MyAppName "${app}"
#ifndef MyAppVersion
#define MyAppVersion "0.1.0"
#endif
#define MyAppExeName "${binary}.exe"

[Setup]
AppId={{${app}-desktop}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
DefaultDirName={autopf}\\{#MyAppName}
DefaultGroupName={#MyAppName}
OutputDir=..\\..\\build\\installer
OutputBaseFilename=${artifactName}Setup
Compression=lzma
SolidCompression=yes
SetupIconFile=app.ico
UninstallDisplayIcon={app}\\{#MyAppExeName}

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "..\\..\\build\\bin\\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "app.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\\{#MyAppName}"; Filename: "{app}\\{#MyAppExeName}"; IconFilename: "{app}\\app.ico"
Name: "{userdesktop}\\{#MyAppName}"; Filename: "{app}\\{#MyAppExeName}"; IconFilename: "{app}\\app.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#MyAppName}}"; Flags: nowait postinstall skipifsilent
`;
}

function windowsIconResourceScript(app: string): string {
  return `$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
npx --yes @tonycletus/app-icon-pipeline --input (Join-Path $repoRoot "public\\icon-512.png") --out (Join-Path $repoRoot "public") --name "${app}" --ico (Join-Path $repoRoot "installer\\windows\\app.ico")
$rsrc = Get-Command rsrc -ErrorAction SilentlyContinue
if (-not $rsrc) {
  go install github.com/akavel/rsrc@v0.10.2
  $env:Path = "$((go env GOPATH))\\bin;$env:Path"
  $rsrc = Get-Command rsrc -ErrorAction Stop
}
& $rsrc.Source -ico (Join-Path $repoRoot "installer\\windows\\app.ico") -o (Join-Path $repoRoot "rsrc_windows_amd64.syso")
`;
}

function downloadsDocTemplate({ artifactName, repo, slug }: { artifactName: string; repo: string; slug: string }): string {
  return `# Release Download URLs

Stable latest URLs:

- Windows: https://github.com/${repo}/releases/latest/download/${artifactName}Setup.exe
- macOS: https://github.com/${repo}/releases/latest/download/${artifactName}-macos-arm64.dmg
- Linux: https://github.com/${repo}/releases/latest/download/${slug}-linux-amd64.deb
`;
}
