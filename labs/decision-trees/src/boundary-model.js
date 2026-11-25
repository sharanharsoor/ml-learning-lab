(() => {
  'use strict';

  const { stats, candidates, evaluate } = TreeLab;
  const auto = [
    [1.1, 1.6], [2.6, 2.9], [3.7, 4.2], [1.6, 5.5],
    [3, 6.7], [2, 8.8], [4, 8.1], [3.6, 9.3],
    [6, 2.4], [6.8, 3.7], [7.6, 1.4], [8.6, 4], [9.1, 2.6],
  ];
  const review = [
    [6, 6.6], [6.4, 8.6], [7.1, 7.3], [7.7, 9.2],
    [8.1, 6], [8.7, 7.9], [9, 6.9], [9.2, 8.9],
  ];
  const rows = [auto, review]
    .flatMap((points, label) => points.map(([x, z]) => ({ x, z, label })))
    .map((row, index) => ({ id: 'Parcel ' + (index + 1), ...row }));
  const bounds = { xMin: 0, xMax: 10, zMin: 0, zMax: 10 };
  const demo = { first: { feature: 'x', threshold: 5 }, second: { path: 'rootr', feature: 'z', threshold: 5 } };

  function fitLogistic(rows, bounds) {
    const xScale = (bounds.xMax - bounds.xMin) / 2;
    const zScale = (bounds.zMax - bounds.zMin) / 2;
    const xCenter = bounds.xMin + xScale;
    const zCenter = bounds.zMin + zScale;
    const data = rows.map(({ x, z, label }) => ({ x: (x - xCenter) / xScale, z: (z - zCenter) / zScale, label }));
    // Minimize mean binary log loss with a small L2 penalty on the scaled slopes.
    // The intercept is unpenalized. The log-loss curvature is at most 3/4 for inputs in [-1, 1].
    const penalty = 0.002;
    const step = 2;
    let intercept = 0;
    let weight = 0;
    let scan = 0;
    for (let iteration = 0; iteration < 2000; iteration++) {
      let interceptGradient = 0;
      let weightGradient = 0;
      let scanGradient = 0;
      for (const { x, z, label } of data) {
        const score = intercept + weight * x + scan * z;
        const residual = 1 / (1 + Math.exp(-score)) - label;
        interceptGradient += residual;
        weightGradient += residual * x;
        scanGradient += residual * z;
      }
      interceptGradient /= data.length;
      weightGradient = weightGradient / data.length + penalty * weight;
      scanGradient = scanGradient / data.length + penalty * scan;
      if (Math.max(Math.abs(interceptGradient), Math.abs(weightGradient), Math.abs(scanGradient)) < 1e-9) break;
      intercept -= step * interceptGradient;
      weight -= step * weightGradient;
      scan -= step * scanGradient;
    }

    // Convert back to the plot's original axes before drawing the score-zero line.
    weight /= xScale;
    scan /= zScale;
    intercept -= weight * xCenter + scan * zCenter;
    const matches = rows.filter(({ x, z, label }) => Number(intercept + weight * x + scan * z >= 0) === label).length;
    return { intercept, weight, scan, matches };
  }

  function leaf(path, bounds, rows, summary = stats(rows, 'entropy')) {
    return { path, bounds, rows, stats: summary, split: null, left: null, right: null, gain: 0 };
  }

  function create() {
    return leaf('root', bounds, rows);
  }

  function getNode(tree, path) {
    if (typeof path !== 'string' || !path.startsWith(tree.path)) return null;
    let node = tree;
    for (const direction of path.slice(tree.path.length)) {
      if (!node.split || (direction !== 'l' && direction !== 'r')) return null;
      node = direction === 'l' ? node.left : node.right;
    }
    return node;
  }

  function leaves(node) {
    return node.split ? [...leaves(node.left), ...leaves(node.right)] : [node];
  }

  function availableCuts(node, feature) {
    if (!node || node.split || (feature !== 'x' && feature !== 'z')) return [];
    // The fixture records tenths, so its exact decimal midpoints use at most two places.
    return candidates(node.rows).filter(split => split.feature === feature)
      .map(split => Number(split.threshold.toFixed(2)));
  }

  function applyCut(tree, path, feature, threshold) {
    const target = getNode(tree, path);
    if (!availableCuts(target, feature).includes(threshold)) return null;

    const split = { feature, threshold };
    const { left, right, leftStats, rightStats, gain } = evaluate(target.rows, split, 'entropy');
    const replacement = {
      ...target,
      split,
      gain,
      left: leaf(path + 'l', { ...target.bounds, [feature + 'Max']: threshold }, left, leftStats),
      right: leaf(path + 'r', { ...target.bounds, [feature + 'Min']: threshold }, right, rightStats),
    };

    function replace(node) {
      if (node === target) return replacement;
      const branch = path[node.path.length] === 'l' ? 'left' : 'right';
      return { ...node, [branch]: replace(node[branch]) };
    }

    return replace(tree);
  }

  const logistic = fitLogistic(rows, bounds);
  globalThis.TreeLabBoundaryModel = { rows, bounds, demo, logistic, create, getNode, leaves, availableCuts, applyCut };
})();
