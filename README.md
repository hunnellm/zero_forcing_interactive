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

## Testing

Run the test suite with:

```
npm test
```

Tests cover:
- `src/lib/graph6.test.js` — graph6 string parser
- `src/lib/matrix-utils.test.js` — adjacency-matrix mutation helpers (`addNodeToMatrix`, `addEdgeToMatrix`)
