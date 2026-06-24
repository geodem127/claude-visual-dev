# Claude Visual Dev — VS Code Extension Design

**Date:** 2026-06-24  
**Status:** Approved

---

## Overview

A VS Code extension that enables visual development with Claude. Users connect a live app preview, select UI elements with annotation mode, describe changes in natural language, and Claude generates a variant branch they can preview and apply — all without leaving VS Code.

---

## Architecture

### Two-Layer Design

**Extension Host (Node.js / privileged)**
Runs in VS Code's Node.js process. Handles all privileged operations:
- Workspace file reads and writes
- Claude API calls via `@anthropic-ai/sdk`
- Dev server URL proxying (to resolve iframe CORS)
- Git branch creation and file staging (`claude/variant-<timestamp>`)
- Puppeteer for webpage screenshots (URL-based design references)
- Figma REST API calls (design reference fetch + screenshot)
- Typed message bus: receives commands from webview, replies with results

**Webview UI (React + TypeScript)**
A single `WebviewPanel` renders the full 3-panel layout. Built with Vite, bundled to static assets loaded by the extension. Manages UI state with Zustand. All host communication goes through `vscode.postMessage` / `window.addEventListener('message')`.

### Message Protocol

All cross-boundary calls use typed commands:

```ts
// Webview → Host
{ type: 'CLAUDE_CHAT', id: string, payload: { messages, context } }
{ type: 'FETCH_FIGMA', id: string, payload: { url } }
{ type: 'SCREENSHOT_URL', id: string, payload: { url } }
{ type: 'PREVIEW_VARIANT', id: string, payload: { element, instruction, files } }
{ type: 'APPLY_BRANCH', id: string, payload: { branch } }
{ type: 'DISCARD_BRANCH', id: string, payload: { branch } }
{ type: 'READ_FILE', id: string, payload: { path } }
{ type: 'OPEN_FILE', id: string, payload: { path, line? } }

// Host → Webview
{ type: 'RESPONSE', id: string, result: any }
{ type: 'ERROR', id: string, error: string }
{ type: 'STREAM_CHUNK', id: string, chunk: string }  // for Claude streaming
```

---

## Left Panel

Vertical stack of 4 collapsible sections.

### 1. Design Reference Input
Two sub-tabs:
- **Figma Link** — text input; host calls Figma REST API (`/v1/files/:key`, `/v1/images/:key`) to fetch file metadata and export a screenshot. Stored as base64 in webview state.
- **Upload / URL** — file picker (JPG, PNG, PDF) or URL field; URL triggers host Puppeteer screenshot. Image stored as base64.

Captured image is sent as a vision attachment (base64 `image` content block) in subsequent Claude messages.

### 2. File Attach
Drop zone + file picker scoped to the workspace. Selected files are read by the host (`READ_FILE`) and included as text context in the next Claude message. Shows a list of attached files with remove buttons.

### 3. Claude Chat
Scrollable message thread with a textarea input and send button. Supports streaming responses (host streams `STREAM_CHUNK` messages as Claude responds).

**Pinned Element Context:** When an element is selected in the center panel, a dismissible chip appears above the input showing `ComponentName — src/path/to/file.tsx`. This context is automatically prepended to the next outgoing message. Dismissing the chip removes it from context without deselecting the element.

### 4. Workspace File Tree (collapsed by default)
Shallow file browser scoped to workspace root. Click to attach a file to the current context.

---

## Center Panel

### Toolbar
- URL input field (dev server address, e.g. `localhost:3000`)
- Refresh button
- Viewport size selector (Desktop 1440 / Tablet 768 / Mobile 375)
- Annotation Mode toggle (highlights elements on hover, captures on click)

### Live Preview Tab
An `<iframe>` loading the configured dev server URL. The host proxies the URL to resolve CORS issues.

**Annotation Mode (when toggled on):**
The webview sends a `postMessage` to the iframe to inject a lightweight overlay script. This script:
- Adds a hover highlight border to DOM elements
- On click, captures: CSS selector, component display name (from `__reactFiber` if available), bounding box, computed styles (color, font, spacing, layout), and source file path (from source maps or React fiber `_debugSource`)
- Posts the captured element data back to the parent webview via `postMessage`
- The selected element data updates the right panel and optionally pins context in the left panel chat

### Claude Output Tab (appears when a variant is staged)
Shows the Claude-generated variant. Toggle between:
- **Rendered** — static HTML render of the generated component
- **Diff** — side-by-side code diff (original vs. generated)

### Branch Banner
Slim bar at top of panel when a variant branch is active:
- Branch name (`claude/variant-1719235200`)
- **Compare** button (opens diff view in Claude Output tab)
- **Apply** button (calls `APPLY_BRANCH`)
- **Discard** button (calls `DISCARD_BRANCH`)

---

## Right Panel

### Selected Element Header
- Component display name (bold)
- File path (clickable link → `OPEN_FILE` to VS Code editor)
- DOM selector (monospace, truncated)
- Clears when annotation mode is toggled off

### Properties Inspector
Editable key-value list showing:
- Computed CSS properties: color, background, font-size, font-weight, padding, margin, border, border-radius, display, flex properties
- React props (if available from fiber): prop name → value, read-only

Changes in the inspector do not auto-apply — they are queued into the instruction box below as a structured prefix.

### Comment & Instruction Box
Textarea pre-populated with selected element context when an element is pinned. User types their change request here. On submit this becomes the Claude prompt.

Example pre-populated content:
```
Element: PrimaryButton (src/components/PrimaryButton.tsx)
Selector: #app > main > .hero > button.primary

Instruction: [user types here]
```

### Controls
- **Preview Variant** — sends element context + instruction + attached files to Claude via `PREVIEW_VARIANT`. Host creates branch `claude/variant-<timestamp>`, writes generated file, posts branch name back. Center panel switches to Claude Output tab.
- **Apply** — sends `APPLY_BRANCH`. Host copies variant file to current branch, deletes variant branch.
- **Discard** — sends `DISCARD_BRANCH`. Host deletes variant branch. Center panel returns to Live Preview tab.

### Variant History (collapsed by default)
Session log of previous variants:
- Timestamp
- Element name
- Truncated instruction text
- Status: Applied / Discarded / Pending
- Click to restore a previous variant as the active staged branch

---

## Extension Settings (`package.json` contributes)

| Setting | Type | Default | Description |
|---|---|---|---|
| `claudeDev.claudeApiKey` | string | — | Anthropic API key |
| `claudeDev.figmaApiKey` | string | — | Figma personal access token |
| `claudeDev.defaultDevServerPort` | number | 3000 | Default iframe URL port |
| `claudeDev.claudeModel` | string | `claude-sonnet-4-6` | Model for chat and variant generation |

---

## Key Files (planned structure)

```
claude-dev/
├── src/
│   ├── extension.ts          # activation, WebviewPanel registration
│   ├── host/
│   │   ├── messageHandler.ts # routes webview commands to handlers
│   │   ├── claudeClient.ts   # Anthropic SDK wrapper, streaming
│   │   ├── figmaClient.ts    # Figma REST API calls
│   │   ├── screenshotter.ts  # Puppeteer URL screenshot
│   │   ├── gitClient.ts      # branch create/apply/discard via simple-git
│   │   └── fileSystem.ts     # workspace file read/write
│   └── webview/
│       ├── main.tsx           # React entry
│       ├── store.ts           # Zustand global state
│       ├── components/
│       │   ├── LeftPanel/
│       │   ├── CenterPanel/
│       │   └── RightPanel/
│       └── bridge.ts          # typed postMessage wrapper
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Error Handling

- Claude API errors: streamed error message shown inline in chat thread
- Figma API auth failure: inline error in design reference input with link to settings
- Iframe load failure: center panel shows error state with retry button and URL field
- Git branch conflict: host returns error, banner shows warning with manual resolution prompt
- Puppeteer timeout: falls back to a "could not capture screenshot" message with retry

---

## Out of Scope (v1)

- Multi-file variant generation (variants modify only the single selected component file)
- Real-time collaborative annotation
- Publishing variants as PRs automatically
- Non-git workspaces (git is required for branch-based variant flow)
