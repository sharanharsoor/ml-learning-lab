(() => {
  const lesson = document.getElementById('classification-teaching');
  const { classify } = window.MetricsCore;
  const order = lesson.querySelector('#class-teach-order');
  const replay = lesson.querySelector('#class-teach-replay');
  const reveal = lesson.querySelector('#class-teach-reveal');
  const reset = lesson.querySelector('#class-teach-reset');
  const comparison = lesson.querySelector('#class-teach-comparison');
  const comparisonResult = lesson.querySelector('#class-teach-comparison-result');
  const threshold = document.getElementById('threshold');
  const stages = [...lesson.querySelectorAll('[data-class-lesson-stage]')];
  const previous = lesson.querySelector('#class-teach-previous');
  const next = lesson.querySelector('#class-teach-next');
  const baselineCutoff = 0.25;
  const baseline = classify(baselineCutoff);
  const outcomes = [
    ['tp', 'True positive'], ['fn', 'False negative'],
    ['fp', 'False positive'], ['tn', 'True negative'],
  ];
  const focusCases = ['D14', 'D19'].map(id => baseline.cases.find(item => item.caseId === id));
  const rateLabels = [['precision', 'Precision'], ['recall', 'Recall'], ['f1', 'F1'], ['accuracy', 'Accuracy']];
  const formatter = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });
  const percentage = value => value === null ? 'Undefined' : formatter.format(value);
  const forecast = confirmed => confirmed ? 'On track' : 'Likely late';
  let step = 0;
  let activeStage = 0;

  order.replaceChildren(...baseline.cases.map(item => new Option(item.caseId, item.caseId)));
  order.value = 'D14';
  comparison.value = '0.10';

  function showStage(index, focusHeading = false) {
    activeStage = index;
    stages.forEach((button, i) => {
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      button.setAttribute('aria-pressed', String(i === activeStage));
      panel.hidden = i !== activeStage;
    });
    previous.disabled = activeStage === 0;
    next.disabled = activeStage === stages.length - 1;
    if (focusHeading) {
      const panel = document.getElementById(stages[activeStage].getAttribute('aria-controls'));
      const heading = panel.querySelector('h3');
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    }
  }

  function outcomeTable(item) {
    const cells = outcomes.map(([kind, meaning]) => {
      const active = item?.outcome === kind;
      const value = item ? kind.toUpperCase() : `${baseline[kind]} ${kind.toUpperCase()}`;
      return `<td${active ? ' class="class-teach-outcome-active"' : ''}><strong>${value}</strong><small>${active ? item.caseId + ' · ' : ''}${meaning}</small></td>`;
    });
    const caption = item ? `${item.caseId} adds one count to its highlighted cell` : 'All 20 orders at cutoff 0.25';
    return `<table class="class-teach-outcome"><caption>${caption}</caption>
      <thead><tr><th scope="col">Actual outcome</th><th scope="col">Forecast On track (P)</th><th scope="col">Forecast Likely late (N)</th></tr></thead>
      <tbody><tr><th scope="row">On time (P)</th>${cells[0]}${cells[1]}</tr>
      <tr><th scope="row">Late (N)</th>${cells[2]}${cells[3]}</tr></tbody></table>`;
  }

  function showMetricEvidence() {
    const records = focusCases.map(item => `<tr><th scope="row">${item.caseId}</th><td>${item.score.toFixed(2)}</td>
      <td>${item.onTime ? 'On time' : 'Late'}</td><td>${forecast(item.confirmed)} (${item.outcome.toUpperCase()})</td></tr>`).join('');
    lesson.querySelector('#class-teach-rate-evidence').innerHTML = outcomeTable() +
      `<table class="class-teach-outcome"><caption>The two mistakes from the replay</caption>
       <thead><tr><th scope="col">Order</th><th scope="col">Score</th><th scope="col">Actual</th><th scope="col">Forecast</th></tr></thead>
       <tbody>${records}</tbody></table>`;
  }

  function showPairEvidence() {
    const positives = baseline.cases.filter(item => item.onTime);
    const negatives = baseline.cases.filter(item => !item.onTime);
    const groups = negatives.map(item => {
      const wins = positives.filter(other => other.score > item.score).length;
      const ties = positives.filter(other => other.score === item.score).length;
      return { item, wins, ties, credit: wins + ties / 2 };
    });
    const credits = groups.reduce((total, group) => total + group.credit, 0);
    const pairs = positives.length * negatives.length;
    const rows = groups.map(({ item, wins, ties, credit }) => `<tr><th scope="row">${item.caseId}</th>
      <td>${item.score.toFixed(2)}</td><td>${wins}</td><td>${ties}</td><td>${credit} / ${positives.length}</td></tr>`).join('');
    lesson.querySelector('#class-teach-auc-evidence').innerHTML = `
      <table class="class-teach-outcome"><caption>Compare all ${positives.length} actual on-time orders with each actual late order</caption>
      <thead><tr><th scope="col">Late order</th><th scope="col">Score</th><th scope="col">On-time wins</th><th scope="col">Tied scores</th><th scope="col">Pair credit</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <p class="class-teach-equation">AUC = (${groups.map(group => group.credit).join(' + ')}) ÷ (${positives.length} × ${negatives.length}) = ${credits}/${pairs} ≈ ${(credits / pairs).toFixed(3)}</p>`;
  }

  function showPythonExample() {
    const scores = focusCases.map(item => item.score.toFixed(2)).join(', ');
    const labels = focusCases.map(item => Number(item.onTime));
    const predictions = focusCases.map(item => Number(item.confirmed));
    const correct = focusCases.filter(item => item.confirmed === item.onTime).length;
    lesson.querySelector('#class-teach-code-example').textContent =
      `# Each list contains D14, then D19.\nscores = [${scores}]\nactual = [${labels.join(', ')}]\ncutoff = ${baselineCutoff.toFixed(2)}\npredicted = [int(score >= cutoff) for score in scores]\ncorrect = sum(p == y for p, y in zip(predicted, actual))\nprint(predicted, correct)`;
    lesson.querySelector('#class-teach-code-output').textContent =
      `The snippet prints [${predictions.join(', ')}] and ${correct} correct. These are the two mistakes we replayed. Use all 20 cases for overall accuracy.`;
  }

  function renderOrder() {
    const item = baseline.cases.find(item => item.caseId === order.value);
    const decision = step >= 1 ? `<div class="class-teach-ticket"><span>Forecast at dispatch</span><strong>${forecast(item.confirmed)}</strong><p>${item.score.toFixed(2)} ${item.confirmed ? '≥' : '&lt;'} ${baselineCutoff.toFixed(2)}</p></div>` : '';
    const actual = step === 2 ? `<div class="class-teach-ticket"><span>Outcome after arrival</span><strong>${item.onTime ? 'On time' : 'Late'}</strong><p>${item.onTime ? 'Arrived by' : 'Arrived after'} the promised 12:40 deadline. This is the recorded class.</p></div>` : '';
    replay.innerHTML = `<div class="class-teach-replay-cards"><div class="class-teach-ticket"><span>${item.caseId} · On-time score</span><strong>${item.score.toFixed(2)}</strong><p>Higher scores rank on-time arrival more confidently.</p></div>${decision}${actual}</div>${step === 2 ? outcomeTable(item) : ''}`;
    reveal.hidden = step === 2;
    reveal.textContent = step ? 'Show actual outcome' : 'Show dispatch forecast';
    reset.hidden = step === 0;
  }

  function renderComparison() {
    const alternate = classify(Number(comparison.value));
    const changed = alternate.cases.filter((item, i) => item.confirmed !== baseline.cases[i].confirmed);
    const rows = rateLabels.map(([key, label]) => `<tr><th scope="row">${label}</th><td>${percentage(baseline[key])}</td><td>${percentage(alternate[key])}</td></tr>`).join('');
    const examples = changed.slice(0, 5).map(item => {
      const first = baseline.cases[item.id - 1];
      return `<li><strong>${item.caseId}</strong><span>Score ${item.score.toFixed(2)} · Actual ${item.onTime ? 'on time' : 'late'}</span>
        <span>${forecast(first.confirmed)} (${first.outcome.toUpperCase()}) → ${forecast(item.confirmed)} (${item.outcome.toUpperCase()})</span></li>`;
    }).join('');
    const counts = result => `${result.tp} TP · ${result.fn} FN · ${result.fp} FP · ${result.tn} TN`;
    comparisonResult.innerHTML = `<div class="class-teach-compare">
      <table class="class-teach-outcome"><caption>Results on the same 20 orders</caption><thead><tr><th scope="col">Measure</th><th scope="col">Cutoff 0.25</th><th scope="col">Cutoff ${comparison.value}</th></tr></thead>
      <tbody><tr><th scope="row">Counts</th><td>${counts(baseline)}</td><td>${counts(alternate)}</td></tr>${rows}</tbody></table>
      <div><h4>${changed.length} ${changed.length === 1 ? 'order changes' : 'orders change'} forecast</h4><p>The scores and arrivals stay fixed. Each changed order moves to the other forecast column in its own actual-outcome row.</p>
      ${alternate.precision === null ? '<p>At this cutoff every forecast is Likely late. There are zero On track forecasts to divide by, so precision is undefined.</p>' : ''}
      <ul class="class-teach-changes">${examples}</ul>
      ${changed.length > 5 ? `<p>Showing five changes. Use the playground to inspect the full register.</p>` : ''}</div></div>`;
  }

  stages.forEach((button, i) => {
    button.addEventListener('click', () => showStage(i));
  });
  previous.addEventListener('click', () => showStage(activeStage - 1, true));
  next.addEventListener('click', () => showStage(activeStage + 1, true));
  lesson.querySelectorAll('[data-class-focus]').forEach(button => {
    button.addEventListener('click', () => {
      const control = document.querySelector(`[data-teach="${button.dataset.classFocus}"]`);
      window.MetricsLab.setThreshold(baselineCutoff);
      control.click();
      control.focus();
    });
  });
  order.addEventListener('change', () => { step = 0; renderOrder(); });
  reveal.addEventListener('click', () => {
    step += 1;
    renderOrder();
    if (step === 2) reset.focus();
  });
  reset.addEventListener('click', () => { step = 0; renderOrder(); reveal.focus(); });
  comparison.addEventListener('change', renderComparison);
  lesson.querySelector('#class-teach-use-cutoff').addEventListener('click', () => {
    document.querySelector('[data-teach="register"]').click();
    window.MetricsLab.setThreshold(comparison.value);
    threshold.focus();
  });
  showStage(0);
  renderOrder();
  renderComparison();
  showMetricEvidence();
  showPairEvidence();
  showPythonExample();
})();
