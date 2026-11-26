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
  const outlierPredictions = fixture.additional_prediction_sets.outlier;
  const last = rows.length - 1;
  const constant = rows[0].worse_predicted_duration_minutes;
  const models = [
    {
      name: 'Small misses', predictions: defaultPredictions,
      origin: `Set every example estimate ${defaultPredictions[0] - actual[0]} minutes higher than its actual duration.`,
    },
    {
      name: 'One large miss', predictions: outlierPredictions,
      origin: `Set the first four estimates exactly right and make ${rows[last].case_id} ${outlierPredictions[last] - actual[last]} minutes too high.`,
    },
    {
      name: 'Mean reference', predictions: rows.map(row => row.baseline_duration_minutes),
      origin: 'Use the same mean observed duration as the estimate for every order.',
    },
    {
      name: `Always predict ${constant} minutes`, predictions: rows.map(row => row.worse_predicted_duration_minutes),
      origin: `Use a constant ${constant}-minute guess to see what happens when a predictor’s squared error is higher than the reference’s.`,
    },
    {
      name: 'Perfect predictions', predictions: fixture.additional_prediction_sets.perfect,
      origin: 'Set each example estimate equal to its actual duration to see the best possible score.',
    },
  ];
  const stats = models.map(({ predictions }) => core.regression(predictions));
  const referenceScale = Math.max(...stats.map(result => result.sse), stats[0].sst);
  const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });
  const fmt = value => format.format(value).replace('-', '−');
  const signed = value => value > 0 ? '+' + fmt(value) : fmt(value);
  const residualEquation = (observed, estimate, residual) => `${fmt(observed)} − ${fmt(estimate)} = ${signed(residual)} min`;
  const timelineMax = Math.ceil(Math.max(...actual, ...defaultPredictions) / 10) * 10;
  const buttons = Array.from(root.querySelectorAll('[data-rg-step]'));
  const panes = Array.from(root.querySelectorAll('[data-rg-pane]'));
  const explorerJump = select('#rg-jump-to-explorer');
  let activeStep;

  function showStep(step) {
    activeStep = step;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.rgStep === step)));
    panes.forEach(pane => { pane.hidden = pane.dataset.rgPane !== step; });
    explorerJump.textContent = step === 'reference' ? 'Use these estimates in the full plot' : 'Explore the full residual plot';
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
          <span><i class="rg-predicted-key" aria-hidden="true"></i>Forecast at dispatch <strong>${fmt(predicted)} min</strong></span>
          <span><i class="rg-actual-key" aria-hidden="true"></i>Actual after arrival <strong>${fmt(minutes)} min</strong></span>
        </div>
      </div>`;
    const direction = residual < 0 ? 'estimated too many minutes' : residual > 0 ? 'estimated too few minutes' : 'matched the arrival';
    select('#rg-order-reading').innerHTML =
      `<p><strong>${rows[index].case_id} residual</strong> · ${residualEquation(minutes, predicted, residual)}. The app ${direction}.</p>`;
  }

  function renderErrors(kind) {
    const absolute = kind === 'absolute';
    const values = stats.slice(0, 2).map(row => absolute ? row.absoluteErrors : row.squaredErrors);
    const largest = Math.max(...values.flat());
    const unit = absolute ? 'min' : 'min²';
    const cards = values.map((errors, index) => {
      const total = errors.reduce((acc, error) => acc + error, 0);
      const { name, predictions, origin } = models[index];
      const { residuals, mae, mse, rmse } = stats[index];
      const bars = errors.map((value, rowIndex) => `<div class="rg-bar-row">
        <span>${rows[rowIndex].case_id}<small class="rg-bar-operands">${residualEquation(actual[rowIndex], predictions[rowIndex], residuals[rowIndex])}</small></span>
        <span class="rg-bar-track" aria-hidden="true"><span style="width:${100 * value / largest}%"></span></span>
        <strong>${fmt(value)} ${unit}</strong>
      </div>`).join('');
      const equation = absolute
        ? `MAE = ${fmt(total)} ÷ ${rows.length} = ${fmt(mae)} min`
        : `MSE = ${fmt(total)} ÷ ${rows.length} = ${fmt(mse)} min²<br>RMSE = √${fmt(mse)} ${Number.isInteger(rmse) ? '=' : '≈'} ${fmt(rmse)} min`;
      return `<article class="rg-error-card">
        <h4>${name}</h4>
        <p class="rg-chart-scale">${origin}</p>
        <div class="rg-error-bars" aria-label="${absolute ? 'Absolute' : 'Squared'} errors in ${unit}">${bars}</div>
        <p>${equation}</p>
      </article>`;
    });
    const reading = absolute
      ? 'Mean absolute error (MAE) averages the sizes of the misses. The five small misses and the one large miss add up to the same number of minutes.'
      : `Mean squared error (MSE) averages the squares of the misses, so its unit is min². Root mean squared error (RMSE) takes the square root to return to minutes. The ${fmt(Math.max(...stats[1].absoluteErrors))}-minute miss contributes ${fmt(largest)} min² by itself.`;
    select('#rg-error-bars').innerHTML = `<div class="rg-error-grid">${cards.join('')}</div>
      <p class="rg-chart-scale">Shared scale from 0 to ${fmt(largest)} ${unit} per order.</p>
      <p class="rg-teaching-callout">${reading}</p>`;
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
  const cancellationTerms = cancellation.residuals.slice(0, offsets.length).map((residual, index) =>
    `<li><strong>${rows[index].case_id}</strong> · ${residualEquation(actual[index], oppositeMisses[index], residual)}</li>`).join('');
  const absoluteTerms = cancellation.absoluteErrors.slice(0, offsets.length).map(fmt).join(' + ');
  select('#rg-cancelled').innerHTML = `<ul>${cancellationTerms}</ul>
    <p>The other three residuals are zero. Mean residual = ${fmt(cancellation.meanResidual)} min. <strong>MAE = (${absoluteTerms}) ÷ ${rows.length} = ${fmt(cancellation.mae)} min</strong>. The signed errors cancel and their sizes add.</p>`;

  const reference = select('#rg-reference');
  reference.replaceChildren(...models.map(({ name }, index) => new Option(name, String(index))));
  reference.value = '0';

  function renderReference() {
    const index = Number(reference.value);
    const { mean, sse, sst, r2, squaredErrors, baselineErrors } = stats[index];
    const { predictions, origin } = models[index];
    const estimate = predictions[0];
    const meaning = r2 === 1 ? 'Every prediction is exact.' :
      r2 > 0 ? 'The model has smaller squared error than the reference.' :
      r2 === 0 ? 'The model and the mean reference have the same squared error.' :
      'The model has larger squared error than the reference.';
    select('#rg-reference-bars').innerHTML = `
      <div class="rg-teaching-callout">
        <p>${origin}</p>
        <p><strong>Find the reference.</strong> The five actual durations average (${actual.map(fmt).join(' + ')}) ÷ ${rows.length} = <strong>${fmt(mean)} min</strong>.</p>
        <p><strong>Read both contributions for ${rows[0].case_id}.</strong> The selected estimate gives (${fmt(actual[0])} − ${fmt(estimate)})² = ${fmt(squaredErrors[0])} min². The mean reference gives (${fmt(actual[0])} − ${fmt(mean)})² = ${fmt(baselineErrors[0])} min².</p>
      </div>
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
        <p><strong>SSE</strong> = ${squaredErrors.map(fmt).join(' + ')} = ${fmt(sse)} min²<br><strong>SST</strong> = ${baselineErrors.map(fmt).join(' + ')} = ${fmt(sst)} min²</p>
        <p><strong>R² = 1 − ${fmt(sse)} ÷ ${fmt(sst)} = ${fmt(r2)}</strong>. ${meaning}</p>
      </div>`;
  }

  order.addEventListener('change', renderTimeline);
  reference.addEventListener('change', renderReference);
  explorerJump.addEventListener('click', () => {
    if (activeStep === 'reference') window.MetricsLab.setPredictions(models[Number(reference.value)].predictions);
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
