(() => {
  const byId = (id) => document.getElementById(id);
  const percent = (value, places = 0) => (100 * value).toFixed(places) + '%';
  const average = (values) => values.reduce((total, value) => total + value, 0) / values.length;

  function initializeSpread() {
    const batches = [[.10, .42], [.90, .56], [.25, .49], [.80, .55], [.45, .48]];
    const letters = 'ABCDE';
    const reveal = byId('bagl-next-batch');
    let visible = 1;

    function render() {
      const rows = batches.map(([single, bagged], index) => {
        const shown = visible > index;
        const points = shown ? `
          <i class="bagl-point bagl-symbol bagl-symbol-single" style="--position:${percent(single)}"></i>
          <i class="bagl-point bagl-symbol bagl-symbol-bagged" style="--position:${percent(bagged)}"></i>` : '';
        return `<tr>
          <th scope="row">Batch ${letters[index]}</th>
          <td>${shown ? single.toFixed(2) : 'Pending'}</td>
          <td>${shown ? bagged.toFixed(2) : 'Pending'}</td>
          <td><div class="bagl-plot-track" aria-hidden="true">${points}</div></td>
        </tr>`;
      }).join('');
      byId('bagl-batches').innerHTML = `
        <table>
          <caption class="sr-only">Predicted Review probabilities for the same parcel by training batch</caption>
          <thead><tr><th scope="col">Training batch</th><th scope="col">Single tree</th><th scope="col">Bagged trees</th><th scope="col">
            <div class="bagl-plot-scale" aria-label="Probability from 0 to 1"><span>0</span><span>0.5</span><span>1</span></div>
          </th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;

      reveal.textContent = visible === batches.length ? 'Replay batches' : 'Reveal next batch';
      if (visible === 1) {
        byId('bagl-batch-summary').textContent = 'One batch is visible. Reveal another to compare how each prediction moves.';
        return;
      }
      const shownBatches = batches.slice(0, visible);
      const describe = (column) => {
        const scores = shownBatches.map((batch) => batch[column]);
        const mean = average(scores);
        const spread = Math.sqrt(average(scores.map((score) => (score - mean) ** 2)));
        return { mean: mean.toFixed(2), spread: spread.toFixed(3) };
      };
      const single = describe(0);
      const bagged = describe(1);
      byId('bagl-batch-summary').innerHTML = `<strong>${visible} of ${batches.length} batches</strong>
        <span>Single tree mean ${single.mean}, spread ${single.spread}</span>
        <span>Bagged trees mean ${bagged.mean}, spread ${bagged.spread}</span>
        <small>Spread is the standard deviation across the visible batches.</small>`;
    }

    reveal.addEventListener('click', () => {
      visible = visible === batches.length ? 1 : visible + 1;
      render();
    });
    render();
  }

  function initializeVariance() {
    const trees = byId('bagl-trees');
    const correlation = byId('bagl-corr');

    function render() {
      const count = Number(trees.value);
      const rho = Number(correlation.value);
      const reducible = (1 - rho) / count;
      const ratio = rho + reducible;
      byId('bagl-trees-value').textContent = count;
      byId('bagl-corr-value').textContent = rho.toFixed(2);
      byId('bagl-shared-fill').style.width = percent(rho, 2);
      byId('bagl-reducible-fill').style.width = percent(reducible, 2);
      byId('bagl-variance-summary').innerHTML = `<strong>${percent(ratio, 1)} of one tree's variance</strong>
        <span class="formula">${rho.toFixed(2)} + (1 − ${rho.toFixed(2)}) / ${count} = ${ratio.toFixed(3)}</span>`;
    }

    trees.addEventListener('input', render);
    correlation.addEventListener('input', render);
    render();
  }

  const parcels = [
    { id: 'O1', weight: 2, review: 0 },
    { id: 'O2', weight: 4, review: 0 },
    { id: 'O3', weight: 3, review: 1 },
    { id: 'O4', weight: 5, review: 1 },
    { id: 'O5', weight: 6, review: 1 },
  ];
  const bagIds = [
    ['O2', 'O2', 'O3', 'O5', 'O5'],
    ['O2', 'O2', 'O4', 'O4', 'O5'],
    ['O1', 'O2', 'O3', 'O3', 'O5'],
  ];
  const labelName = (review) => review ? 'Review' : 'Auto';
  const countDraws = (draws, id) => draws.filter((draw) => draw.id === id).length;

  function leafCounts(rows) {
    return { review: rows.reduce((total, row) => total + row.review, 0), count: rows.length };
  }

  function fitStump(ids) {
    const draws = ids.map((id) => parcels.find((row) => row.id === id));
    const weights = [...new Set(draws.map((row) => row.weight))].sort((a, b) => a - b);
    const candidates = weights.slice(1).map((weight, index) => {
      const cut = (weights[index] + weight) / 2;
      const left = leafCounts(draws.filter((row) => row.weight <= cut));
      const right = leafCounts(draws.filter((row) => row.weight > cut));
      const weighted = [left, right].reduce((sum, leaf) => {
        const p = leaf.review / leaf.count;
        return sum + leaf.count / draws.length * 2 * p * (1 - p);
      }, 0);
      return { cut, left, right, weighted };
    });
    const best = candidates.sort((a, b) => a.weighted - b.weighted)[0];
    return { draws, ...best };
  }

  function initializeOob() {
    const trees = bagIds.map(fitStump);
    const grid = byId('bagl-oob-grid');
    const selected = byId('bagl-oob-selected');
    const scores = parcels.map((row) => {
      const leaves = trees.flatMap((tree, index) => {
        if (countDraws(tree.draws, row.id)) return [];
        return [{ tree: index + 1, leaf: row.weight <= tree.cut ? tree.left : tree.right }];
      });
      const probability = leaves.length
        ? average(leaves.map(({ leaf }) => leaf.review / leaf.count))
        : null;
      const prediction = probability === null ? null : Number(probability > .5);
      return { row, leaves, probability, prediction };
    });
    grid.innerHTML = parcels.map((row, index) => `
      <tr data-bagl-oob-row="${index}">
        <th scope="row"><button type="button" class="button secondary bagl-row-button" data-bagl-pick="${index}" aria-pressed="false">${row.id}</button></th>
        <td>${row.weight}</td><td>${labelName(row.review)}</td>
        ${trees.map(({ draws }) => {
          const count = countDraws(draws, row.id);
          return `<td>${count ? `<span class="bagl-drawn">${count}×</span>` : '<span class="bagl-eligible">0 · OOB</span>'}</td>`;
        }).join('')}
      </tr>`).join('');

    byId('bagl-oob-samples').innerHTML = `<div class="bagl-leaf-summaries">${trees.map((tree, index) => `
      <div>
        <h3>Tree ${index + 1}</h3>
        <p>${tree.draws.map((row) => row.id).join(', ')}</p>
        <p class="formula">Weight ≤ ${tree.cut}</p>
        <p class="small">Yes leaf ${tree.left.review}/${tree.left.count} Review<br>No leaf ${tree.right.review}/${tree.right.count} Review</p>
      </div>`).join('')}</div>`;

    const covered = scores.filter((entry) => entry.prediction !== null);
    const matches = covered.filter(({ row, prediction }) => row.review === prediction).length;
    byId('bagl-oob-score').innerHTML = `
      <div class="table-wrap"><table>
        <caption class="sr-only">Out-of-bag predictions across the five training parcels</caption>
        <thead><tr><th scope="col">Parcel</th><th scope="col">OOB trees</th><th scope="col">Review probability</th><th scope="col">Prediction</th><th scope="col">True label</th></tr></thead>
        <tbody>${scores.map(({ row, leaves, probability, prediction }) => `
          <tr><th scope="row">${row.id}</th><td>${leaves.length}</td>
          <td>${probability === null ? 'Unavailable' : percent(probability, 1)}</td>
          <td>${prediction === null ? 'Unavailable' : labelName(prediction)}</td><td>${labelName(row.review)}</td></tr>
        `).join('')}</tbody>
      </table></div>
      <p class="bagl-result"><strong>Coverage ${covered.length} / ${scores.length}</strong>
        <span>OOB accuracy among covered rows <strong>${matches} / ${covered.length} ≈ ${percent(matches / covered.length, 1)}</strong></span></p>
      <p class="small">O1 and O4 match. O3 gives one error. O2 and O5 have zero eligible trees.</p>`;

    function renderSelection(index) {
      grid.querySelectorAll('[data-bagl-pick]').forEach((button, buttonIndex) => {
        const active = buttonIndex === index;
        button.setAttribute('aria-pressed', String(active));
        button.closest('tr').classList.toggle('is-selected', active);
      });
      const { row, leaves, probability, prediction } = scores[index];
      if (!leaves.length) {
        selected.innerHTML = `<h3>${row.id} has no eligible trees</h3>
          <p>All three samples contain this parcel. Its OOB prediction is unavailable.</p>`;
        return;
      }
      const fraction = ({ leaf }) => leaf.review + '/' + leaf.count;
      const sum = leaves.map(fraction).join(' + ');
      selected.innerHTML = `<h3>${row.id} can use ${leaves.length} of 3 trees</h3>
        <div class="bagl-votes">${leaves.map((entry) => `
          <span><strong>Tree ${entry.tree}</strong> <span class="formula">${fraction(entry)}</span> Review in its leaf</span>
        `).join('')}</div>
        <p class="formula">Average Review probability = (${sum}) / ${leaves.length} ≈ ${percent(probability, 1)}</p>
        <p>OOB prediction <strong>${labelName(prediction)}</strong>. True label <strong>${labelName(row.review)}</strong>.</p>`;
    }

    grid.addEventListener('click', (event) => {
      const button = event.target.closest('[data-bagl-pick]');
      if (button) renderSelection(Number(button.dataset.baglPick));
    });
    renderSelection(0);
  }

  initializeSpread();
  initializeVariance();
  initializeOob();
})();
