(() => {
  'use strict';

  const branches = document.getElementById('multiway-branches');
  const criterion = document.getElementById('multiway-criterion');
  const structure = document.getElementById('multiway-structure');
  const math = document.getElementById('multiway-math');
  const labels = ['Auto', 'Review', 'Hold'];
  const packages = [
    { name: 'A', counts: [3, 1, 0] },
    { name: 'B', counts: [0, 3, 1] },
    { name: 'C', counts: [0, 0, 4] },
  ];

  function sum(values) {
    return values.reduce((total, value) => total + value, 0);
  }

  function combine(groups) {
    return labels.map((_, i) => sum(groups.map(group => group.counts[i])));
  }

  function score(counts, measure) {
    const total = sum(counts);
    const shares = counts.map(count => count / total);
    if (measure === 'gini') return 1 - sum(shares.map(p => p * p));
    return -sum(shares.filter(p => p > 0).map(p => p * Math.log2(p)));
  }

  function number(value) {
    return value.toFixed(3);
  }

  function draw() {
    const measure = criterion.value;
    const selected = structure.value;
    const parent = combine(packages);
    const total = sum(parent);
    const name = measure === 'entropy' ? 'Entropy' : 'Gini';
    const units = measure === 'entropy' ? ' bits' : '';
    const groups = selected === 'all' ? packages : [
      packages.find(group => group.name === selected),
      { name: 'Other packaging', counts: combine(packages.filter(group => group.name !== selected)) },
    ];
    const results = groups.map(group => ({
      ...group, n: sum(group.counts), score: score(group.counts, measure),
    }));

    branches.innerHTML = results.map(({ name: group, counts, n, score: impurity }) =>
      '<article class="multiway-branch"><h4>' + (group.length === 1 ? 'Packaging ' : '') + group + '</h4>' +
      '<p>' + n + ' of ' + total + ' rows</p>' +
      '<div class="multiway-band" aria-hidden="true">' +
      counts.map(count => '<span style="width:' + 100 * count / n + '%"></span>').join('') +
      '</div><p>' + counts.map((count, i) => count + ' ' + labels[i]).join(' · ') + '</p>' +
      '<p>' + name + ' = <strong>' + number(impurity) + units + '</strong></p></article>'
    ).join('');

    const before = score(parent, measure);
    const after = sum(results.map(result => result.n * result.score)) / total;
    const weightedTerms = results.map(result => '(' + result.n + '/' + total + ') × ' + number(result.score));
    math.innerHTML = '<p><strong>Parent ' + name.toLowerCase() + '</strong> ' + number(before) + units + '</p>' +
      '<p><strong>Weighted children</strong> ' + weightedTerms.join(' + ') + ' ≈ ' + number(after) + units + '</p>' +
      '<p><strong>' + (measure === 'entropy' ? 'Information gain' : 'Gini reduction') + '</strong> ' +
      number(before) + ' − ' + number(after) + ' ≈ ' + number(before - after) + units + '</p>';
  }

  criterion.addEventListener('change', draw);
  structure.addEventListener('change', draw);
  draw();
})();
