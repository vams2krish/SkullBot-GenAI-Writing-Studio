# SkullBot product verification report

Test date: November 5, 2026 (America/Los_Angeles).

## Outcome

The private writing workspace was tested with the supplied cross-cultural leadership assignment, a synthetic 2,836-word Mandela research-plan draft (21,253 characters), planted grammar errors, controlled source matches, and valid/invalid documents. The sample explicitly states that no empirical research was conducted. This is a feature verification exercise, not a submitted assignment or a benchmark of scholarly accuracy.

The baseline exposed defects. The fixes below were implemented and regression-tested. The app remains an editing and formatting workspace: it cannot independently complete the full academic assignment, establish AI authorship, or search a plagiarism corpus.

## Coverage

| Feature              | Tests and evidence                                                                                         | Final result                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Paraphraser          | All seven modes submitted through the live UI; supplied assignment also tested as editing input            | Passed workflow; output quality still requires human review                               |
| Rewrite intensity    | UI endpoints 0 and 100; normalization, invalid values, bounds                                              | Passed after fixing zero being treated as 50                                              |
| Grammar              | Planted tense, agreement, capitalization, spelling and repetition errors; citation retained                | Passed                                                                                    |
| Humanizer            | Basic and Advanced submissions                                                                             | Passed workflow; Advanced left one already formal passage essentially unchanged           |
| Summarizer           | All four modes using the same 2,836-word draft; word counts measured                                       | Passed after enforcing length bounds and an explicitly labeled extractive fallback        |
| Detector             | Sentence markers, mixed flagged/unflagged sentences, no probability or authorship claim                    | Passed current experimental behavior; classifier accuracy not applicable                  |
| Source comparison    | Identical text 100%, unrelated text 0%, short snippets, source validation                                  | Passed; only supplied sources compared                                                    |
| TXT/DOCX/PDF import  | Long draft imported through native file picker; DOCX import included cover/reference content               | Passed                                                                                    |
| Import rejection     | Unsupported CSV, >10 MB, >25,000 characters, corrupt DOCX, no-text PDF, 101-page PDF                       | Passed; existing draft retained                                                           |
| Citation templates   | Webpage/group author, book/single author, synthetic journal/three authors; year/URL errors                 | Passed after APA punctuation/site-name fixes                                              |
| Citation library     | Alphabetical order, in-text forms, copy all, remove synthetic source                                       | Passed                                                                                    |
| Student APA          | Missing-field validation, long-body preview, actual browser DOCX download                                  | Passed workflow and structural checks                                                     |
| Professional APA     | Running head, author note, preview, actual browser DOCX download                                           | Passed after header alignment and server validation fixes                                 |
| Copy/download/reuse  | Clipboard exact match, saved TXT file exact match, use result as draft                                     | Passed; native TXT download event was not emitted, but the actual saved file was verified |
| Saved workspace      | Reload persistence, saving disabled, recent result restoration, cap of 20, clear synthetic activity        | Passed                                                                                    |
| UI states            | Example, empty submit disabled, clear/new draft, About disclosures, Escape dialog close                    | Passed                                                                                    |
| In-flight edits      | Edited input and changed tools while a request was running                                                 | Late response did not overwrite the new draft                                             |
| Responsive layout    | 390 × 844 phone and 768 × 1024 tablet; menu/tool switching and overflow                                    | Passed                                                                                    |
| API input validation | 16 checks for malformed/empty/oversized requests, invalid selections, comparisons and detector uncertainty | 16 passed                                                                                 |
| Export validation    | Required fields, running-head limit, supported and complete citations, body/source count limits            | 9 passed after repair                                                                     |
| Regression suite     | Focused algorithm, response-quality and paper-schema tests                                                 | 16 passed                                                                                 |

Baseline browser observations and full input/output evidence are retained locally under `outputs/qa-2026-11-05`, which is ignored by Git. They include the initial failures as well as follow-up results; they have not been rewritten into an all-pass baseline. Student fixtures and recordings are not published in this repository.

## Summary-length regression

| Mode     | Input words | Target | Final output words | Method                      |
| -------- | ----------: | -----: | -----------------: | --------------------------- |
| Short    |       2,836 |    567 |                558 | AI-assisted                 |
| Medium   |       2,836 |  1,134 |              1,128 | Labeled extractive fallback |
| Long     |       2,836 |  1,702 |              1,702 | Labeled extractive fallback |
| Detailed |       2,836 |  2,269 |              2,269 | Labeled extractive fallback |

These are individual test runs, not quality or latency guarantees. The provider can ignore length instructions. SkullBot now checks the returned word count: output outside 80–115% of the target, or truncated summaries, triggers a summary built from intact original sentences. The result is explicitly labeled rather than represented as AI-generated text. Whole-sentence extraction can exceed a small target when a document contains only one long sentence.

## Repairs

1. Preserve an intensity of zero, clamp bounds, and invalidate an existing result when the slider changes.
2. Add explicit summary word targets and post-response length validation. Preserve whole original sentences in a labeled fallback; avoid splitting abbreviations with a naive punctuation expression.
3. Reject truncated, blank, and malformed model output instead of showing it as a completed rewrite.
4. Omit a website name when it is identical to the group author, consistently across preview, clipboard, and DOCX.
5. Correct journal/volume punctuation in plain-text references.
6. Replace raw ZIP/module-loader errors with actionable import messages, including a refresh instruction for an older open tab after deployment.
7. Validate required student/professional metadata, source types and running-head length on the export server, not only in the browser form.
8. Set the professional running head flush left with a right tab stop for the page number.

## DOCX checks

Both student and professional exports passed these ten structural checks: one-inch margins, Letter dimensions, Times New Roman 12 pt, double spacing, header page field, unchanged body paragraphs, separate body/reference starts, three hanging reference indents, correct header alignment, and no duplicated group-author website name. The browser-produced baseline exports and repaired server exports are retained locally for inspection.

Visual Word pagination, page count, heading layout and rendering fidelity are **not verified**. The packaged renderer was attempted and reported `LibreOffice soffice.exe was not found on PATH`. Structural checks are not a substitute for opening the paper in Word or LibreOffice.

## Remaining limitations relevant to the assignment

- There is no abstract field or automatic APA heading hierarchy. The rubric's complete manuscript cannot be generated and graded by the existing formatter alone.
- In-text citations and reference entries are not automatically matched or validated against actual publications. Quotation locators, editions and complex APA cases require manual checking.
- The detector is an explicitly labeled style-marker demonstration, not a trained AI classifier. No false-positive, calibration or authorship accuracy claim was tested or established.
- Comparison is normalized exact overlap against one supplied source; there is no web, journal or institutional corpus search.
- The app edits submitted writing; it does not conduct Yin-style research, collect evidence or produce verified scholarship from an assignment prompt.
- Public multi-user abuse controls, billing and cross-device synchronization are outside the current private product.
- The live provider's invalid-key, exhausted-credit and rate-limit paths were reviewed in code; account credentials or balance were not deliberately changed to force them. Provider-result failure handling has focused regression coverage.
- Language quality is probabilistic. This session verifies flows, preservation checks and explicit output constraints, not universal semantic accuracy or academic suitability.

## Recording and local evidence

Recordly recorded the visible test session with microphone/webcam disabled. The recording includes successful operations, initial failures, diagnosis and retests; it is not edited to hide failures. The recording/export location and final playback check are provided in the chat handoff. Raw test fixtures, exports, screenshots, API outcomes and summary outputs are in the local QA evidence directory.

## Source context for the synthetic fixture

The limited biographical starting point was checked against the [Nelson Mandela Foundation](https://www.nelsonmandela.org/the-life-and-times-of-nelson-mandela). The research-method context was checked against [SAGE's Yin companion resources](https://study.sagepub.com/yin6e). Most fixture content is original proposed research procedure; it is not a completed or validated case study.
