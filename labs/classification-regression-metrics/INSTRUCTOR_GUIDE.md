# Teaching Classification and Regression Metrics

Open [Classification Metrics](https://sharanharsoor.github.io/ml-learning-lab/classification-regression-metrics/#classification) or [Regression Metrics](https://sharanharsoor.github.io/ml-learning-lab/classification-regression-metrics/#regression). Each lesson includes a live example, worked calculations, optional explanations, and the corresponding Colab notebook. Teaching view increases the reading size. The whiteboard has templates and accepts pen, mouse, touch, or typed labels.

## Classification route

1. Ask where a scored email should go. Reveal the decision at cutoff 0.50, then the recorded label. E4130 scores 0.5177 and actually belongs in the inbox, so it contributes one FP. E35 scores 0.0009 despite being Spam, so it contributes one FN.
2. Combine the 20 selected test examples at cutoff 0.50. The matrix is `[[9, 1], [2, 8]]` with actual Spam and Legitimate as rows and predicted Spam and Legitimate as columns.
3. Read precision down the Spam prediction column and recall across the actual Spam row. The common numerator is 9. The different denominators are 11 and 10. Work through accuracy and F1 with their own formulas.
4. Compare cutoff 0.75 and 0.20. Ask which emails change folders, then reveal the register. E4130 moves to the inbox at 0.75. E4447 moves into Spam at 0.20. On these examples, raising the threshold can give up a true positive to avoid a false positive.
5. Track FPR and TPR as the cutoff changes. Compute AUC with one example pair, one reversal, then the full 100-pair tally. The 20 examples use rounded scores, so a tied pair earns half a point. The 1,168-email test fold shows performance on a broader set than the selected teaching cases.

## Regression route

1. Ask what is available before the hour. The calendar model knows the hour and whether it is a workday. The recorded rental count is available after the hour.
2. Open the 08:00 forecast for November 1, 2012. The model predicts 470 rentals, the recorded count is 680, and the residual is +210 rentals. Explain the sign before taking an absolute value or square.
3. Use the five consecutive hours to build MAE, MSE, and RMSE. Add the absolute misses and the squared misses separately. Use the adjustable prediction to see how a large individual miss changes each metric.
4. Calculate R² by comparing SSE from the fitted forecasts with SST around the observed evaluation mean. A constant prediction set to that observed mean has R² = 0. In deployment, a baseline prediction uses historical training values. Show the difference using the chronological test results.
5. Ask which metric would answer a planning question. MAE gives an average absolute miss. RMSE gives large misses extra influence. Mean residual shows direction. R² compares squared error with variability around the evaluation mean.

## Run a knowledge check

Read the visible question. Open **Show options** when the room is ready, then **What is the right answer?** after learners commit. Open **Show explanation** to work through the reason. The question and options can also be entered in a classroom polling tool.

## Python and provenance

Open either guided teaching notebook from the corresponding lesson. The combined notebook verifies the two sets of worked values. The public-data notebook refits both examples from UCI, and the preparation scripts reproduce the browser fixtures.

See [dataset attribution and licenses](THIRD_PARTY_NOTICES.md).
