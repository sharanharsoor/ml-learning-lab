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
const bike = embedded('foundation-bike-data');
assert.deepEqual(first, fixture('unit-1.json'));
assert.deepEqual(exploration, fixture('unit-3.json'));
assert.deepEqual(evaluation, fixture('unit-4.json'));
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

const downloads = embedded('foundation-downloads');
const notebookNames = fs.readdirSync(path.join(lab, 'notebooks')).filter(name => name.endsWith('.ipynb'));
assert.equal(notebookNames.length, 4);
for (const name of notebookNames) {
  assert.equal(page.includes('colab.research.google.com/github/sharanharsoor/ml-learning-lab/blob/main/labs/ml-foundations/notebooks/' + name), true);
  assert.deepEqual(Buffer.from(downloads[name].data, 'base64'), fs.readFileSync(path.join(lab, 'notebooks', name)));
}
const csv = Buffer.from(downloads['bike-share-starter-rows.csv'].data, 'base64').toString('utf8').trim().split('\n');
assert.equal(csv.length, first.history.length + 2);
assert.equal(csv.at(-1), '15928,2012-11-01,8,1,680,held_out_example');
assert.equal(page.match(/class="lab-quiz"/g).length, 6);
for (const label of ['Show options', 'What is the right answer?', 'Show explanation']) {
  assert.equal(page.split(`<summary>${label}</summary>`).length - 1, 6);
}
assert.ok(home.indexOf('href="./ml-foundations/" aria-label="Open ML Foundations"') <
  home.indexOf('href="./bagging/" aria-label='));
assert.ok(home.includes('./ml-foundations/#unit-1'));
assert.doesNotMatch(page, /\{\{[A-Z0-9_]+\}\}/);
console.log('Verified Foundations fixtures, predictions, validation and test metrics, notebook downloads, and course entry.');
