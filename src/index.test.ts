import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { initWailsReleaseKit, slugify } from "./index";

describe("wails-release-kit", () => {
  it("slugifies app names", () => {
    expect(slugify("Peer Drift Pro")).toBe("peer-drift-pro");
  });

  it("writes release kit files", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "wails-release-kit-"));
    try {
      const result = await initWailsReleaseKit({
        cwd: dir,
        app: "PeerDrift",
        binary: "PeerDrift",
        repo: "tonycletus/peerdrift",
      });
      expect(result.files.length).toBeGreaterThan(3);
      const workflow = await readFile(path.join(dir, ".github/workflows/desktop-release.yml"), "utf8");
      expect(workflow).toContain("UniformTypeIdentifiers");
      expect(workflow).toContain("PeerDriftSetup.exe");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
