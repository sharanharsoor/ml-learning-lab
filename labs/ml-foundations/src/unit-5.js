(() => {
  'use strict';

  const get = id => document.getElementById('u5-' + id);
  const data = JSON.parse(document.getElementById('foundations-unit-5-data').textContent);
  const { rows, fits, scores, sampleDates, demoLine } = data;
  const training = rows.train;
  const sample = sampleDates.map(date => training.find(row => row.date === date));
  const focal = rows.test.find(row => row.date === data.focalDate);
  const baseline = fits.refit.calendarPrediction;
  const maxAxis = 1000;
  const riseX = 700;
  const integer = new Intl.NumberFormat('en-US');
  const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  const scoreFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const dateLabel = date => dateFormat.format(new Date(date + 'T00:00:00Z'));
  const fmt = value => decimal.format(value).replace('-', '−');
  const signed = value => (value > 0 ? '+' : '') + fmt(value);
  const precise = (value, digits) => String(Number(value.toFixed(digits))).replace('-', '−');
  const sum = values => values.reduce((total, value) => total + value, 0);
  const forecast = (line, input) => line.intercept + line.slope * input;
  const hasRoundedCoefficients = line => line.intercept !== Number(line.intercept.toFixed(4)) ||
    line.slope !== Number(line.slope.toFixed(6));
  const needsRounding = value => Math.abs(value - Number(value.toFixed(2))) > 1e-8;
  const equals = rounded => rounded ? ' ≈ ' : ' = ';
  const formula = line => precise(line.intercept, 4) + (line.slope < 0 ? ' − ' : ' + ') + precise(Math.abs(line.slope), 6);
  const equation = line => formula(line) + ' × x';
  const forecastSteps = (line, input) => formula(line) + ' × ' + integer.format(input);
  const set = (id, value) => { get(id).textContent = value; };
  const plot = get('plot');
  const slope = get('slope');
  const intercept = get('intercept');
  const rowPicker = get('row');
  const handles = [get('intercept-handle'), get('rise-handle')];
  let line = { slope: 0, intercept: baseline };
  let selected = sample[0];

  for (const row of sample) rowPicker.add(new Option(dateLabel(row.date), row.date));
  const points = get('points');
  const samplePoints = new Map();

  function locatePoint(point, row) {
    point.style.setProperty('--u5-x', (100 * row.previousRentals / maxAxis) + '%');
    point.style.setProperty('--u5-y', (100 * row.rentals / maxAxis) + '%');
  }

  const background = document.createDocumentFragment();
  for (const row of training) {
    if (sampleDates.includes(row.date)) continue;
    const dot = document.createElement('span');
    dot.className = 'u5-context-point';
    dot.setAttribute('aria-hidden', 'true');
    locatePoint(dot, row);
    background.append(dot);
  }
  points.append(background);
  for (const row of sample) {
    const point = document.createElement('button');
    point.type = 'button';
    point.className = 'u5-point';
    const label = dateLabel(row.date) + ', yesterday ' + row.previousRentals + ', today ' + row.rentals + ' rentals';
    point.setAttribute('aria-label', label);
    point.title = label;
    locatePoint(point, row);
    point.addEventListener('click', () => showRow(row));
    samplePoints.set(row.date, point);
    points.append(point);
  }

  function drawPlot() {
    const { clientWidth: width, clientHeight: height } = plot;
    if (!width || !height) return;
    const x = value => width * value / maxAxis;
    const y = value => height * (1 - value / maxAxis);
    const pinned = get('baseline-line');
    const stroke = get('line');
    const trace = get('residual');
    const left = y(line.intercept);
    const rise = y(forecast(line, maxAxis)) - left;
    Object.assign(pinned.style, { left: '0px', top: y(baseline) + 'px', width: width + 'px' });
    Object.assign(stroke.style, {
      left: '0px',
      top: (left - 1.5) + 'px',
      width: Math.hypot(width, rise) + 'px',
      transform: 'rotate(' + Math.atan2(rise, width) + 'rad)'
    });

    const predicted = forecast(line, selected.previousRentals);
    const dotTop = y(selected.rentals);
    const lineTop = y(predicted);
    Object.assign(trace.style, {
      left: x(selected.previousRentals) + 'px',
      top: Math.min(dotTop, lineTop) + 'px',
      height: Math.abs(dotTop - lineTop) + 'px'
    });
    for (const [index, handle] of handles.entries()) {
      const input = index === 0 ? 0 : riseX;
      const vertical = forecast(line, input);
      handle.hidden = vertical < -4 || vertical > maxAxis + 4;
      Object.assign(handle.style, { left: x(input) + 'px', top: y(Math.min(maxAxis, Math.max(0, vertical))) + 'px' });
    }
  }

  function showRow(row) {
    selected = row;
    rowPicker.value = row.date;
    for (const [date, point] of samplePoints) point.setAttribute('aria-pressed', String(date === row.date));
    const estimate = forecast(line, row.previousRentals);
    const residual = row.rentals - estimate;
    const direction = residual > 0 ? 'The line predicted too low.' : residual < 0 ? 'The line predicted too high.' : 'The line matched the recorded count.';
    const offChart = estimate < 0 || estimate > maxAxis;
    const predictionRounded = hasRoundedCoefficients(line) || needsRounding(estimate);
    set('row-caption', dateLabel(row.previousDate) + ' supplied ' + integer.format(row.previousRentals) +
      ' rentals. ' + dateLabel(row.date) + ' recorded ' + integer.format(row.rentals) +
      '. Source records ' + integer.format(row.previousRowId) + ' and ' + integer.format(row.rowId) + '.');
    set('prediction-steps', forecastSteps(line, row.previousRentals) + equals(predictionRounded) + fmt(estimate) + ' rentals');
    set('residual-steps', fmt(row.rentals) + ' − (' + fmt(estimate) + ')' + equals(needsRounding(estimate)) + signed(residual) + ' rentals');
    set('squared-steps', '(' + fmt(residual) + ')²' + equals(needsRounding(residual) || needsRounding(residual ** 2)) + fmt(residual ** 2) + ' rentals²');
    set('point-summary', direction + (offChart ? ' The prediction is outside the plotted rental scale.' : ''));
    drawPlot();
  }

  function displayLoss() {
    const errors = sample.map(row => {
      const estimate = forecast(line, row.previousRentals);
      return { row, estimate, residual: row.rentals - estimate };
    });
    const tableRows = errors.map(({ row, estimate, residual }) => {
      const tr = document.createElement('tr');
      const heading = document.createElement('th');
      heading.scope = 'row';
      heading.textContent = dateLabel(row.date);
      tr.append(heading);
      for (const value of [fmt(row.previousRentals), fmt(row.rentals), fmt(estimate), signed(residual), fmt(residual ** 2)]) {
        tr.insertCell().textContent = value;
      }
      return tr;
    });
    get('worked-rows').replaceChildren(...tableRows);
    const squares = errors.map(({ residual }) => residual ** 2);
    const fullTotal = sum(training.map(row => (row.rentals - forecast(line, row.previousRentals)) ** 2));
    set('sample-mse', '(' + squares.map(fmt).join(' + ') + ') ÷ ' + sample.length + ' ≈ ' +
      scoreFormat.format(sum(squares) / sample.length) + ' rentals²');
    set('train-mse', fmt(fullTotal) + ' ÷ ' + training.length + ' ≈ ' +
      scoreFormat.format(fullTotal / training.length) + ' rentals²');
  }

  function showLine(next, status) {
    line = next;
    set('line-equation', 'ŷ' + equals(hasRoundedCoefficients(line)) + equation(line));
    set('slope-value', precise(line.slope, 6));
    set('intercept-value', precise(line.intercept, 4));
    set('line-status', status);
    slope.setAttribute('aria-valuetext', precise(line.slope, 6));
    intercept.setAttribute('aria-valuetext', precise(line.intercept, 4) + ' rentals');
    showRow(selected);
    displayLoss();
  }

  function loadLine(next, status) {
    slope.value = next.slope;
    intercept.value = next.intercept;
    showLine(next, status);
  }
  const baselineStatus = 'A slope of zero gives the same forecast for every input. This 470-rental reference includes October. The October score uses only earlier data.';
  const manualStatus = 'The displayed errors update for the line you set. Use the training fit to minimize MSE across all the training points.';
  rowPicker.addEventListener('change', () => showRow(sample.find(row => row.date === rowPicker.value)));
  slope.addEventListener('input', () => showLine({ ...line, slope: Number(slope.value) }, manualStatus));
  intercept.addEventListener('input', () => showLine({ ...line, intercept: Number(intercept.value) }, manualStatus));
  get('use-baseline').addEventListener('click', () => loadLine(
    { slope: 0, intercept: baseline }, baselineStatus
  ));
  get('use-trial').addEventListener('click', () => loadLine(
    demoLine, 'This trial line gives us whole numbers in the worked table. Compare its training MSE with the fitted line.'
  ));
  get('use-fit').addEventListener('click', () => loadLine(
    fits.train, 'Least squares uses all ' + training.length + ' training pairs. The slopes and intercepts on screen are rounded for display.'
  ));

  for (const [index, handle] of handles.entries()) {
    const control = index === 0 ? intercept : slope;
    const term = index === 0 ? 'intercept' : 'slope';
    handle.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', event => {
      if (!handle.hasPointerCapture(event.pointerId)) return;
      const bounds = plot.getBoundingClientRect();
      if (!bounds.height) return;
      const fraction = (event.clientY - bounds.top) / bounds.height;
      const vertical = maxAxis * (1 - Math.max(0, Math.min(1, fraction)));
      const value = index === 0 ? vertical : (vertical - line.intercept) / riseX;
      const step = Number(control.step);
      const rounded = Math.round(value / step) * step;
      control.value = Math.max(Number(control.min), Math.min(Number(control.max), rounded));
      showLine({ ...line, [term]: Number(control.value) }, manualStatus);
    });
  }
  new ResizeObserver(drawPlot).observe(plot);

  const featureValues = training.map(row => row.previousRentals);
  set('feature-range', fmt(Math.min(...featureValues)) + ' to ' + fmt(Math.max(...featureValues)) + ' rentals');
  set('fit-equation', 'ŷ ≈ ' + equation(fits.train));
  set('fit-stats', 'The model uses ' + fits.train.n + ' training pairs. Its MSE is ' +
    scoreFormat.format(scores.train.linear.mse) + ' rentals². Its slope predicts about ' +
    fmt(fits.train.slope * 100) + ' more rentals for each additional 100 in yesterday’s count.');
  set('fit-arithmetic', 'x̄ ≈ ' + fmt(fits.train.meanX) + ', ȳ ≈ ' + fmt(fits.train.meanY) +
    '. m ≈ ' + fmt(fits.train.crossProducts) + ' ÷ ' + fmt(fits.train.squaredXDeviations) + ' ≈ ' +
    precise(fits.train.slope, 6) + '. b ≈ ' + fmt(fits.train.meanY) + ' − ' +
    precise(fits.train.slope, 6) + ' × ' + fmt(fits.train.meanX) + ' ≈ ' + precise(fits.train.intercept, 4) + '.');

  const testMissing = data.excludedMissingPrevious.filter(date => date >= data.testStart).length;
  set('pair-counts', training.length + ' pairs fit the first line, ' + rows.validation.length +
    ' pairs score it in October, and ' + rows.test.length + ' pairs score the refitted rules in November and December. ' +
    'Yesterday’s input was available on ' + rows.test.length + ' of ' + (rows.test.length + testMissing) +
    ' observed test workdays.');

  for (const [part, model] of [['validation', fits.train], ['test', fits.refit]]) {
    const n = rows[part].length;
    for (const [name, label] of [['baseline', 'Calendar baseline (' + model.calendarPrediction + ' rentals)'], ['linear', 'Fitted line']]) {
      const score = scores[part][name];
      const row = get(part + '-rows').insertRow();
      const heading = document.createElement('th');
      heading.scope = 'row';
      heading.textContent = label;
      row.append(heading);
      row.insertCell().textContent = fmt(score.absoluteErrorTotal) + ' rentals';
      row.insertCell().textContent = integer.format(n);
      row.insertCell().textContent = scoreFormat.format(score.mae);
    }
  }
  const calendarCalc = model => 'round(' + integer.format(model.calendarTotal) + ' ÷ ' +
    integer.format(model.calendarCount) + ') = ' + model.calendarPrediction;
  set('validation-summary', 'The calendar forecast is ' + calendarCalc(fits.train) +
    ' rentals, using all observed 8 a.m. workday counts through September. The line lowers October MAE from ' +
    scoreFormat.format(scores.validation.baseline.mae) + ' to ' + scoreFormat.format(scores.validation.linear.mae) +
    ' rentals. Keep the line’s form and refit it using the ' + fits.refit.n + ' pairs through October.');
  set('test-summary', 'After refitting, the calendar forecast is ' + calendarCalc(fits.refit) +
    ' rentals. On the same ' + rows.test.length + ' later workdays, calendar MAE is ' +
    fmt(scores.test.baseline.absoluteErrorTotal) + ' ÷ ' + rows.test.length + ' = ' + scoreFormat.format(scores.test.baseline.mae) +
    '. Line MAE is ' + fmt(scores.test.linear.absoluteErrorTotal) + ' ÷ ' + rows.test.length + ' ≈ ' +
    scoreFormat.format(scores.test.linear.mae) + ' rentals.');

  const finalPrediction = forecast(fits.refit, focal.previousRentals);
  set('focal-linear-steps', 'Yesterday’s count was ' + focal.previousRentals + '. The refitted line predicts ' +
    forecastSteps(fits.refit, focal.previousRentals) + ' ≈ ' + scoreFormat.format(finalPrediction) +
    ' rentals. The record shows ' + focal.rentals + ', so the residual is ' +
    signed(focal.rentals - finalPrediction) + ' rentals. The 470-rental forecast missed by 210.');

  function disclosure(buttonId, targetId, title, afterReveal) {
    const button = get(buttonId);
    const target = get(targetId);
    button.addEventListener('click', () => {
      const opening = target.hidden;
      target.hidden = !opening;
      button.setAttribute('aria-expanded', String(opening));
      button.textContent = (opening ? 'Hide ' : 'Reveal ') + title;
      if (opening) {
        afterReveal?.();
        target.scrollIntoView({ block: 'nearest' });
      }
    });
  }
  disclosure('reveal-actual', 'focal-actual', 'the recorded count');
  disclosure('reveal-validation', 'validation-results', 'October validation', () => {
    get('reveal-test').disabled = false;
  });
  disclosure('reveal-test', 'test-results', 'November and December test');

  loadLine(line, baselineStatus);
})();
