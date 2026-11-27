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
const bike = embedded('foundation-bike-data');
assert.deepEqual(first, fixture('unit-1.json'));
assert.deepEqual(exploration, fixture('unit-3.json'));
assert.deepEqual(evaluation, fixture('unit-4.json'));
assert.deepEqual(regression, fixture('unit-5.json'));
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

const downloads = embedded('foundation-downloads');
const notebookNames = fs.readdirSync(path.join(lab, 'notebooks')).filter(name => name.endsWith('.ipynb'));
assert.equal(notebookNames.length, 5);
for (const name of notebookNames) {
  assert.equal(page.includes('colab.research.google.com/github/sharanharsoor/ml-learning-lab/blob/main/labs/ml-foundations/notebooks/' + name), true);
  assert.deepEqual(Buffer.from(downloads[name].data, 'base64'), fs.readFileSync(path.join(lab, 'notebooks', name)));
}
const csv = Buffer.from(downloads['bike-share-starter-rows.csv'].data, 'base64').toString('utf8').trim().split('\n');
assert.equal(csv.length, first.history.length + 2);
assert.equal(csv.at(-1), '15928,2012-11-01,8,1,680,held_out_example');
assert.equal(page.match(/class="lab-quiz"/g).length, 9);
for (const label of ['Show options', 'What is the right answer?', 'Show explanation']) {
  assert.equal(page.split(`<summary>${label}</summary>`).length - 1, 9);
}
assert.ok(home.indexOf('href="./ml-foundations/" aria-label="Open ML Foundations"') <
  home.indexOf('href="./bagging/" aria-label='));
assert.ok(home.includes('./ml-foundations/#unit-1'));
assert.doesNotMatch(page, /\{\{[A-Z0-9_]+\}\}/);
console.log('Verified Foundations forecasts, regression fits, held-out metrics, notebook downloads, quizzes, and course entry.');
