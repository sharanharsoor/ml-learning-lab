(() => {
  'use strict';

  const { bike, unitOne } = window.Foundations;
  const get = id => document.getElementById(id);
  const morning = bike.rows.find(row => row.hour === 8);
  const nextHour = bike.rows.find(row => row.hour === 9);
  const { train_group_count: trainingCount, train_group_total: trainingTotal } = morning;
  const matchesForecast = row => row.hour === unitOne.forecast.hour &&
    row.workingday === unitOne.forecast.workingday;
  const difference = morning.actual - morning.predicted;
  const signed = number => number > 0 ? '+' + number : String(number).replace('-', '−');
  const code = `total_rentals = ${trainingTotal}
matching_hours = ${trainingCount}
forecast = round(total_rentals / matching_hours)
print(forecast)`;
  const number = value => value.toLocaleString('en-US');
  const reveal = get('first-reveal');
  const reset = get('first-reset');
  let stage = 0;

  get('first-history').innerHTML = unitOne.history.map(row => `
    <tr class="${matchesForecast(row) ? 'first-match' : ''}">
    <th scope="row">${row.row_id}</th><td>${row.date}</td><td>${String(row.hour).padStart(2, '0')}:00</td>
    <td>${row.workingday ? 'Yes' : 'No'}</td><td>${number(row.rentals)}</td>
    <td>${matchesForecast(row) ? '<strong>Yes</strong>' : 'No, non-workday'}</td></tr>`).join('');
  const matchingCounts = unitOne.history.filter(matchesForecast).map(row => row.rentals);
  const excerptTotal = matchingCounts.reduce((sum, count) => sum + count, 0);
  get('first-history-note').textContent =
    `All six rows are at 08:00. The ${matchingCounts.length} highlighted workdays also match the day type. Add their recorded counts, then divide by the number of matching rows.`;
  get('first-history-calculation').textContent =
    `${matchingCounts.map(number).join(' + ')} = ${number(excerptTotal)} rentals. ${number(excerptTotal)} ÷ ${matchingCounts.length} = ${number(excerptTotal / matchingCounts.length)} rentals per hour in this excerpt.`;
  get('first-practice-prompt').textContent =
    `Past 09:00 workday hours recorded ${number(nextHour.train_group_total)} rentals across ${number(nextHour.train_group_count)} hours. The next hour in the test data recorded ${number(nextHour.actual)} rentals. Calculate the rounded forecast and the residual. Did the forecast run high or low?`;
  get('first-practice-answer').textContent =
    `${number(nextHour.train_group_total)} ÷ ${nextHour.train_group_count} ≈ ${nextHour.predicted} rentals. Residual = ${nextHour.actual} − ${nextHour.predicted} = ${signed(nextHour.actual - nextHour.predicted)} rentals. The forecast was too low.`;

  function render() {
    reveal.hidden = stage === 2;
    reset.hidden = stage === 0;
    reveal.textContent = stage === 0 ? 'Reveal forecast' : 'Reveal actual count';
    const forecast = stage ? `<div class="first-calculation">
      <p><strong>Historical calendar forecast</strong></p>
      <p>Take the mean of all training hours that match 08:00 and workday status.</p>
      <p class="formula">${number(trainingTotal)} rentals ÷ ${number(trainingCount)} hours
      = ${(trainingTotal / trainingCount).toFixed(2)} rentals per hour, rounded to ${morning.predicted}.</p>
      <details><summary>See the Python for this step</summary><pre><code>${code}</code></pre></details>
    </div>` : '';
    const actual = stage === 2 ? `<dl class="first-score">
      <div><dt>Forecast</dt><dd>${morning.predicted} rentals</dd></div>
      <div><dt>Recorded count</dt><dd>${morning.actual} rentals</dd></div>
      <div><dt>Residual</dt><dd>${signed(difference)} rentals</dd></div>
    </dl>
    <p class="formula">Actual − prediction = ${morning.actual} − ${morning.predicted} = ${difference} rentals</p>
    <p>Source row ${unitOne.forecast.row_id} records the observed count for 08:00–08:59. That count is the ground truth for this evaluation. The forecast was <strong>${difference} rentals too low</strong>. A residual is the signed difference for one example. We’ll measure how the model performs across many hours in Unit 4.</p>` : '';
    get('first-result').innerHTML = forecast + actual;
  }

  reveal.addEventListener('click', () => {
    stage += 1;
    render();
    if (stage === 2) reset.focus({ preventScroll: true });
    get('first-result').scrollIntoView?.({ block: 'nearest' });
  });
  reset.addEventListener('click', () => {
    stage = 0;
    render();
    reveal.focus({ preventScroll: true });
  });

  const tasks = {
    regression: '<strong>Regression.</strong> A rental forecast answers a numeric question. In training, each example has an observed rental count.',
    classification: '<strong>Classification.</strong> The answer is a category, such as Spam or Legitimate. In training, each email has a recorded label.',
    clustering: '<strong>Clustering.</strong> We might group historical days with similar hourly rental patterns. The grouping uses the measured patterns, with no preassigned group for each day.',
  };
  const taskButtons = [...document.querySelectorAll('[data-first-task]')];
  function showTask(task) {
    for (const button of taskButtons) button.setAttribute('aria-pressed', String(button.dataset.firstTask === task));
    get('first-task-reading').innerHTML = tasks[task];
  }
  for (const button of taskButtons) button.addEventListener('click', () => showTask(button.dataset.firstTask));
  showTask('regression');
  render();
})();
