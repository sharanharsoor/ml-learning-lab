(() => {
  'use strict';

  const get = id => document.getElementById('bag-' + id);
  const { curves, choices, folds, summary } = JSON.parse(get('tuning-data').textContent);
  const percentage = value => (value * 100).toFixed(2) + '%';
  const count = value => Number(value).toLocaleString('en-US');

  function explore(root, labels, render) {
    const controls = document.createElement('div');
    controls.className = 'bag-actions';
    const output = document.createElement('div');
    output.setAttribute('aria-live', 'polite');
    const buttons = labels.map((label, i) => {
      const button = document.createElement('button');
      button.className = 'button secondary';
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', () => choose(i));
      controls.append(button);
      return button;
    });
    function choose(index) {
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
      output.innerHTML = render(index);
    }
    root.append(controls, output);
    choose(0);
  }

  function curveMarkup(curve) {
    const xs = curve.values.map((_, i) => 72 + 526 * i / (curve.values.length - 1));
    const axisMinimum = Math.max(0, Math.floor((Math.min(...curve.train, ...curve.validation) - .01) * 20) / 20);
    const y = score => 239 - 210 * (score - axisMinimum) / (1 - axisMinimum);
    const ticks = Array.from({ length: 6 }, (_, i) => axisMinimum + i * (1 - axisMinimum) / 5);
    const grid = ticks.map(score =>
      `<line x1="61" x2="610" y1="${y(score)}" y2="${y(score)}" stroke="#dce8e3"/>
       <text x="52" y="${y(score) + 5}" text-anchor="end">${Math.round(score * 100)}%</text>`
    ).join('');
    const settingTicks = curve.values.map((label, i) =>
      `<text x="${xs[i]}" y="263" text-anchor="middle">${label}</text>`
    ).join('');
    function series(values, color, dashed = false) {
      const points = values.map((score, i) => `${xs[i]},${y(score)}`).join(' ');
      const dots = values.map((score, i) =>
        `<circle cx="${xs[i]}" cy="${y(score)}" r="5" fill="${color}">
           <title>${curve.values[i]} · ${percentage(score)}</title></circle>`
      ).join('');
      const dash = dashed ? 'stroke-dasharray="7 5"' : '';
      return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="3" ${dash}/>${dots}`;
    }
    const rows = curve.values.map((label, i) =>
      `<tr><th scope="row">${label}</th><td>${percentage(curve.train[i])}</td>
         <td>${percentage(curve.validation[i])}</td></tr>`
    ).join('');
    return `<p><strong>${curve.label}</strong> · ${curve.explanation}</p>
      <p class="small"><strong style="color:#754723">Train (dashed)</strong> ·
        <strong style="color:#14675d">Validation (solid)</strong> · Mean balanced accuracy</p>
      <div class="bag-tuning-frame">
        <svg class="bag-tuning-plot" width="100%" viewBox="0 0 640 276" role="img"
             aria-label="${curve.label} versus mean training and validation balanced accuracy"
             style="font:15px system-ui;fill:#273a42">
          ${grid}${settingTicks}${series(curve.train, '#754723', true)}${series(curve.validation, '#14675d')}
        </svg>
      </div>
      <details class="teaching-note">
        <summary>Read the exact scores</summary>
        <div class="table-wrap"><table><thead><tr><th>Setting</th><th>Train</th><th>Validation</th></tr></thead>
          <tbody>${rows}</tbody></table></div>
      </details>`;
  }

  function searchMarkup(randomized) {
    const depths = [...new Set(choices.map(choice => choice.depth))];
    const features = [...new Set(choices.map(choice => choice.features))];
    const tried = choices.filter(choice => !randomized || choice.sampled);
    const best = tried.reduce((a, b) => b.score > a.score ? b : a);
    const rows = depths.map(depth => {
      const entries = features.map(feature => {
        const choice = choices.find(choice => choice.depth === depth && choice.features === feature);
        if (!tried.includes(choice)) return '<td><span class="small">Skipped</span></td>';
        const score = percentage(choice.score);
        return choice === best ? `<td><strong>${score} · Best</strong></td>` : `<td>${score}</td>`;
      }).join('');
      return `<tr><th scope="row">Depth ${depth}</th>${entries}</tr>`;
    }).join('');
    const header = features.map(feature => `<th scope="col">Features ${feature}</th>`).join('');
    return `<p role="status"><strong>${tried.length} tried × ${folds} folds = ${tried.length * folds} fits</strong>
      · Best mean validation balanced accuracy ${percentage(best.score)}.</p>
      <div class="table-wrap">
        <table><thead><tr><th scope="col">Tree depth</th>${header}</tr></thead><tbody>${rows}</tbody></table>
      </div>`;
  }

  function showNotebookResults() {
    const { trainCount, testCount, trainSpamCount, testSpamCount, cvScore, nIter, results, oobAccuracy, oobCoverage, matrix, version, bestParams } = summary;
    const tuned = results.at(-1);
    const baselineForest = results.at(-2);
    get('fit-split').innerHTML = `<strong>${count(trainCount)} training emails</strong> for fitting and validation (${percentage(trainSpamCount / trainCount)} Spam). <strong>${count(testCount)} held-out emails</strong> for the final comparison (${percentage(testSpamCount / testCount)} Spam).`;
    get('tuning-provenance').textContent = `Results from the notebook’s seeded scikit-learn ${version} run. Validation rotates over ${folds} folds within the training split. The test emails stay set aside until the final check.`;
    get('search-iterations').textContent = nIter;
    get('search-budget').textContent = `The notebook samples ${nIter} configurations from a larger space. Each is fitted on ${folds} folds, for ${nIter * folds} search fits before the winner is refit on all ${count(trainCount)} training emails.`;
    get('search-scores').innerHTML = `<p><strong>Validation.</strong> The winning configuration has ${percentage(cvScore)} mean balanced accuracy across its ${folds} validation folds.</p>
      <p><strong>Final test.</strong> The refitted forest has ${percentage(tuned.balancedAccuracy)} balanced accuracy on the ${count(testCount)} reserved emails.</p>
      <p class="small"><strong>Winning settings.</strong> ${Object.entries(bestParams).map(([key, value]) => {
        const display = typeof value === 'string' ? `'${value}'` : value ?? 'None';
        return `<code>${key}=${display}</code>`;
      }).join(' · ')}</p>`;
    get('benchmark').innerHTML = `<div class="table-wrap"><table>
        <caption class="sr-only">Models compared on the same held-out Spambase emails</caption>
        <thead><tr><th scope="col">Model</th><th scope="col">Test accuracy</th><th scope="col">Test balanced accuracy</th></tr></thead>
        <tbody>${results.map(({ label, accuracy, balancedAccuracy }) => `<tr><th scope="row">${label}</th><td>${percentage(accuracy)}</td><td>${percentage(balancedAccuracy)}</td></tr>`).join('')}</tbody>
      </table></div>
      <p>The baseline and tuned forests scored ${percentage(baselineForest.balancedAccuracy)} and ${percentage(tuned.balancedAccuracy)} on these held-out emails. The search picked the winner using validation folds, so the final test can still favor the baseline.</p>
      <p>The tuned forest’s OOB accuracy was ${percentage(oobAccuracy)} among ${count(oobCoverage)} training emails with OOB predictions. That score is ordinary accuracy and uses training rows. The table above uses the held-out test rows.</p>`;

    const [[tn, fp], [fn, tp]] = matrix;
    const support = fn + tp;
    const predictedSpam = fp + tp;
    const precision = predictedSpam ? percentage(tp / predictedSpam) : 'undefined';
    const recall = support ? percentage(tp / support) : 'undefined';
    const denominator = 2 * tp + fp + fn;
    const f1 = denominator ? percentage(2 * tp / denominator) : 'undefined';
    get('test-report').innerHTML = `<div class="table-wrap"><table>
        <caption class="sr-only">Confusion matrix for the tuned forest on ${count(testCount)} held-out emails</caption>
        <thead><tr><th scope="col">Recorded class</th><th scope="col">Predicted Legitimate</th><th scope="col">Predicted Spam</th><th scope="col">Total</th></tr></thead>
        <tbody><tr><th scope="row">Legitimate</th><td>${tn}</td><td>${fp}</td><td>${tn + fp}</td></tr>
        <tr><th scope="row">Spam</th><td>${fn}</td><td>${tp}</td><td>${support}</td></tr></tbody>
        <tfoot><tr><th scope="row">Total</th><td>${tn + fn}</td><td>${predictedSpam}</td><td>${count(testCount)}</td></tr></tfoot>
      </table></div>
      <p>Spam <strong>precision</strong> uses the prediction column, ${tp} ÷ ${predictedSpam} ≈ ${precision}. Spam <strong>recall</strong> uses the recorded row, ${tp} ÷ ${support} ≈ ${recall}. <strong>F1</strong> combines them as 2 × ${tp} ÷ (2 × ${tp} + ${fp} + ${fn}) ≈ ${f1}. <strong>Support</strong> is the ${support} recorded Spam emails.</p>`;
  }

  explore(get('tuning-explorer'), curves.map(curve => curve.label), index => curveMarkup(curves[index]));
  explore(get('search-explorer'), ['Grid search', 'Randomized search'], index => searchMarkup(index === 1));
  showNotebookResults();
})();
