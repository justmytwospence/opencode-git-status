// The checkout's git status, in the format the shell prompt and the other agent footers
// share: `[wt ]<branch> ✖N ● ↑N ↓N`.
//
//   wt   a linked worktree (dim)
//   ✖N   N unmerged (conflicted) paths (error)
//   ●    anything staged, modified or untracked (warning)
//   ↑N   commits ahead of upstream (success)
//   ↓N   commits behind upstream (error)

import { execFile } from "node:child_process";

export interface GitStatus {
  branch: string;
  worktree: boolean;
  conflicts: number;
  dirty: boolean;
  ahead: number;
  behind: number;
}

/** A run of text in the status line; `color` names a theme color, or the line's own when absent. */
export interface Segment {
  text: string;
  color?: "text" | "error" | "warning" | "success" | "textMuted";
}

/** Parse `git status --porcelain=v2 --branch` (newline- or NUL-separated). */
export function parseStatus(output: string, worktree = false): GitStatus {
  const status: GitStatus = { branch: "", worktree, conflicts: 0, dirty: false, ahead: 0, behind: 0 };
  let oid = "";
  const records = output.split(/[\n\0]/);
  for (let i = 0; i < records.length; i++) {
    const line = records[i];
    if (line.startsWith("# branch.head ")) status.branch = line.slice(14);
    else if (line.startsWith("# branch.oid ")) oid = line.slice(13, 20);
    else if (line.startsWith("# branch.ab ")) {
      const match = /\+(\d+) -(\d+)/.exec(line);
      if (match) { status.ahead = +match[1]; status.behind = +match[2]; }
    } else if (line.startsWith("u ")) status.conflicts++;
    else if (/^[12?] /.test(line)) {
      status.dirty = true;
      if (line[0] === "2" && output.includes("\0")) i++; // -z puts a rename's source in its own field.
    }
  }
  if (status.branch === "(detached)") status.branch = `detached:${oid || "HEAD"}`;
  return status;
}

/** The status line's segments, separated by single spaces. */
export function segments(s: GitStatus | undefined): Segment[] | undefined {
  if (!s?.branch) return undefined;
  const parts: Segment[][] = [];
  if (s.worktree) parts.push([{ text: "wt", color: "textMuted" }]);
  parts.push([{ text: s.branch, color: "text" }]);
  if (s.conflicts) parts.push([{ text: `✖${s.conflicts}`, color: "error" }]);
  if (s.dirty) parts.push([{ text: "●", color: "warning" }]);
  if (s.ahead) parts.push([{ text: `↑${s.ahead}`, color: "success" }]);
  if (s.behind) parts.push([{ text: `↓${s.behind}`, color: "error" }]);
  return parts.flatMap((p, i) => (i ? [{ text: " " }, ...p] : p));
}

function git(cwd: string, args: string[]): Promise<string | undefined> {
  return new Promise((resolve) => {
    execFile("git", ["-C", cwd, ...args], { timeout: 10_000, maxBuffer: 16 * 1024 * 1024 }, (err, stdout) =>
      resolve(err ? undefined : stdout),
    );
  });
}

/** The status of the checkout at cwd; undefined outside a repository. */
export async function readStatus(cwd: string): Promise<GitStatus | undefined> {
  const gitDir = await git(cwd, ["rev-parse", "--absolute-git-dir"]);
  if (gitDir === undefined) return undefined;
  // --no-optional-locks: never take index.lock from under the agent.
  const out = await git(cwd, ["--no-optional-locks", "status", "--porcelain=v2", "--branch", "-z"]);
  if (out === undefined) return undefined;
  return parseStatus(out, /\/worktrees\/[^/]+\n?$/.test(gitDir.trim()));
}

export const sameStatus = (a: GitStatus | undefined, b: GitStatus | undefined): boolean =>
  JSON.stringify(a) === JSON.stringify(b);
