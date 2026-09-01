#!/usr/bin/env python3
"""
cli.py - JSON stdin/stdout bridge between the Node.js backend and loop_zf.py.

Reads a single JSON object from stdin:
  {
    "op": "looped" | "maximum-looped" | "forts" | "blocking-sets",
    "adjacencyMatrix": [[0,1,...], ...],
    "loopedVertices": [0, 2, ...]
  }

Writes a single JSON object to stdout:
  { "ok": true, "result": {...} }
  or
  { "ok": false, "error": "message" }
"""

import json
import sys

import loop_zf


def _matrix_to_graph(adjacency_matrix):
    n = len(adjacency_matrix)
    return {
        i: [j for j, value in enumerate(row) if value]
        for i, row in enumerate(adjacency_matrix)
    }


def _sorted_set(vertex_set):
    return sorted(int(v) for v in vertex_set)


def _run_looped(g, looped_vertices):
    number, sets = loop_zf.looped_zero_forcing_number(g, looped_vertices, return_sets=True)
    return {
        'loopedVertices': _sorted_set(looped_vertices),
        'number': number,
        'sets': [_sorted_set(s) for s in sets],
    }


def _run_maximum_looped(g, _looped_vertices):
    number, data = loop_zf.maximum_looped_zero_forcing_number(g, return_configurations=True, return_sets=True)
    configurations = [
        {
            'loopedVertices': _sorted_set(cfg),
            'sets': [_sorted_set(s) for s in min_sets],
        }
        for cfg, min_sets in data
    ]
    return {
        'number': number,
        'configurations': configurations,
    }


def _run_forts(g, looped_vertices):
    all_forts = loop_zf.loop_forts(g, looped_vertices, include_empty=False, include_full=True)
    minimal = loop_zf.minimal_loop_forts(g, looped_vertices, include_empty=False)
    return {
        'loopedVertices': _sorted_set(looped_vertices),
        'forts': [_sorted_set(s) for s in all_forts],
        'minimalForts': [_sorted_set(s) for s in minimal],
    }


def _run_blocking_sets(g, looped_vertices):
    number, sets = loop_zf.loop_blocking_sets(g, looped_vertices, return_sets=True)
    return {
        'loopedVertices': _sorted_set(looped_vertices),
        'number': number,
        'sets': [_sorted_set(s) for s in sets],
    }


OPERATIONS = {
    'looped': _run_looped,
    'maximum-looped': _run_maximum_looped,
    'forts': _run_forts,
    'blocking-sets': _run_blocking_sets,
}


def main():
    raw = sys.stdin.read()
    try:
        payload = json.loads(raw)
        op = payload['op']
        adjacency_matrix = payload['adjacencyMatrix']
        looped_vertices = set(int(v) for v in payload.get('loopedVertices', []))

        handler = OPERATIONS.get(op)
        if handler is None:
            raise ValueError('unknown operation: {!r}'.format(op))

        g = _matrix_to_graph(adjacency_matrix)
        result = handler(g, looped_vertices)
        sys.stdout.write(json.dumps({'ok': True, 'result': result}))
    except Exception as error:  # noqa: BLE001 - report all failures back over JSON
        sys.stdout.write(json.dumps({'ok': False, 'error': str(error)}))
        sys.exit(0)


if __name__ == '__main__':
    main()
