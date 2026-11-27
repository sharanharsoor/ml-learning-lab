(() => {
  "use strict";

  const unit = document.getElementById("unit-4");
  const bike = window.Foundations.bike;
  const details = JSON.parse(document.getElementById("foundations-unit-4-data").textContent);
  const focusHour = bike.rows.find(row => row.hour === 8);
  const integer = new Intl.NumberFormat("en-US");
  const decimal = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  const find = name => unit.querySelector(`[data-unit-4-${name}]`);
  const write = (name, value) => { find(name).textContent = value; };
  const format = value => integer.format(value);

  const periodSizes = { train: details.train.n, validation: details.validation.n, test: bike.test.n };
  for (const [period, n] of Object.entries(periodSizes)) {
    unit.querySelector(`[data-unit-4-count="${period}"]`).textContent = `${format(n)} recorded hours`;
  }
  write("training-baseline", format(details.validation_baseline));
  write("refit-baseline", format(bike.baseline));

  const stages = [...unit.querySelectorAll("[data-unit-4-stage]")];
  const periodMarkers = [...unit.querySelectorAll("[data-unit-4-period]")];
  const previous = find("previous");
  let activeStage = 0;
  const stageStatus = {
    train: "The evaluation restarts at training.",
    validation: "October validation scores are now visible.",
    locked: "The calendar model is locked and refitted.",
    test: "Final test scores are now visible."
  };

  function setStage(name) {
    activeStage = stages.findIndex(stage => stage.getAttribute("data-unit-4-stage") === name);
    const active = stages[activeStage];
    for (const stage of stages) stage.hidden = stage !== active;
    previous.hidden = activeStage === 0;
    const period = name === "locked" ? "validation" : name;
    for (const marker of periodMarkers) {
      if (marker.getAttribute("data-unit-4-period") === period) marker.setAttribute("aria-current", "step");
      else marker.removeAttribute("aria-current");
    }
    write("status", stageStatus[name]);
    const heading = active.querySelector("h4");
    heading.tabIndex = -1;
    heading.focus();
  }

  for (const button of unit.querySelectorAll("[data-unit-4-next]")) {
    button.addEventListener("click", () => setStage(button.getAttribute("data-unit-4-next")));
  }
  previous.addEventListener("click", () => setStage(stages[activeStage - 1].getAttribute("data-unit-4-stage")));

  const resultGroups = {
    validation: details.validation_results,
    test: details.test_results
  };
  const rules = [
    ["training_mean", "Overall mean baseline", details.validation_baseline, bike.baseline],
    ["calendar_model", "Calendar model"]
  ];
  const chartLimit = Math.ceil(Math.max(
    ...Object.values(resultGroups).flatMap(scores => Object.values(scores).map(score => score.mae))
  ) / 50) * 50;

  for (const [period, scores] of Object.entries(resultGroups)) {
    const tbody = unit.querySelector(`[data-unit-4-results="${period}"]`);
    for (const [key, label, initial, final] of rules) {
      const result = scores[key];
      const row = tbody.insertRow();
      const name = document.createElement("th");
      name.scope = "row";
      const fixedForecast = period === "validation" ? initial : final;
      name.textContent = fixedForecast === undefined ? label : `${label} (${fixedForecast} rentals)`;
      row.append(name);
      row.insertCell().textContent = `${format(result.absolute_error_total)} ÷ ${format(periodSizes[period])}`;
      const reading = row.insertCell();
      reading.textContent = `${decimal.format(result.mae)} rentals`;
      const bar = document.createElement("span");
      bar.className = `unit-4-mae-bar ${key === "calendar_model" ? "unit-4-mae-calendar" : ""}`;
      bar.setAttribute("aria-hidden", "true");
      bar.style.setProperty("--unit-4-bar", `${100 * result.mae / chartLimit}%`);
      reading.append(bar);
    }
  }

  const splitStories = {
    chronological: {
      name: "Chronological split",
      reason: "Forecasts go forward in time. Sorting dates prevents later outcomes from informing a forecast for earlier dates.",
      flow: ["Fit on earlier hours", "Compare rules on the next month", "Test on the latest months"]
    },
    random: {
      name: "Random split",
      reason: "If rows come from the same setting and share no subject or time dependency, randomly assigning them gives a reasonable sample of new rows. Save the random seed to reproduce the split.",
      flow: ["Shuffle independent rows", "Assign whole rows to each split", "Keep each row in a single split"]
    },
    stratified: {
      name: "Stratified split",
      reason: "When spam is rare, preserve the approximate Spam share across randomly sampled splits. Recall is the share of actual Spam emails the model catches, so each split needs enough examples of that class.",
      flow: ["Separate rows by label", "Randomly draw from each label", "Keep the approximate class mix"]
    },
    grouped: {
      name: "Grouped split",
      reason: "For a separate prediction job with station-level records, keep each station together if the goal is to predict for unseen stations. That way the model has no history from a test station.",
      flow: ["Define the group as a station", "Assign entire stations", "Test on unseen stations"]
    }
  };

  function bindChoice(attribute, render) {
    const buttons = [...unit.querySelectorAll(`[data-unit-4-${attribute}]`)];
    for (const button of buttons) {
      button.addEventListener("click", () => {
        for (const peer of buttons) peer.setAttribute("aria-pressed", String(peer === button));
        render(button.getAttribute(`data-unit-4-${attribute}`));
      });
    }
    render(buttons.find(button => button.getAttribute("aria-pressed") === "true")
      .getAttribute(`data-unit-4-${attribute}`));
  }

  bindChoice("split", key => {
    const story = splitStories[key];
    write("split-name", story.name);
    write("split-reason", story.reason);
    find("split-flow").replaceChildren(...story.flow.map(action => {
      const item = document.createElement("li");
      item.textContent = action;
      return item;
    }));
  });

  bindChoice("input", input => {
    const usesFuture = input === "after";
    const prediction = usesFuture ? details.case.casual + details.case.registered : focusHour.predicted;
    const explanation = usesFuture
      ? `After the hour, record ${details.case.record.toLocaleString("en-US")} gives ${details.case.casual} casual rentals and ${details.case.registered} registered rentals. Their sum is ${prediction}.`
      : `At 7:59 a.m. we can see the hour and workday status. Past workday counts give round(${format(focusHour.train_group_total)} ÷ ${format(focusHour.train_group_count)}) = ${prediction}.`;

    write("input-title", usesFuture ? "Target leakage" : "Inputs available at forecast time");
    write("input-detail", explanation);
    write("prediction-label", usesFuture ? "Total copied from future data" : "Calendar forecast");
    write("prediction", `${format(prediction)} rentals`);
    write("actual", `${format(focusHour.actual)} rentals`);
    write("error", `|${focusHour.actual} − ${prediction}| = ${Math.abs(focusHour.actual - prediction)}`);
    find("input-readout").classList.toggle("unit-4-leak", usesFuture);
  });
})();
