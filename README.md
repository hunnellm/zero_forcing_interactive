# Zero Forcing on Graphs

This application aims to be an interface to allow the creation of and interaction with graphs.

# Features

## Coloring interaction

Click nodes to color or uncolor them. Hold **CTRL / ⌘** while clicking to also toggle all
neighbors of the clicked node.

### Step Forward / Step Back

- **Mode selector** — choose **Zero Forcing**, **PSD Zero Forcing**, or **Transmission Forcing**.
- **STEP** — applies one iteration of the selected forcing rule to the current colored set.
- **Step Back (⏮)** — undoes the last STEP, restoring the previous coloring state. Multiple steps
  can be undone in sequence.
- **Reset (↩)** — clears all colored nodes and the full step history at once.

In **Transmission Forcing**, each initially filled vertex starts at weight `1` and unfilled
vertices start at `0`. Eligible filled vertices transmit `alpha * current_weight` to their
eligible unfilled neighbor each step (same forcing eligibility as zero forcing), and a vertex
becomes filled once its weight is strictly greater than `beta`. Both `alpha` and `beta` are user
inputs constrained to `[0, 1]`.

## On-demand computation

The right-side **Analysis** panel now holds the two separate on-demand computation flows, leaving
the canvas toolbar focused on drawing and coloring actions. The panel can be collapsed, resized on
wider screens, and reopens with its last saved width.

- **Compute value** — computes the selected invariant only when clicked. The available
  value variants are **fault-tolerant**, **ProportionalZeroForcing**, and
  **maximum-nullity**.
- **Compute minimum sets** — computes minimum forcing sets for the selected
  **standard** or **psd** variant, reduced to one representative from each orbit under
  the automorphism group of the current graph.

Each analysis flow is shown as a compact accordion card. Card headers always expose the selected
variant, status, stale marker, elapsed runtime, and the current **Compute** / **Cancel** action.
Expand a card only when you need the detailed result body.

While a computation is running the app shows a spinner, elapsed time, and a **Cancel** button.
Results are cached for the current browser session by graph and selected variant, so re-running an
unchanged computation reuses the cached result.

For **maximum-nullity**, the current app uses the exact graph6 lookup from
`hunnellm/maximum-nullity`, so this computation is available for graphs on at most
8 vertices.

If the graph or selected variant changes after a computation finishes, the old result remains
visible with a **Stale** badge until you recompute it.

### Looped forcing & fort analysis (runs in your browser)

A third accordion card, **Looped forcing & fort analysis**, exposes the advanced zero forcing
algorithms from [`hunnellm/enhanced-zf`](https://github.com/hunnellm/enhanced-zf):

- **looped forcing** — the looped zero forcing number and minimum sets for a chosen loop
  configuration.
- **maximum looped** — the maximum looped zero forcing number over every possible loop
  configuration.
- **loop forts** — all loop forts and inclusion-minimal loop forts for a chosen loop
  configuration.
- **blocking sets** — the loop blocking number and minimum loop blocking sets.

Use the vertex checkboxes to choose which vertices carry a loop (not shown for **maximum
looped**, which searches over all configurations). Looped vertices are also highlighted on the
graph with a thicker, distinctly-coloured border and a small loop glyph.

These computations run **entirely in your browser** by default, in a background Web Worker (see
[In-browser analysis](#in-browser-analysis) below) - no separate server process is required for
normal use. They are exponential in the number of vertices, so the UI caps them at 20 vertices;
the **Compute** button is disabled with an explanatory warning above that size, and an
in-progress computation can be cancelled at any time. If a computation exceeds its in-browser
time budget (or a worker isn't available in your browser), the app automatically falls back to
the optional backend described in [Backend API](#backend-api); a warning is only shown if
*neither* is available.

### Minimum-set navigation

- Use **Previous** / **Next** inside the expanded minimum-sets card to step through the displayed representative sets.
- The app shows the current position as `Set i of N`.
- The active representative set is highlighted on the graph and its vertex IDs are
  listed textually below the controls.
- To keep the UI responsive, the app currently displays at most **50** representative
  sets per computation and shows a warning when truncation occurs.

## Draw Graph Mode

Click the **pencil icon (✏)** in the toolbar to enter Draw Graph mode.

- Click the canvas background to add a new isolated node.
- Click a node to select it as an edge source (highlighted with a secondary-colour ring).
- Click a second node to connect them with an edge.
- Click the selected source node again to cancel the selection.
- **Double-click a node** to delete it and all its incident edges.

Click the pencil icon again to return to normal coloring interaction.

The underlying adjacency matrix is updated automatically, so a newly drawn graph can be
inspected or exported via the **Generate Graph** tab in the right-side panel.

# Development

## Prerequisites

- Node 18.0.0
- NPM 8.6.0

Install dependencies with `npm i`. Start a local development server with `npm start`. That's it -
looped forcing, maximum looped forcing, and fort/blocking-set analysis all run in-browser; no
additional backend process is required for normal use (see below).

## In-browser analysis

Looped forcing, maximum looped forcing, loop forts, and loop blocking sets are computed
client-side by default:

- `src/lib/forcing/compute-core.js` — a pure, dependency-free JS port of the algorithms in
  `python/loop_zf.py` (no Node/server-only APIs), directly unit-testable and shared between the
  main thread and the worker below.
- `src/workers/forcing.worker.js` — runs `compute-core.js` in a Web Worker so the UI stays
  responsive, using a `{ id, op, payload }` → `{ id, ok, result | error }` message protocol with
  cooperative cancellation and a per-request timeout (20s by default).
- `src/lib/api.js` — the client used by the UI (`computeLoopedForcing`, etc.); it tries the
  worker first and transparently falls back to the backend API described below if a worker is
  unavailable, crashes, times out, or reports a computation error. Cancelling a computation (e.g.
  navigating away or pressing **Cancel**) stops the worker cooperatively and never triggers a
  backend fallback.

These are exponential brute-force algorithms, so the same 20-vertex cap and cancellation UI
apply regardless of which transport ends up handling a given request (see
[Looped forcing & fort analysis](#looped-forcing--fort-analysis-runs-in-your-browser) above).

Set `REACT_APP_FORCE_BACKEND=true` at build time (see `sample.env`) to always use the backend
API instead of the in-browser worker - useful for debugging or verifying parity between the two
implementations.

## Backend API (optional)

The backend is an optional fallback: a small Express server (`server.js`) that wraps a vendored,
trimmed-down copy of the [`hunnellm/enhanced-zf`](https://github.com/hunnellm/enhanced-zf) Python
library (`python/loop_zf.py`, invoked via `python/cli.py`) and exposes the same looped forcing /
maximum looped forcing / loop fort / loop blocking-set computations over HTTP. The frontend only
calls it when the in-browser worker is unavailable, fails, or times out (see
[In-browser analysis](#in-browser-analysis) above) - most users never need to run it.

Requires Python 3 (no third-party packages) on the `PATH` as `python3`.

Start the backend with:

```
npm run server
```

It listens on port `5051` by default (override with the `FORCING_API_PORT` environment
variable) and exposes:

- `GET /api/forcing/health` — basic health check.
- `POST /api/forcing/looped` — looped zero forcing number + minimum sets.
- `POST /api/forcing/maximum-looped` — maximum looped zero forcing number over all loop
  configurations.
- `POST /api/forcing/forts` — loop forts and minimal loop forts.
- `POST /api/forcing/blocking-sets` — loop blocking number and minimum blocking sets.

Each `POST` endpoint accepts a JSON body with an `adjacencyMatrix` (square, symmetric, binary,
at most 20 vertices) and, where applicable, a `loopedVertices` array of vertex indices; it
returns `{ result, meta }` on success or `{ error }` on failure.

During local development, run the backend (`npm run server`) alongside the frontend
(`npm start`) if you want to exercise or force the fallback path; the webpack dev server proxies
`/api` requests to the backend automatically. In production, set the `FORCING_API_BASE_URL`
environment variable at build time to point the frontend at a separately deployed backend's base
URL (leave unset for same-origin deployments, or if you don't intend to run a backend at all).

## Graph input

The graph input panel supports two modes:
- **Adjacency Matrix** (existing behavior)
- **graph6 String**

Select the mode in the Matrix tab, paste your input, then click **Generate Graph**.

Example graph6 input:
- `Dhc` (cycle graph on 5 vertices)

## Download / Export

### Download as PNG

Click the **download icon (⬇)** in the toolbar to save the current canvas view as a `.png` file.

### Download as TikZ (.tex)

Click the **code icon (`</>`)** in the toolbar to export the current graph as a TikZ picture
saved to `graph.tex`.

The exported file contains a `tikzpicture` environment with:

- One `\node` per vertex, positioned to reflect the on-screen layout (y-axis inverted for TikZ).
- `fill=filledcolor` applied to any colored (filled) nodes; `fill=white` for uncolored nodes.
- `\definecolor{filledcolor}{HTML}{…}` definitions at the top so the file compiles standalone.
- LaTeX-safe escaping of any special characters in node labels.

Include the file in a LaTeX document with:

```latex
\usepackage{tikz}
\input{graph.tex}
```

or compile it directly using the `standalone` document class.

## Testing

Run the test suite with:

```
npm test
```

Tests cover:
- `src/lib/graph6.test.js` — graph6 string parser
- `src/lib/matrix-utils.test.js` — adjacency-matrix mutation helpers (`addNodeToMatrix`, `addEdgeToMatrix`, `removeNodeFromMatrix`)
- `src/lib/tikz.test.js` — TikZ export utility (color mapping, coordinate conversion, label escaping, output generation)
- `src/components/analysis-panel-state.test.js` — persisted drawer state, responsive overlay rules, and accordion state helpers
- `src/components/computation-panel.test.js` — compact analysis header status, stale, cancel, and elapsed metadata
- `src/lib/forcing/compute-core.test.js` — in-browser looped forcing/maximum looped/fort/blocking-set algorithms, including parity with the `python/loop_zf.py` reference implementation, vertex-limit enforcement, and cancellation/timeout behavior
- `src/workers/forcing.worker.test.js` — forcing Web Worker message protocol (success, unknown op, cancellation, timeout)
- `src/lib/api.test.js` — frontend forcing API client: worker-first execution and backend fallback (unavailable/crashed/errored worker), `REACT_APP_FORCE_BACKEND`, and cancellation handling
- `server.test.js` — backend request validation and `/api/forcing/*` endpoints (optional fallback path)
- `src/index.test.js` — regression guard ensuring `src/index.js` imports the `regenerator-runtime` polyfill needed by async/await elsewhere in the app
