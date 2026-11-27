(() => {
  'use strict';

  const unit = document.getElementById('unit-2');
  const bike = window.Foundations?.bike;
  if (!unit || !bike) return;

  const get = id => unit.querySelector('#py-' + id);
  const cases = bike.rows.filter(row => row.hour >= 7 && row.hour <= 9);
  const example = cases.find(row => row.hour === 8);
  const { train_group_total: total, train_group_count: count, actual } = example;
  const forecast = Math.round(total / count);
  const cells = [
    {
      title: 'Cell 1 · Name the inputs',
      code: 'rentals_total = ' + total + '\nhours_seen = ' + count + '\nprint(rentals_total, hours_seen)',
      output: total + ' ' + count,
      reading: 'Each name holds a number from the fitted group of earlier workday 8 a.m. hours.',
    },
    {
      title: 'Cell 2 · Define and call a function',
      code: 'def forecast(total, count):\n    return round(total / count)\n\npredicted = forecast(rentals_total, hours_seen)\nprint(predicted)',
      output: String(forecast),
      reading: 'Divide ' + total.toLocaleString('en-US') + ' by ' + count + ' to get about ' +
        (total / count).toFixed(2) + ' rentals. Round the prediction to ' + forecast + ' whole rentals.',
    },
    {
      title: 'Cell 3 · Read the observation and measure error',
      code: 'actual = ' + actual + '\nresidual = actual - predicted\nprint(residual)',
      output: String(actual - forecast),
      reading: 'The recorded count was ' + actual + '. A positive residual of ' +
        (actual - forecast) + ' rentals means the model predicted too low.',
    },
  ];
  const run = get('run-cell');
  const reset = get('reset-cell');
  let runs = 0;

  function paintCell() {
    const cell = cells[Math.max(0, runs - 1)];
    get('code-label').textContent = cell.title;
    get('cell-code').textContent = cell.code;
    get('cell-output').textContent = runs ? cell.output : 'Run the first cell to see its output.';
    get('cell-reading').textContent = cell.reading;
    get('cell-status').textContent = runs + ' of ' + cells.length + ' cells run.';
    run.disabled = runs === cells.length;
    run.textContent = run.disabled ? 'All cells run' : 'Run cell ' + (runs + 1);
    reset.disabled = !runs;
  }
  run.addEventListener('click', () => {
    runs += 1;
    paintCell();
    if (run.disabled) reset.focus();
  });
  reset.addEventListener('click', () => {
    runs = 0;
    paintCell();
    run.focus();
  });
  paintCell();

  const hour = get('hour-filter');
  const workday = get('workday-filter');
  const past = get('past-filter');
  const preview = [...get('preview-rows').rows];
  function filter() {
    let visible = 0;
    for (const row of preview) {
      const matches = (hour.value === 'all' || row.dataset.hour === hour.value) &&
        (workday.value === 'all' || row.dataset.workday === workday.value) &&
        (!past.checked || row.dataset.date < example.date);
      row.hidden = !matches;
      if (matches) visible += 1;
    }
    const status = visible === preview.length ? 'Showing all ' + visible + ' rows in the excerpt.'
      : 'Showing ' + visible + ' of ' + preview.length + ' rows in the excerpt.';
    get('filter-status').textContent = status + (visible ? '' : ' No rows match these filters.');
  }
  for (const control of [hour, workday, past]) control.addEventListener('change', filter);
  filter();

  const max = Math.ceil(Math.max(...cases.map(row => row.actual)) / 100) * 100;
  const bar = (label, value) => `<div class="py-plot-barline"><span>${label} <strong>${value}</strong></span>
    <span class="py-track" aria-hidden="true"><span class="py-fill" style="--py-width:${100 * value / max}%"></span></span></div>`;
  get('plot').innerHTML = cases.map(row => `<div class="py-plot-hour"><strong>${row.case_id}</strong>
    <div class="py-plot-pairs">${bar('Forecast', row.predicted)}${bar('Recorded', row.actual)}</div></div>`
  ).join('') + `<p class="py-plot-scale">Each track spans 0 to ${max} rentals.</p>`;
})();
