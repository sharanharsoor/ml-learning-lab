(() => {
  'use strict';

  const { curves, choices, folds } = JSON.parse(document.getElementById('bag-tuning-data').textContent);
  const percentage = value => (value * 100).toFixed(2) + '%';

  function explore(root, labels, render) {
    const controls = document.createElement('div');
    controls.className = 'bag-actions';
    const output = document.createElement('div');
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
    const y = score => 239 - 420 * (score - 0.5);
    const grid = [0.5, 0.6, 0.7, 0.8, 0.9, 1].map(score =>
      `<line x1="61" x2="610" y1="${y(score)}" y2="${y(score)}" stroke="#dce8e3"/>
       <text x="52" y="${y(score) + 5}" text-anchor="end">${Math.round(score * 100)}%</text>`
    ).join('');
    const ticks = curve.values.map((label, i) =>
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
          ${grid}${ticks}${series(curve.train, '#754723', true)}${series(curve.validation, '#14675d')}
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

  explore(document.getElementById('bag-tuning-explorer'), curves.map(curve => curve.label),
    index => curveMarkup(curves[index]));
  explore(document.getElementById('bag-search-explorer'), ['Grid search', 'Randomized search'],
    index => searchMarkup(index === 1));
})();
