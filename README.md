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

Install dependencies with `npm i`. Start a local development server with `npm start`.

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
