(() => {
  "use strict";

  const unit = document.getElementById("unit-3");
  if (!unit) return;
  const get = (id) => unit.querySelector("#" + id);
  const data = JSON.parse(get("foundations-unit-3-data").textContent);
  const formatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
  const fmt = (value) => formatter.format(value);
  const sum = (values) => values.reduce((total, value) => total + value, 0);
  const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });
  const dateLabel = (value) => dateFmt.format(new Date(value + "T00:00:00Z"));
  const dayLabels = { workday: "workday", nonWorkday: "non-workday" };
  const hourLabel = (hour) => String(hour).padStart(2, "0") + ":00";
  const unusual = get("u3-unusual");
  const groupPicker = get("u3-group");
  const widthPicker = get("u3-bin-width");
  const pointPicker = get("u3-point-picker");
  const histogram = get("u3-histogram");

  function describe(values) {
    const n = values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const median = (sorted[Math.floor((n - 1) / 2)] + sorted[Math.floor(n / 2)]) / 2;
    const mean = sum(values) / n;
    const deviations = values.map((value) => value - mean);
    const squared = deviations.map((value) => value ** 2);
    const variance = sum(squared) / n;
    return { mean, median, variance, standardDeviation: Math.sqrt(variance), sorted, deviations, squared };
  }

  function describeProfile() {
    const n = data.profile.length;
    const edited = unusual.checked;
    const chartCounts = data.profile.map((row) => edited && row.hour === 8 ? 2500 : row.count);
    const { mean, median, variance, standardDeviation, sorted, deviations, squared } = describe(chartCounts);
    get("u3-scenario").textContent = edited
      ? "Illustration only. The observed 779 at 08:00 is replaced by 2,500 in this table. The historical charts still use measured data."
      : "These five counts are measured in October. The later November 1 count of 680 belongs to the forecast evaluation.";
    get("u3-count-rows").innerHTML = data.profile.map((row, i) => {
      const style = edited && row.hour === 8 ? " class=\"u3-what-if\"" : "";
      return "<tr" + style + "><th scope=\"row\">" + hourLabel(row.hour) + "</th><td>" +
        fmt(chartCounts[i]) + "</td><td>" + fmt(deviations[i]) + "</td><td>" + fmt(squared[i]) +
        " rentals²</td></tr>";
    }).join("");
    const statistics = [
      ["Mean", mean, "rentals", "(" + chartCounts.map(fmt).join(" + ") + ") ÷ " + n + " = " + fmt(mean)],
      ["Median", median, "rentals", "Sorted counts " + sorted.map(fmt).join(", ") + ". The third count is " + fmt(median) + "."],
      ["Variance", variance, "rentals²", "(" + squared.map(fmt).join(" + ") + ") ÷ " + n + " = " + fmt(variance)],
      ["Standard deviation", standardDeviation, "rentals", "√" + fmt(variance) + " ≈ " + fmt(standardDeviation)],
    ];
    get("u3-statistics").innerHTML = statistics.map(([label, value, units, working]) =>
      "<article><h4>" + label + "</h4><p class=\"u3-stat-value\">" + fmt(value) + " " + units +
      "</p><p class=\"u3-math-line\">" + working + "</p></article>").join("");
  }

  function bins(rows, width) {
    const counts = Array.from({ length: 900 / width }, () => 0);
    for (const [, count] of rows) counts[Math.floor(count / width)] += 1;
    return counts;
  }

  let activeBin = 0;
  function setBin(i, counts, width) {
    activeBin = i;
    for (const [j, button] of [...histogram.children].entries()) {
      button.setAttribute("aria-pressed", String(i === j));
    }
    get("u3-bin-reading").textContent = fmt(counts[i]) + " of " + fmt(sum(counts)) + " recorded " +
      dayLabels[groupPicker.value] + " hours had " + fmt(i * width) + " to " +
      fmt((i + 1) * width - 1) + " rentals.";
  }

  function renderHistogram() {
    const width = Number(widthPicker.value);
    const counts = bins(data.groups[groupPicker.value], width);
    const commonMax = Math.ceil(Math.max(...Object.values(data.groups).flatMap((rows) => bins(rows, width))) / 10) * 10;
    histogram.style.setProperty("--u3-bins", counts.length);
    get("u3-histogram-axis").textContent = "Vertical axis · recorded hours (0 to " + commonMax + ")";
    histogram.innerHTML = counts.map((count, i) =>
      "<button type=\"button\" class=\"u3-bin\" aria-label=\"" + fmt(i * width) + " to " +
      fmt((i + 1) * width - 1) + " rentals, " + count + " observed hours\" aria-pressed=\"false\">" +
      "<span class=\"u3-bin-track\" aria-hidden=\"true\"><span class=\"u3-bin-fill\" style=\"--u3-height:" +
      (100 * count / commonMax) + "%\"></span></span><span class=\"u3-bin-label\" aria-hidden=\"true\">" +
      i * width + "</span></button>").join("");
    for (const [i, button] of [...histogram.children].entries()) {
      button.addEventListener("click", () => setBin(i, counts, width));
    }
    setBin(Math.min(activeBin, counts.length - 1), counts, width);
  }

  function position(row) {
    return ["--u3-x:" + (100 * row[2] / 35) + "%", "--u3-y:" + (100 * row[1] / 900) + "%"];
  }

  function focusPoint() {
    const row = data.groups[groupPicker.value][Number(pointPicker.value)];
    get("u3-selected-point").style.cssText = position(row).join(";");
    get("u3-point-reading").textContent = dateLabel(row[0]) + " at 08:00 had " + fmt(row[1]) +
      " rentals and about " + fmt(row[2]) + " °C.";
  }

  function renderGroup() {
    const group = groupPicker.value;
    const rows = data.groups[group];
    const counts = rows.map((row) => row[1]);
    const { mean, median } = describe(counts);
    get("u3-group-reading").textContent = fmt(rows.length) + " recorded " + dayLabels[group] +
      " hours · mean " + fmt(sum(counts)) + " ÷ " + fmt(rows.length) + " ≈ " + fmt(mean) +
      " rentals · median " + fmt(median) + " rentals.";
    get("u3-points").innerHTML = rows.map((row) =>
      "<span class=\"u3-dot\" style=\"" + position(row).join(";") + "\"></span>").join("");
    const low = counts.indexOf(Math.min(...counts));
    const high = counts.indexOf(Math.max(...counts));
    const mostRecent = rows.length - 1;
    const featured = group === "workday" ? rows.findIndex((row) => row[0] === "2012-10-25") : mostRecent;
    const highlight = [
      [featured, group === "workday" ? "From our five-hour table" : "Most recent"],
      [low, "Lowest count"],
      [high, "Highest count"],
    ];
    pointPicker.innerHTML = highlight.map(([index, label]) =>
      "<option value=\"" + index + "\">" + label + " · " + dateLabel(rows[index][0]) + "</option>").join("");
    focusPoint();
    renderHistogram();
  }

  const example = data.profile.find((row) => row.hour === 8);
  get("u3-example-row").innerHTML = "<tr><th scope=\"row\">" + dateLabel(example.date) +
    "</th><td>" + hourLabel(example.hour) + "</td><td>Workday (1)</td><td>Mist (" + example.weather +
    ")</td><td>" + fmt(example.temperature) + " °C</td><td>" + fmt(example.count) + " rentals</td></tr>";

  const { audit } = data;
  get("u3-audit-scope").textContent = "Audit the " + fmt(audit.rows) + " source rows from " +
    dateLabel(audit.start) + " through " + dateLabel(audit.end) + ".";
  const recordedHours = audit.rows - audit.duplicateKeys;
  get("u3-audit").innerHTML = [
    ["Blank cells", fmt(audit.blankCells) + " blank CSV fields across the source rows."],
    ["Repeated hours", fmt(audit.duplicateKeys) + " extra rows with an already recorded date and hour. Two dates at 08:00 are distinct observations."],
    ["Unrecorded hours", fmt(audit.expectedHours / 24) + " dates × 24 hours = " + fmt(audit.expectedHours) +
      " expected date-hour keys. " + fmt(audit.expectedHours) + " expected − " + fmt(recordedHours) + " recorded = " +
      fmt(audit.absentHours) + " missing hours. Check collection notes before interpreting an absence as zero."],
  ].map(([label, detail]) => "<div><strong>" + label + "</strong><p>" + detail + "</p></div>").join("");

  function busiestRange(group) {
    const counts = bins(data.groups[group], 100);
    const max = Math.max(...counts);
    return counts.flatMap((count, start) => count === max
      ? [fmt(100 * start) + " to " + fmt(100 * start + 99) + " rentals (" + fmt(count) + " hours)"]
      : []).join(" and ");
  }
  get("u3-exercise-answer").textContent = "Workdays peak at " + busiestRange("workday") +
    ". Non-workdays peak at " + busiestRange("nonWorkday") + ". Day type is observable before 08:00 " +
    "and distinguishes groups with different count distributions in this training data.";

  unusual.addEventListener("change", describeProfile);
  widthPicker.addEventListener("change", () => {
    activeBin = 0;
    renderHistogram();
  });
  groupPicker.addEventListener("change", renderGroup);
  pointPicker.addEventListener("change", focusPoint);
  describeProfile();
  renderGroup();
})();
