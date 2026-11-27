(() => {
  'use strict';

  const { spam, spamProbability, spamOutcome } = window.Foundations;
  const get = id => document.getElementById('u7-' + id);
  const set = (id, value) => { get(id).textContent = value; };
  const unit = document.getElementById('unit-7');
  const integer = new Intl.NumberFormat('en-US');
  const percent = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });
  const count = value => integer.format(value);
  const rate = value => percent.format(value);
  const fmt = value => value.toFixed(2);
  const label = actual => actual ? 'Spam' : 'Legitimate';
  const formatScore = probability => probability.toFixed(4);
  const scored = rows => rows.map(row => ({ ...row, p: spamProbability(row.x) }));
  const validation = scored(spam.rows.validation);
  const test = scored(spam.rows.test);
  const byId = new Map(validation.map(row => [row.id, row]));
  const presets = spam.thresholds.presets;
  const thresholdDefault = spam.thresholds.default;
  const cells = ['tp', 'fn', 'fp', 'tn'];
  const cellNames = { tp: 'true positive', fn: 'false negative', fp: 'false positive', tn: 'true negative' };
  const blankCounts = () => ({ tp: 0, fn: 0, fp: 0, tn: 0 });

  function confusion(rows, cutoff) {
    const result = blankCounts();
    for (const row of rows) result[spamOutcome(row.y, row.p, cutoff)] += 1;
    return result;
  }

  function metric(numerator, denominator, working) {
    return denominator
      ? (working || count(numerator) + ' ÷ ' + count(denominator)) + ' ≈ ' + rate(numerator / denominator)
      : 'Undefined · denominator is zero';
  }

  function showMetrics(prefix, { tp, fn, fp, tn }) {
    const n = tp + fn + fp + tn;
    for (const [cell, value] of Object.entries({ tp, fn, fp, tn })) set(prefix + '-' + cell, count(value));
    set(prefix + '-accuracy', metric(tp + tn, n, '(' + count(tp) + ' + ' + count(tn) + ') ÷ ' + count(n)));
    set(prefix + '-precision', metric(tp, tp + fp, count(tp) + ' ÷ (' + count(tp) + ' + ' + count(fp) + ')'));
    set(prefix + '-recall', metric(tp, tp + fn, count(tp) + ' ÷ (' + count(tp) + ' + ' + count(fn) + ')'));
    set(prefix + '-fpr', metric(fp, fp + tn, count(fp) + ' ÷ (' + count(fp) + ' + ' + count(tn) + ')'));
    const twiceCorrectSpam = 2 * tp;
    set(prefix + '-f1', metric(twiceCorrectSpam, twiceCorrectSpam + fp + fn,
      '(2 × ' + count(tp) + ') ÷ (2 × ' + count(tp) + ' + ' + count(fp) + ' + ' + count(fn) + ')'));
    set(prefix + '-baseline-accuracy', metric(fp + tn, n));
    set(prefix + '-baseline-recall', metric(0, tp + fn));
  }

  const practiceEmail = get('practice-email');
  const practiceCutoff = get('practice-cutoff');
  const cellButtons = [...unit.querySelectorAll('[data-u7-cell]')];
  const placements = new Map();

  function showPractice() {
    const row = byId.get(practiceEmail.value);
    const cutoff = Number(practiceCutoff.value);
    const predicted = row.p >= cutoff;
    const comparison = (Number(formatScore(row.p)) >= cutoff) === predicted
      ? formatScore(row.p) : 'Unrounded p';
    set('practice-score', formatScore(row.p) + ' (' + rate(row.p) + ')');
    set('practice-actual', label(row.y));
    set('practice-prediction', label(predicted));
    set('practice-comparison', comparison + (predicted ? ' ≥ ' : ' < ') + fmt(cutoff));
    const totals = blankCounts();
    for (const placed of placements.values()) totals[placed] += 1;
    for (const cell of cells) set('practice-' + cell, count(totals[cell]));
    for (const button of cellButtons) {
      button.classList.toggle('u7-cell-selected', placements.get(row.id) === button.dataset.u7Cell);
    }
  }

  function resetPractice(message) {
    placements.clear();
    set('practice-feedback', message);
    showPractice();
  }

  practiceEmail.addEventListener('change', () => {
    const placement = placements.get(practiceEmail.value);
    set('practice-feedback', placement
      ? practiceEmail.value + ' already contributes to ' + cellNames[placement] + '.'
      : 'Use the recorded label for the row and the prediction for the column.');
    showPractice();
  });
  practiceCutoff.addEventListener('change', () => resetPractice('Cutoff changed. The four practice counts are cleared so you can place each email under the new rule.'));
  get('practice-reset').addEventListener('click', () => resetPractice('Practice counts cleared.'));
  for (const button of cellButtons) {
    button.addEventListener('click', () => {
      const row = byId.get(practiceEmail.value);
      const outcome = spamOutcome(row.y, row.p, Number(practiceCutoff.value));
      if (placements.has(row.id)) {
        set('practice-feedback', row.id + ' has already been counted at this cutoff.');
      } else if (button.dataset.u7Cell !== outcome) {
        set('practice-feedback', 'Try again. The recorded label is ' + label(row.y) + '. The prediction is ' +
          label(row.p >= Number(practiceCutoff.value)) + '.');
      } else {
        placements.set(row.id, outcome);
        set('practice-feedback', row.id + ' adds one ' + cellNames[outcome] + '. ' +
          placements.size + ' of ' + practiceEmail.options.length + ' practice emails placed.');
        showPractice();
      }
    });
  }
  showPractice();

  const validationCutoff = get('validation-cutoff');
  function showValidation() {
    const cutoff = Number(validationCutoff.value);
    set('validation-cutoff-value', rate(cutoff));
    validationCutoff.setAttribute('aria-valuetext', rate(cutoff) + ' Spam cutoff');
    showMetrics('v', confusion(validation, cutoff));
    for (const button of unit.querySelectorAll('[data-u7-cutoff]')) {
      button.setAttribute('aria-pressed', String(Number(button.dataset.u7Cutoff) === cutoff));
    }
  }
  validationCutoff.addEventListener('input', showValidation);
  for (const button of unit.querySelectorAll('[data-u7-cutoff]')) {
    button.addEventListener('click', () => {
      validationCutoff.value = button.dataset.u7Cutoff;
      showValidation();
    });
  }
  showValidation();

  const metricFocus = get('metric-focus');
  const metricReadings = {
    accuracy: [cells, 'Use all four cells in the denominator. TP and TN are the correct decisions in the numerator.'],
    precision: [['tp', 'fp'], 'Use the Predict Spam column. TP is the share of those flags that were correct.'],
    recall: [['tp', 'fn'], 'Use the Recorded Spam row. TP is the share of those emails the filter caught.'],
    fpr: [['fp', 'tn'], 'Use the Recorded Legitimate row. FP is the share of those emails that were flagged.'],
    f1: [['tp', 'fp', 'fn'], 'F1 doubles TP and includes both kinds of mistakes in the denominator. TN stays outside the calculation.']
  };
  function showMetricFocus() {
    const [marked, note] = metricReadings[metricFocus.value];
    for (const cell of cells) get('v-' + cell).closest('td').classList.toggle('u7-count-focus', marked.includes(cell));
    set('metric-focus-note', note);
  }
  if (metricFocus) {
    metricFocus.addEventListener('change', showMetricFocus);
    showMetricFocus();
  }

  const budget = 25;
  const budgetChoice = get('budget-choice');
  const lock = get('lock-cutoff');
  const reveal = get('reveal-test');
  const options = presets.map(cutoff => ({ cutoff, ...confusion(validation, cutoff) }));
  const best = options.filter(option => option.fp <= budget).reduce((a, b) => a.tp >= b.tp ? a : b);
  let locked = null;

  for (const option of options) {
    const tr = get('budget-rows').insertRow();
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = fmt(option.cutoff);
    tr.append(th);
    for (const value of [count(option.tp), count(option.fp), option.fp <= budget ? 'Yes' : 'No']) {
      tr.insertCell().textContent = value;
    }
  }

  budgetChoice.addEventListener('change', () => {
    lock.disabled = !budgetChoice.value;
  });
  lock.addEventListener('click', () => {
    const option = options.find(option => option.cutoff === Number(budgetChoice.value));
    if (!option) {
      set('budget-feedback', 'Choose one of the three validation cutoffs first.');
    } else if (option.fp > budget) {
      set('budget-feedback', fmt(option.cutoff) + ' flags ' + option.fp + ' Legitimate emails. The limit is ' + budget + '.');
    } else if (option.cutoff !== best.cutoff) {
      set('budget-feedback', fmt(option.cutoff) + ' meets the limit and catches ' + option.tp +
        ' Spam emails. Check whether another cutoff can catch more and still meet the limit.');
    } else {
      locked = option.cutoff;
      lock.disabled = true;
      budgetChoice.disabled = true;
      reveal.disabled = false;
      set('budget-feedback', 'Locked at ' + fmt(locked) + '. This cutoff catches ' + option.tp +
        ' Spam emails and has ' + option.fp + ' false alarms on validation.');
    }
  });
  reveal.addEventListener('click', () => {
    if (locked === null) return;
    const result = confusion(test, locked);
    showMetrics('t', result);
    set('test-cutoff', 'cutoff ' + fmt(locked));
    const testResults = get('test-results');
    testResults.hidden = false;
    reveal.setAttribute('aria-expanded', 'true');
    reveal.disabled = true;
    testResults.scrollIntoView({ block: 'nearest' });
  });

  const positives = validation.filter(row => row.y).length;
  const negatives = validation.length - positives;
  const groups = new Map();
  for (const row of validation) {
    if (!groups.has(row.p)) groups.set(row.p, { threshold: row.p, positive: 0, negative: 0 });
    const group = groups.get(row.p);
    group[row.y ? 'positive' : 'negative'] += 1;
  }
  const points = [{ threshold: Infinity, tp: 0, fp: 0, positive: 0, negative: 0 }];
  let tp = 0;
  let fp = 0;
  let wins = 0;
  let ties = 0;
  for (const group of [...groups.values()].sort((a, b) => b.threshold - a.threshold)) {
    tp += group.positive;
    fp += group.negative;
    wins += group.positive * (negatives - fp);
    ties += group.positive * group.negative;
    points.push({ ...group, tp, fp });
  }

  const pairs = positives * negatives;
  const auc = (wins + 0.5 * ties) / pairs;
  set('auc', '(' + count(wins) + ' + 0.5 × ' + count(ties) + ') ÷ ' + count(pairs) + ' ≈ ' + auc.toFixed(4));
  const stepSlider = get('roc-step');
  const previous = get('roc-previous');
  const next = get('roc-next');
  const play = get('roc-play');
  const chart = get('roc');
  const last = points.length - 1;
  let step = 0;
  let timer = null;

  function drawRoc() {
    const { clientWidth: width, clientHeight: height } = chart;
    if (width < 90 || height < 90) return;
    const ctx = chart.getContext('2d');
    if (!ctx) return;
    const scale = window.devicePixelRatio || 1;
    chart.width = Math.round(width * scale);
    chart.height = Math.round(height * scale);
    ctx.scale(scale, scale);
    const left = 49, right = width - 19, top = 17, bottom = height - 38;
    const x = v => left + (right - left) * v;
    const y = v => bottom - (bottom - top) * v;
    const grid = [0, 0.25, 0.5, 0.75, 1];
    ctx.font = '12px system-ui, sans-serif';
    ctx.strokeStyle = '#dde5df';
    ctx.fillStyle = '#445750';
    ctx.lineWidth = 1;
    ctx.textBaseline = 'middle';
    for (const v of grid) {
      ctx.beginPath();
      ctx.moveTo(left, y(v));
      ctx.lineTo(right, y(v));
      ctx.moveTo(x(v), top);
      ctx.lineTo(x(v), bottom);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(rate(v), left - 8, y(v));
      ctx.textAlign = 'center';
      ctx.fillText(rate(v), x(v), bottom + 15);
    }
    ctx.fillText('False-positive rate', (left + right) / 2, bottom + 30);
    ctx.strokeStyle = '#83958a';
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, bottom);
    ctx.lineTo(right, bottom);
    ctx.stroke();
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(left, bottom);
    ctx.lineTo(right, top);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const [limit, color, weight] of [[last, '#bec8c1', 2], [step, '#0a6b5c', 3]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = weight;
      ctx.beginPath();
      ctx.moveTo(left, bottom);
      for (let i = 1; i <= limit; i += 1) ctx.lineTo(x(points[i].fp / negatives), y(points[i].tp / positives));
      ctx.stroke();
    }
    const point = points[step];
    ctx.beginPath();
    ctx.arc(x(point.fp / negatives), y(point.tp / positives), 5.5, 0, 2 * Math.PI);
    ctx.fillStyle = '#624789';
    ctx.fill();
    ctx.strokeStyle = '#fffefa';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function stopPlayback() {
    clearInterval(timer);
    timer = null;
    play.textContent = 'Play the sweep';
    play.setAttribute('aria-pressed', 'false');
  }
  function showRoc(index, message, cutoffLabel) {
    step = index;
    stepSlider.value = step;
    const point = points[step];
    const threshold = cutoffLabel || (step === 0 ? 'Above every score' : '≈ ' + point.threshold.toFixed(6));
    set('roc-threshold', threshold);
    stepSlider.setAttribute('aria-valuetext', step + ' of ' + last + ' score groups, cutoff ' + threshold);
    set('roc-tpr', metric(point.tp, positives));
    set('roc-fpr', metric(point.fp, negatives));
    set('roc-group', step === 0
      ? 'No emails flagged'
      : '+' + count(point.positive) + ' Spam and +' + count(point.negative) + ' Legitimate at this exact score');
    set('roc-status', message || (step === 0 ? 'Start at (0, 0). No scores reach this high cutoff.'
      : step === last ? 'End at (1, 1). All scores reach the last cutoff.'
      : 'Included score group ' + count(step) + ' of ' + count(last) + '.'));
    previous.disabled = step === 0;
    next.disabled = step === last;
    drawRoc();
  }
  stepSlider.max = last;
  stepSlider.addEventListener('input', () => {
    stopPlayback();
    showRoc(Number(stepSlider.value));
  });
  for (const [button, offset] of [[previous, -1], [next, 1]]) {
    button.addEventListener('click', () => {
      stopPlayback();
      showRoc(step + offset);
    });
  }
  play.addEventListener('click', () => {
    if (timer !== null) {
      stopPlayback();
      return;
    }
    if (step === last) showRoc(0);
    play.textContent = 'Pause the sweep';
    play.setAttribute('aria-pressed', 'true');
    timer = setInterval(() => {
      if (unit.hidden || step === last) stopPlayback();
      else showRoc(step + 1);
    }, 70);
  });
  get('roc-fifty')?.addEventListener('click', () => {
    stopPlayback();
    showRoc(points.findLastIndex(point => point.threshold >= thresholdDefault),
      'The 0.50 cutoff flags these same emails. This is the ROC point for the 0.50 validation matrix.', '0.50');
  });
  get('roc-tie')?.addEventListener('click', () => {
    stopPlayback();
    const index = points.findIndex(point => point.threshold === byId.get('E1405').p);
    const before = points[index - 1];
    const after = points[index];
    showRoc(index, 'E1405 and E3487 enter together. True positives rise from ' + before.tp + ' to ' + after.tp +
      ', and false positives rise from ' + before.fp + ' to ' + after.fp + '.');
  });
  if (typeof ResizeObserver === 'function') new ResizeObserver(drawRoc).observe(chart);
  showRoc(0);
})();
