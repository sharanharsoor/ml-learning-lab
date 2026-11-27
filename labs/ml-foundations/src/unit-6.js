(() => {
  'use strict';

  const get = id => document.getElementById('u6-' + id);
  const { spam, spamScore: score, spamProbability: probability, spamOutcome } = window.Foundations;
  const { rows, fit, examples, thresholds } = spam;
  const allRows = new Map(Object.values(rows).flat().map(row => [row.id, row]));
  const integer = new Intl.NumberFormat('en-US');
  const percentage = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });
  const fmt = (value, digits = 4) => value.toFixed(digits).replace('-', '−');
  const percent = value => percentage.format(value);
  const featureText = value => value.toFixed(3) + '%';
  const logit = p => Math.log(p / (1 - p));
  const loss = ({ x, y }) => {
    const z = score(x);
    return Math.max(z, 0) - z * y + Math.log1p(Math.exp(-Math.abs(z)));
  };
  const label = value => value ? 'Spam' : 'Legitimate';
  const prediction = (p, cutoff) => label(p >= cutoff);
  const set = (id, value) => { get(id).textContent = value; };
  const features = get('feature');
  const picker = get('row');
  const thresholdSlider = get('threshold');
  const chart = get('curve');
  const zoomMax = 2;
  const focal = allRows.get(examples.focal);
  let selected = focal;
  let feature = focal.x;
  let threshold = thresholds.default;
  let locked = null;

  const sampleIds = [...new Set([examples.focal, ...examples.validation])];
  picker.replaceChildren(
    ...sampleIds.map(id => {
      const row = allRows.get(id);
      return new Option(id + ' · ' + featureText(row.x) + ' exclamation marks', id);
    }),
    new Option('Try your own frequency', 'custom')
  );
  picker.value = focal.id;
  features.max = zoomMax;
  features.step = '0.001';
  features.value = feature;

  function showMeasurement() {
    const z = score(feature);
    const p = probability(feature);
    const comparison = p >= threshold ? '≥' : '<';
    const rounded = Number(p.toFixed(4));
    const probabilityLabel = (rounded >= threshold) === (p >= threshold) ? fmt(p) : 'Unrounded p';
    set('equation', 'z ≈ ' + fmt(fit.intercept) + ' + ' + fmt(fit.weight) + ' × x');
    set('feature-value', featureText(feature));
    features.setAttribute('aria-valuetext', featureText(feature) + ' of characters');
    set('row-caption', selected
      ? selected.id + ' has ' + featureText(feature) + ' exclamation marks. The recorded label is ' + label(selected.y) + '.'
      : 'You chose ' + featureText(feature) + '. This practice input has no recorded class.');
    set('score-steps', 'z ≈ ' + fmt(fit.intercept) + ' + ' + fmt(fit.weight) + ' × ' + feature.toFixed(3) + ' ≈ ' + fmt(z));
    get('probability-steps').innerHTML = 'p = σ(z) ≈ 1 ÷ (1 + e<sup>' + fmt(-z) + '</sup>) ≈ ' + fmt(p) + ' (' + percent(p) + ')';
    set('odds-steps', 'p ÷ (1 − p) = eᶻ ≈ ' + fmt(Math.exp(z), 3) + ' to 1');
    set('label-result', probabilityLabel + ' ' + comparison + ' ' + fmt(threshold, 2) + ' · Predict ' + prediction(p, threshold) +
      (selected ? ' · ' + (prediction(p, threshold) === label(selected.y) ? 'Matches recorded label' : 'Differs from recorded label') : ''));
    drawCurve();
  }

  picker.addEventListener('change', () => {
    selected = allRows.get(picker.value) || null;
    if (selected) {
      feature = selected.x;
      features.value = feature;
    }
    showMeasurement();
  });
  features.addEventListener('input', () => {
    selected = null;
    picker.value = 'custom';
    feature = Number(features.value);
    showMeasurement();
  });

  function chartFrame(width, height) {
    return { left: 48, right: width - 16, top: 17, bottom: height - 37 };
  }

  function drawCurve() {
    const { clientWidth: width, clientHeight: height } = chart;
    if (width < 85 || height < 80) return;
    const ctx = chart.getContext('2d');
    if (!ctx) return;
    const pixelRatio = window.devicePixelRatio || 1;
    chart.width = Math.round(width * pixelRatio);
    chart.height = Math.round(height * pixelRatio);
    ctx.scale(pixelRatio, pixelRatio);
    const { left, right, top, bottom } = chartFrame(width, height);
    const px = x => left + (right - left) * x / zoomMax;
    const py = p => bottom - (bottom - top) * p;

    ctx.font = '12px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    for (const value of [0, 0.25, 0.5, 0.75, 1]) {
      const y = py(value);
      ctx.strokeStyle = '#d8dfd9';
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
      ctx.fillStyle = '#445750';
      ctx.fillText(percent(value), left - 8, y);
    }
    ctx.textAlign = 'center';
    for (const value of [0, 0.5, 1, 1.5, 2]) {
      const x = px(value);
      ctx.strokeStyle = '#e4e9e4';
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.stroke();
      ctx.fillStyle = '#445750';
      ctx.fillText(value + '%', x, bottom + 15);
    }
    ctx.strokeStyle = '#83958a';
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom);
    ctx.lineTo(right, bottom);
    ctx.stroke();

    const crossing = (logit(threshold) - fit.intercept) / fit.weight;
    ctx.strokeStyle = '#51645d';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(left, py(threshold));
    ctx.lineTo(right, py(threshold));
    if (crossing >= 0 && crossing <= zoomMax) {
      ctx.moveTo(px(crossing), py(threshold));
      ctx.lineTo(px(crossing), bottom);
    }
    ctx.stroke();

    ctx.strokeStyle = '#6c668a';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.moveTo(px(feature), py(probability(feature)));
    ctx.lineTo(px(feature), bottom);
    ctx.stroke();

    ctx.strokeStyle = '#624789';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(left, py(probability(0)));
    for (let i = 1; i <= 120; i += 1) {
      const x = zoomMax * i / 120;
      ctx.lineTo(px(x), py(probability(x)));
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px(feature), py(probability(feature)), 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ab5127';
    ctx.fill();
    ctx.strokeStyle = '#fffefa';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  chart.addEventListener('click', event => {
    const bounds = chart.getBoundingClientRect();
    const { left, right, top, bottom } = chartFrame(chart.clientWidth, chart.clientHeight);
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (x < left || x > right || y < top || y > bottom) return;
    features.value = (zoomMax * (x - left) / (right - left)).toFixed(3);
    features.dispatchEvent(new Event('input'));
  });
  if (typeof ResizeObserver === 'function') new ResizeObserver(drawCurve).observe(chart);

  function reveal(buttonId, panelId) {
    const button = get(buttonId);
    button.setAttribute('aria-expanded', 'true');
    get(panelId).hidden = false;
  }

  const focalProbability = probability(focal.x);
  set('opening-example', percent(focalProbability) + ' Spam · Predict ' + prediction(focalProbability, thresholds.default));
  set('opening-label', label(focal.y));
  get('reveal-label')?.addEventListener('click', () => {
    const button = get('reveal-label');
    const panel = get('observed-label');
    const opening = panel.hidden;
    panel.hidden = !opening;
    get('opening-label').hidden = !opening;
    button.setAttribute('aria-expanded', String(opening));
    button.textContent = opening ? 'Hide recorded label' : 'Reveal recorded label';
  });

  function appendRow(body, cells) {
    const tr = body.insertRow();
    const heading = document.createElement('th');
    heading.scope = 'row';
    heading.textContent = cells[0];
    tr.append(heading);
    for (const value of cells.slice(1)) tr.insertCell().textContent = value;
  }

  const workedLoss = examples.worked.map(id => {
    const row = allRows.get(id);
    const p = probability(row.x);
    const observedProbability = row.y ? p : 1 - p;
    const error = loss(row);
    appendRow(get('loss-rows'), [
      row.id + ' (' + featureText(row.x) + ')',
      String(row.y) + ' · ' + label(row.y),
      fmt(p),
      (row.y ? 'p ≈ ' : '1 − p ≈ ') + fmt(observedProbability),
      '−ln(' + fmt(observedProbability) + ') ≈ ' + fmt(error)
    ]);
    return error;
  });
  const sampleLoss = workedLoss.reduce((total, value) => total + value, 0) / workedLoss.length;
  set('loss-mean', '(' + workedLoss.map(value => fmt(value)).join(' + ') + ') ÷ ' + workedLoss.length + ' ≈ ' + fmt(sampleLoss));
  set('loss-fit', 'Across ' + integer.format(rows.train.length) + ' training emails, mean loss fell from ' +
    fmt(fit.lossBefore, 6) + ' at b = 0 and w = 0 to ' + fmt(fit.lossAfter, 6) + ' after ' + fit.steps + ' fitting updates.');

  function confusion(emails, cutoff) {
    const counts = { tp: 0, fp: 0, fn: 0, tn: 0 };
    for (const { x, y } of emails) {
      counts[spamOutcome(y, probability(x), cutoff)] += 1;
    }
    return counts;
  }

  function metric(numerator, denominator) {
    return denominator ? integer.format(numerator) + ' ÷ ' + integer.format(denominator) + ' ≈ ' +
      percent(numerator / denominator) : 'Undefined · no emails in the denominator';
  }

  function showCounts(prefix, { tp, fp, fn, tn }) {
    for (const [key, value] of Object.entries({ tp, fp, fn, tn })) set(prefix + '-' + key, integer.format(value));
    set(prefix + '-precision', metric(tp, tp + fp));
    set(prefix + '-recall', metric(tp, tp + fn));
  }

  function showCases(id, ids, cutoff, includeFeature = false) {
    const tbody = get(id);
    tbody.replaceChildren();
    for (const rowId of ids) {
      const { id, x, y } = allRows.get(rowId);
      const p = probability(x);
      const cells = includeFeature ? [id, featureText(x)] : [id];
      appendRow(tbody, [...cells, fmt(p), label(y), prediction(p, cutoff)]);
    }
  }

  function showValidation() {
    set('threshold-value', percent(threshold));
    set('curve-cutoff', percent(threshold) + ' cutoff');
    thresholdSlider.setAttribute('aria-valuetext', percent(threshold) + ' probability cutoff');
    const { tp, fp, fn, tn } = confusion(rows.validation, threshold);
    showCounts('v', { tp, fp, fn, tn });
    showCases('validation-cases', [examples.focal, examples.validation.at(-1)], threshold);
    set('validation-verdict', integer.format(tp) + ' Spam emails caught, ' + integer.format(fp) +
      ' Legitimate emails sent to Spam, and ' + integer.format(fn) + ' Spam emails left in the inbox.');
    const x = (logit(threshold) - fit.intercept) / fit.weight;
    const line = x <= 0
      ? 'At this cutoff, even 0% predicts Spam.'
      : x > zoomMax
        ? 'The cutoff is about ' + featureText(x) + ', just beyond the plotted range.'
        : 'With this fitted model, p reaches the cutoff at about ' + featureText(x) + ' exclamation marks.';
    set('boundary', line);
    showMeasurement();
  }

  set('validation-count', integer.format(rows.validation.length) + ' validation emails');
  set('test-count', integer.format(rows.test.length) + ' held-out test emails');
  thresholdSlider.value = threshold;
  thresholdSlider.addEventListener('input', () => {
    threshold = Number(thresholdSlider.value);
    showValidation();
  });
  for (const [id, value] of [
    ['threshold-low', thresholds.presets[0]],
    ['threshold-default', thresholds.default],
    ['threshold-high', thresholds.presets.at(-1)]
  ]) {
    get(id)?.addEventListener('click', () => {
      thresholdSlider.value = value;
      thresholdSlider.dispatchEvent(new Event('input'));
    });
  }

  get('lock-threshold').addEventListener('click', () => {
    locked = threshold;
    set('locked-threshold', 'Locked cutoff ' + fmt(locked, 2) + '. You can still explore the validation slider.');
    get('reveal-test').disabled = false;
  });
  get('reveal-test').addEventListener('click', () => {
    if (locked === null) return;
    const { tp, fp, fn, tn } = confusion(rows.test, locked);
    showCounts('t', { tp, fp, fn, tn });
    showCases('test-cases', examples.test, locked, true);
    set('test-verdict', 'At the locked cutoff of ' + fmt(locked, 2) + ', the model caught ' + integer.format(tp) + ' of ' +
      integer.format(tp + fn) + ' Spam emails and sent ' + integer.format(fp) + ' Legitimate emails to Spam.');
    reveal('reveal-test', 'test-results');
    get('lock-threshold').disabled = true;
    get('reveal-test').disabled = true;
    get('test-results').scrollIntoView({ block: 'nearest' });
  });

  showValidation();
})();
