(() => {
  'use strict';

  const fixture = id => JSON.parse(document.getElementById(id).textContent);
  const classificationData = fixture('metrics-classification-data');
  const regressionData = fixture('regression-teaching-fixture');
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const fraction = (numerator, denominator) => denominator ? numerator / denominator : null;

  function classify(threshold, rows = classificationData.rows) {
    const counts = { tp: 0, fp: 0, fn: 0, tn: 0 };
    const cases = rows.map(({ id, score, actual }) => {
      const actualSpam = actual === 1;
      const predictedSpam = score >= threshold;
      const outcome = actualSpam ? (predictedSpam ? 'tp' : 'fn') : (predictedSpam ? 'fp' : 'tn');
      counts[outcome] += 1;
      return { caseId: id, score, actualSpam, predictedSpam, outcome };
    });
    const { tp, fp, fn, tn } = counts;
    const recall = fraction(tp, tp + fn);
    return {
      ...counts, cases, recall, tpr: recall, fpr: fraction(fp, fp + tn),
      precision: fraction(tp, tp + fp),
      f1: fraction(2 * tp, 2 * tp + fp + fn),
      accuracy: fraction(tp + tn, rows.length),
    };
  }

  function roc(rows = classificationData.rows) {
    const positives = rows.filter(row => row.actual === 1);
    const negatives = rows.filter(row => row.actual === 0);
    let wins = 0;
    let ties = 0;
    for (const positive of positives) {
      for (const negative of negatives) {
        if (positive.score > negative.score) wins += 1;
        else if (positive.score === negative.score) ties += 1;
      }
    }
    const thresholds = [Infinity, ...new Set(rows.map(row => row.score))].sort((a, b) => b - a);
    const points = thresholds.map(threshold => {
      const { fpr, tpr } = classify(threshold, rows);
      return { threshold, fpr, tpr };
    });
    const pairs = positives.length * negatives.length;
    return { points, wins, ties, pairs, auc: fraction(wins + 0.5 * ties, pairs) };
  }

  const regressionActual = regressionData.rows.map(row => row.actual);
  function regression(predictions, observed = regressionActual) {
    const center = mean(observed);
    const residuals = observed.map((value, i) => value - predictions[i]);
    const absoluteErrors = residuals.map(Math.abs);
    const squaredErrors = residuals.map(value => value ** 2);
    const baselineErrors = observed.map(value => (value - center) ** 2);
    const sse = squaredErrors.reduce((sum, value) => sum + value, 0);
    const sst = baselineErrors.reduce((sum, value) => sum + value, 0);
    const mse = mean(squaredErrors);
    return {
      residuals, absoluteErrors, squaredErrors, baselineErrors, mean: center,
      mae: mean(absoluteErrors), mse, rmse: Math.sqrt(mse), meanResidual: mean(residuals),
      sse, sst, r2: sst ? 1 - sse / sst : null,
    };
  }

  window.MetricsCore = {
    classificationData, regressionData, classify, roc, regression, regressionActual,
    scores: classificationData.rows.map(row => row.score),
    actual: classificationData.rows.map(row => row.actual),
  };
  window.MetricsMath = Object.freeze({
    countsAtThreshold: classify,
    rocPoints: () => roc().points,
    aucPairwise: () => roc().auc,
    r2: (observed, predicted) => predicted === undefined
      ? regression(observed).r2 : regression(predicted, observed).r2,
  });
})();
