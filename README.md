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

## Draw Graph Mode

Click the **pencil icon (✏)** in the toolbar to enter Draw Graph mode.

- Click the canvas background to add a new isolated node.
- Click a node to select it as an edge source (highlighted with a secondary-colour ring).
- Click a second node to connect them with an edge.
- Click the selected source node again to cancel the selection.
- **Double-click a node** to delete it and all its incident edges.

Click the pencil icon again to return to normal coloring interaction.

The underlying adjacency matrix is updated automatically, so a newly drawn graph can be
inspected or exported via the **Matrix** tab in the settings drawer.

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

