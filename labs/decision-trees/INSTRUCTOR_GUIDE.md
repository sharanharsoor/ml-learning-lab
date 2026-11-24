# Teach the Decision Tree Lab

Open the [Decision Tree Lab](https://sharanharsoor.github.io/ml-learning-lab/decision-trees/) before class. The same fictional parcel desk carries the lesson from a first prediction to split scoring, evaluation, regression, and Python. Budget about 30 minutes for the full walkthrough.

## Begin with a decision

A desk sorts each arriving parcel into **Auto (0)** or **Review (1)**. At prediction time the desk knows its weight **X** and packaging code **Y**, either A or B. The recorded disposition is the classification target. The recorded processing time in minutes becomes a separate regression target later. All rows are synthetic.

Ask learners to choose a first question using the eight training parcels. Offer “Is X at most 3.5?” and “Is Y equal to A?” Ask which question better separates the two outcomes. The first question isolates three Auto parcels. The other group contains four Review parcels and one Auto parcel. Packaging A isolates only two Auto parcels at the root.

## Turn surprise into a split score

Ask how surprised you would be to observe an outcome with probability 1, ½, or ¼.

- Inverse likelihood, $1/p$, increases as an outcome gets rarer. The base-2 logarithm gives $I(p)=\log_2(1/p)=-\log_2(p)$, so certainty is worth zero bits and those three outcomes give 0, 1, and 2 bits.
- The logarithm also makes independent surprises add. Two independent events of probability ½ each have one bit of surprise. Observing both has probability ¼ and gives two bits.
- Entropy is expected surprise. Count the frequency of each class and multiply the class's surprise by its probability, once per class. Averaging the surprise over all individual rows gives the same result. The term for an absent class contributes zero by the limit $p\log_2(p)\to 0$ as $p$ approaches zero from above. An empty child has no class distribution and is excluded as a split.

The root has four parcels per class, so its entropy is **1 bit**. At $X\leq3.5$, the children contain three and five parcels. Their entropies are **0** and **0.7219** bits. Weighting by the child sizes gives $(3/8)(0)+(5/8)(0.7219)\approx0.4512$ bits. Subtracting from the parent gives **0.5488 bits** of information gain. The packaging split gains **0.3113 bits** at the root.

Switch to Gini and keep the groups fixed. Gini is the probability that two independent labels drawn from the node differ. The root has Gini **0.5**, and the weight split gives weighted child Gini **0.2** and reduction **0.3**. Both criteria choose the same root split here. The scores have different meanings and scales.

For an exact numeric search, sort the distinct weights and test a midpoint between each adjacent pair. All cutoffs in the same gap partition these training rows identically. A histogram search groups values into bins and scores eligible bin boundaries. It can miss a better cut inside a bin. For packaging A/B, the one grouping divides A from B.

## Grow the tree and check new parcels

Follow the five parcels with $X>3.5$. Ask whether packaging becomes useful here even though it lost at the root. In this branch, A sends the remaining Auto parcel to one child and B sends all four Review parcels to the other. The left branch of the root was already pure. Change the depth between one split and two levels to show when another question is allowed.

Evaluate on the six held-out parcels. With Review as the positive class, the two-level tree gives **TN 2, FP 1, FN 1, TP 2** and accuracy **4/6**. A Review parcel at $X=6$, $Y=A$ is missed. An Auto parcel at $X=7$, $Y=B$ is flagged. The stump gives **TN 2, FP 1, FN 0, TP 3** and accuracy **5/6**. The deeper tree fits the training labels better and scores lower on this small held-out set. Ask which kind of mistake matters more at this desk before moving to the [metrics playground](https://sharanharsoor.github.io/ml-learning-lab/classification-regression-metrics/) in a later lesson.

## Give each feature credit

An impurity-based importance score adds the gains at a feature's splits, weighting each local gain by the fraction of training rows that reached that node. For the two-level entropy tree, X gets **0.5488** at the root. Y gets $(5/8)(0.7219)\approx0.4512$ on the right. These sum to 1 bit, so the normalized shares are **54.88% X** and **45.12% Y**. Ask what would happen if the Y split handled fewer parcels with the same local gain. The shares describe how this fitted tree reduced training impurity.

## Predict minutes and run the code

Switch the target to processing time. Each leaf now predicts the mean of the minutes it contains. The root predicts **5 minutes** and its mean squared error is **7 minutes²**. At the same root cut, the two means are **2** and **6.8 minutes**. The child errors are **0** and **2.56 minutes²**, so the weighted error is **1.6 minutes²** and the reduction is **5.4 minutes²**. Keep the weight question visible while changing the target so learners can see that the partition stays the same and the score and predictions change.

Run the embedded Python example after learners have predicted its output. Compare the printed gains, held-out matrix, and weighted regression error with the browser view. Load the in-browser Python runtime before presenting if you plan to execute the code live.
