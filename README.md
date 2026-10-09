# opencode-git-status

An opencode TUI plugin that shows the checkout's git status to the right of the
prompt, on the home screen and in sessions:

```
wt feat/x ✖2 ● ↑1 ↓3
```

| Mark | Color | Meaning |
| --- | --- | --- |
| `wt` | muted | a linked worktree |
| branch | text | or `detached:<sha7>` |
| `✖N` | error | N unmerged (conflicted) paths |
| `●` | warning | anything staged, modified or untracked |
| `↑N` | success | commits ahead of upstream |
| `↓N` | error | commits behind upstream |

It is the same format as the shell prompt, Claude Code statusline and pi footer
in [justmytwospence/dotfiles](https://github.com/justmytwospence/dotfiles), so a
checkout reads the same in every harness. Nothing shows outside a repository.

The status is re-read every 3 seconds, after each completed tool call and when a
turn ends. `git status` runs with `--no-optional-locks`, so it never takes
`index.lock` from under the agent.

## Install

TUI-only: list it in `~/.config/opencode/tui.jsonc`, pinned to a commit.

```jsonc
{
  "plugin": ["opencode-git-status@github:justmytwospence/opencode-git-status#<commit>"]
}
```

It renders before opencode-marimo and opencode-cache-guard in the same slot.

## Development

```sh
npm ci && npm run check
```
