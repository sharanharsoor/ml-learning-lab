(() => {
  'use strict';

  const root = document.getElementById('regression-teaching');
  if (!root) return;

  const select = selector => root.querySelector(selector);
  const selectAll = selector => Array.from(root.querySelectorAll(selector));
  const { regressionData: fixture, regression: evaluate } = window.MetricsCore;
  const rows = fixture.rows;
  const actual = rows.map(row => row.actual);
  const fitted = rows.map(row => row.predicted);
  const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format;
  const r2Format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 });
  const number = value => fmt(value).replace('-', '−');
  const signed = value => value > 0 ? '+' + number(value) : number(value);

  const forecastMax = Math.ceil(Math.max(...fitted) / 100) * 100;
  select('#rg-opening-forecast').innerHTML = rows.map(row => `
    <li><div class="rg-opening-bar"><span aria-hidden="true" style="height:${row.predicted / forecastMax * 100}%"></span></div>
      <strong>${number(row.predicted)}</strong><span>${row.case_id}</span></li>`).join('');

  function model(name, origin, predictions) {
    return { name, origin, predictions, ...evaluate(predictions) };
  }

  const calendar = model('Fitted calendar model', 'The forecasts use earlier counts for the same hour and workday status.', fitted);
  const { mean, baselineErrors, sst } = calendar;
  const distributed = model('Five small misses', 'For this comparison only, set each forecast 10 rentals high.', actual.map(value => value + 10));
  const concentrated = model('One large miss', 'Make the first four forecasts exact and the last one 50 rentals high.', actual.map((value, index) => value + (index === actual.length - 1 ? 50 : 0)));
  const references = [
    calendar,
    model('Evaluation mean', 'Repeat the five observed counts’ mean for every hour. This is the reference built into R².', actual.map(() => mean)),
    model('Training mean', 'Repeat the mean from earlier training hours. A constant forecast can use this value before the hour starts.', actual.map(() => fixture.baseline)),
    model('Always predict zero', 'Predict zero rentals for every hour as a deliberately poor comparison.', actual.map(() => 0)),
    model('Perfect forecasts', 'Set each forecast equal to its observed count to show the upper bound of R².', actual),
  ];

  const steps = selectAll('[data-rg-step]');
  const panes = selectAll('[data-rg-pane]');
  const previous = select('#rg-previous');
  const next = select('#rg-next');
  let activeStep = 0;
  function showStep(index, focusHeading = false) {
    const button = steps[index];
    const step = button.dataset.rgStep;
    const pane = panes.find(item => item.dataset.rgPane === step);
    activeStep = index;
    steps.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    panes.forEach(item => { item.hidden = item !== pane; });
    previous.disabled = index === 0;
    next.disabled = index === steps.length - 1;
    if (focusHeading) {
      const heading = pane.querySelector('h3');
      heading.tabIndex = -1;
      heading.focus();
    }
  }
  steps.forEach((button, index) => button.addEventListener('click', () => showStep(index)));
  previous.addEventListener('click', () => showStep(activeStep - 1, true));
  next.addEventListener('click', () => showStep(activeStep + 1, true));

  const order = select('#rg-order');
  const reveal = select('#rg-reveal-actual');
  order.replaceChildren(...rows.map((row, index) => new Option(row.case_id + '–' + String(row.hour + 1).padStart(2, '0') + ':00', String(index))));
  order.value = '0';
  const timelineMax = Math.ceil(Math.max(...actual, ...fitted) / 100) * 100;

  function residualEquation(observed, estimate, residual) {
    return number(observed) + ' − ' + number(estimate) + ' = ' + signed(residual);
  }

  function renderTimeline(revealed) {
    const index = Number(order.value);
    const row = rows[index];
    const residual = calendar.residuals[index];
    const start = 100 * Math.min(row.actual, row.predicted) / timelineMax;
    const gap = 100 * Math.abs(residual) / timelineMax;
    const nextHour = String(row.hour + 1).padStart(2, '0') + ':00';
    reveal.setAttribute('aria-pressed', String(revealed));
    reveal.textContent = revealed ? 'Hide actual count' : 'Reveal actual count';
    select('#rg-forecast-cards').innerHTML = `
      <article><strong>Before ${row.case_id}</strong><span>${number(row.predicted)} rentals forecast</span>
        <small>${number(row.train_group_total)} rentals ÷ ${number(row.train_group_count)} earlier ${row.case_id} workday hours ≈ ${number(row.predicted)} after rounding</small></article>
      <article><strong>After ${nextHour}</strong><span>${revealed ? number(row.actual) + ' rentals recorded' : 'Actual count hidden'}</span>
        <small>Read the completed hour’s observed total.</small></article>`;
    select('#rg-timeline').innerHTML = `
      <div class="rg-timeline">
        <div class="rg-timeline-track" aria-hidden="true">
          ${revealed ? '<span class="rg-timeline-gap" style="left:' + start + '%;width:' + gap + '%"></span><span class="rg-timeline-actual" style="left:' + (100 * row.actual / timelineMax) + '%"></span>' : ''}
          <span class="rg-timeline-predicted" style="left:${100 * row.predicted / timelineMax}%"></span>
        </div>
        <div class="rg-timeline-axis"><span>0 rentals</span><span>${number(timelineMax)} rentals</span></div>
        <div class="rg-timeline-key">
          <span><i class="rg-predicted-key" aria-hidden="true"></i>Forecast <strong>${number(row.predicted)}</strong></span>
          ${revealed ? '<span><i class="rg-actual-key" aria-hidden="true"></i>Actual <strong>' + number(row.actual) + '</strong></span>' : ''}
        </div>
      </div>`;
    const direction = residual < 0 ? 'It forecast too many rentals.' : residual > 0 ? 'It forecast too few rentals.' : 'The forecast matched the observed count.';
    select('#rg-order-reading').textContent = revealed
      ? 'Residual = actual − forecast = ' + residualEquation(row.actual, row.predicted, residual) + ' rentals. ' + direction
      : 'Decide which information is available before the hour, then reveal the actual count.';
  }

  function unsetActual() {
    renderTimeline(false);
  }

  order.addEventListener('change', unsetActual);
  reveal.addEventListener('click', () => renderTimeline(reveal.getAttribute('aria-pressed') !== 'true'));
  select('#rg-training-period').textContent = `Fit on ${number(fixture.train.n)} recorded hours from ${fixture.train.start} through ${fixture.train.end}. Set aside all ${number(fixture.test.n)} recorded hours from ${fixture.test.start} through ${fixture.test.end}.`;

  let setName = 'real';
  let errorType = 'absolute';
  const setButtons = selectAll('[data-rg-example]');
  const errorButtons = selectAll('[data-rg-error]');
  function renderErrors() {
    const absolute = errorType === 'absolute';
    const models = setName === 'real' ? [calendar] : [distributed, concentrated];
    const values = models.map(item => absolute ? item.absoluteErrors : item.squaredErrors);
    const largest = Math.max(...values.flat(), 1);
    const unit = absolute ? 'rentals' : 'rentals²';
    const cards = models.map((item, index) => {
      const errors = values[index];
      const bars = errors.map((value, rowIndex) => `
        <div class="rg-bar-row">
          <span>${rows[rowIndex].case_id}<small class="rg-bar-operands">${residualEquation(actual[rowIndex], item.predictions[rowIndex], item.residuals[rowIndex])}</small></span>
          <span class="rg-bar-track" aria-hidden="true"><span style="width:${100 * value / largest}%"></span></span>
          <strong>${number(value)} ${unit}</strong>
        </div>`).join('');
      const n = errors.length;
      const terms = errors.map(number).join(' + ');
      const equation = absolute
        ? `<strong>MAE = Σ |y − ŷ| ÷ n</strong><br>(${terms}) ÷ ${n} = ${number(item.mae)} rentals`
        : `<strong>MSE = Σ (y − ŷ)² ÷ n</strong><br>(${terms}) ÷ ${n} = ${number(item.mse)} rentals²<br><strong>RMSE = √MSE</strong><br>√${number(item.mse)} ${Number.isInteger(item.rmse) ? '=' : '≈'} ${number(item.rmse)} rentals`;
      return `<article class="rg-error-card">
        <h4>${item.name}</h4>
        <p class="rg-chart-scale">${item.origin}</p>
        <div class="rg-error-bars" aria-label="${absolute ? 'Absolute' : 'Squared'} errors in ${unit}">${bars}</div>
        <p>${equation}</p>
      </article>`;
    });
    setButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.rgExample === setName)));
    errorButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.rgError === errorType)));
    select('#rg-error-bars').innerHTML = `
      <div class="rg-error-grid">${cards.join('')}</div>
      <p class="rg-chart-scale">Shared scale from 0 to ${number(largest)} ${unit} per hour. The equation beside each hour is actual − forecast.</p>`;
  }
  setButtons.forEach(button => button.addEventListener('click', () => { setName = button.dataset.rgExample; renderErrors(); }));
  errorButtons.forEach(button => button.addEventListener('click', () => { errorType = button.dataset.rgError; renderErrors(); }));

  const cancellationForecasts = actual.map((value, index) => value + ([-10, 10][index] ?? 0));
  const cancellation = evaluate(cancellationForecasts);
  select('#rg-cancelled').innerHTML = `
    <ul>${rows.slice(0, 2).map((row, index) => `<li><strong>${row.case_id}</strong> · ${residualEquation(actual[index], cancellationForecasts[index], cancellation.residuals[index])}</li>`).join('')}</ul>
    <p>Mean residual = (+10 − 10 + 0 + 0 + 0) ÷ 5 = 0 rentals. <strong>MAE = (10 + 10 + 0 + 0 + 0) ÷ 5 = ${number(cancellation.mae)} rentals.</strong></p>`;

  const reference = select('#rg-reference');
  reference.replaceChildren(...references.map((item, index) => new Option(item.name, String(index))), new Option('Custom forecast', 'custom'));
  reference.value = '0';
  const referenceScale = Math.max(sst, ...references.map(item => item.sse));
  let customForecasts = [...fitted];
  select('#rg-reference-inputs').innerHTML = rows.map((row, index) => `
    <label>${row.case_id}<input type="number" min="0" max="10000" step="any" data-rg-forecast="${index}" aria-label="Forecast rentals for ${row.case_id}"></label>`).join('');
  const editInputs = selectAll('[data-rg-forecast]');
  const currentPrediction = () => reference.value === 'custom' ? customForecasts : references[Number(reference.value)].predictions;

  function syncInputValues() {
    const predictions = currentPrediction();
    editInputs.forEach((input, index) => { input.value = String(predictions[index]); });
  }

  editInputs.forEach((input, index) => {
    input.addEventListener('input', () => {
      const value = Number(input.value);
      if (!input.value || !Number.isFinite(value) || value < 0 || value > 10000) return;
      customForecasts = [...currentPrediction()];
      customForecasts[index] = value;
      reference.value = 'custom';
      renderReference();
    });
    input.addEventListener('change', syncInputValues);
  });

  function renderReference() {
    const item = reference.value === 'custom'
      ? model('Custom forecast', 'These estimates come from your edits. The five observed counts stay fixed.', customForecasts)
      : references[Number(reference.value)];
    const meaning = item.r2 === 1 ? 'Every prediction is exact.'
      : item.r2 === 0 ? 'Its squared error matches the reference.'
      : item.r2 > 0 ? 'It has less squared error than the reference.'
      : 'It has more squared error than the reference.';
    const errorScale = Math.max(referenceScale, item.sse);
    const rowScale = Math.max(timelineMax, ...item.predictions);
    const absoluteSum = item.absoluteErrors.reduce((total, value) => total + value, 0);
    const n = actual.length;
    select('#rg-reference-metrics').innerHTML = `
      <article><span>MAE</span><strong>${number(item.mae)} <small>rentals</small></strong><span>${number(absoluteSum)} ÷ ${n}</span></article>
      <article><span>MSE</span><strong>${number(item.mse)} <small>rentals²</small></strong><span>${number(item.sse)} ÷ ${n}</span></article>
      <article><span>RMSE</span><strong>${number(item.rmse)} <small>rentals</small></strong><span>√(${number(item.sse)} ÷ ${n})</span></article>`;
    const squaredEquation = (values, total) => values.map(number).join(' + ') + ' = ' + number(total) + ' rentals²';
    select('#rg-reference-bars').innerHTML = `
      <div class="rg-teaching-callout">
        <p>${item.origin}</p>
        <p><strong>Mean actual count</strong> = (${actual.map(number).join(' + ')}) ÷ ${actual.length} = ${number(mean)} rentals.</p>
        <p><strong>For ${rows[0].case_id}</strong>, the model adds (${number(actual[0])} − ${number(item.predictions[0])})² = ${number(item.squaredErrors[0])} rentals² to SSE. The reference adds (${number(actual[0])} − ${number(mean)})² = ${number(baselineErrors[0])} rentals² to SST.</p>
      </div>
      <div class="rg-reference-chart">
        <div class="rg-hour-series-legend"><strong>Forecast and actual by hour</strong><span><i class="rg-predicted-key" aria-hidden="true"></i> Forecast</span><span><i class="rg-actual-key" aria-hidden="true"></i> Actual</span></div>
        ${rows.map((row, index) => `<div class="rg-hour-series-row"><strong>${row.case_id}</strong>
          <div class="rg-series-lane"><span aria-hidden="true" style="width:${100 * item.predictions[index] / rowScale}%"></span><small aria-label="Forecast ${number(item.predictions[index])} rentals">${number(item.predictions[index])}</small></div>
          <div class="rg-series-lane"><span aria-hidden="true" style="width:${100 * row.actual / rowScale}%"></span><small aria-label="Actual ${number(row.actual)} rentals">${number(row.actual)}</small></div></div>`).join('')}
        <p class="rg-chart-scale">Both counts use the same scale from 0 to ${number(rowScale)} rentals.</p>
      </div>
      <div class="rg-reference-chart">
        <div class="rg-bar-row">
          <span>Model SSE</span><span class="rg-bar-track" aria-hidden="true"><span style="width:${100 * item.sse / errorScale}%"></span></span>
          <strong>${number(item.sse)} rentals²</strong>
        </div>
        <div class="rg-bar-row">
          <span>Mean SST</span><span class="rg-bar-track rg-bar-reference" aria-hidden="true"><span style="width:${100 * sst / errorScale}%"></span></span>
          <strong>${number(sst)} rentals²</strong>
        </div>
      </div>
      <p class="rg-chart-scale">Both bars share a scale from 0 to ${number(errorScale)} rentals².</p>
      <div class="rg-teaching-callout">
        <p><strong>SSE = Σ (y − ŷ)²</strong> = ${squaredEquation(item.squaredErrors, item.sse)}</p>
        <p><strong>SST = Σ (y − ȳ)²</strong> = ${squaredEquation(baselineErrors, sst)}</p>
        <p><strong>R² = 1 − SSE ÷ SST</strong> = 1 − ${number(item.sse)} ÷ ${number(sst)} ${Number.isInteger(item.r2) ? '=' : '≈'} ${number(item.r2)}. ${meaning}</p>
      </div>`;
  }
  reference.addEventListener('change', () => { syncInputValues(); renderReference(); });

  const metrics = fixture.metric_full_test;
  select('#rg-full-results').innerHTML = `
    <div class="rg-result-table"><table>
      <caption>Scores on ${number(fixture.test.n)} held-out hours</caption>
      <thead><tr><th scope="col">Forecast</th><th scope="col">MAE<br>rentals</th><th scope="col">MSE<br>rentals²</th><th scope="col">RMSE<br>rentals</th><th scope="col">R²</th></tr></thead>
      <tbody>${[['Calendar model', metrics.calendar_model], ['Training mean · ' + number(fixture.baseline) + ' rentals', metrics.training_mean]].map(([name, scores]) => `<tr><th scope="row">${name}</th><td>${number(scores.mae)}</td><td>${number(scores.mse)}</td><td>${number(scores.rmse)}</td><td>${r2Format.format(scores.r2).replace('-', '−')}</td></tr>`).join('')}</tbody>
    </table></div>`;

  select('#rg-python-code').textContent = [
    'actual = [' + actual.join(', ') + ']',
    'forecast = [' + fitted.join(', ') + ']',
    'residuals = [y - guess for y, guess in zip(actual, forecast)]',
    'mae = sum(abs(error) for error in residuals) / len(residuals)',
    'mse = sum(error ** 2 for error in residuals) / len(residuals)',
    'print(residuals[0], mae, mse, mse ** 0.5)',
  ].join('\n');

  showStep(0);
  unsetActual();
  renderErrors();
  syncInputValues();
  renderReference();
})();
