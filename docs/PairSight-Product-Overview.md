# PairSight

**A second look at every match.**

## What is PairSight?

PairSight helps businesses evaluate and compare the results produced by entity-resolution tools. These tools identify records that belong to the same person, company, or product, even when the details differ.

Users upload their original records and the matching results from one or more tools. PairSight uses Jev to assess whether records appear to represent the same entity, compares those judgments with each tool’s results, and highlights potential incorrect matches and missed duplicates.

The result is a comparison supported by record-level evidence, estimated quality scores, and a review workspace where users can check questionable decisions.

This document describes the planned product. The first release focuses on customer/person records and small datasets; broader entity types and larger-scale evaluation are later extensions.

## The problem we solve

A business testing several matching tools can receive very different results from each one. One tool might find more duplicates but incorrectly combine different people. Another might be cautious and leave genuine duplicates unmatched.

The number of matches alone does not reveal which tool did a better job. To assess quality, customers must examine matched records and investigate duplicates the tools missed. That review can become repetitive and difficult to compare consistently across vendors.

PairSight automates an initial assessment and gives users a focused way to inspect the findings. Its purpose is to reduce review effort and help customers make a more informed choice.

## A practical use case

A retailer wants to consolidate customer records before moving to a new CRM. It tests two matching tools on the same customer list.

Tool A combines two family members because they share a phone number and address. Tool B keeps them separate but misses another customer whose name is misspelled in one record.

PairSight checks the available identity information, flags the family-member match as questionable, and identifies the misspelled-name pair as a potential missed duplicate. The retailer can inspect both examples and compare the tools’ overall results against the same AI-generated reference.

## What users provide

- **Original records:** a file containing the records included in the vendor evaluation, with a unique reference for each record.
- **Matching results:** an export identifying which records each vendor matched together, using pair IDs or group IDs and references back to the original records.
- **Matching intent:** a definition of what counts as the same entity, plus relevant context such as country and important identity fields.

The original file matters because matched results alone cannot reveal duplicates that a vendor never matched. Each vendor should have evaluated the same records and the same matching objective for a fair comparison.

## How PairSight works

PairSight creates one shared collection of record pairs to review. Jev assesses each pair using the available record details and the user’s definition of identity. PairSight then compares each vendor’s decisions against those assessments.

In v1, users define blocking rules that create overlapping candidate buckets, such as shared email, shared phone, or name and location. PairSight compares records within these buckets to reduce unnecessary comparisons. A record can belong to several buckets. These buckets identify pairs worth checking; they do not declare the records to be duplicates.

Every vendor-predicted match is included in the review, even if it falls outside the suggested buckets. Blocked candidates and all vendor-matched pairs are combined into one comparison set. Duplicate and reversed pairs are collapsed, and self-pairs are excluded. The same pair is assessed once per evaluation configuration and reused across vendors. Vendor names and match scores should not influence Jev’s identity judgment.

## The user journey

### 1. Discover PairSight

The landing page explains the problem and offers two actions: **Start evaluation** or **Try demo**. The demo uses fictional records and prepared vendor results so visitors can explore the experience immediately.

### 2. Create an evaluation

The user names the evaluation, for example “CRM migration vendor comparison.” An account allows them to save their work and return to previous evaluations.

### 3. Upload original records

The user uploads a CSV and previews its contents. They identify the unique record reference and map fields such as name, email, phone, date of birth, and address. PairSight checks for missing or repeated record references and explains any issues before continuing.

### 4. Add matching results

The user uploads a vendor’s export and gives it a recognizable name. They identify the columns containing record references and match pair or group information. PairSight checks that the matched records exist in the original file. The user can add more vendor results or audit a single tool.

### 5. Define what a match means

The user specifies the identity objective. For the initial customer-record release, this means the same individual, rather than the same household or employer. They can add context, such as how local phone numbers should be interpreted or which fields are especially important.

### 6. Define blocking rules and review the comparison plan

The user defines candidate rules using the mapped identity fields. PairSight builds overlapping buckets and shows the record count, vendors, unique candidate-pair count, and reduction compared with every possible pair. It also shows vendor-matched pairs added outside the blocking rules. Large buckets and group exports that expand into many pairs are flagged before evaluation starts. Pairs excluded by blocking remain unassessed unless a vendor matched them.

### 7. Run the evaluation

The user starts the assessment and sees progress as pairs are reviewed. Jev assesses whether each pair represents the same entity. Its supported output and score meaning must be verified during integration; where a same-entity score is available, PairSight applies a consistent decision threshold and compares the resulting judgments with each vendor’s output. Failed assessments remain visibly incomplete rather than being treated as nonmatches.

### 8. Compare results

The core v1 comparator places each successfully evaluated pair into one category per vendor:

| Result          | Meaning                                                     |
| --------------- | ----------------------------------------------------------- |
| Both matched    | Vendor and PairSight classify the pair as a match.          |
| PairSight only  | A potential duplicate the vendor missed.                    |
| Vendor only     | A potential incorrect vendor match, or a PairSight mistake. |
| Neither matched | Both classify an evaluated pair as different entities.      |

These categories show agreement, not proven correctness. Pending or failed assessments remain incomplete and are excluded from these categories.

The dashboard presents vendors side by side, with estimated precision, recall, and F1 where the evaluation coverage supports those measures. It also shows potential incorrect matches, potential missed duplicates, uncertain judgments, and how many pairs were assessed.

The comparison helps users understand the tradeoff between finding duplicates and avoiding incorrect merges. It assesses the submitted matching results; pricing, integrations, security, and other purchasing factors remain separate considerations.

### 9. Inspect and correct findings

The user opens a pair to view both records side by side, the vendor decision, and Jev’s score. They can filter disagreements and uncertain cases, then mark a pair as **same entity**, **different entities**, or **unsure**. Human decisions are recorded separately from AI judgments, and the comparison updates where applicable.

### 10. Export and return

The user downloads a comparison summary and a CSV of findings for further review or discussion with vendors. The report records the identity definition, evaluation scope, decision threshold, and extent of human review so the scores retain their context. Saved evaluations remain available to revisit.

## Understanding the scores

| Measure   | Plain-language meaning                                                                           |
| --------- | ------------------------------------------------------------------------------------------------ |
| Precision | Of the pairs a vendor matched, how many does the reference assessment agree are the same entity? |
| Recall    | Of the duplicate pairs identified by the reference assessment, how many did the vendor find?     |
| F1        | A combined measure of precision and recall.                                                      |

When Jev supplies the reference judgments, these are **AI-estimated measures**, not verified real-world accuracy. Reviewing every pair improves coverage but does not make AI judgments infallible.

When blocking excludes pairs, genuine duplicates outside the reviewed set can remain unseen. Recall and F1 must therefore be labeled as applying to the evaluated candidate set unless a suitable sampling method accounts for excluded pairs. Dataset-wide claims should not be made from candidate-only review.

Independent, verified identity labels can provide a ground-truth reference. Correcting only the flagged pairs improves the assessment but does not establish complete ground truth for the dataset.

## Features and release scope

The confirmed v1 is a complete loop:

1. Upload source records and vendor results, then map references and identity fields.
2. Define identity and overlapping blocking rules.
3. Combine blocked candidates with every vendor-matched pair and remove duplicates.
4. Evaluate unique pairs with Jev and apply a consistent decision threshold.
5. Compare vendor and PairSight decisions using the four result categories and inspect the underlying records.

V1 focuses on customer/person records and small datasets. Supported import formats, size limits, blocking operators, Jev output handling, and threshold behavior will be specified in the implementation plan.

The wider user journey above also describes fictional demo data, saved evaluations, human corrections, estimated quality metrics, and exports. Their delivery order and inclusion in the initial v1 must be decided during planning rather than assumed from this overview.

Later extensions include companies and products, larger-scale processing, more vendor-specific formats, sampling of excluded pairs, and verified-reference uploads for ground-truth scoring.

## What success looks like

Users should leave with a clearer understanding of where each matching tool performed well, where its results deserve investigation, and which tradeoffs matter for their data.

PairSight’s practical value is faster initial review, consistent comparisons, and an organized path to human validation. Reducing manual pair review by 80% is an early target to test, not an established result or a promise to customers.
