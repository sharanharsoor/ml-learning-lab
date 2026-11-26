(() => {
  'use strict';

  const { REGRESSION_TRAIN, evaluate, fit, trace } = TreeLab;
  const number = value => Number(value.toFixed(4)).toString();
  const question = split => split.feature.toUpperCase() +
    (split.feature === 'y' ? ' = ' : ' ≤ ') + split.threshold + '?';
  const names = { x: 'Weight', y: 'Packaging', z: 'Scan score' };
  const trees = new Map([4, 5].map(depth => [depth, fit(REGRESSION_TRAIN, 'mse', depth)]));

  function indexTree(tree, rows, nodes, path = 'root', depth = 0) {
    const result = tree.split ? evaluate(rows, tree.split, 'mse') : null;
    nodes.set(path, { rows, depth, result });
    if (result) {
      indexTree(tree.left, result.left, nodes, path + 'l', depth + 1);
      indexTree(tree.right, result.right, nodes, path + 'r', depth + 1);
    }
  }

  function init(renderWeightedVisual) {
    const get = id => document.getElementById(id);
    const depthInput = get('deep-regression-depth');
    const form = get('deep-regression-form');
    const graph = get('deep-regression-diagram');
    const inspector = get('deep-regression-inspector');
    const prediction = get('deep-regression-prediction');
    const routeList = get('deep-regression-route');
    const inputStatus = get('deep-regression-input-status');

    let parcel = readParcel();
    let selectedPath = 'rootlrrl';

    function readParcel() {
      const data = new FormData(form);
      return { x: Number(data.get('x')), y: data.get('y'), z: Number(data.get('z')) };
    }

    function renderSplit({ result, depth }) {
      const { parent, leftStats, rightStats, weighted, gain } = result;
      function child(label, rows, group) {
        const times = rows.map(row => row.minutes);
        const mean = number(group.mean);
        const squaredErrors = times.map(time => '(' + time + ' − ' + mean + ')²');
        return '<div class="child ' + label.toLowerCase() + '"><h4>' + label + ' child</h4>' +
          '<p><strong>Mean ' + mean + ' min</strong> · ' + group.n + ' parcels</p>' +
          '<p class="small"><strong>Observed times</strong> ' + times.join(', ') + ' min</p>' +
          '<p class="arithmetic">(' + times.join(' + ') + ') / ' + group.n + ' ≈ ' + mean +
          ' min</p><details class="teaching-note"><summary>MSE ' + number(group.score) + ' min²</summary>' +
          '<p class="arithmetic">[' + squaredErrors.join(' + ') + '] / ' + group.n + ' ≈ ' +
          number(group.score) + ' min²</p></details></div>';
      }
      const term = group => '(' + group.n + '/' + parent.n + ') × ' + number(group.score);
      inspector.innerHTML = '<h3>Depth ' + depth + ' · ' + question(result.split) + '</h3>' +
        '<p class="small">Parent: ' + parent.n + ' parcels, mean ' + number(parent.mean) +
        ' min, MSE ' + number(parent.score) + ' min².</p>' +
        '<div class="regression-child-summary">' + child('Yes', result.left, leftStats) + child('No', result.right, rightStats) + '</div>' +
        '<figure id="deep-regression-weighted" class="weighted-visual"></figure>' +
        '<div class="calc-lines"><p><strong>Weighted child MSE</strong> <span class="arithmetic">' +
        term(leftStats) + ' + ' + term(rightStats) + ' ≈ ' + number(weighted) +
        ' min²</span></p><p><strong>MSE reduction</strong> <span class="arithmetic">' +
        number(parent.score) + ' − ' + number(weighted) + ' ≈ ' + number(gain) + ' min²</span></p>' +
        '<p class="small">The weights use the ' + parent.n + ' rows at this parent. Scores are calculated before rounding.</p></div>';
      renderWeightedVisual(result, 'mse', 'deep-regression-weighted', 4);
    }

    function render() {
      const tree = trees.get(Number(depthInput.value));
      const nodes = new Map();
      indexTree(tree, REGRESSION_TRAIN, nodes);
      while (!nodes.get(selectedPath)?.result) selectedPath = selectedPath.slice(0, -1);
      const traced = trace(tree, parcel);
      const leafPath = traced.paths[traced.paths.length - 1];
      const { rows, depth } = nodes.get(leafPath);
      const times = rows.map(row => row.minutes);
      graph.innerHTML = TreeLabDeepDiagram.render(tree, selectedPath, { criterion: 'mse', tracedPaths: traced.paths });
      prediction.innerHTML = '<p><strong>Prediction ' + number(traced.leaf.prediction) +
        ' min</strong> · Leaf at depth ' + depth + '</p><p class="small">For X = ' + parcel.x + ', Y = ' +
        parcel.y + ', Z = ' + parcel.z + '. The leaf averages ' + times.length + ' training times.</p>' +
        '<p class="arithmetic">(' + times.join(' + ') + ') / ' + times.length + ' = ' +
        number(traced.leaf.mean) + ' min</p>';
      routeList.innerHTML = traced.steps.map(({ split, yes }) => '<li><span>' + question(split) +
        ' ' + names[split.feature] + ' is ' + parcel[split.feature] + '.</span> <strong>' +
        (yes ? 'Yes' : 'No') + '</strong></li>').join('');
      renderSplit(nodes.get(selectedPath));
    }

    get('deep-regression-training').innerHTML = REGRESSION_TRAIN.map(row =>
      '<tr><th scope="row">' + row.x + '</th><td>' + row.y + '</td><td>' + row.z + '</td><td>' +
      row.minutes + '</td></tr>').join('');
    depthInput.addEventListener('change', render);
    form.addEventListener('input', () => {
      const draft = readParcel();
      inputStatus.textContent = Object.keys(parcel).some(feature => draft[feature] !== parcel[feature])
        ? 'Inputs edited. Use Trace parcel to apply them to the path and prediction.' : '';
    });
    form.addEventListener('submit', event => {
      event.preventDefault();
      parcel = readParcel();
      inputStatus.textContent = '';
      render();
    });
    graph.addEventListener('click', event => {
      const button = event.target.closest('[data-deep-node]');
      if (!button) return;
      selectedPath = button.dataset.deepNode;
      render();
      graph.querySelector('[data-deep-node="' + selectedPath + '"]').focus({ preventScroll: true });
    });
    render();
  }

  globalThis.TreeLabDeepRegression = { init };
})();
