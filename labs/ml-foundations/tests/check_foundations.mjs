import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const lab = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(lab, '../..');
const fixture = name => JSON.parse(fs.readFileSync(path.join(lab, 'data', name), 'utf8'));
const page = fs.readFileSync(path.join(root, 'docs/ml-foundations/index.html'), 'utf8');
const home = fs.readFileSync(path.join(root, 'docs/index.html'), 'utf8');

function embedded(id) {
  const script = page.match(new RegExp(`<script[^>]*id="${id}"[^>]*>([\\s\\S]*?)<\\/script>`));
  assert.ok(script, `Missing data for ${id}`);
  return JSON.parse(script[1]);
}

const first = embedded('foundations-unit-1-data');
const exploration = embedded('foundations-unit-3-data');
const evaluation = embedded('foundations-unit-4-data');
const regression = embedded('foundations-unit-5-data');
const logistic = embedded('foundations-unit-6-data');
const tree = embedded('foundations-unit-8-data');
const bike = embedded('foundation-bike-data');
assert.deepEqual(first, fixture('unit-1.json'));
assert.deepEqual(exploration, fixture('unit-3.json'));
assert.deepEqual(evaluation, fixture('unit-4.json'));
assert.deepEqual(regression, fixture('unit-5.json'));
assert.deepEqual(logistic, fixture('unit-6.json'));
assert.deepEqual(tree, fixture('unit-8.json'));
assert.deepEqual(bike, JSON.parse(fs.readFileSync(
  path.join(root, 'labs/classification-regression-metrics/data/bikeshare_metrics.json'), 'utf8'
)));

const forecast = bike.rows.find(row => row.hour === 8);
assert.equal(forecast.date, first.forecast.date);
assert.equal(forecast.actual, 680);
assert.equal(forecast.actual, first.forecast.rentals);
assert.ok(first.history.every(row => row.date < forecast.date));
assert.ok(first.history.some(row => row.workingday === 0));
const workdays = exploration.groups.workday.map(([, count]) => count);
assert.equal(workdays.length, forecast.train_group_count);
assert.equal(workdays.reduce((sum, count) => sum + count, 0), forecast.train_group_total);
assert.equal(Math.round(forecast.train_group_total / forecast.train_group_count), forecast.predicted);
assert.equal(forecast.actual - forecast.predicted, 210);

assert.equal(evaluation.train.n + evaluation.validation.n, bike.train.n);
assert.ok(evaluation.validation_results.calendar_model.mae < evaluation.validation_results.training_mean.mae);
for (const [type, test] of Object.entries(evaluation.test_results)) {
  assert.equal(test.absolute_error_total / bike.test.n, test.mae);
  assert.equal(test.mae, bike.metric_full_test[type].mae);
}

const sum = values => values.reduce((total, value) => total + value, 0);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} differs from ${expected}`);
const { train, validation, test } = regression.rows;
const allPairs = [...train, ...validation, ...test];
assert.equal(regression.source_sha256, exploration.source_sha256);
assert.deepEqual([train.length, validation.length, test.length], [434, 19, 40]);
assert.equal(new Set(allPairs.map(row => row.date)).size, allPairs.length);
assert.ok(allPairs.every(row => Date.parse(row.date) - Date.parse(row.previousDate) === 86_400_000));
assert.ok(train.every(row => row.date < regression.validationStart));
assert.ok(validation.every(row => row.date >= regression.validationStart && row.date < regression.testStart));
assert.ok(test.every(row => row.date >= regression.testStart));

function refit(rows, cutoff, published) {
  const n = rows.length;
  const sumX = sum(rows.map(row => row.previousRentals));
  const sumY = sum(rows.map(row => row.rentals));
  const sumXX = sum(rows.map(row => row.previousRentals ** 2));
  const sumXY = sum(rows.map(row => row.previousRentals * row.rentals));
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX ** 2);
  const intercept = (sumY - slope * sumX) / n;
  const counts = exploration.groups.workday.filter(([day]) => day < cutoff).map(([, count]) => count);
  const calendar = Math.round(sum(counts) / counts.length);
  assert.equal(published.n, n);
  assert.equal(published.calendarCount, counts.length);
  assert.equal(published.calendarTotal, sum(counts));
  assert.equal(published.calendarPrediction, calendar);
  close(published.slope, slope);
  close(published.intercept, intercept);
  return { baseline: () => calendar, linear: row => intercept + slope * row.previousRentals };
}

const initial = refit(train, regression.validationStart, regression.fits.train);
const final = refit([...train, ...validation], regression.testStart, regression.fits.refit);
for (const [period, rows, models] of [['train', train, initial], ['validation', validation, initial], ['test', test, final]]) {
  for (const [name, predict] of Object.entries(models)) {
    const errors = rows.map(row => row.rentals - predict(row));
    const total = sum(errors.map(Math.abs));
    const score = regression.scores[period][name];
    close(score.absoluteErrorTotal, total);
    close(score.mae, total / rows.length);
    close(score.mse, sum(errors.map(error => error ** 2)) / rows.length);
  }
  assert.ok(regression.scores[period].linear.mae < regression.scores[period].baseline.mae);
}

const focal = test.find(row => row.date === regression.focalDate);
const previous = first.history.find(row => row.row_id === focal.previousRowId);
assert.equal(focal.date, forecast.date);
assert.equal(focal.rentals, forecast.actual);
assert.equal(focal.previousDate, previous.date);
assert.equal(focal.previousRentals, previous.rentals);
assert.equal(final.baseline(), 470);
assert.equal(final.baseline(), forecast.predicted);
assert.equal(final.linear(focal).toFixed(2), '582.57');
const sampleErrors = regression.sampleDates.map(day => {
  const row = train.find(pair => pair.date === day);
  return row.rentals - (regression.demoLine.intercept + regression.demoLine.slope * row.previousRentals);
});
assert.deepEqual(sampleErrors, [269, 111, -42]);
assert.equal(sum(sampleErrors.map(error => error ** 2)), 86_446);

const spamRows = Object.values(logistic.rows);
assert.deepEqual(spamRows.map(rows => rows.length), [2654, 1011, 936]);
assert.deepEqual(spamRows.map(rows => sum(rows.map(row => row.y))), [1075, 386, 352]);
const spamIds = new Set(spamRows.flat().map(row => row.id));
assert.equal(spamIds.size, 4601);
for (let row = 1; row <= spamIds.size; row += 1) assert.ok(spamIds.has(`E${row}`));
const sigmoid = z => 1 / (1 + Math.exp(-z));
const spamLogit = row => logistic.fit.intercept + logistic.fit.weight * row.x;
const spamProbability = row => sigmoid(spamLogit(row));
const trainingErrors = logistic.rows.train.map(row => spamProbability(row) - row.y);
close(sum(trainingErrors), 0);
close(sum(logistic.rows.train.map((row, index) => row.x * trainingErrors[index])), 0);
const spamLoss = sum(logistic.rows.train.map(row => {
  const z = spamLogit(row);
  return Math.max(z, 0) - row.y * z + Math.log1p(Math.exp(-Math.abs(z)));
})) / logistic.rows.train.length;
close(logistic.fit.lossBefore, Math.log(2));
close(logistic.fit.lossAfter, spamLoss);
assert.ok(spamLoss < logistic.fit.lossBefore);
const spamExample = logistic.rows.validation.find(row => row.id === logistic.examples.focal);
assert.deepEqual(spamExample, { id: 'E17', x: 0.428, y: 1 });
assert.equal(spamProbability(spamExample).toFixed(4), '0.4866');

function confusion(rows, threshold, probability = spamProbability) {
  const counts = { tp: 0, fp: 0, fn: 0, tn: 0 };
  for (const row of rows) {
    const predicted = probability(row) >= threshold;
    if (predicted) counts[row.y ? 'tp' : 'fp'] += 1;
    else counts[row.y ? 'fn' : 'tn'] += 1;
  }
  return counts;
}

assert.equal(logistic.thresholds.default, 0.5);
assert.deepEqual(logistic.thresholds.presets, [0.35, 0.5, 0.65]);
const [low, standard, high] = logistic.thresholds.presets.map(threshold => confusion(logistic.rows.validation, threshold));
assert.deepEqual(standard, { tp: 141, fp: 21, fn: 245, tn: 604 });
assert.ok(low.tp > standard.tp && standard.tp > high.tp);
assert.ok(low.fp > standard.fp && standard.fp > high.fp);

const practiceBudget = 25;
const candidates = logistic.thresholds.presets.map((threshold, index) => ({
  threshold,
  counts: [low, standard, high][index],
}));
const accepted = candidates.filter(({ counts }) => counts.fp <= practiceBudget);
assert.deepEqual(accepted.map(({ threshold }) => threshold), [0.5, 0.65]);
const winner = accepted.reduce((best, candidate) => candidate.counts.tp > best.counts.tp ? candidate : best);
assert.equal(winner.threshold, 0.5);
const heldOut = confusion(logistic.rows.test, winner.threshold);
assert.deepEqual(heldOut, { tp: 138, fp: 27, fn: 214, tn: 557 });
assert.ok(heldOut.fp > practiceBudget);
const inboxOnly = confusion(logistic.rows.test, Infinity);
assert.equal(inboxOnly.tp, 0);
assert.equal((inboxOnly.tn / logistic.rows.test.length).toFixed(4), '0.6239');

const { tp, fp, fn, tn } = winner.counts;
assert.deepEqual([
  ((tp + tn) / logistic.rows.validation.length).toFixed(4),
  (tp / (tp + fp)).toFixed(4),
  (tp / (tp + fn)).toFixed(4),
  (fp / (fp + tn)).toFixed(4),
  (2 * tp / (2 * tp + fp + fn)).toFixed(4),
], ['0.7369', '0.8704', '0.3653', '0.0336', '0.5146']);

const ranked = logistic.rows.validation.map(row => ({ ...row, score: spamProbability(row) }));
const actualSpam = ranked.filter(row => row.y === 1);
const actualLegitimate = ranked.filter(row => row.y === 0);
let wins = 0;
let ties = 0;
for (const spam of actualSpam) {
  for (const legitimate of actualLegitimate) {
    if (spam.score > legitimate.score) wins += 1;
    if (spam.score === legitimate.score) ties += 1;
  }
}
assert.deepEqual([wins, ties], [193_544, 28_093]);
close((wins + 0.5 * ties) / (actualSpam.length * actualLegitimate.length), 0.8604787565);
const tiedScore = ranked.find(row => row.id === 'E1405').score;
const tiedRows = ranked.filter(row => row.score === tiedScore);
assert.deepEqual(tiedRows.map(({ id, y }) => [id, y]), [['E1405', 1], ['E3487', 0]]);
const highEnough = confusion(logistic.rows.validation, tiedScore);
assert.equal(highEnough.tp, actualSpam.filter(row => row.score > tiedScore).length + 1);
assert.equal(highEnough.fp, actualLegitimate.filter(row => row.score > tiedScore).length + 1);

assert.equal(tree.source_sha256, logistic.source_sha256);
assert.deepEqual(tree.features.map(({ key, column }) => [key, column]), [['x', 51], ['uppercase', 55]]);
for (const [fold, rows] of Object.entries(tree.rows)) {
  assert.deepEqual(rows.map(({ id, x, y }) => ({ id, x, y })), logistic.rows[fold]);
  assert.ok(rows.every(row => Number.isInteger(row.uppercase) && row.uppercase >= 1));
}

function checkNodeSummary(summary, rows) {
  const spam = sum(rows.map(row => row.y));
  const legitimate = rows.length - spam;
  assert.deepEqual([summary.n, summary.spam, summary.legitimate], [rows.length, spam, legitimate]);
  close(summary.impurity, 1 - (spam / rows.length) ** 2 - (legitimate / rows.length) ** 2);
}

function checkSplit(split, rows, left, right) {
  const yes = rows.filter(row => row[split.feature] <= split.threshold);
  const no = rows.filter(row => row[split.feature] > split.threshold);
  checkNodeSummary(left, yes);
  checkNodeSummary(right, no);
  close(split.threshold, (Math.max(...yes.map(row => row[split.feature]))
    + Math.min(...no.map(row => row[split.feature]))) / 2);
  const weighted = (yes.length * left.impurity + no.length * right.impurity) / rows.length;
  close(split.weightedImpurity, weighted);
  return [yes, no];
}

function checkTree(node, rows, depth, visited) {
  visited.set(node.id, { node, rows });
  checkNodeSummary(node, rows);
  close(node.score, node.spam / rows.length);
  assert.equal(node.prediction, Number(node.score >= 0.5));
  if (!node.feature) return;
  assert.ok(depth > 0);
  assert.equal(node.left.id, node.id + 'L');
  assert.equal(node.right.id, node.id + 'R');
  const [yes, no] = checkSplit(node, rows, node.left, node.right);
  close(node.gain, node.impurity - node.weightedImpurity);
  assert.ok(node.gain > 0);
  checkTree(node.left, yes, depth - 1, visited);
  checkTree(node.right, no, depth - 1, visited);
}

function leafScore(root, row) {
  let node = root;
  while (node.feature) node = row[node.feature] <= node.threshold ? node.left : node.right;
  return node.score;
}

const matrixOf = ({ tp, fp, fn, tn }) => ({ tp, fp, fn, tn });
const treeDepths = Object.keys(tree.trees).map(Number);
assert.deepEqual(treeDepths, [1, 2, 3, 4]);
const deepestNodes = new Map();
for (const depth of treeDepths) {
  const { root } = tree.trees[depth];
  checkTree(root, tree.rows.train, depth, depth === 4 ? deepestNodes : new Map());
  for (const fold of ['train', 'validation']) {
    const reported = tree.trees[depth][fold];
    assert.deepEqual(matrixOf(reported), confusion(tree.rows[fold], 0.5, row => leafScore(root, row)));
    close(reported.accuracy, (reported.tp + reported.tn) / tree.rows[fold].length);
  }
}
assert.deepEqual(tree.splitExamples.map(({ nodeId, parent }) => [nodeId, parent.n]), [['root', 2654], ['rootL', 1502]]);
for (const { nodeId, parent, candidates: splits } of tree.splitExamples) {
  const { node, rows } = deepestNodes.get(nodeId);
  checkNodeSummary(parent, rows);
  assert.equal(splits.length, 2);
  assert.equal(splits[0].feature, node.feature);
  assert.equal(splits[0].threshold, node.threshold);
  assert.ok(splits[0].gain > splits[1].gain);
  for (const split of splits) {
    checkSplit(split, rows, split.left, split.right);
    close(split.gain, parent.impurity - split.weightedImpurity);
  }
}
const bestValidationAccuracy = Math.max(...treeDepths.map(depth => tree.trees[depth].validation.accuracy));
assert.equal(tree.selectedDepth, treeDepths.find(depth => tree.trees[depth].validation.accuracy === bestValidationAccuracy));
assert.equal(tree.selectedDepth, 3);
assert.equal(tree.trees[3].validation.accuracy, tree.trees[4].validation.accuracy);
assert.ok(tree.trees[4].train.accuracy > tree.trees[3].train.accuracy);
const selectedTree = tree.trees[tree.selectedDepth].root;
const logisticTwoFeatureProbability = row => sigmoid(tree.logistic.intercept
  + tree.logistic.weights.x * row.x + tree.logistic.weights.uppercase * row.uppercase);
const logisticTreeMatrix = confusion(tree.rows.test, 0.5, logisticTwoFeatureProbability);
assert.deepEqual(matrixOf(tree.logistic.validation), confusion(tree.rows.validation, 0.5, logisticTwoFeatureProbability));
assert.deepEqual(matrixOf(tree.test.logistic), logisticTreeMatrix);
assert.deepEqual(matrixOf(tree.test.tree), confusion(tree.rows.test, 0.5, row => leafScore(selectedTree, row)));
assert.deepEqual(matrixOf(tree.test.tree), { tp: 243, fp: 55, fn: 109, tn: 529 });
assert.deepEqual(logisticTreeMatrix, { tp: 172, fp: 37, fn: 180, tn: 547 });

const downloads = embedded('foundation-downloads');
const notebookNames = fs.readdirSync(path.join(lab, 'notebooks')).filter(name => name.endsWith('.ipynb'));
assert.equal(notebookNames.length, 8);
for (const name of notebookNames) {
  assert.equal(page.includes('colab.research.google.com/github/sharanharsoor/ml-learning-lab/blob/main/labs/ml-foundations/notebooks/' + name), true);
  assert.deepEqual(Buffer.from(downloads[name].data, 'base64'), fs.readFileSync(path.join(lab, 'notebooks', name)));
}
const csv = Buffer.from(downloads['bike-share-starter-rows.csv'].data, 'base64').toString('utf8').trim().split('\n');
assert.equal(csv.length, first.history.length + 2);
assert.equal(csv.at(-1), '15928,2012-11-01,8,1,680,held_out_example');
assert.equal(page.match(/class="lab-quiz"/g).length, 20);
for (const label of ['Show options', 'What is the right answer?', 'Show explanation']) {
  assert.equal(page.split(`<summary>${label}</summary>`).length - 1, 20);
}
assert.ok(home.indexOf('href="./ml-foundations/" aria-label="Open ML Foundations"') <
  home.indexOf('href="./bagging/" aria-label='));
assert.ok(home.includes('./ml-foundations/#unit-1'));
assert.ok(page.includes('href="#unit-6"') && page.includes('value="unit-6"'));
assert.ok(page.includes('href="#unit-7"') && page.includes('value="unit-7"'));
assert.ok(page.includes('href="#unit-8"') && page.includes('value="unit-8"'));
const metricsLesson = page.slice(page.indexOf('<section class="course-page" id="unit-7"'), page.indexOf('<section class="course-page" id="unit-8"'));
assert.ok(metricsLesson.includes('href="https://sharanharsoor.github.io/ml-learning-lab/classification-regression-metrics/#classification"'));
const treeLesson = page.slice(page.indexOf('<section class="course-page" id="unit-8"'), page.indexOf('<section class="course-page" id="course"'));
assert.ok(treeLesson.includes('href="https://sharanharsoor.github.io/ml-learning-lab/decision-trees/#split"'));
assert.ok(treeLesson.includes('href="https://sharanharsoor.github.io/ml-learning-lab/decision-trees/#tree"'));
assert.doesNotMatch(page, /\{\{[A-Z0-9_]+\}\}/);
console.log('Verified Foundations model fits, held-out metrics, ROC ranking, tree splits, notebooks, quizzes, and course links.');
