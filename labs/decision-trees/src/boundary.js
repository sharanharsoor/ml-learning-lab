(() => {
  'use strict';

  const { create, getNode, leaves, availableCuts, applyCut, demo, logistic } = TreeLabBoundaryModel;
  const { render: drawPlot, pointAt } = TreeLabBoundaryPlot;
  const get = name => document.getElementById('boundary-' + name);
  const form = get('settings');
  const plot = get('plot');
  const diagram = get('tree');
  const region = get('region');
  const direction = get('feature');
  const cutoff = get('threshold');
  const applyButton = get('apply');
  const undo = get('undo');
  const reset = get('reset');
  const example = get('demo');
  const logisticToggle = get('logistic');
  const logisticNote = get('logistic-note');
  const maxCuts = 2;
  const history = [];
  let tree = create();
  let selectedPath = tree.path;
  let draft = null;
  let pointer = null;

  function regionName(path) {
    if (path === 'root') return 'All parcels';
    return Array.from(path.slice(4), branch => branch === 'l' ? 'Yes' : 'No').join(', then ');
  }

  function regionOptions(node) {
    const name = regionName(node.path);
    const option = '<option value="' + node.path + '">' + name + ' · ' + node.stats.n + ' parcels</option>';
    return node.split ? option + regionOptions(node.left) + regionOptions(node.right) : option;
  }

  function paintPlot() {
    const showLogistic = logisticToggle.checked;
    plot.innerHTML = drawPlot(tree, selectedPath, draft, showLogistic ? logistic : null);
    logisticNote.hidden = !showLogistic;
  }

  function render() {
    const node = getNode(tree, selectedPath);
    const canCut = history.length < maxCuts && !node.split;
    const cuts = canCut ? availableCuts(node, direction.value) : [];
    region.innerHTML = regionOptions(tree);
    region.value = selectedPath;
    direction.disabled = !canCut;
    cutoff.innerHTML = '<option value="">Choose cutoff</option>' + cuts.map(value =>
      '<option value="' + value + '">' + value + '</option>').join('');
    cutoff.value = draft?.threshold ?? '';
    cutoff.disabled = cuts.length === 0;
    applyButton.disabled = !draft;
    undo.disabled = history.length === 0;
    reset.disabled = history.length === 0 && !draft && direction.value === 'x';
    diagram.innerHTML = TreeLabDiagram.render(tree, { selectedPath, showScore: false });
    paintPlot();

    const { n, auto, review } = node.stats;
    get('selection').textContent = regionName(node.path) + ' · ' + n + ' parcels (' + auto + ' Auto, ' + review + ' Review)';
    const matches = leaves(tree).reduce((sum, leaf) => sum + Math.max(leaf.stats.auto, leaf.stats.review), 0);
    let next = 'Draw or choose a cutoff for this region.';
    if (history.length === maxCuts) next = 'Click a node to see its region, or undo a cut.';
    else if (node.split) next = 'Select one child region for the next cut.';
    else if (cuts.length === 0) next = 'Try the other direction or choose another region.';
    get('feedback').textContent = matches + ' of ' + tree.stats.n + ' training labels match the predictions. ' + next;
  }

  function selectRegion(path) {
    if (path === selectedPath) return;
    selectedPath = path;
    draft = null;
    render();
  }

  function setDraft(threshold) {
    draft = threshold === '' ? null : { feature: direction.value, threshold: Number(threshold) };
    cutoff.value = threshold;
    applyButton.disabled = !draft;
    reset.disabled = history.length === 0 && !draft && direction.value === 'x';
    paintPlot();
  }

  function placeCut(point) {
    if (cutoff.disabled) return;
    const axis = direction.value;
    const cuts = availableCuts(getNode(tree, selectedPath), axis);
    const nearest = cuts.reduce((best, value) =>
      Math.abs(point[axis] - value) < Math.abs(point[axis] - best) ? value : best);
    if (draft?.threshold !== nearest) setDraft(nearest);
  }

  function commit(path, feature, threshold) {
    const next = applyCut(tree, path, feature, threshold);
    if (!next) return;
    history.push({ tree, path });
    tree = next;
    selectedPath = path;
    draft = null;
  }

  function clear() {
    history.length = 0;
    tree = create();
    selectedPath = tree.path;
    draft = null;
    direction.value = 'x';
  }

  region.addEventListener('change', () => selectRegion(region.value));
  direction.addEventListener('change', () => {
    draft = null;
    render();
  });
  cutoff.addEventListener('change', () => setDraft(cutoff.value));
  logisticNote.textContent = 'The blue line marks a 50% predicted probability of Review. ' +
    'The model predicts Review toward the upper right and matches ' + logistic.matches + ' of ' +
    tree.stats.n + ' training labels.';
  logisticToggle.addEventListener('change', paintPlot);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!draft || history.length >= maxCuts) return;
    commit(selectedPath, draft.feature, draft.threshold);
    render();
    region.focus({ preventScroll: true });
  });

  diagram.addEventListener('click', event => {
    const button = event.target.closest('[data-node]');
    if (!button) return;
    selectRegion(button.dataset.node);
    diagram.querySelector('[aria-pressed="true"]').focus({ preventScroll: true });
  });

  function plotPoint(event) {
    return pointAt(plot.querySelector('[data-boundary-chart]'), event);
  }

  plot.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointer) return;
    const point = plotPoint(event);
    if (!point) return;
    const paths = TreeLab.trace(tree, point).paths;
    const path = paths.at(-1);
    const isNewRegion = path !== selectedPath;
    selectRegion(path);
    if (cutoff.disabled) return;

    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, isNewRegion };
    plot.setPointerCapture(event.pointerId);
    if (!isNewRegion) placeCut(point);
  });
  plot.addEventListener('pointermove', event => {
    if (event.pointerId !== pointer?.id) return;
    const distance = Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y);
    if (distance > 5) pointer.isNewRegion = false;
    const point = plotPoint(event);
    if (point && !pointer.isNewRegion) placeCut(point);
  });
  plot.addEventListener('lostpointercapture', () => { pointer = null; });

  undo.addEventListener('click', () => {
    const previous = history.pop();
    tree = previous.tree;
    selectedPath = previous.path;
    draft = null;
    render();
    if (undo.disabled) region.focus({ preventScroll: true });
  });
  reset.addEventListener('click', () => {
    clear();
    render();
    direction.focus({ preventScroll: true });
  });
  example.addEventListener('click', () => {
    clear();
    commit('root', demo.first.feature, demo.first.threshold);
    commit(demo.second.path, demo.second.feature, demo.second.threshold);
    render();
  });

  render();
})();
