/**
 * Single source of truth for whether the force-directed physics simulation
 * is allowed to run continuously (as opposed to staying frozen).
 *
 * Draw mode always freezes the simulation so manually placed nodes/edges are
 * not perturbed while the user is actively editing the graph. Otherwise,
 * continuous physics-driven redraw is only permitted when the user has
 * explicitly turned "Auto Redraw" on. Nothing else (manual redraw, node/edge
 * edits, drags, etc.) may re-enable continuous ticking -- this keeps "Auto
 * Redraw: Off" an absolute guarantee rather than one of several ORed
 * conditions scattered across the UI layer.
 *
 * @param {{ drawMode: boolean, autoRedraw: boolean }} params
 * @returns {boolean} true when the simulation should be allowed to tick indefinitely
 */
export function isContinuousRedrawEnabled({ drawMode, autoRedraw }) {
  return !drawMode && !!autoRedraw
}
