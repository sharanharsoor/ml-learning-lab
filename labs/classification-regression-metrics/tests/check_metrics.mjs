import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const lab = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = process.argv[2] || path.resolve(lab, '../../docs/classification-regression-metrics/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const fixture = name => JSON.parse(fs.readFileSync(path.join(lab, 'data', name), 'utf8'));
const closeTo = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} ≠ ${expected}`);
const script = id => {
  const match = html.match(new RegExp(`<script[^>]+id="${id}"[^>]*>([\\s\\S]*?)<\\/script>`));
  assert.ok(match, `Missing embedded script ${id}`);
  return match[1];
};
const spam = fixture('spam_classification.json');
const bike = fixture('bikeshare_metrics.json');
assert.deepEqual(JSON.parse(script('metrics-classification-data')), spam);
assert.deepEqual(JSON.parse(script('regression-teaching-fixture')), bike);

const window = {};
const document = { getElementById: id => ({ textContent: script(id) }) };
vm.runInNewContext(script('metrics-core-code'), { window, document });
const { classify, roc, regression } = window.MetricsCore;
const expectedCounts = new Map([
  [0.5, [9, 2, 1, 8]], [0.75, [8, 1, 2, 9]], [0.2, [9, 3, 1, 7]],
  [0, [10, 10, 0, 0]], [1.01, [0, 0, 10, 10]],
]);
for (const [threshold, counts] of expectedCounts) {
  const results = classify(threshold);
  assert.deepEqual([results.tp, results.fp, results.fn, results.tn], counts);
}

for (const threshold of [...spam.rows.map(row => row.score), 0.5178, 1.01]) {
  const expected = { tp: 0, fp: 0, fn: 0, tn: 0 };
  const result = classify(threshold);
  for (const [index, row] of spam.rows.entries()) {
    const prediction = Number(row.score >= threshold);
    const outcome = ['tn', 'fp', 'fn', 'tp'][2 * row.actual + prediction];
    expected[outcome] += 1;
    assert.equal(result.cases[index].caseId, row.id);
    assert.equal(result.cases[index].outcome, outcome);
  }
  for (const [outcome, count] of Object.entries(expected)) assert.equal(result[outcome], count);
}

assert.equal(classify(0.5177).cases.find(row => row.caseId === 'E4130').outcome, 'fp');
assert.equal(classify(0.5178).cases.find(row => row.caseId === 'E4130').outcome, 'tn');
assert.equal(classify(1.01).precision, null);
assert.equal(classify(1.01).f1, 0);
closeTo(classify(0.5).precision, 9 / 11);
closeTo(classify(0.5).recall, 9 / 10);
closeTo(classify(0.5).f1, 18 / 21);
closeTo(classify(0.5).accuracy, 17 / 20);

const ranking = roc();
assert.equal(ranking.wins, 84);
assert.equal(ranking.ties, 1);
assert.equal(ranking.pairs, 100);
closeTo(ranking.auc, 0.845);
const trapezoids = ranking.points.slice(1).map(({ fpr, tpr }, i) => {
  const previous = ranking.points[i];
  return (fpr - previous.fpr) * (tpr + previous.tpr) / 2;
});
closeTo(trapezoids.reduce((sum, area) => sum + area, 0), ranking.auc);
assert.equal(roc([{ id: 'a', score: 0.4, actual: 0 }, { id: 'b', score: 0.4, actual: 1 }]).auc, 0.5);

const observed = bike.rows.map(row => row.actual);
const fitted = regression(bike.rows.map(row => row.predicted));
assert.deepEqual(Array.from(fitted.residuals), [131, 210, 93, 12, 13]);
assert.equal(fitted.mae, 91.8);
assert.equal(fitted.mse, 14044.6);
closeTo(fitted.rmse, Math.sqrt(14044.6));
closeTo(fitted.r2, 1 - 70223 / 188175.2);
assert.equal(regression(observed).r2, 1);
closeTo(regression(observed.map(() => fitted.mean)).r2, 0);
assert.ok(regression(observed.map(() => 1000)).r2 < 0);
assert.equal(regression([2, 2], [1, 1]).r2, null);

const assets = JSON.parse(script('kit-embedded-assets'));
for (const name of ['spam_classification.csv', 'bikeshare_metrics.csv', 'metrics_demo.py', 'metrics-teaching-resources.zip']) {
  assert.ok(assets[name]?.b64, `Missing download ${name}`);
}
const quizzes = html.match(/class="lab-quiz"/g)?.length || 0;
assert.ok(quizzes >= 6);
for (const label of ['Show options', 'What is the right answer?', 'Show explanation']) {
  const count = html.split(`<summary>${label}</summary>`).length - 1;
  assert.equal(count, quizzes, `Every knowledge check has stage ${label}`);
}
console.log('Verified real-data fixtures, threshold ties, ROC-AUC, rental errors, downloads, and quiz stages.');
