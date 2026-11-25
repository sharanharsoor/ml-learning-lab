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
  const baselineCutoff = 0.25;
  const baseline = classify(baselineCutoff);
  const outcomes = [
    ['tp', 'Correct on-track forecast'], ['fn', 'Unnecessary late forecast'],
    ['fp', 'False on-track forecast'], ['tn', 'Correct late forecast'],
  ];
  const rateLabels = [['precision', 'Precision'], ['recall', 'Recall'], ['f1', 'F1'], ['accuracy', 'Accuracy']];
  const formatter = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });
  const percentage = value => value === null ? 'Undefined' : formatter.format(value);
  const forecast = confirmed => confirmed ? 'On track' : 'Likely late';
  let step = 0;

  order.replaceChildren(...baseline.cases.map(item => new Option(item.caseId, item.caseId)));
  order.value = 'D14';
  comparison.value = '0.10';

  function showStage(id) {
    lesson.querySelectorAll('[data-class-lesson-stage]').forEach(button => {
      const active = button.dataset.classLessonStage === id;
      button.setAttribute('aria-pressed', String(active));
      document.getElementById(button.getAttribute('aria-controls')).hidden = !active;
    });
  }

  function outcomeTable(item) {
    const cells = outcomes.map(([kind, description]) => {
      const active = kind === item.outcome;
      return `<td${active ? ' class="class-teach-outcome-active"' : ''}><strong>${kind.toUpperCase()}</strong><small>${active ? item.caseId + ' · ' : ''}${description}</small></td>`;
    });
    return `<table class="class-teach-outcome"><caption>${item.caseId} adds one count to its cell</caption>
      <thead><tr><th scope="col">Actual outcome</th><th scope="col">Forecast On track (P)</th><th scope="col">Forecast Likely late (N)</th></tr></thead>
      <tbody><tr><th scope="row">On time (P)</th>${cells[0]}${cells[1]}</tr>
      <tr><th scope="row">Late (N)</th>${cells[2]}${cells[3]}</tr></tbody></table>`;
  }

  function renderOrder() {
    const item = baseline.cases.find(item => item.caseId === order.value);
    const decision = step >= 1 ? `<div class="class-teach-ticket"><span>Forecast at dispatch</span><strong>${forecast(item.confirmed)}</strong><p>${item.score.toFixed(2)} ${item.confirmed ? '≥' : '&lt;'} ${baselineCutoff.toFixed(2)}</p></div>` : '';
    const actual = step === 2 ? `<div class="class-teach-ticket"><span>Outcome after arrival</span><strong>${item.onTime ? 'On time' : 'Late'}</strong><p>${item.onTime ? 'Arrived by' : 'Arrived after'} the promised 12:40 deadline.</p></div>` : '';
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
      return `<li><strong>${item.caseId}</strong><span>Score ${item.score.toFixed(2)} · Actual ${item.onTime ? 'on time' : 'late'}</span><span>${first.outcome.toUpperCase()} becomes ${item.outcome.toUpperCase()}</span></li>`;
    }).join('');
    const counts = result => `${result.tp} TP · ${result.fn} FN · ${result.fp} FP · ${result.tn} TN`;
    comparisonResult.innerHTML = `<div class="class-teach-compare">
      <table class="class-teach-outcome"><caption>Results on the same 20 orders</caption><thead><tr><th scope="col">Measure</th><th scope="col">Cutoff 0.25</th><th scope="col">Cutoff ${comparison.value}</th></tr></thead>
      <tbody><tr><th scope="row">Counts</th><td>${counts(baseline)}</td><td>${counts(alternate)}</td></tr>${rows}</tbody></table>
      <div><h4>${changed.length} ${changed.length === 1 ? 'order changes' : 'orders change'} forecast</h4><p>The scores and arrivals stay fixed. Each changed order moves to the other forecast column in its own actual-outcome row.</p><ul class="class-teach-changes">${examples}</ul>
      ${changed.length > 5 ? `<p>Showing five changes. Use the playground to inspect the full register.</p>` : ''}</div></div>`;
  }

  lesson.querySelectorAll('[data-class-lesson-stage]').forEach(button => {
    button.addEventListener('click', () => showStage(button.dataset.classLessonStage));
  });
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
  showStage('one');
  renderOrder();
  renderComparison();
})();
