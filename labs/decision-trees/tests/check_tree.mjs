import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = new URL('../src/engine.js', import.meta.url);
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(source, 'utf8'), context, { filename: source.pathname });
const { TRAIN, HOLDOUT, DEEP_TRAIN, IMPORTANCE_TRAIN, entropy, gini, stats, candidates, evaluate, rank, fit, predict, confusion, importance } =
  context.TreeLab;

// Convert objects from the script's realm before comparing prototypes in Node.
const plain = value => JSON.parse(JSON.stringify(value));
const close = (actual, expected, name) => {
  assert.ok(Math.abs(actual - expected) < 1e-12, `${name}: expected ${expected}, received ${actual}`);
};

const trainingReference = [
  [1, 'A', 0, 2],
  [2, 'B', 0, 2],
  [3, 'B', 0, 2],
  [4, 'B', 1, 6],
  [5, 'B', 1, 8],
  [6, 'B', 1, 8],
  [7, 'A', 0, 4],
  [8, 'B', 1, 8],
];
const heldOutReference = [[2, 'A', 0], [3, 'B', 0], [5, 'B', 1], [8, 'B', 1], [6, 'A', 1], [7, 'B', 0]];
assert.deepEqual(Array.from(TRAIN, row => [row.x, row.y, row.label, row.minutes]), trainingReference);
assert.deepEqual(Array.from(HOLDOUT, row => [row.x, row.y, row.label]), heldOutReference);
assert.ok(HOLDOUT.every(row => !Object.hasOwn(row, 'minutes')), 'The test set provides class labels only');
assert.equal(new Set([...TRAIN, ...HOLDOUT].map(row => row.id)).size, TRAIN.length + HOLDOUT.length);

for (const p of [0, 1]) {
  assert.equal(entropy(p), 0);
  assert.equal(gini(p), 0);
}
assert.equal(entropy(0.5), 1);
assert.equal(gini(0.5), 0.5);
close(entropy(0.8), 0.7219280948873623, 'one Auto and four Review entropy');
close(gini(0.8), 0.32, 'one Auto and four Review Gini');
assert.deepEqual(plain(stats(TRAIN, 'entropy')), { n: 8, auto: 4, review: 4, mean: 5, score: 1, prediction: 0 });
assert.deepEqual(plain(stats(TRAIN, 'mse')), { n: 8, auto: 4, review: 4, mean: 5, score: 7, prediction: 5 });
assert.throws(() => stats(HOLDOUT, 'mse'), /requires a time/);

const byWeight = { feature: 'x', threshold: 3.5 };
const byPack = { feature: 'y', threshold: 'A' };
assert.deepEqual(plain(candidates(TRAIN)), [
  ...[1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5].map(threshold => ({ feature: 'x', threshold })),
  byPack,
]);
assert.equal(evaluate(TRAIN, { feature: 'x', threshold: 0 }, 'entropy'), null);
assert.equal(evaluate(TRAIN, { feature: 'x', threshold: 8 }, 'entropy'), null);

const splitReferences = [
  ['entropy', 0.4512050593046014, 0.5487949406953986, 0.6887218755408672, 0.3112781244591328],
  ['gini', 0.20, 0.30, 1 / 3, 1 / 6],
  ['mse', 1.60, 5.40, 17 / 3, 4 / 3],
];
for (const [criterion, weightScore, weightGain, packScore, packGain] of splitReferences) {
  const weight = evaluate(TRAIN, byWeight, criterion);
  const pack = evaluate(TRAIN, byPack, criterion);
  close(weight.weighted, weightScore, `${criterion} weight split score`);
  close(weight.gain, weightGain, `${criterion} weight split gain`);
  close(pack.weighted, packScore, `${criterion} pack split score`);
  close(pack.gain, packGain, `${criterion} pack split gain`);
  const ranks = rank(TRAIN, criterion);
  assert.deepEqual(plain(ranks[0].split), byWeight);
  assert.ok(ranks.every((result, i) => i === 0 || result.gain <= ranks[i - 1].gain));
  assert.deepEqual(Array.from(weight.left, row => row.id), ['P1', 'P2', 'P3']);
  assert.deepEqual(Array.from(weight.right, row => row.id), ['P4', 'P5', 'P6', 'P7', 'P8']);
}

const entropyTree = fit(TRAIN, 'entropy', 2);
assert.deepEqual(plain(entropyTree.split), byWeight);
assert.equal(entropyTree.left.split, null, 'A pure child is already terminal');
assert.deepEqual(plain(entropyTree.right.split), byPack);
close(entropyTree.right.gain, 0.7219280948873623, 'local second split gain');
assert.deepEqual(plain(confusion(entropyTree, TRAIN)), { tn: 4, fp: 0, fn: 0, tp: 4 });
assert.deepEqual(plain(confusion(entropyTree, HOLDOUT)), { tn: 2, fp: 1, fn: 1, tp: 2 });
assert.deepEqual(Array.from(HOLDOUT, row => predict(entropyTree, row)), [0, 0, 1, 1, 0, 1]);
const entropyGains = importance(entropyTree);
close(entropyGains.x, 0.5487949406953986, 'entropy importance of X');
close(entropyGains.y, 0.4512050593046014, 'root-weighted entropy importance of Y');
close(entropyGains.total, 1, 'total entropy reduction');
const giniGains = importance(fit(TRAIN, 'gini', 2));
close(giniGains.x, 0.3, 'Gini importance of X');
close(giniGains.y, 0.2, 'Gini importance of Y');
close(giniGains.total, 0.5, 'total Gini reduction');

const depthZero = fit(TRAIN, 'entropy', 0);
assert.equal(depthZero.split, null);
assert.equal(depthZero.gain, 0);
assert.deepEqual(plain(importance(depthZero)), { x: 0, y: 0, total: 0 });
const restricted = fit(TRAIN, 'entropy', 2, 4);
assert.deepEqual(plain(restricted.split), { feature: 'x', threshold: 4.5 }, 'Skip the unconstrained winner when it is too small');
assert.equal(restricted.left.split, null);
assert.equal(restricted.right.split, null);

const tied = [
  { x: 0, y: 'A', label: 0 },
  { x: 1, y: 'B', label: 1 },
];
assert.deepEqual(plain(rank(tied, 'entropy').map(result => result.split)), [{ feature: 'x', threshold: 0.5 }, byPack]);
assert.equal(fit(tied, 'entropy', 1).split.feature, 'x');
assert.equal(predict(fit(tied, 'entropy', 0), tied[0]), 0, 'A prediction tie resolves to Auto');
const zeroGain = [
  { x: 0, y: 'A', label: 0, minutes: 0 },
  { x: 0, y: 'A', label: 1, minutes: 2 },
  { x: 1, y: 'A', label: 0, minutes: 1 },
  { x: 1, y: 'A', label: 1, minutes: 1 },
];
for (const criterion of ['entropy', 'gini', 'mse']) {
  assert.deepEqual(plain(candidates(zeroGain)), [{ feature: 'x', threshold: 0.5 }], 'Duplicate values have one midpoint');
  assert.equal(rank(zeroGain, criterion)[0].gain, 0);
  assert.equal(fit(zeroGain, criterion, 3).split, null);
}

const stump = fit(TRAIN, 'mse', 1);
assert.equal(predict(stump, { x: 2, y: 'A' }), 2);
close(predict(stump, { x: 3.51, y: 'B' }), 6.8, 'regression right prediction');
assert.equal(predict(stump, { x: 3.5, y: 'B' }), 2, 'Numerical equality follows the left branch');
close(stump.right.stats.score, 2.56, 'regression right MSE');
const regressionResiduals = Array.from(TRAIN, row => row.minutes - predict(stump, row));
close(regressionResiduals.reduce((sum, error) => sum + error ** 2, 0) / TRAIN.length, 1.6, 'regression train MSE');

function leafCost(node) {
  return node.split ? leafCost(node.left) + leafCost(node.right) : node.stats.n * node.stats.score;
}
for (const criterion of ['entropy', 'gini', 'mse']) {
  for (const depth of [0, 1, 2, 3]) {
    const tree = fit(TRAIN, criterion, depth);
    const gains = importance(tree);
    close(gains.x + gains.y, gains.total, `${criterion}, depth ${depth} feature totals`);
    close(gains.total, tree.stats.score - leafCost(tree) / TRAIN.length, `${criterion}, depth ${depth} total leaf reduction`);
  }
}

assert.deepEqual(Array.from(TRAIN, row => [row.x, row.y, row.label, row.minutes]), trainingReference);

const deepTree = fit(DEEP_TRAIN, 'entropy', 5);
const deepParent = deepTree.left.left.right;
const depthThree = evaluate(DEEP_TRAIN.filter(row => row.x >= 3 && row.x <= 9), deepParent.split, 'entropy');
assert.deepEqual(
  [deepTree, deepTree.left, deepTree.left.left, deepParent, deepParent.right].map(node => node.split.threshold),
  [13.5, 9.5, 2.5, 5.5, 7.5],
);
assert.deepEqual([depthThree.parent.n, depthThree.leftStats.n, depthThree.rightStats.n], [7, 3, 4]);
assert.deepEqual([depthThree.leftStats.score, depthThree.rightStats.score], [0, 1]);
close(depthThree.weighted, 4 / 7, 'Depth-three weights use the seven rows at the immediate parent');
close(depthThree.gain, 0.2916919971387914, 'Depth-three information gain');
assert.equal(deepParent.right.left.stats.prediction, 0);
assert.equal(deepParent.right.right.stats.prediction, 1);
assert.equal(fit(DEEP_TRAIN, 'entropy', 4).left.left.right.right.split, null);

const diagram = new URL('../src/deep-graph.js', import.meta.url);
vm.runInContext(fs.readFileSync(diagram, 'utf8'), context, { filename: diagram.pathname });
const graph = context.TreeLabDeepDiagram.render(deepTree, 'rootllr');
assert.equal((graph.match(/data-deep-node=/g) || []).length, 5);
assert.equal((graph.match(/deep-graph-card--parent/g) || []).length, 1);
assert.equal((graph.match(/deep-graph-card--child/g) || []).length, 2);

const importanceTree = fit(IMPORTANCE_TRAIN, 'entropy', 5);
const firstWeight = importanceTree;
const secondWeight = firstWeight.left;
const thirdWeight = secondWeight.right;
const packaging = thirdWeight.right;
const scan = packaging.left;
assert.deepEqual([firstWeight, secondWeight, thirdWeight, packaging, scan].map(node => node.split.feature),
  ['x', 'x', 'x', 'y', 'z']);
assert.deepEqual([firstWeight, secondWeight, thirdWeight, packaging, scan].map(node => node.stats.n),
  [20, 16, 13, 9, 5]);
assert.equal(scan.split.threshold, 3);
const creditAtFive = importance(importanceTree);
const creditAtFour = importance(fit(IMPORTANCE_TRAIN, 'entropy', 4));
close(creditAtFive.x, 0.5208349300509707, 'Repeated Weight credits across three splits');
close(creditAtFive.y, 0.17049547671085313, 'Packaging credit from nine of twenty rows');
close(creditAtFive.z, 0.24273764861366714, 'Scan credit from five of twenty rows');
close(creditAtFive.total, importanceTree.stats.score, 'All six leaves are pure at depth five');
close(creditAtFour.x, creditAtFive.x, 'Weight raw credit is unchanged at depth four');
assert.equal(creditAtFour.z ?? 0, 0);
assert.ok(creditAtFour.x / creditAtFour.total > creditAtFive.x / creditAtFive.total);
assert.equal(IMPORTANCE_TRAIN.filter(row => predict(importanceTree, row) === row.label).length, 20);
const creditGraph = context.TreeLabDeepDiagram.render(importanceTree, 'rootlr', {
  featureFocus: 'x',
  credits: new Map([['rootlr', 13 / 20 * thirdWeight.gain]]),
});
assert.equal((creditGraph.match(/is-contributor/g) || []).length, 3);
assert.equal((creditGraph.match(/is-focus/g) || []).length, 1);
assert.match(creditGraph, /Credit 0.2340 bits/);
console.log('PASS: split scores, stopping, evaluation, depth-five entropy, and repeated feature credit.');
