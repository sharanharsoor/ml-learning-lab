# Teach the Decision Tree Lab

Open the [Decision Tree Lab](https://sharanharsoor.github.io/ml-learning-lab/decision-trees/) before class. The same fictional parcel desk carries the lesson from a first prediction to split scoring, evaluation, regression, and Python. Budget about 30 minutes for the full walkthrough.

## Begin with a decision

A desk sorts each arriving parcel into **Auto (0)** or **Review (1)**. At prediction time the desk knows its weight **X** and packaging code **Y**, either A or B. The recorded disposition is the classification target. The recorded processing time in minutes becomes a separate regression target later. All rows are synthetic.

Ask learners to choose a first question using the eight training parcels. Offer “Is X at most 3.5?” and “Is Y equal to A?” Ask which question better separates the two outcomes. The first question isolates three Auto parcels. The other group contains four Review parcels and one Auto parcel. Packaging A isolates only two Auto parcels at the root.

Open the worked parcel route after the prediction prompt. Start with the root, follow the No branch for weight 7, then the Yes branch for packaging A. Point out the difference between a decision node, which asks another question, and a leaf, which returns a class.

## Turn surprise into a split score

Ask how surprised you would be to observe an outcome with probability 1, ½, or ¼.

- Inverse likelihood, $1/p$, increases as an outcome gets rarer. The base-2 logarithm gives $I(p)=\log_2(1/p)=-\log_2(p)$, so certainty is worth zero bits and those three outcomes give 0, 1, and 2 bits.
- The logarithm also makes independent surprises add. Two independent events of probability ½ each have one bit of surprise. Observing both has probability ¼ and gives two bits.
- Entropy is expected surprise. Count the frequency of each class and multiply the class's surprise by its probability, once per class. Averaging the surprise over all individual rows gives the same result. The term for an absent class contributes zero by the limit $p\log_2(p)\to 0$ as $p$ approaches zero from above. An empty child has no class distribution and is excluded as a split.

The root has four parcels per class, so its entropy is **1 bit**. At $X\leq3.5$, the children contain three and five parcels. Their entropies are **0** and **0.7219** bits. Weighting by the child sizes gives $(3/8)(0)+(5/8)(0.7219)\approx0.4512$ bits. Subtracting from the parent gives **0.5488 bits** of information gain. The packaging split gains **0.3113 bits** at the root.

Open [Gini vs. entropy](https://sharanharsoor.github.io/ml-learning-lab/decision-trees/#gini) and move from a pure node to the balanced root and then the 80% Review branch. Gini is the probability that two labels drawn with replacement differ. Gini uses squares and avoids logarithms. Score the same split with both criteria before opening the optional counterexample where the best candidate changes. Both criteria choose the same root split for the eight training parcels. The weight split gives weighted child Gini **0.2** and reduction **0.3**. The scores have different meanings and scales.

For an exact numeric search, sort the distinct weights and test a midpoint between each adjacent pair. All cutoffs in the same gap partition these training rows identically. A histogram search groups values into bins and scores eligible bin boundaries. It can miss a better cut inside a bin. For packaging A/B, the one grouping divides A from B.

## Grow the tree and check new parcels

Follow the five parcels with $X>3.5$. Ask whether packaging becomes useful here even though it lost at the root. In this branch, A sends the remaining Auto parcel to one child and B sends all four Review parcels to the other. The left branch of the root was already pure. Select the internal node to compare its weighted child score and local gain. Change the depth between one split and two levels to show when another question is allowed. Trace H5 from the matrix to show that 100% Auto in a leaf may represent just one training row.

Evaluate on the six held-out parcels. With Review as the positive class, the two-level tree gives **TN 2, FP 1, FN 1, TP 2**. A Review parcel at $X=6$, $Y=A$ is missed. An Auto parcel at $X=7$, $Y=B$ is flagged. Ask which kind of mistake matters more at this desk before moving to the [metrics playground](https://sharanharsoor.github.io/ml-learning-lab/classification-regression-metrics/) in a later lesson.

## Decide where to stop

Open [Where to stop](https://sharanharsoor.github.io/ml-learning-lab/decision-trees/#stopping). Compare the same training and held-out parcels at each depth.

- **Depth 0:** One leaf predicts Auto by the lab's tie rule. Training accuracy is **4/8**, and held-out accuracy is **3/6**. A single class for every parcel misses useful structure.
- **Depth 1:** The weight question raises training accuracy to **7/8** and held-out accuracy to **5/6**. Its held-out matrix is **TN 2, FP 1, FN 0, TP 3**.
- **Depth 2:** The extra packaging question gives **8/8** on training and **4/6** on held-out parcels. The perfectly pure one-row leaf illustrates how a more detailed rule can fit the training set and still do worse on new cases.

In class, ask what a minimum of two rows per leaf would do to that packaging split. A depth limit, minimum leaf size, or required improvement can stop growth early. Pruning starts with a larger tree and cuts back weak branches. These six parcels illustrate the tradeoff. If learners use their scores to choose depth or pruning, those parcels serve as validation data. Reserve an independent test set for the final evaluation.

## Give each feature credit

An impurity-based importance score asks how much each feature reduced impurity across the original training set. Choose a training parcel at random. A split low in the tree improves the score only for the fraction of parcels that reach its node. A node with $n$ out of $N$ training rows therefore contributes $(n/N)$ times its local improvement. Credit that value to the feature used at the node and add all its contributions.

For the two-level entropy tree, X gets $(8/8)(1-0.4512)\approx\mathbf{0.5488}$ bits. Y gets $(5/8)(0.7219-0)\approx\mathbf{0.4512}$ bits. When the gains are added, the impurity of each intermediate node cancels against its contribution to its parent's child score. The total is root impurity minus the root-weighted impurity of the leaves. Here the leaves are pure, so the total is $1-0=1$ bit. Divide each feature's credit by the total gain to get **54.88% X** and **45.12% Y**. Those percentages describe the tree's training impurity reduction.

## Predict minutes and run the code

Switch the target to processing time. Each leaf predicts the mean of the minutes it contains. For any constant guess $c$, its MSE equals the MSE at the mean plus $(c-\bar y)^2$. Guessing the mean makes that extra term zero.

The root predicts **5 minutes** with MSE **7 minutes²**. At the same root cut, the two child predictions are **2** and **6.8 minutes**. The child errors are **0** and **2.56 minutes²**, so the weighted error is $(3/8)(0)+(5/8)(2.56)=\mathbf{1.6}$ minutes². The reduction is **5.4 minutes²**. Keep the weight question visible while changing the target so learners can see that the partition stays the same and the score and predictions change.

Apply the same stopping controls to regression. A deeper tree can keep reducing training MSE by producing averages for smaller groups. Compare validation MSE or RMSE across depths before choosing one. The six held-out parcels have routing labels only, so they cannot measure processing-time error.

Run the embedded Python example after learners have predicted its output. Compare the printed gains, held-out matrix, and weighted regression error with the browser view. Load the in-browser Python runtime before presenting if you plan to execute the code live.
