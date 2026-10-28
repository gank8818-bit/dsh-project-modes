# DSH Project Modes — a toolset + workflow picker for DeepSeek Harness

A small plugin for [DeepSeek Harness (DSH)](https://www.npmjs.com/package/@deepseek-ai/dsh) web that adds a
compact **`General · Plan ▾`** button beside the prompt box. Open it to choose:

- **Toolset** — which tool families the agent may load: General, Video gen, Video editing, AI CAD,
  PPT / Office, Images / SVG / PDF, Web / UX / 3D, Research, Desktop, All tools.
- **Workflow** — Research → Plan → Act, Plan → Act (default), Act, or Research → Ask → Plan → Act.

Selections belong to the current chat, persist across restarts, and can change between responses.

## Why

Large MCP installs register hundreds of tools (one Premiere connector alone exposes 400+). Sending every
schema on every request wastes context and confuses the model. Project Modes:

- **masks the host tool registry** per session so only the chosen family's tools reach the model;
- adds a **guard** that blocks hidden tools even through nested dispatch;
- strips unrelated tool/MCP instructions from the assembled system prompt;
- gives the agent two tools: `project_stage` (record a plan estimate, advance exactly one stage with a
  revision check) and `project_tools` (search every installed tool without loading schemas, inspect up to
  3, enable up to 8 per request with a rolling cap of 12 extras, disable/clear);
- keeps **Research / Ask / Plan** stages read-only (shell for inspection only; desktop control limited to
  observation) and unlocks writes in **Act**.

Sandbox, approvals, authentication and desktop STOP policies are untouched — the plugin only narrows
what the model sees.

## Install (DSH 0.2.x web profile)

```sh
git clone https://github.com/gank8818-bit/dsh-project-modes ~/.dsh/plugins/dsh-project-modes
cd ~/.dsh/plugins/dsh-project-modes
ln -s "$(npm root -g)/@deepseek-ai/dsh/node_modules" node_modules   # reuse DSH's own dependencies
npm test && npm run build      # prints build-manifest.json with the versioned runtime path
```

Then link it into the web profile and point a loader entry at the built runtime:

```jsonc
// ~/.dsh/profiles/web/package.json → dependencies
"dsh-project-modes": "link:/ABSOLUTE/PATH/.dsh/plugins/dsh-project-modes"
```
```yaml
# ~/.dsh/profiles/web/cordis.patch.yml — add an insert entry whose `name` is the "runtime" path
# printed by `npm run build` (lib/<version>-<digest>/index.js). Restart `dsh web`, then refresh the page.
```

The build writes an immutable, content-addressed runtime under `lib/` so a profile reload never reuses
stale modules. Edit `client.source.js` (not the generated `client.js`).

State lives in `~/.dsh/project-modes/state.json`. Uninstall by removing the profile row and dependency.

## Files

| File | Role |
|---|---|
| `index.js` | host plugin: registry masks, guard, prompt assembly filter, `project_stage`, `project_tools`, `/api/project-modes` |
| `policy.js` | toolsets, workflows, stage rules, guidance text (pure functions, unit-tested) |
| `families.js` | tool-family routing by name pattern (Premiere, 剪映, Canva, CAD, …) |
| `client.source.js` | the React picker injected into `conversation.input.left` |
| `scripts/build.mjs` | validates the client and writes the versioned runtime |

## License

MIT. Not affiliated with DeepSeek.
