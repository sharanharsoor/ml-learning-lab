(() => {
  'use strict';

  const TRAIN = [
    { id: 'P1', x: 1, y: 'A', label: 0, minutes: 2 },
    { id: 'P2', x: 2, y: 'B', label: 0, minutes: 2 },
    { id: 'P3', x: 3, y: 'B', label: 0, minutes: 2 },
    { id: 'P4', x: 4, y: 'B', label: 1, minutes: 6 },
    { id: 'P5', x: 5, y: 'B', label: 1, minutes: 8 },
    { id: 'P6', x: 6, y: 'B', label: 1, minutes: 8 },
    { id: 'P7', x: 7, y: 'A', label: 0, minutes: 4 },
    { id: 'P8', x: 8, y: 'B', label: 1, minutes: 8 },
  ];
  const HOLDOUT = [
    { id: 'H1', x: 2, y: 'A', label: 0 },
    { id: 'H2', x: 3, y: 'B', label: 0 },
    { id: 'H3', x: 5, y: 'B', label: 1 },
    { id: 'H4', x: 8, y: 'B', label: 1 },
    { id: 'H5', x: 6, y: 'A', label: 1 },
    { id: 'H6', x: 7, y: 'B', label: 0 },
  ];
  const DEEP_TRAIN = [0, 0, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 1]
    .map((label, index) => ({ id: 'D' + (index + 1), x: index + 1, y: 'A', label }));
  const importancePackaging = 'AABAABBBABAAABBAAAAA';
  const importanceScanScores = '33242422224244223423';
  const IMPORTANCE_TRAIN = Array.from('11100001011011101111', (label, index) => ({
    x: index + 1,
    y: importancePackaging[index],
    z: Number(importanceScanScores[index]),
    label: Number(label),
  }));
  const processingTimes = [19, 19, 19, 10, 10, 10, 10, 19, 12, 19, 14.5, 13, 15.5, 19, 19, 14, 9, 9, 9, 9];
  const REGRESSION_TRAIN = IMPORTANCE_TRAIN.map((row, index) => ({ ...row, minutes: processingTimes[index] }));

  function entropy(p) {
    if (p === 0 || p === 1) return 0;
    return -p * Math.log2(p) - (1 - p) * Math.log2(1 - p);
  }

  function gini(p) {
    return 2 * p * (1 - p);
  }

  function stats(rows, criterion) {
    if (criterion !== 'entropy' && criterion !== 'gini' && criterion !== 'mse') {
      throw new RangeError('Unknown split criterion.');
    }
    const n = rows.length;
    if (n === 0) return { n, auto: 0, review: 0, mean: null, score: 0, prediction: null };

    const review = rows.reduce((sum, row) => sum + row.label, 0);
    const auto = n - review;
    const hasTimes = rows.every(row => Number.isFinite(row.minutes));
    const mean = hasTimes ? rows.reduce((sum, row) => sum + row.minutes, 0) / n : null;
    if (criterion === 'mse') {
      if (!hasTimes) throw new TypeError('Mean squared error requires a time for every row.');
      const score = rows.reduce((sum, row) => sum + (row.minutes - mean) ** 2, 0) / n;
      return { n, auto, review, mean, score, prediction: mean };
    }

    const score = criterion === 'entropy' ? entropy(review / n) : gini(review / n);
    return { n, auto, review, mean, score, prediction: review > auto ? 1 : 0 };
  }

  function candidates(rows) {
    const splits = ['x', 'z'].flatMap(feature => {
      const readings = rows.map(row => row[feature]);
      if (!readings.every(Number.isFinite)) return [];
      const values = [...new Set(readings)].sort((a, b) => a - b);
      return values.slice(1).map((next, index) => {
        const previous = values[index];
        const midpoint = previous / 2 + next / 2;
        const threshold = midpoint >= previous && midpoint < next ? midpoint : previous;
        return { feature, threshold };
      });
    });
    if (rows.some(row => row.y === 'A') && rows.some(row => row.y === 'B')) {
      splits.push({ feature: 'y', threshold: 'A' });
    }
    return splits;
  }

  function goesLeft(row, split) {
    return split.feature === 'y' ? row.y === split.threshold : row[split.feature] <= split.threshold;
  }

  function evaluate(rows, split, criterion) {
    const left = [];
    const right = [];
    for (const row of rows) {
      const branch = goesLeft(row, split) ? left : right;
      branch.push(row);
    }
    if (left.length === 0 || right.length === 0) return null;

    const parent = stats(rows, criterion);
    const leftStats = stats(left, criterion);
    const rightStats = stats(right, criterion);
    const weighted = (leftStats.n * leftStats.score + rightStats.n * rightStats.score) / parent.n;
    const difference = parent.score - weighted;
    const tolerance = 8 * Number.EPSILON * Math.max(parent.score, weighted);
    const gain = Math.abs(difference) <= tolerance ? 0 : difference;
    return { split, left, right, parent, leftStats, rightStats, weighted, gain };
  }

  function rank(rows, criterion) {
    // A stable sort preserves feature and threshold order for tied gains.
    return candidates(rows)
      .map(split => evaluate(rows, split, criterion))
      .filter(result => result !== null)
      .sort((a, b) => b.gain - a.gain);
  }

  function fit(rows, criterion, maxDepth, minLeaf = 1) {
    if (rows.length === 0) throw new RangeError('Fit needs at least one training row.');
    if (!Number.isInteger(maxDepth) || maxDepth < 0) {
      throw new RangeError('Maximum depth must be a nonnegative integer.');
    }
    if (!Number.isInteger(minLeaf) || minLeaf < 1) {
      throw new RangeError('Minimum leaf size must be a positive integer.');
    }

    function grow(group, remainingDepth) {
      const node = stats(group, criterion);
      const leaf = { stats: node, split: null, left: null, right: null, gain: 0 };
      if (remainingDepth === 0 || node.score === 0 || node.n < 2 * minLeaf) return leaf;

      const winner = rank(group, criterion).find(result => (
        result.gain > 0 && result.left.length >= minLeaf && result.right.length >= minLeaf
      ));
      if (!winner) return leaf;

      return {
        stats: node,
        split: winner.split,
        left: grow(winner.left, remainingDepth - 1),
        right: grow(winner.right, remainingDepth - 1),
        gain: winner.gain,
      };
    }

    return grow(rows, maxDepth);
  }

  function terminalNode(tree, row, onSplit) {
    let node = tree;
    while (node.split) {
      const yes = goesLeft(row, node.split);
      onSplit?.(node.split, yes);
      node = yes ? node.left : node.right;
    }
    return node;
  }

  function predict(tree, row) {
    return terminalNode(tree, row).stats.prediction;
  }

  function trace(tree, row) {
    const paths = ['root'];
    const steps = [];
    const leaf = terminalNode(tree, row, (split, yes) => {
      steps.push({ split, yes });
      paths.push(paths[paths.length - 1] + (yes ? 'l' : 'r'));
    });
    return { paths, steps, leaf: leaf.stats };
  }

  function confusion(tree, rows) {
    const counts = { tn: 0, fp: 0, fn: 0, tp: 0 };
    for (const row of rows) {
      const prediction = predict(tree, row);
      if (prediction !== 0 && prediction !== 1) {
        throw new TypeError('A confusion matrix requires binary class predictions.');
      }
      const key = row.label === 1 ? (prediction === 1 ? 'tp' : 'fn') : (prediction === 1 ? 'fp' : 'tn');
      counts[key] += 1;
    }
    return counts;
  }

  function importance(tree) {
    const gains = { x: 0, y: 0, total: 0 };

    function visit(node) {
      if (!node.split) return;
      const feature = node.split.feature;
      gains[feature] = (gains[feature] ?? 0) + (node.stats.n / tree.stats.n) * node.gain;
      visit(node.left);
      visit(node.right);
    }

    visit(tree);
    gains.total = Object.values(gains).reduce((sum, credit) => sum + credit, 0);
    return gains;
  }

  globalThis.TreeLab = {
    TRAIN, HOLDOUT, DEEP_TRAIN, IMPORTANCE_TRAIN, REGRESSION_TRAIN,
    entropy, gini, stats, candidates, evaluate, rank, fit, predict, trace, confusion, importance,
  };
})();
