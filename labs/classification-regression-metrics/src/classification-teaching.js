(() => {
  const lesson = document.getElementById('classification-teaching');
  const { classify, classificationData, roc } = window.MetricsCore;
  const email = lesson.querySelector('#class-teach-order');
  const replay = lesson.querySelector('#class-teach-replay');
  const reveal = lesson.querySelector('#class-teach-reveal');
  const reset = lesson.querySelector('#class-teach-reset');
  const comparison = lesson.querySelector('#class-teach-comparison');
  const comparisonResult = lesson.querySelector('#class-teach-comparison-result');
  const custom = lesson.querySelector('#class-teach-custom');
  const register = lesson.querySelector('#class-teach-register');
  const rocCutoff = lesson.querySelector('#class-teach-roc-cutoff');
  const positiveChoice = lesson.querySelector('#class-teach-positive');
  const negativeChoice = lesson.querySelector('#class-teach-negative');
  const rateButtons = [...lesson.querySelectorAll('[data-class-focus]')];
  const stages = [...lesson.querySelectorAll('[data-class-lesson-stage]')];
  const previous = lesson.querySelector('#class-teach-previous');
  const next = lesson.querySelector('#class-teach-next');
  const baselineCutoff = classificationData.default_threshold;
  const baseline = classify(baselineCutoff);
  const casesById = new Map(baseline.cases.map(item => [item.caseId, item]));
  const outcomes = [
    ['tp', 'True positive'], ['fn', 'False negative'],
    ['fp', 'False positive'], ['tn', 'True negative'],
  ];
  const focusCases = ['E4130', 'E35'].map(id => casesById.get(id));
  const rateLabels = [['precision', 'Precision'], ['recall', 'Recall'], ['f1', 'F1'], ['accuracy', 'Accuracy']];
  const formatter = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 });
  const percentage = value => value === null ? 'Undefined' : formatter.format(value);
  const scoreText = score => score.toFixed(classificationData.score_decimals);
  const classLabel = spam => spam ? 'Spam' : 'Legitimate';
  const destination = spam => spam ? 'Spam folder' : 'Inbox';
  const counts = result => `${result.tp} TP · ${result.fn} FN · ${result.fp} FP · ${result.tn} TN`;
  let step = 0;
  let activeStage = 0;

  email.replaceChildren(...baseline.cases.map(item => new Option(item.caseId, item.caseId)));
  email.value = focusCases[0].caseId;

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

  function outcomeTable({ item, highlighted = [], result = baseline, caption = 'All 20 teaching emails at cutoff 0.50', changes = {} } = {}) {
    const cells = outcomes.map(([kind, meaning]) => {
      const active = item?.outcome === kind || highlighted.includes(kind);
      const value = item ? kind.toUpperCase() : `${result[kind]} ${kind.toUpperCase()}`;
      const delta = changes[kind];
      const change = delta ? `<small class="class-teach-outcome-change">${Math.abs(delta)} ${delta > 0 ? 'more' : 'fewer'}</small>` : '';
      return `<td${active ? ' class="class-teach-outcome-active"' : ''}><strong>${value}</strong><small>${item && active ? item.caseId + ' · ' : ''}${meaning}</small>${change}</td>`;
    });
    const title = item ? `${item.caseId} adds one count to its highlighted cell` : caption;
    return `<table class="class-teach-outcome"><caption>${title}</caption>
      <thead><tr><th scope="col">Recorded label</th><th scope="col">Predicted Spam (P)</th><th scope="col">Predicted Legitimate (N)</th></tr></thead>
      <tbody><tr><th scope="row">Spam (P)</th>${cells[0]}${cells[1]}</tr>
      <tr><th scope="row">Legitimate (N)</th>${cells[2]}${cells[3]}</tr></tbody></table>`;
  }

  function showMetricEvidence(highlighted) {
    const records = focusCases.map(item => `<tr><th scope="row">${item.caseId}</th><td>${scoreText(item.score)}</td>
      <td>${classLabel(item.actualSpam)}</td><td>${classLabel(item.predictedSpam)} (${item.outcome.toUpperCase()})</td></tr>`).join('');
    lesson.querySelector('#class-teach-rate-evidence').innerHTML = outcomeTable({ highlighted }) +
      `<table class="class-teach-outcome"><caption>Two mistakes to trace</caption>
       <thead><tr><th scope="col">Email</th><th scope="col">Score</th><th scope="col">Actual</th><th scope="col">Prediction</th></tr></thead>
       <tbody>${records}</tbody></table>`;
  }

  function showSelectedPair() {
    const positive = casesById.get(positiveChoice.value);
    const negative = casesById.get(negativeChoice.value);
    const tie = positive.score === negative.score;
    const wins = positive.score > negative.score;
    const credit = tie ? 0.5 : Number(wins);
    const relation = tie ? '=' : wins ? '>' : '<';
    lesson.querySelector('#class-teach-pair').textContent =
      `${positive.caseId} (${scoreText(positive.score)}) ${relation} ${negative.caseId} (${scoreText(negative.score)}) · Pair earns ${credit}`;
  }

  function showPairEvidence() {
    const positives = baseline.cases.filter(item => item.actualSpam);
    const negatives = baseline.cases.filter(item => !item.actualSpam);
    for (const [control, cases] of [[positiveChoice, positives], [negativeChoice, negatives]]) {
      control.replaceChildren(...cases.map(item => new Option(`${item.caseId} · ${scoreText(item.score)}`, item.caseId)));
      control.addEventListener('change', showSelectedPair);
    }
    positiveChoice.value = 'E1809';
    negativeChoice.value = 'E4130';
    showSelectedPair();
    const groups = negatives.map(item => {
      const wins = positives.filter(other => other.score > item.score).length;
      const ties = positives.filter(other => other.score === item.score).length;
      return { item, wins, ties, credit: wins + ties / 2 };
    });
    const credits = groups.reduce((total, group) => total + group.credit, 0);
    const wins = groups.reduce((total, group) => total + group.wins, 0);
    const ties = groups.reduce((total, group) => total + group.ties, 0);
    const pairs = positives.length * negatives.length;
    const rows = groups.map(({ item, wins, ties, credit }) => `<tr><th scope="row">${item.caseId}</th>
      <td>${scoreText(item.score)}</td><td>${wins}</td><td>${ties}</td><td>${credit} / ${positives.length}</td></tr>`).join('');
    lesson.querySelector('#class-teach-auc-evidence').innerHTML = `
      <p>Across ${positives.length} × ${negatives.length} = ${pairs} pairs, the Spam email scores higher in ${wins}, lower in ${pairs - wins - ties}, and ties in ${ties}.</p>
      <p class="class-teach-equation">AUC = (${wins} + 0.5 × ${ties}) ÷ ${pairs} = ${credits}/${pairs} = ${(credits / pairs).toFixed(3)}</p>
      <details class="class-teach-note"><summary>Show how the 100 pairs add up</summary>
      <table class="class-teach-outcome"><caption>Compare all ${positives.length} Spam emails with each Legitimate email</caption>
      <thead><tr><th scope="col">Legitimate email</th><th scope="col">Score</th><th scope="col">Spam wins</th><th scope="col">Tied scores</th><th scope="col">Pair credit</th></tr></thead>
      <tbody>${rows}</tbody></table></details>`;
  }

  function showFullTestEvidence() {
    const { full_test: test } = classificationData;
    const reference = test.counts[String(baselineCutoff)];
    const correct = reference.tp + reference.tn;
    lesson.querySelector('#class-teach-full-test').innerHTML = `
      <p>The same fitted model scored all ${test.rows.toLocaleString('en-US')} test emails. The fold has ${test.spam} Spam and ${test.rows - test.spam} Legitimate messages.</p>
      <p>At 0.50 it has ${counts(reference)}. The fold accuracy is ${correct}/${test.rows} or ${percentage(correct / test.rows)}, and the ROC AUC is ${test.auc.toFixed(3)}.</p>`;
  }

  function showPythonExample() {
    const scores = focusCases.map(item => scoreText(item.score)).join(', ');
    const labels = focusCases.map(item => Number(item.actualSpam));
    const predictions = focusCases.map(item => Number(item.predictedSpam));
    const correct = focusCases.filter(item => item.predictedSpam === item.actualSpam).length;
    lesson.querySelector('#class-teach-code-example').textContent =
      `# Each list contains E4130, then E35.\nscores = [${scores}]\nactual = [${labels.join(', ')}]\ncutoff = ${baselineCutoff.toFixed(2)}\npredicted = [int(score >= cutoff) for score in scores]\ncorrect = sum(p == y for p, y in zip(predicted, actual))\nprint(predicted, correct)`;
    lesson.querySelector('#class-teach-code-output').textContent =
      `The snippet prints [${predictions.join(', ')}] and ${correct} correct. We chose two mistakes for the replay. Overall accuracy uses all 20 teaching emails.`;
  }

  function renderEmail() {
    const item = casesById.get(email.value);
    const decision = step >= 1 ? `<div class="class-teach-ticket"><span>Filter decision</span><strong>${destination(item.predictedSpam)}</strong><p>Predict ${classLabel(item.predictedSpam)} because ${scoreText(item.score)} ${item.predictedSpam ? '≥' : '&lt;'} ${baselineCutoff.toFixed(2)}.</p></div>` : '';
    const actual = step === 2 ? `<div class="class-teach-ticket"><span>UCI recorded label</span><strong>${classLabel(item.actualSpam)}</strong><p>Use this field after predicting to evaluate the filter.</p></div>` : '';
    replay.innerHTML = `<div class="class-teach-replay-cards"><div class="class-teach-ticket"><span>${item.caseId} · Spam score</span><strong>${scoreText(item.score)}</strong><p>The fitted model scored this held-out email.</p></div>${decision}${actual}</div>${step === 2 ? outcomeTable({ item }) : ''}`;
    reveal.hidden = step === 2;
    reveal.textContent = step ? 'Show recorded label' : 'Show filter decision';
    reset.hidden = step === 0;
  }

  function renderComparison() {
    const useCustom = comparison.value === 'custom';
    custom.parentElement.hidden = !useCustom;
    if (useCustom && (custom.value === '' || !custom.validity.valid)) return;
    const value = useCustom ? Number(custom.value) : Number(comparison.value);
    const cutoffText = useCustom ? scoreText(value) : value.toFixed(2);
    const alternate = classify(value);
    const changes = Object.fromEntries(outcomes.map(([kind]) => [kind, alternate[kind] - baseline[kind]]));
    const highlighted = Object.keys(changes).filter(kind => changes[kind] !== 0);
    const changed = alternate.cases.filter(item => item.predictedSpam !== casesById.get(item.caseId).predictedSpam);
    const rows = rateLabels.map(([key, label]) => `<tr><th scope="row">${label}</th><td>${percentage(baseline[key])}</td><td>${percentage(alternate[key])}</td></tr>`).join('');
    const examples = changed.slice(0, 5).map(item => {
      const first = casesById.get(item.caseId);
      return `<li><strong>${item.caseId}</strong><span>Score ${scoreText(item.score)} · Actual ${classLabel(item.actualSpam)}</span>
        <span>${destination(first.predictedSpam)} (${first.outcome.toUpperCase()}) → ${destination(item.predictedSpam)} (${item.outcome.toUpperCase()})</span></li>`;
    }).join('');
    comparisonResult.innerHTML = `<div class="class-teach-compare class-teach-matrix-pair" id="class-teach-comparison-matrices">
      ${outcomeTable({ caption: 'Baseline matrix · cutoff 0.50' })}
      ${outcomeTable({ result: alternate, caption: `Second matrix · cutoff ${cutoffText}`, highlighted, changes })}
      </div><div class="class-teach-compare">
      <table class="class-teach-outcome"><caption>Rates on the same 20 emails</caption><thead><tr><th scope="col">Measure</th><th scope="col">Cutoff 0.50</th><th scope="col">Cutoff ${cutoffText}</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div><h4>${changed.length} ${changed.length === 1 ? 'email changes' : 'emails change'} folder</h4><p>Each changed email moves to the other prediction column. Its score and recorded label stay fixed.</p>
      ${alternate.precision === null ? '<p>Every email goes to the inbox. The predicted-Spam column has zero emails, so precision is undefined.</p>' : ''}
      <ul class="class-teach-changes">${examples}</ul>
      ${changed.length > 5 ? '<p>Open the full register below to see the rest.</p>' : ''}</div></div>`;
    const records = alternate.cases.map(item => {
      const before = casesById.get(item.caseId);
      return `<tr><th scope="row">${item.caseId}</th><td>${scoreText(item.score)}</td><td>${classLabel(item.actualSpam)}</td>
        <td>${destination(before.predictedSpam)} (${before.outcome.toUpperCase()})</td>
        <td${before.outcome !== item.outcome ? ' class="class-teach-outcome-active"' : ''}>${destination(item.predictedSpam)} (${item.outcome.toUpperCase()})</td></tr>`;
    }).join('');
    register.innerHTML = `<table class="class-teach-outcome"><caption>Recorded labels and decisions at both cutoffs</caption>
      <thead><tr><th scope="col">Email</th><th scope="col">Score</th><th scope="col">Actual</th>
      <th scope="col">At 0.50</th><th scope="col">At ${cutoffText}</th></tr></thead><tbody>${records}</tbody></table>`;
    return value;
  }

  function setupRoc() {
    const x = rate => 64 + 386 * rate;
    const y = rate => 224 - 198 * rate;
    const points = roc().points.map(point => `${x(point.fpr)},${y(point.tpr)}`).join(' ');
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(value => `<text x="${x(value)}" y="245" text-anchor="middle">${value}</text>
      <text x="58" y="${y(value) + 4}" text-anchor="end">${value}</text>`).join('');
    lesson.querySelector('#class-teach-roc-chart').innerHTML = `<svg viewBox="0 0 475 278" role="img" aria-label="ROC curve for the 20 teaching emails">
      <path class="class-teach-roc-axis" d="M64 26V224H450"/>
      <path class="class-teach-roc-reference" d="M64 224L450 26"/>
      <polyline class="class-teach-roc-line" points="${points}"/>
      <circle class="class-teach-roc-marker" cx="64" cy="224" r="6"/>
      ${ticks}<text x="257" y="270" text-anchor="middle">False-positive rate (FPR)</text>
      <text transform="translate(16 125) rotate(-90)" text-anchor="middle">Recall (TPR)</text></svg>`;
    const marker = lesson.querySelector('.class-teach-roc-marker');
    const valueLabel = lesson.querySelector('#class-teach-roc-value');
    const coordinates = lesson.querySelector('#class-teach-roc-coordinates');
    function renderRocPoint() {
      const cutoff = Number(rocCutoff.value);
      const result = classify(cutoff);
      marker.setAttribute('cx', x(result.fpr));
      marker.setAttribute('cy', y(result.tpr));
      valueLabel.textContent = scoreText(cutoff);
      coordinates.textContent = `FPR ${result.fp}/${result.fp + result.tn} = ${percentage(result.fpr)} · TPR ${result.tp}/${result.tp + result.fn} = ${percentage(result.tpr)}`;
    }
    function setRocCutoff(value) {
      rocCutoff.value = value;
      renderRocPoint();
    }
    rocCutoff.addEventListener('input', renderRocPoint);
    lesson.querySelectorAll('[data-class-roc]').forEach(button => {
      button.addEventListener('click', () => setRocCutoff(button.dataset.classRoc));
    });
    renderRocPoint();
    return setRocCutoff;
  }

  stages.forEach((button, i) => {
    button.addEventListener('click', () => showStage(i));
  });
  previous.addEventListener('click', () => showStage(activeStage - 1, true));
  next.addEventListener('click', () => showStage(activeStage + 1, true));
  const focusExamples = {
    precision: { cells: ['tp', 'fp'], text: 'Precision divides 9 true positives by the 11 predicted Spam emails.' },
    recall: { cells: ['tp', 'fn'], text: 'Recall divides 9 true positives by the 10 actual Spam emails.' },
    f1: { cells: ['tp', 'fp', 'fn'], text: 'F1 uses 2 × 9 in the numerator and 2 × 9 + 2 + 1 in the denominator.' },
  };
  rateButtons.forEach(button => {
    button.addEventListener('click', () => {
      const example = focusExamples[button.dataset.classFocus];
      rateButtons.forEach(control => control.setAttribute('aria-pressed', String(control === button)));
      showMetricEvidence(example.cells);
      lesson.querySelector('#class-teach-rate-highlight').textContent = example.text;
    });
  });
  email.addEventListener('change', () => { step = 0; renderEmail(); });
  reveal.addEventListener('click', () => {
    step += 1;
    renderEmail();
    if (step === 2) reset.focus();
  });
  reset.addEventListener('click', () => { step = 0; renderEmail(); reveal.focus(); });
  const setRocCutoff = setupRoc();
  function updateComparison() {
    const selected = renderComparison();
    if (selected !== undefined) setRocCutoff(selected);
  }
  comparison.addEventListener('change', updateComparison);
  custom.addEventListener('input', updateComparison);
  showStage(0);
  renderEmail();
  renderComparison();
  showMetricEvidence();
  showPairEvidence();
  showFullTestEvidence();
  showPythonExample();
})();
