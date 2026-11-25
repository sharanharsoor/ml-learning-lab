(() => {
  'use strict';

  const viewWidth = 540;
  const viewHeight = 370;
  const box = { left: 64, right: 516, top: 16, bottom: 308 };
  const width = box.right - box.left;
  const height = box.bottom - box.top;

  const escape = value => String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
  const round = value => Number(value.toFixed(3));
  const route = label => label === 1 ? 'Review' : 'Auto';
  const className = label => route(label).toLowerCase();
  const ticks = (min, max) =>
    Array.from({ length: Math.floor(max) - Math.ceil(min) + 1 }, (_, index) => Math.ceil(min) + index);
  const pointX = (x, bounds) => box.left + width * (x - bounds.xMin) / (bounds.xMax - bounds.xMin);
  const pointY = (z, bounds) => box.bottom - height * (z - bounds.zMin) / (bounds.zMax - bounds.zMin);

  function plotRect(area, bounds) {
    const left = pointX(area.xMin, bounds);
    const right = pointX(area.xMax, bounds);
    const top = pointY(area.zMax, bounds);
    const bottom = pointY(area.zMin, bounds);
    return { left, top, width: right - left, height: bottom - top };
  }

  function rect({ left, top, width, height }, classes, attrs = '') {
    return '<rect class="' + classes + '" x="' + round(left) + '" y="' + round(top) +
      '" width="' + round(width) + '" height="' + round(height) + '"' + attrs + '></rect>';
  }

  function line(x1, y1, x2, y2, classes, attrs = '') {
    return '<line class="' + classes + '" x1="' + round(x1) + '" y1="' + round(y1) +
      '" x2="' + round(x2) + '" y2="' + round(y2) + '"' + attrs + '></line>';
  }

  function splitLine(node, split, bounds, classes, attrs) {
    const area = node.bounds;
    if (split.feature === 'x') {
      const x = pointX(split.threshold, bounds);
      return line(x, pointY(area.zMax, bounds), x, pointY(area.zMin, bounds), classes, attrs);
    }
    const y = pointY(split.threshold, bounds);
    return line(pointX(area.xMin, bounds), y, pointX(area.xMax, bounds), y, classes, attrs);
  }

  function splits(node, bounds, selectedPath) {
    if (!node.split) return '';
    const classes = 'boundary-chart__split' + (node.path === selectedPath ? ' boundary-chart__split--selected' : '');
    return splitLine(node, node.split, bounds, classes, ' data-boundary-split="' + escape(node.path) + '"') +
      splits(node.left, bounds, selectedPath) + splits(node.right, bounds, selectedPath);
  }

  function logisticBoundary({ intercept, weight, scan }, bounds) {
    const { xMin, xMax, zMin, zMax } = bounds;
    const corners = [[xMin, zMin], [xMax, zMin], [xMax, zMax], [xMin, zMax]];
    const scores = corners.map(([x, z]) => intercept + weight * x + scan * z);
    const intersections = [];

    // Find where the score reaches zero along the four edges of the plot.
    corners.forEach(([x, z], index) => {
      const next = (index + 1) % corners.length;
      const score = scores[index];
      const nextScore = scores[next];
      if (score === 0) intersections.push([x, z]);
      else if (score * nextScore < 0) {
        const [nextX, nextZ] = corners[next];
        const fraction = score / (score - nextScore);
        intersections.push([x + (nextX - x) * fraction, z + (nextZ - z) * fraction]);
      }
    });

    if (intersections.length !== 2) return '';
    const [[x1, z1], [x2, z2]] = intersections;
    return line(pointX(x1, bounds), pointY(z1, bounds), pointX(x2, bounds), pointY(z2, bounds),
      'boundary-chart__logistic', ' data-boundary-logistic');
  }

  function regionRects(leaves, bounds) {
    return leaves.map(node => rect(plotRect(node.bounds, bounds),
      'boundary-chart__region boundary-chart__region--' + className(node.stats.prediction),
      ' data-boundary-region="' + escape(node.path) + '"')).join('');
  }

  function regionLabels(leaves, bounds) {
    return leaves.map(node => {
      const area = plotRect(node.bounds, bounds);
      if (area.width < 90 || area.height < 44) return '';
      const label = route(node.stats.prediction);
      return '<text class="boundary-chart__region-label boundary-chart__region-label--' + className(node.stats.prediction) +
        '" x="' + round(area.left + 12) + '" y="' + round(area.top + 21) + '">' + label + '</text>';
    }).join('');
  }

  function selection(node, bounds) {
    if (!node) return '';
    const area = plotRect(node.bounds, bounds);
    const inset = Math.min(3, area.width / 4, area.height / 4);
    return rect({
      left: area.left + inset, top: area.top + inset,
      width: area.width - 2 * inset, height: area.height - 2 * inset,
    }, 'boundary-chart__selection');
  }

  function marks(rows, bounds) {
    return rows.map(row => {
      const x = pointX(row.x, bounds);
      const y = pointY(row.z, bounds);
      const title = '<title>' + escape(row.id) + ', weight ' + row.x + ', scan score ' + row.z + ', ' +
        route(row.label) + '</title>';
      if (row.label === 0) {
        return '<circle class="boundary-chart__point boundary-chart__point--auto" cx="' + round(x) +
          '" cy="' + round(y) + '" r="5.6">' + title + '</circle>';
      }
      const diamond = [[x, y - 7], [x + 7, y], [x, y + 7], [x - 7, y]];
      return '<polygon class="boundary-chart__point boundary-chart__point--review" points="' +
        diamond.map(([pointX, pointY]) => round(pointX) + ',' + round(pointY)).join(' ') + '">' + title + '</polygon>';
    }).join('');
  }

  function coordinates(bounds) {
    const xTicks = ticks(bounds.xMin, bounds.xMax);
    const zTicks = ticks(bounds.zMin, bounds.zMax);
    const grid = xTicks.map(tick => {
      const x = pointX(tick, bounds);
      return line(x, box.top, x, box.bottom, 'boundary-chart__grid');
    }).join('') + zTicks.map(tick => {
      const y = pointY(tick, bounds);
      return line(box.left, y, box.right, y, 'boundary-chart__grid');
    }).join('');
    const labels = xTicks.map(tick => '<text class="boundary-chart__tick" text-anchor="middle" x="' +
      round(pointX(tick, bounds)) + '" y="' + (box.bottom + 23) + '">' + tick + '</text>').join('') +
      zTicks.map(tick => '<text class="boundary-chart__tick" text-anchor="end" dominant-baseline="middle" x="' +
      (box.left - 11) + '" y="' + round(pointY(tick, bounds)) + '">' + tick + '</text>').join('');
    return { grid, labels };
  }

  function render(tree, selectedPath, draft = null, logistic = null) {
    const { bounds, rows } = tree;
    const selected = TreeLabBoundaryModel.getNode(tree, selectedPath);
    const leaves = tree.split ? TreeLabBoundaryModel.leaves(tree) : [];
    const chartRect = { left: box.left, top: box.top, width, height };
    const { grid, labels } = coordinates(bounds);
    const preview = selected && !selected.split && draft
      ? splitLine(selected, draft, bounds, 'boundary-chart__draft', ' data-boundary-draft')
      : '';
    const overlay = logistic ? logisticBoundary(logistic, bounds) : '';
    const description = 'Weight by scan score for ' + rows.length + ' labeled parcels. ' +
      (leaves.length ? leaves.length + ' prediction regions. ' : 'No cut applied. ') +
      'Circles are Auto. Diamonds are Review.' +
      (overlay ? ' The logistic regression line marks a 50% predicted probability of Review.' : '');
    return '<svg class="boundary-chart" viewBox="0 0 ' + viewWidth + ' ' + viewHeight +
      '" data-boundary-chart role="img" aria-label="' + description +
      '" data-x-min="' + bounds.xMin + '" data-x-max="' + bounds.xMax +
      '" data-z-min="' + bounds.zMin + '" data-z-max="' + bounds.zMax + '">' +
      rect(chartRect, 'boundary-chart__surface') + regionRects(leaves, bounds) + grid +
      rect(chartRect, 'boundary-chart__frame') + selection(selected, bounds) +
      splits(tree, bounds, selectedPath) + preview + overlay + regionLabels(leaves, bounds) + marks(rows, bounds) + labels +
      '<text class="boundary-chart__axis-title" text-anchor="middle" x="' + (box.left + width / 2) +
      '" y="357">Weight X</text>' +
      '<text class="boundary-chart__axis-title" text-anchor="middle" transform="translate(18 ' +
      (box.top + height / 2) + ') rotate(-90)">Scan score Z</text></svg>';
  }

  function pointAt(svg, event) {
    const matrix = svg?.getScreenCTM();
    if (!matrix) return null;
    const devicePoint = svg.createSVGPoint();
    devicePoint.x = event.clientX;
    devicePoint.y = event.clientY;
    const point = devicePoint.matrixTransform(matrix.inverse());
    if (!(point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom)) return null;

    const { xMin, xMax, zMin, zMax } = svg.dataset;
    return {
      x: +xMin + (point.x - box.left) / width * (+xMax - +xMin),
      z: +zMin + (box.bottom - point.y) / height * (+zMax - +zMin),
    };
  }

  globalThis.TreeLabBoundaryPlot = { render, pointAt };
})();
