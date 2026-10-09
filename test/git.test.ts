import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseStatus, readStatus, segments } from "../src/git.js";

const text = (s: ReturnType<typeof segments>) => s?.map((p) => p.text).join("");

describe("parseStatus", () => {
  it("reads branch, ahead/behind, conflicts and changes", () => {
    const s = parseStatus(["# branch.oid aabbccddeeff", "# branch.head feat/x", "# branch.ab +2 -3",
      "u UU N... 1 1 1 1 a b c f", "? new", ""].join("\n"));
    expect(s).toEqual({ branch: "feat/x", worktree: false, conflicts: 1, dirty: true, ahead: 2, behind: 3 });
  });
  it("names a detached head by its commit", () => {
    expect(parseStatus("# branch.oid aabbccddeeff\0# branch.head (detached)\0").branch).toBe("detached:aabbccd");
  });
  it("skips a rename's source field under -z", () => {
    const s = parseStatus("# branch.head main\0" + "2 R. N... 1 1 1 a b R100 new\0u odd-source-name\0");
    expect(s.conflicts).toBe(0);
    expect(s.dirty).toBe(true);
  });
});

describe("segments", () => {
  it("renders the shared format with colors", () => {
    const s = segments({ branch: "feat/x", worktree: true, conflicts: 2, dirty: true, ahead: 1, behind: 3 });
    expect(text(s)).toBe("wt feat/x ✖2 ● ↑1 ↓3");
    expect(s?.filter((p) => p.color && p.color !== "text").map((p) => p.color)).toEqual(["textMuted", "error", "warning", "success", "error"]);
  });
  it("shows a clean branch alone, and nothing outside a repository", () => {
    expect(text(segments({ branch: "main", worktree: false, conflicts: 0, dirty: false, ahead: 0, behind: 0 }))).toBe("main");
    expect(segments(undefined)).toBeUndefined();
  });
});

describe("readStatus", () => {
  it("reads a real checkout and its linked worktree", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "ogs-"));
    try {
      expect(await readStatus(dir)).toBeUndefined();
      const repo = path.join(dir, "repo");
      execFileSync("git", ["init", "-q", "-b", "main", repo]);
      execFileSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "i"]);
      writeFileSync(path.join(repo, "f"), "x");
      expect(text(segments(await readStatus(repo)))).toBe("main ●");
      execFileSync("git", ["-C", repo, "worktree", "add", "-q", "-b", "feat", path.join(dir, "wt")]);
      expect(text(segments(await readStatus(path.join(dir, "wt"))))).toBe("wt feat");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
