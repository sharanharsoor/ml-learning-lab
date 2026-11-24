(() => {
  'use strict';

  const { DEEP_TRAIN, evaluate, fit } = TreeLab;
  const get = id => document.getElementById(id);
  const number = value => Number(value.toFixed(4)).toString();
  const question = split => 'X ≤ ' + split.threshold + '?';
  const counts = group => group.auto + ' Auto · ' + group.review + ' Review';

  function init(renderWeightedVisual) {
    const limit = get('deep-max-depth');
    const graph = get('deep-diagram');
    const math = get('deep-math');
    const presets = [...document.querySelectorAll('[data-deep-preset]')];
    let results;
    let tree;
    let path = 'rootllr';

    function index(current, rows, key, depth) {
      if (!current.split) return;
      const split = evaluate(rows, current.split, 'entropy');
      results.set(key, { split, depth });
      index(current.left, split.left, key + 'l', depth + 1);
      index(current.right, split.right, key + 'r', depth + 1);
    }

    function render() {
      const { split, depth } = results.get(path);
      const { parent, leftStats, rightStats } = split;
      const sides = [['Yes child', leftStats], ['No child', rightStats]];
      graph.innerHTML = TreeLabDeepDiagram.render(tree, path);

      presets.forEach(button => {
        const preset = button.dataset.deepPreset;
        const presetDepth = preset === 'root' ? 0 : Number(preset);
        button.disabled = ![...results.values()].some(result => result.depth === presetDepth);
        button.setAttribute('aria-pressed', String(depth === presetDepth));
      });

      const rows = sides.map(([label, stats]) => '<tr><th scope="row">' + label + '</th><td>' + counts(stats) +
        '</td><td>' + number(stats.score) + '</td><td>' + stats.n + '/' + parent.n + '</td></tr>').join('');
      const context = depth === 0
        ? '<p>The selected parent is the root. All ' + parent.n + ' parcels reach it.</p>'
        : '<p>Earlier questions routed <strong>' + parent.n + ' of the ' + tree.stats.n +
          ' root parcels</strong> here. This split uses the ' + parent.n + ' that reached this node.</p>';

      math.innerHTML = '<h3>Depth ' + depth + ' · ' + question(split.split) + '</h3>' + context +
        '<p><strong>Current parent</strong> ' + counts(parent) + ' · Entropy ' + number(parent.score) + ' bits</p>' +
        '<div class="table-wrap"><table><caption class="sr-only">Children used in this split calculation</caption>' +
        '<thead><tr><th scope="col">Node</th><th scope="col">Labels</th><th scope="col">Entropy</th><th scope="col">Weight</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>' +
        '<figure id="deep-weighted-visual" class="weighted-visual"></figure>' +
        '<div class="calc-lines"><p><strong>Weighted child entropy</strong> <span class="arithmetic">(' +
        leftStats.n + '/' + parent.n + ') × ' + number(leftStats.score) + ' + (' +
        rightStats.n + '/' + parent.n + ') × ' + number(rightStats.score) + ' ≈ ' + number(split.weighted) +
        ' bits</span></p><p><strong>Information gain</strong> <span class="arithmetic">' + number(parent.score) +
        ' − ' + number(split.weighted) + ' ≈ ' + number(split.gain) + ' bits</span></p></div>' +
        '<p class="small">Only the parent and children highlighted on the diagram enter this calculation. The root is at depth 0.</p>';
      renderWeightedVisual(split, 'entropy', 'deep-weighted-visual', 4);
    }

    function fitTree() {
      tree = fit(DEEP_TRAIN, 'entropy', Number(limit.value));
      results = new Map();
      index(tree, DEEP_TRAIN, 'root', 0);
      while (!results.has(path)) path = path.slice(0, -1);
      render();
    }

    graph.addEventListener('click', event => {
      const button = event.target.closest('[data-deep-node]');
      if (!button) return;
      path = button.dataset.deepNode;
      render();
      graph.querySelector('[data-deep-node="' + path + '"]').focus({ preventScroll: true });
    });

    presets.forEach(button => button.addEventListener('click', () => {
      const presetDepth = button.dataset.deepPreset === 'root' ? 0 : Number(button.dataset.deepPreset);
      path = [...results].find(([, record]) => record.depth === presetDepth)[0];
      render();
    }));

    get('deep-training-rows').innerHTML = DEEP_TRAIN.map(row =>
      '<tr><th scope="row">' + row.x + '</th><td>' + (row.label ? 'Review' : 'Auto') + '</td></tr>').join('');
    limit.addEventListener('change', fitTree);
    fitTree();
  }

  globalThis.TreeLabDeepExample = { init };
})();
