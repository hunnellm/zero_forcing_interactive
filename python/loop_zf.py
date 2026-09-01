#!/usr/bin/env python3
"""
loop_zf.py - Zero forcing utilities with explicit simple-vs-looped APIs.

This module is a trimmed vendored subset of the `loop-zf.py` core library
from https://github.com/hunnellm/enhanced-zf (same author/owner), containing
only the pieces required by this app's backend API: looped zero forcing
numbers/sets, the maximum looped zero forcing number over all loop
configurations, loop forts, and loop blocking sets. See the upstream
repository for the full library (forcing paths, reversal maps, etc.).

Key design choice:
------------------
This module separates SIMPLE and LOOPED forcing semantics in public APIs.

- SIMPLE rule (no white forcing):
    only blue vertices may force a unique white neighbor.

- LOOPED rule (white forcing allowed):
    any vertex may force if it has exactly one white neighbor in the looped graph
    (where a specified subset of vertices has loops; this subset may be empty).

No public function infers one rule from missing parameters.
"""

from itertools import combinations


# ---------------------------------------------------------------------------
# Graph normalization
# ---------------------------------------------------------------------------

def _adjacency_lists(g):
    """
    Return (vertices, adj_mask, n) in bitmask-ready format.
    """
    if isinstance(g, dict):
        vertices = sorted(g.keys())
        raw_adj = {v: list(g[v]) for v in vertices}
    elif hasattr(g, "adjacency"):
        # NetworkX-like
        adj_raw = dict(g.adjacency())
        vertices = sorted(adj_raw.keys())
        raw_adj = {v: list(adj_raw[v].keys()) for v in vertices}
    else:
        # SageMath-compatible
        vertices = sorted(g.vertices())
        raw_adj = {v: list(g.neighbors(v)) for v in vertices}

    n = int(len(vertices))
    idx = {v: int(i) for i, v in enumerate(vertices)}

    adj_mask = [0] * n
    for i, v in enumerate(vertices):
        m = 0
        for u in raw_adj[v]:
            if u in idx:
                m |= (1 << idx[u])
        adj_mask[int(i)] = int(m)

    return vertices, adj_mask, n


def _bitmask_from_vertices(vertices, subset):
    idx = {v: int(i) for i, v in enumerate(vertices)}
    mask = 0
    for v in subset:
        if v not in idx:
            raise ValueError("vertex {!r} is not in the graph".format(v))
        mask |= (1 << idx[v])
    return int(mask)


def _loop_mask_from_vertices(vertices, looped_vertices):
    if looped_vertices is None:
        raise ValueError("looped_vertices must be explicitly provided for looped functions (possibly empty set)")
    return int(_bitmask_from_vertices(vertices, looped_vertices))


# ---------------------------------------------------------------------------
# Core closures
# ---------------------------------------------------------------------------

def _lzf_closure(adj_mask, initial_mask, loop_mask, n):
    """
    LOOPED closure: any vertex can force if it has a unique white neighbor
    in looped graph.
    """
    blue = int(initial_mask)
    loop_mask = int(loop_mask)
    n = int(n)

    changed = True
    while changed:
        changed = False
        to_blue = 0

        for v in range(n):
            nbrs = int(adj_mask[v])
            if (loop_mask >> v) & 1:
                nbrs |= (1 << v)

            white_nbrs = nbrs & ~blue
            if white_nbrs and not (white_nbrs & (white_nbrs - 1)):
                to_blue |= int(white_nbrs)

        if to_blue:
            blue |= int(to_blue)
            changed = True

    return int(blue)


def _looped_zero_forcing_number_internal(adj_mask, loop_mask, n, full_mask):
    n = int(n)
    loop_mask = int(loop_mask)
    full_mask = int(full_mask)

    for size in range(0, n + 1):
        for combo in combinations(range(n), size):
            mask = 0
            for v in combo:
                mask |= (1 << int(v))
            mask = int(mask)
            if _lzf_closure(adj_mask, mask, loop_mask, n) == full_mask:
                return int(size)
    return int(n)


# ---------------------------------------------------------------------------
# Public LOOPED API
# ---------------------------------------------------------------------------

def looped_zero_forcing_closure(g, initial_set, looped_vertices):
    vertices, adj_mask, n = _adjacency_lists(g)
    initial_mask = _bitmask_from_vertices(vertices, initial_set)
    loop_mask = _loop_mask_from_vertices(vertices, looped_vertices)
    closure_mask = _lzf_closure(adj_mask, initial_mask, loop_mask, n)
    return frozenset(vertices[i] for i in range(n) if (closure_mask >> i) & 1)


def is_looped_zero_forcing_set(g, initial_set, looped_vertices):
    vertices, adj_mask, n = _adjacency_lists(g)
    initial_mask = _bitmask_from_vertices(vertices, initial_set)
    loop_mask = _loop_mask_from_vertices(vertices, looped_vertices)
    full_mask = int((1 << n) - 1)
    return _lzf_closure(adj_mask, initial_mask, loop_mask, n) == full_mask


def looped_zero_forcing_number(g, looped_vertices, return_sets=False):
    vertices, adj_mask, n = _adjacency_lists(g)

    if n == 0:
        if return_sets:
            return 0, [frozenset()]
        return 0

    full_mask = int((1 << n) - 1)
    loop_mask = _loop_mask_from_vertices(vertices, looped_vertices)

    lz = _looped_zero_forcing_number_internal(adj_mask, loop_mask, n, full_mask)
    if not return_sets:
        return lz

    sets = []
    for combo in combinations(range(n), lz):
        mask = 0
        for v in combo:
            mask |= (1 << int(v))
        mask = int(mask)
        if _lzf_closure(adj_mask, mask, loop_mask, n) == full_mask:
            sets.append(frozenset(vertices[v] for v in combo))

    return lz, sorted(sets, key=lambda s: sorted(s))


def maximum_looped_zero_forcing_number(g, return_configurations=False, return_sets=False):
    """
    Maximum looped zero forcing number over all loop configurations.
    """
    vertices, adj_mask, n = _adjacency_lists(g)

    if n == 0:
        if return_sets:
            return 0, [(frozenset(), [frozenset()])]
        if return_configurations:
            return 0, [frozenset()]
        return 0

    full_mask = int((1 << n) - 1)
    max_lz = -1
    maximizing_configs = []

    for loop_mask in range(1 << int(n)):
        loop_mask = int(loop_mask)
        lz = _looped_zero_forcing_number_internal(adj_mask, loop_mask, n, full_mask)

        if lz > max_lz:
            max_lz = lz
            maximizing_configs = [loop_mask]
        elif lz == max_lz:
            maximizing_configs.append(loop_mask)

    def mask_to_set(m):
        return frozenset(vertices[i] for i in range(n) if (m >> i) & 1)

    if not return_configurations and not return_sets:
        return max_lz

    if return_configurations and not return_sets:
        cfgs = [mask_to_set(m) for m in maximizing_configs]
        return max_lz, sorted(cfgs, key=lambda s: sorted(s))

    data = []
    for m in maximizing_configs:
        cfg = mask_to_set(m)
        _, min_sets = looped_zero_forcing_number(g, looped_vertices=cfg, return_sets=True)
        data.append((cfg, min_sets))

    data = sorted(data, key=lambda pair: sorted(pair[0]))
    return max_lz, data


# ---------------------------------------------------------------------------
# Loop forts and loop blocking sets
# ---------------------------------------------------------------------------

def loop_forts(g, looped_vertices, include_empty=False, include_full=True):
    """
    Return all loop forts for a fixed loop configuration.

    A loop fort S satisfies:
      for every vertex v in V(G_looped), |N(v) ∩ S| != 1,
    where G_looped has loops exactly on looped_vertices, and a loop at v means
    v is included in N(v).
    """
    vertices, adj_mask, n = _adjacency_lists(g)
    loop_mask = _loop_mask_from_vertices(vertices, looped_vertices)
    n = int(n)

    if n == 0:
        return [frozenset()] if include_empty else []

    # Closed-neighborhood masks in the chosen loop configuration.
    nbr_masks = [0] * n
    for v in range(n):
        m = int(adj_mask[v])
        if (loop_mask >> v) & 1:
            m |= (1 << v)
        nbr_masks[v] = int(m)

    def is_loop_fort_mask(mask):
        mask = int(mask)
        for v in range(n):
            c = int(bin(nbr_masks[v] & mask).count("1"))
            if c == 1:
                return False
        return True

    forts = []
    full_mask = int((1 << n) - 1)

    for mask in range(1 << n):
        mask = int(mask)

        if not include_empty and mask == 0:
            continue
        if not include_full and mask == full_mask:
            continue

        if is_loop_fort_mask(mask):
            forts.append(frozenset(vertices[i] for i in range(n) if (mask >> i) & 1))

    return sorted(forts, key=lambda s: (len(s), sorted(s)))


def is_loop_fort(g, fort_set, looped_vertices):
    """
    Decide whether fort_set is a loop fort for a fixed loop configuration.

    S is a loop fort iff for every vertex v in V(G_looped),
      |N(v) ∩ S| != 1,
    where loops are present exactly on looped_vertices.
    """
    vertices, adj_mask, n = _adjacency_lists(g)
    mask = _bitmask_from_vertices(vertices, fort_set)
    loop_mask = _loop_mask_from_vertices(vertices, looped_vertices)
    n = int(n)

    for v in range(n):
        nbrs = int(adj_mask[v])
        if (loop_mask >> v) & 1:
            nbrs |= (1 << v)
        if int(bin(nbrs & mask).count("1")) == 1:
            return False
    return True


def minimal_loop_forts(g, looped_vertices, include_empty=False):
    """
    Return all inclusion-minimal loop forts for a fixed loop configuration.

    By default, excludes the empty set (set include_empty=True to allow it).
    """
    forts = loop_forts(
        g,
        looped_vertices=looped_vertices,
        include_empty=include_empty,
        include_full=True,
    )

    minimal = []
    for S in forts:
        is_minimal = True
        for T in forts:
            if T != S and T.issubset(S):
                is_minimal = False
                break
        if is_minimal:
            minimal.append(S)

    return sorted(minimal, key=lambda s: (len(s), sorted(s)))


def loop_blocking_number(g, looped_vertices, return_sets=False):
    """
    Compute the minimum size of a loop blocking set for a fixed loop configuration.

    A loop blocking set S satisfies:
      for every vertex u in G (with loops added exactly on looped_vertices),
      u has at least two neighbors in S.

    Here, a loop at u contributes u itself as a neighbor when u in S.
    """
    vertices, adj_mask, n = _adjacency_lists(g)

    if n == 0:
        if return_sets:
            return 0, [frozenset()]
        return 0

    loop_mask = _loop_mask_from_vertices(vertices, looped_vertices)

    # For each vertex u, build the candidate-neighbor bitmask in the looped graph.
    nbr_masks = [0] * n
    for u in range(n):
        m = int(adj_mask[u])
        if (loop_mask >> u) & 1:
            m |= (1 << u)
        nbr_masks[u] = int(m)

    def is_loop_blocking(mask):
        mask = int(mask)
        for u in range(n):
            c = int(bin(nbr_masks[u] & mask).count("1"))
            if c < 2:
                return False
        return True

    best_size = None
    best_sets = []

    for size in range(0, n + 1):
        found_any = False
        for combo in combinations(range(n), size):
            mask = 0
            for v in combo:
                mask |= (1 << int(v))
            mask = int(mask)

            if is_loop_blocking(mask):
                found_any = True
                if not return_sets:
                    return int(size)
                best_sets.append(frozenset(vertices[v] for v in combo))

        if found_any:
            best_size = int(size)
            break

    # If no set exists (possible for sparse/small graphs), return n and optionally [].
    if best_size is None:
        if return_sets:
            return int(n), []
        return int(n)

    return int(best_size), sorted(best_sets, key=lambda s: sorted(s))


def loop_blocking_sets(g, looped_vertices, return_sets=False):
    return loop_blocking_number(g, looped_vertices, return_sets=True)
