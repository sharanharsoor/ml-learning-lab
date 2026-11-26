# Teaching Classification & Regression Metrics

This workshop uses one growing delivery-service problem to motivate different evaluation questions. The fictional Asha story is a teaching scaffold; each metric still needs its exact definition. The browser provides visual explanations. A separate notebook provides actual Python execution.

- [Open the lab](https://sharanharsoor.github.io/ml-learning-lab/classification-regression-metrics/)
- [ML Learning Lab source](https://github.com/sharanharsoor/ml-learning-lab)
- Core notebook: `notebooks/metrics_core.ipynb`
- Optional fitted-model notebook: `notebooks/metrics_public_data.ipynb`

These paths are relative to this lab's folder in the source repository. In the downloadable resources ZIP, both notebooks and `metrics_demo.py` are directly in the extracted folder, beside `README.txt` and `data/`. Omit the `notebooks/` prefix when opening that extracted copy.

## The arrangement

Use the built-in Board for the opening sketch and four-outcome register. Then stay in Playground: formulas, substitutions, matrix highlights, scores, and curves sit beside their evidence. Switch once to a contiguous Jupyter block after the visual discussion. Classroom offers optional prepared questions; the later Board templates are optional drawing aids.

The Concepts rail has **Accuracy baseline, Confusion matrix, Precision, Recall, F1, ROC, R²**. Accuracy baseline sets cutoff 0; Confusion matrix restores 0.25. The other classification concepts preserve the cutoff. Precision, Recall, F1, and Accuracy tiles are also clickable. R² opens Arrival-time regression. MAE, MSE, and RMSE appear below its plot.

All included guides and downloads are public. The presentation layout changes the display, not access. Keep personal notes outside the shared surface, and verify whether your meeting tool shares one tab, one application window, or the whole screen. Board reference notes and worked examples can remain visible.

## Establish the world before the first metric

Say: “Asha runs a meal-delivery service. A customer has already placed an order and the service has accepted it. At acceptance they agreed on an arrival deadline, say 12:40. At dispatch at 12:00, Asha has forty minutes left. The address, dispatch time, courier location, and current traffic can inform a forecast. The app now displays either On track or Likely late. Later, the actual arrival tells us whether the forecast was right.”

Keep the class legend visible:

- **P, label 1: on time**, arrival by the fixed deadline. Predicted P displays **On track**.
- **N, label 0: late**, arrival after that deadline. Predicted N displays **Likely late**.
- A 12:35 arrival is P; a 12:50 arrival is N. Every order is still processed. The forecast does not accept or reject an order, guarantee the outcome, or change the deadline.
- The teaching rows contain only frozen synthetic scores and later labels. They do not store address, traffic, or courier features. No trained feature pipeline or calibrated probability is being demonstrated.

Explain two separate questions: “Will this order arrive by its fixed deadline?” is binary classification. “How many minutes from dispatch until arrival?” is numerical regression. The five regression cases are separate from the twenty classification cases.

## Act 1: an impressive headline

Say: “Asha's first system displays On track for every order. Sixteen of twenty orders arrive on time. Her report says 80% accuracy. Would you rely on the report?”

Draw twenty marks and reveal sixteen on-time arrivals and four late arrivals. Ask learners to explain the headline before revealing the four incorrect optimistic statuses.

In Playground select **Accuracy baseline**. Click **Accuracy**: TP and TN form the correct numerator; all twenty cases form the denominator. Here (16+0)/20=0.8. Positive means a class, not correctness.

Transition: “The headline loses the distinction between different mistakes. Asha needs an outcome register.”

## Act 2: build the register

Say: “Asha's next system gives each dispatched order an on-time score. Higher scores indicate the intended on-time ordering. For now, On track means score at least 0.25. A score is not established as a calibrated probability.”

Draw actual P then N on the rows, and predicted P then N on the columns. Place these four cases before naming all the cells:

- D01: score 0.98, actually on time, predicted On track. **TP**, top left.
- D14: score 0.45, actually late, predicted On track. **FP**, bottom left. This is incorrect optimistic reassurance.
- D19: score 0.10, actually on time, predicted Likely late. **FN**, top right. This is an unnecessary late forecast.
- D17: score 0.20, actually late, predicted Likely late. **TN**, bottom right.

Select **Confusion matrix** to restore 0.25. The complete positive-first matrix is `[[15,1],[1,3]]`, in the order `[[TP,FN],[FP,TN]]`. Actual P totals sixteen; actual N totals four. Predicted P totals sixteen; predicted N totals four.

Ask: “In false positive, which part names the predicted class and which part names correctness?” Positive is the predicted class; false means it disagrees with reality.

## Act 3: how reliable are the On track forecasts?

Say: “The supervisor asks: of the sixteen orders the app called On track, how many actually arrived on time?”

Click **Precision**. Use the left predicted-P column: fifteen correct forecasts and one incorrect optimistic forecast.

**Precision = TP/(TP+FP) = 15/(15+1) = 15/16 = 0.9375.**

Then ask: “Could every On track forecast be correct while some actual on-time orders still receive Likely late?” At cutoff 0.50 there are TP=13, FP=0, FN=3, TN=4. Precision is 1, but three actual positives are missed. Precision measures reliability among positive predictions. It does not count their coverage.

Return to **Confusion matrix** for 0.25.

## Act 4: what about the on-time orders we called late?

Say: “The customer with D19 asks: the app said Likely late, but my meal arrived on time. Why did it worry me unnecessarily? Asha now asks: of all actual on-time orders, how many did we call On track?”

Click **Recall**. Use the top actual-P row.

**Recall = TP/(TP+FN) = 15/(15+1) = 15/16 = 0.9375.**

Precision and recall happen to match here, but their denominators contain different cases. Recall measures coverage of actual positives; it does not measure the reliability of the positive predictions.

Say: “Asha wants to label more of the actual on-time orders On track. She lowers the cutoff from 0.25 to 0.10. Who enters, and what might go wrong?”

Wait for a prediction. D17 and D18 are actual negatives; D19 is an actual positive. The three extra positive predictions add one TP and two FP. At 0.10:

- TP=16, FP=3, FN=0, TN=1.
- Precision=16/19≈84.2%.
- Recall=16/16=100%.
- Accuracy=(16+1)/20=85%.

On fixed scores, lowering the cutoff cannot reduce recall. Precision can rise or fall depending on the added cases. The observed drop here is not a universal law.

## Act 5: one summary, with limits

Say: “Asha asks for one symmetric summary of precision and recall for a report.”

Click **F1**. In this formula p means precision and r means recall:

**F1 = 2pr/(p+r) = 2TP/(2TP+FP+FN).**

Substitute the precision and recall fractions to obtain the count form. At 0.25, F1=30/(30+1+1)=0.9375. At 0.10, F1=32/(32+3+0)=32/35≈0.9143. Explain the harmonic mean: a small component pulls it down more than the arithmetic mean would.

Ask: “Must the higher-F1 cutoff be the right operational choice?” No. F1 excludes TN and has no explicit error costs. Suppose an incorrect On track forecast costs ten units and an unnecessary Likely late forecast costs one. These two candidate cutoffs cost 11 and 30 units respectively. Those illustrative costs must come from the real problem; F1 neither supplies them nor proves a globally optimal cutoff.

Boundary check: all-N predicts no positive cases. Precision is undefined; recall is 0; the count form of F1 is 0 here because actual positives exist. State a library's zero-division convention rather than presenting an empty ratio as measured performance.

## Act 6: are the scores useful beyond one cutoff?

Say: “Tomorrow Asha might choose a more conservative or more optimistic status policy. The scores have not changed. Do they rank actual on-time orders above late ones?”

Click **ROC**. Read both axes with their groups:

- Vertical: **TPR = recall = TP/(TP+FN)**, among sixteen actual positives.
- Horizontal: **FPR = FP/(FP+TN)**, among four actual negatives.
- At 0.25 the point is `(1/4,15/16)`; at 0.10 it is `(3/4,1)`.
- All-P produces `(1,1)`, but precision remains 16/20=80%. ROC is not a precision-recall curve.

Move the cutoff down the score ordering. Crossing an actual positive moves up by 1/16; crossing an actual negative moves right by 1/4. A tied-score group crosses together.

Open **How 59 / 64?**. The grid columns are actual P cases; its rows are actual N cases. A cell's credit belongs to the positive case's ranking:

- Actual-P score greater than actual-N score: positive-case win, credit 1.
- Equal scores: tie, credit 0.5.
- Actual-P score lower: positive-case loss, credit 0.

Select D19 (0.10) against D14 (0.45): a positive-case loss. Then select D19 against D20 (0.05): a positive-case win. Pair comparison displays both scores and the relation.

Against the four late cases D14 (0.45), D17 (0.20), D18 (0.15), D20 (0.05), the actual-positive cases earn 13+15+15+16=59 wins. D20 does not itself “win” sixteen times; all sixteen actual-positive scores exceed its score. There are 64 pairs, 59 wins, five losses, and no ties.

**AUC = (wins+0.5×ties)/(actual P×actual N) = 59/(16×4) = 59/64 = 0.921875.**

The five inversions are D15 (0.40), D16 (0.30), and D19 (0.10) against D14 (0.45); and D19 against D17 (0.20) and D18 (0.15).

Change the cutoff while the grid is open. Decisions and the ROC point move; the fixed scores and pair results do not. AUC is discrimination, not calibrated probability, selected-cutoff accuracy, precision, or business value. A different model or changed score ordering can produce a different AUC. ROC-AUC requires both actual classes.

## Act 7: when will it arrive, and how wrong is the estimate?

Say: “The customer already knows the 12:40 deadline, but asks: will my meal arrive at 12:10 or closer to 12:35? Asha adds a prediction of delivery minutes from dispatch. Now she needs to measure the size of its misses.”

Click **R²** to open Arrival-time regression. Use actual durations `[20,30,40,50,60]` and **Small misses · 5 min high**, predictions `[25,35,45,55,65]`.

### Average miss in minutes

A residual is actual minus prediction, `e=y−ŷ`. Here every residual is −5 minutes. The absolute residuals are five minutes each.

**MAE, Mean Absolute Error, = Σ|e|/n = 25/5 = 5 minutes.**

This is average magnitude. It is not the signed mean residual: −5 means the predictions are five minutes high on average.

### Why one large miss can matter

Say: “A second predictor gets four orders exactly right but predicts 85 minutes for an order that takes 60. It also has MAE 5. Does that one average capture the difference?”

Select **One large miss**, predictions `[20,30,40,50,85]`. Its residuals are `[0,0,0,0,−25]`.

- Default: SSE=125, **MSE, Mean Squared Error, =125/5=25 minutes²**; **RMSE, Root Mean Squared Error, =√25=5 minutes**.
- One large miss: SSE=625, MSE=625/5=125 minutes²; RMSE=√125≈11.180 minutes.
- Both have MAE 5 and signed mean residual −5. The change in RMSE reflects concentration of error, not a different average signed bias.

Squaring gives large misses more weight. The root restores the original unit. Neither metric supplies the real cost of a late meal. Keep MSE as the bridge to RMSE rather than introducing an extra narrative detour.

### Compared with what?

Return to **Small misses · 5 min high**. The observed mean is 40 minutes.

- **SSE, Sum of Squared Errors, =Σ(y−ŷ)²=125 minutes².**
- **SST, Total Sum of Squares, =Σ(y−ȳ)²=1000 minutes².**
- First case: model residual `20−25=−5`, squared error 25; mean-reference deviation `20−40=−20`, squared deviation 400.
- **R²=1−SSE/SST=1−125/1000=0.875.** One large miss gives 0.375.

The observed-mean reference gives MAE 12, MSE 200, RMSE≈14.142, and R² 0. Predicting 60 for all cases gives SSE 3000 and R² −2. Perfect predictions give R² 1.

R² is unitless and can be negative. It is not “87.5% accurate.” The observed evaluation mean is the reference in the standard R² calculation. It is not a deployable baseline fitted from held-out labels; fit predictive baselines on training data and evaluate them separately. Constant targets make the ordinary SST denominator zero, even if a library returns a finite convention.

Spend about three to four minutes on MAE/MSE/RMSE, then continue the R² comparison within the existing regression time block.

## One actual Python block

Open `notebooks/metrics_core.ipynb`. Run its setup before jumping to later cells. The route is sections 1 setup, 2 accuracy, 3 counts, 4 denominators, 5 cutoff experiment, 6 library check, 7 decision, 8 ROC-AUC, 9 duration metrics, 10 boundaries, 11 exit questions.

Ask learners to predict each result before execution:

1. At 0.25, count TP15, FP1, FN1, TN3 and verify precision, recall, F1, and accuracy.
2. Change to 0.10 and verify TP16, FP3, FN0, TN1. Recompute AUC from the original scores and explain why it stays 59/64.
3. Verify MAE, MSE, RMSE, signed mean residual, and R² for the default and One large miss cases.

The positive-first matrix is `[[TP,FN],[FP,TN]]`. In scikit-learn use `labels=[1,0]`; do not flatten it as though label 0 comes first. Use scores for ROC-AUC, not already thresholded labels.

The optional Wine Quality exercise belongs after the core workshop. Positive means quality≥7 for that exercise only. Its ordinal rating is treated numerically for a separate regression approximation. It removes exact duplicate rows before the held-out split, fits on training data, and uses the bundled unmodified CSV. Choose a policy on validation data, not by repeatedly optimizing the final test set.

## Timings and closing questions

For **45 minutes**, use 0–3 opening, 3–8 matrix, 8–13 precision, 13–18 recall/cutoff, 18–22 F1, 22–28 ROC-AUC, 28–34 duration metrics, 34–40 Python, and 40–45 recap. For **60 minutes**, use 0–4 opening, 4–10 matrix, 10–17 precision, 17–24 recall/cutoff, 24–29 F1, 29–38 ROC-AUC, 38–47 duration metrics, 47–55 Python, and 55–60 recap. Learner questions and predictions belong inside these blocks.

Close with: “Which question are we answering, what group or reference are we using, and what does this number leave out?”

- Which column gives precision? Predicted P; TP+FP.
- Which row gives recall? Actual P; TP+FN.
- Why can precision be 1 while recall is smaller? Some actual positives can still be predicted N.
- Does lowering the cutoff always lower precision? No; it depends on the added cases.
- Why can the ROC point be (1,1) with precision 0.8? The axes use actual-class denominators, while precision uses predicted positives.
- Why did AUC stay fixed? Only the cutoff changed; pair ordering did not.
- Why compare MAE with RMSE? Equal average magnitudes can hide different concentration of large errors.
- What does R² compare? Model squared error with the stated observed-mean reference.
- Can one metric choose the best policy for us? No; the objective, costs, constraints, evaluation data, and uncertainty must also be stated.

## Sources and reuse

The fictional scenario, synthetic examples, and workshop scripts are original project material under the repository's MIT license. Teaching references include [3Blue1Brown's neural-network introduction](https://www.youtube.com/watch?v=aircAruvnKk), [StatQuest's PCA explanation](https://www.youtube.com/watch?v=FgakZw6K1QQ), and [Scaler's CAP explanation](https://www.youtube.com/watch?v=8UryASGBiR4). Those works are linked, not redistributed. Technical definitions follow the linked scikit-learn references in the app.

The optional UCI data have a separate license: Cortez, P., Cerdeira, A., Almeida, F., Matos, T., and Reis, J. (2009), [Wine Quality](https://archive.ics.uci.edu/dataset/186/wine+quality), DOI [10.24432/C56S3T](https://doi.org/10.24432/C56S3T), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). See `THIRD_PARTY_NOTICES.md`.
