(() => {
  "use strict";

  const { TRAIN } = TreeLabData;
  const { entropy, gini, evaluate } = TreeLab;
  const get = id => document.getElementById(id);
  const slider = get("gini-review-share");
  const presets = [...document.querySelectorAll("[data-gini-preset]")];
  const formatPercent = probability => Number((probability * 100).toFixed(2)) + "%";
  const formatScore = score => score.toFixed(3);

  function renderCurves(review, giniScore, entropyScore) {
    const x = probability => 34 + 260 * probability;
    const y = value => 131 - 107 * value;
    function points(score) {
      return Array.from({ length: 81 }, (_, i) => {
        const p = i / 80;
        return x(p).toFixed(2) + "," + y(score(p)).toFixed(2);
      }).join(" ");
    }
    get("gini-curves").innerHTML =
      '<svg class="chart" viewBox="0 0 324 178" role="img" aria-label="At ' +
      formatPercent(review) + ' Spam, Gini is ' + formatScore(giniScore) +
      ' and entropy is ' + formatScore(entropyScore) + ' bits. Both curves peak at 50 percent.">' +
      '<path class="grid" d="M34 24H294 M34 77.5H294"/>' +
      '<path class="axis" d="M34 24V131H294" fill="none"/>' +
      '<text x="26" y="28" class="gini-svg-label gini-svg-label-end">1</text>' +
      '<text x="26" y="81.5" class="gini-svg-label gini-svg-label-end">0.5</text>' +
      '<text x="26" y="135" class="gini-svg-label gini-svg-label-end">0</text>' +
      '<text x="34" y="148" class="gini-svg-label">0%</text>' +
      '<text x="164" y="148" class="gini-svg-label">50%</text>' +
      '<text x="294" y="148" class="gini-svg-label">100%</text>' +
      '<line x1="' + x(review) + '" y1="24" x2="' + x(review) + '" y2="131" class="gini-pointer"/>' +
      '<polyline points="' + points(entropy) + '" class="entropy-curve"/>' +
      '<polyline points="' + points(gini) + '" class="gini-curve"/>' +
      '<circle cx="' + x(review) + '" cy="' + y(entropyScore) + '" r="4" class="entropy-point"/>' +
      '<circle cx="' + x(review) + '" cy="' + y(giniScore) + '" r="4" class="gini-point"/>' +
      '<line x1="34" y1="170" x2="50" y2="170" class="gini-curve"/>' +
      '<text x="55" y="174" class="gini-svg-label gini-svg-label-start">Gini ' + formatScore(giniScore) + '</text>' +
      '<line x1="145" y1="170" x2="161" y2="170" class="entropy-curve"/>' +
      '<text x="166" y="174" class="gini-svg-label gini-svg-label-start">Entropy ' + formatScore(entropyScore) + ' bits</text></svg>';
  }

  function renderMix() {
    const review = Number(slider.value) / 100;
    const auto = 1 - review;
    const giniScore = gini(review);
    const entropyScore = entropy(review);
    const mix = { aa: auto * auto, ar: auto * review, ra: review * auto, rr: review * review };

    get("gini-review-output").textContent = formatPercent(review);
    get("gini-auto-share").textContent = formatPercent(auto);
    get("gini-review-label-share").textContent = formatPercent(review);
    for (const [pair, probability] of Object.entries(mix)) {
      get("gini-" + pair).textContent = formatPercent(probability);
    }
    get("gini-calculation").innerHTML =
      '<strong>Gini</strong> <span class="formula">' + auto.toFixed(2) + ' × ' + review.toFixed(2) +
      ' + ' + review.toFixed(2) + ' × ' + auto.toFixed(2) + ' = ' + giniScore.toFixed(4) + '</span>';
    for (const button of presets) {
      button.setAttribute("aria-pressed", button.dataset.giniPreset === slider.value ? "true" : "false");
    }
    renderCurves(review, giniScore, entropyScore);
  }

  function compareParcelQuestions() {
    const candidates = [
      { label: "X ≤ 3.5", split: { feature: "x", threshold: 3.5 } },
      { label: "Y = A", split: { feature: "y", threshold: "A" } },
    ];
    get("gini-parcel-ranks").innerHTML = candidates.map(({ label, split }) =>
      '<tr><th scope="row">' + label + '</th><td>' +
      formatScore(evaluate(TRAIN, split, "gini").gain) + '</td><td>' +
      formatScore(evaluate(TRAIN, split, "entropy").gain) + '</td></tr>'
    ).join("");
  }

  function compareToyQuestions() {
    const total = 10;
    const parentSpamShare = 2 / total;
    const splits = [
      { label: "Split A", yes: [0, 1], no: [8, 1] },
      { label: "Split B", yes: [2, 2], no: [6, 0] },
    ];
    function gain(split, score) {
      const contribution = ([auto, review]) => ((auto + review) / total) * score(review / (auto + review));
      return score(parentSpamShare) - contribution(split.yes) - contribution(split.no);
    }
    const giniGains = splits.map(split => gain(split, gini));
    const entropyGains = splits.map(split => gain(split, entropy));
    const highlight = (value, series) => value === Math.max(...series) ?
      '<strong class="gini-winning">' + formatScore(value) + ' · wins</strong>' : formatScore(value);

    get("gini-toy-ranks").innerHTML = splits.map((split, i) =>
      '<tr><th scope="row">' + split.label + '<span class="gini-share">Yes (' + split.yes.join(", ") +
      '), no (' + split.no.join(", ") + ')</span></th><td>' + highlight(giniGains[i], giniGains) +
      '</td><td>' + highlight(entropyGains[i], entropyGains) + '</td></tr>'
    ).join("");
    get("gini-toy-worked").textContent = "For split A, weighted child Gini is (1/10) × 0 + (9/10) × " +
      formatScore(gini(1 / 9)) + " ≈ 0.178. Parent Gini is 0.320, so the gain is " + formatScore(giniGains[0]) + ".";
  }

  slider.addEventListener("input", renderMix);
  for (const button of presets) {
    button.addEventListener("click", () => {
      slider.value = button.dataset.giniPreset;
      renderMix();
    });
  }
  renderMix();
  compareParcelQuestions();
  compareToyQuestions();
})();
