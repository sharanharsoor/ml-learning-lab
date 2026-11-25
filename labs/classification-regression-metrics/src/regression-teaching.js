(() => {
  'use strict';

  const root = document.getElementById('regression-teaching');
  const core = window.MetricsCore;
  if (!root || !core) return;

  const select = selector => root.querySelector(selector);
  const fixture = JSON.parse(select('#regression-teaching-fixture').textContent);
  const rows = fixture.rows;
  const actual = core.regressionActual;
  const defaultPredictions = rows.map(row => row.predicted_duration_minutes);
  const models = [
    ['Small misses', defaultPredictions],
    ['One large miss', fixture.additional_prediction_sets.outlier],
    ['Mean reference', rows.map(row => row.baseline_duration_minutes)],
    ['Always predict ' + rows[0].worse_predicted_duration_minutes + ' minutes', rows.map(row => row.worse_predicted_duration_minutes)],
    ['Perfect predictions', fixture.additional_prediction_sets.perfect],
  ];
  const stats = models.map(([, predictions]) => core.regression(predictions));
  const referenceScale = Math.max(...stats.map(result => result.sse), stats[0].sst);
  const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
  const fmt = value => format.format(value).replace('-', '−');
  const signed = value => value > 0 ? '+' + fmt(value) : fmt(value);
  const timelineMax = Math.ceil(Math.max(...actual, ...defaultPredictions) / 10) * 10;
  const buttons = Array.from(root.querySelectorAll('[data-rg-step]'));
  const panes = Array.from(root.querySelectorAll('[data-rg-pane]'));

  function showStep(step) {
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.rgStep === step)));
    panes.forEach(pane => { pane.hidden = pane.dataset.rgPane !== step; });
  }
  buttons.forEach(button => button.addEventListener('click', () => showStep(button.dataset.rgStep)));

  const order = select('#rg-order');
  order.replaceChildren(...rows.map((row, index) => new Option(row.case_id, String(index))));
  order.value = '0';

  function renderTimeline() {
    const index = Number(order.value);
    const minutes = actual[index];
    const predicted = defaultPredictions[index];
    const residual = stats[0].residuals[index];
    const start = 100 * Math.min(minutes, predicted) / timelineMax;
    const gap = 100 * Math.abs(residual) / timelineMax;
    select('#rg-timeline').innerHTML = `
      <div class="rg-timeline">
        <div class="rg-timeline-track" aria-hidden="true">
          <span class="rg-timeline-gap" style="left:${start}%;width:${gap}%"></span>
          <span class="rg-timeline-actual" style="left:${100 * minutes / timelineMax}%"></span>
          <span class="rg-timeline-predicted" style="left:${100 * predicted / timelineMax}%"></span>
        </div>
        <div class="rg-timeline-axis"><span>Dispatch · 0 min</span><span>${timelineMax} min after dispatch</span></div>
        <div class="rg-timeline-key">
          <span><i class="rg-actual-key" aria-hidden="true"></i>Arrived after <strong>${fmt(minutes)} min</strong></span>
          <span><i class="rg-predicted-key" aria-hidden="true"></i>Estimated <strong>${fmt(predicted)} min</strong></span>
        </div>
      </div>`;
    const direction = residual < 0 ? 'estimated too many minutes' : residual > 0 ? 'estimated too few minutes' : 'matched the arrival';
    select('#rg-order-reading').innerHTML =
      `<p><strong>${rows[index].case_id} residual</strong> · ${fmt(minutes)} − ${fmt(predicted)} = <strong>${signed(residual)} min</strong>. The app ${direction}.</p>`;
  }

  function renderErrors(kind) {
    const absolute = kind === 'absolute';
    const values = stats.slice(0, 2).map(row => absolute ? row.absoluteErrors : row.squaredErrors);
    const largest = Math.max(...values.flat());
    const unit = absolute ? 'min' : 'min²';
    const cards = values.map((errors, index) => {
      const total = errors.reduce((acc, error) => acc + error, 0);
      const bars = errors.map((value, rowIndex) => `<div class="rg-bar-row">
        <span>${rows[rowIndex].case_id}</span>
        <span class="rg-bar-track" aria-hidden="true"><span style="width:${100 * value / largest}%"></span></span>
        <strong>${fmt(value)}</strong>
      </div>`).join('');
      const equation = absolute
        ? `MAE = ${fmt(total)} ÷ ${rows.length} = ${fmt(stats[index].mae)} min`
        : `MSE = ${fmt(total)} ÷ ${rows.length} = ${fmt(stats[index].mse)} min²<br>RMSE = √${fmt(stats[index].mse)} ≈ ${fmt(stats[index].rmse)} min`;
      return `<article class="rg-error-card">
        <h4>${models[index][0]}</h4>
        <div class="rg-error-bars" aria-label="${absolute ? 'Absolute' : 'Squared'} errors in ${unit}">${bars}</div>
        <p>${equation}</p>
      </article>`;
    });
    select('#rg-error-bars').innerHTML = `<div class="rg-error-grid">${cards.join('')}</div>
      <p class="rg-chart-scale">Shared scale from 0 to ${fmt(largest)} ${unit} per order.</p>`;
  }

  const errorButtons = Array.from(root.querySelectorAll('[data-rg-error]'));
  function showErrorMode(mode) {
    errorButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.rgError === mode)));
    renderErrors(mode);
  }
  errorButtons.forEach(button => button.addEventListener('click', () => showErrorMode(button.dataset.rgError)));

  const offsets = [-5, 5];
  const oppositeMisses = actual.map((minutes, index) => minutes + (offsets[index] ?? 0));
  const cancellation = core.regression(oppositeMisses);
  const cancellationTerms = cancellation.residuals.map(signed).join(', ');
  select('#rg-cancelled').innerHTML = `<p>Residuals ${cancellationTerms} min. Mean residual = ${fmt(cancellation.meanResidual)} min, while <strong>MAE = ${fmt(cancellation.mae)} min</strong>. On average the direction balances out, while two orders still have errors.</p>`;

  const reference = select('#rg-reference');
  reference.replaceChildren(...models.map(([name], index) => new Option(name, String(index))));
  reference.value = '0';

  function renderReference() {
    const index = Number(reference.value);
    const { mean, sse, sst, r2 } = stats[index];
    const meaning = r2 === 1 ? 'Every prediction is exact.' :
      r2 > 0 ? 'The model has smaller squared error than the reference.' :
      r2 === 0 ? 'The model and the mean reference have the same squared error.' :
      'The model has larger squared error than the reference.';
    select('#rg-reference-bars').innerHTML = `
      <div class="rg-reference-chart">
        <div class="rg-bar-row">
          <span>Model SSE</span><span class="rg-bar-track" aria-hidden="true"><span style="width:${100 * sse / referenceScale}%"></span></span>
          <strong>${fmt(sse)} min²</strong>
        </div>
        <div class="rg-bar-row">
          <span>Mean reference SST</span><span class="rg-bar-track rg-bar-reference" aria-hidden="true"><span style="width:${100 * sst / referenceScale}%"></span></span>
          <strong>${fmt(sst)} min²</strong>
        </div>
      </div>
      <p class="rg-chart-scale">Shared scale from 0 to ${fmt(referenceScale)} min² across prediction sets.</p>
      <div class="rg-teaching-callout">
        <p>Always predicting the observed mean of <strong>${fmt(mean)} min</strong> gives the reference error.</p>
        <p><strong>R² = 1 − ${fmt(sse)} ÷ ${fmt(sst)} = ${fmt(r2)}</strong>. ${meaning}</p>
      </div>`;
  }

  order.addEventListener('change', renderTimeline);
  reference.addEventListener('change', renderReference);
  select('#rg-jump-to-explorer').addEventListener('click', () => {
    const explorer = document.getElementById('regression-chart');
    explorer.setAttribute('tabindex', '-1');
    explorer.focus({ preventScroll: true });
    explorer.scrollIntoView({ block: 'start' });
  });
  select('#rg-python-code').textContent = [
    'actual = [' + actual.join(', ') + ']',
    'predicted = [' + defaultPredictions.join(', ') + ']',
    'residuals = [y - guess for y, guess in zip(actual, predicted)]',
    'mae = sum(abs(error) for error in residuals) / len(residuals)',
    'print(residuals[0], mae)  # ' + stats[0].residuals[0] + ', ' + stats[0].mae.toFixed(1),
  ].join('\n');
  showStep('residual');
  renderTimeline();
  showErrorMode('absolute');
  renderReference();
})();
