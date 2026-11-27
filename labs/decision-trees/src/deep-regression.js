(() => {
  'use strict';

  const { REGRESSION_TRAIN, BIKE_TRACE } = TreeLabData;
  const { evaluate, fit, trace } = TreeLab;
  const number = value => Number(value.toFixed(4)).toString();
  const question = split => split.feature.toUpperCase() +
    (split.feature === 'y' ? ' = ' : ' ≤ ') + split.threshold + '?';
  const names = { x: 'Clock hour', y: 'Day type', z: 'Humidity bucket' };
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
    const observed = get('deep-regression-observed');
    const inputStatus = get('deep-regression-input-status');

    let parcel = readParcel();
    let selectedPath = trace(trees.get(5), BIKE_TRACE).paths.at(-2);

    function readParcel() {
      const data = new FormData(form);
      return { x: Number(data.get('x')), y: data.get('y'), z: Number(data.get('z')) };
    }

    function renderSplit({ result, depth }) {
      const { parent, leftStats, rightStats, weighted, gain } = result;
      function child(label, rows, group) {
        const times = rows.map(row => row.target);
        const mean = number(group.mean);
        const squaredErrors = times.map(time => '(' + time + ' − ' + mean + ')²');
        return '<div class="child ' + label.toLowerCase() + '"><h4>' + label + ' child</h4>' +
          '<p><strong>Mean ' + mean + ' rentals</strong> · ' + group.n + ' hours</p>' +
          '<p class="small"><strong>Observed counts</strong> ' + times.join(', ') + ' rentals</p>' +
          '<p class="arithmetic">(' + times.join(' + ') + ') / ' + group.n + ' ≈ ' + mean +
          ' rentals</p><details class="teaching-note"><summary>MSE ' + number(group.score) + ' rentals²</summary>' +
          '<p class="arithmetic">[' + squaredErrors.join(' + ') + '] / ' + group.n + ' ≈ ' +
          number(group.score) + ' rentals²</p></details></div>';
      }
      const term = group => '(' + group.n + '/' + parent.n + ') × ' + number(group.score);
      inspector.innerHTML = '<h3>Depth ' + depth + ' · ' + question(result.split) + '</h3>' +
        '<p class="small">Parent: ' + parent.n + ' hours, mean ' + number(parent.mean) +
        ' rentals, MSE ' + number(parent.score) + ' rentals².</p>' +
        '<div class="regression-child-summary">' + child('Yes', result.left, leftStats) + child('No', result.right, rightStats) + '</div>' +
        '<figure id="deep-regression-weighted" class="weighted-visual"></figure>' +
        '<div class="calc-lines"><p><strong>Clock houred child MSE</strong> <span class="arithmetic">' +
        term(leftStats) + ' + ' + term(rightStats) + ' ≈ ' + number(weighted) +
        ' rentals²</span></p><p><strong>MSE reduction</strong> <span class="arithmetic">' +
        number(parent.score) + ' − ' + number(weighted) + ' ≈ ' + number(gain) + ' rentals²</span></p>' +
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
      const times = rows.map(row => row.target);
      graph.innerHTML = TreeLabDeepDiagram.render(tree, selectedPath, { criterion: 'mse', tracedPaths: traced.paths });
      prediction.innerHTML = '<p><strong>Prediction ' + number(traced.leaf.prediction) +
        ' rentals</strong> · Leaf at depth ' + depth + '</p><p class="small">For X = ' + parcel.x + ', Y = ' +
        parcel.y + ', Z = ' + parcel.z + '. The leaf averages ' + times.length + ' training counts.</p>' +
        '<p class="arithmetic">(' + times.join(' + ') + ') / ' + times.length + ' = ' +
        number(traced.leaf.mean) + ' rentals</p>';
      const knownHour = ['x', 'y', 'z'].every(feature => parcel[feature] === BIKE_TRACE[feature]);
      observed.textContent = knownHour
        ? 'Observed later: ' + BIKE_TRACE.target + ' rentals. Actual − predicted = ' + BIKE_TRACE.target +
          ' − ' + number(traced.leaf.prediction) + ' ≈ ' + number(BIKE_TRACE.target - traced.leaf.prediction) + ' rentals.'
        : 'This input combination is a what-if. It has no measured count in the demonstration.';
      routeList.innerHTML = traced.steps.map(({ split, yes }) => '<li><span>' + question(split) +
        ' ' + names[split.feature] + ' is ' + parcel[split.feature] + '.</span> <strong>' +
        (yes ? 'Yes' : 'No') + '</strong></li>').join('');
      renderSplit(nodes.get(selectedPath));
    }

    get('deep-regression-training').innerHTML = REGRESSION_TRAIN.map(row =>
      '<tr><th scope="row">' + row.sourceRow + '</th><td>' + row.date + '</td><td>' + row.x + ':00</td><td>' +
      row.y + '</td><td>' + row.humidity + '% (Z=' + row.z + ')</td><td>' + row.target + '</td></tr>').join('');
    depthInput.addEventListener('change', render);
    form.addEventListener('input', () => {
      const draft = readParcel();
      inputStatus.textContent = Object.keys(parcel).some(feature => draft[feature] !== parcel[feature])
        ? 'Inputs edited. Use Trace hour to apply them to the path and prediction.' : '';
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
