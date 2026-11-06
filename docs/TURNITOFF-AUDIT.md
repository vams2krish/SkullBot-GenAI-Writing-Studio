# Detection audit and TurnitOFF format verification

## Assessment
The current product is not equivalent to QuillBot or Turnitin detection services. There is no trained AI classifier, calibrated decision threshold, held-out accuracy evaluation, web crawler, licensed academic index, or private submission corpus. Writing style analysis tests a handful of phrases and sentence patterns; source comparison measures exact normalized sequences of five or more words against one pasted source. Real calculations do not establish AI authorship or plagiarism. The sidebar labels were corrected to match this scope.

A production detection product would require an authorized source/detection provider, source-linked reports, quotation/citation handling, error and coverage reporting, plus independent evaluation on human, AI, edited, mixed, multilingual and out-of-domain texts. Access to Turnitin's proprietary corpus is not supplied by this app. No percentage from our local analysis should be compared with their reports.

## Test method and results
50 automated tests pass (32 prior tests plus 18 matrix/regression tests). TypeScript passes. Format tests feed encoded file bytes to the same processor used by the browser upload handler and inspect the resulting encoded bytes. They are complete processor-path integration tests, not proof that every format survives a real-world document corpus or has passed visual Word/LaTeX rendering.

| Area | Result |
| --- | --- |
| TXT, MD, TEX | Changed eligible prose; retained tested equations, citations, links, code fences, CRLF and quotes |
| JS, JSX, TS, TSX, MJS, CJS, PY | Parsed before/after; eligible comments changed; tested executable bytes, strings and Python docstrings retained |
| DOCX | Eligible runs changed; tags/attributes, bold markup, media, styles and document properties retained; main/header/footer/footnote/endnote parts tested |
| ZIP | Supported entries processed; unsupported binaries/nested archives retained; syntax failures reported and retained |
| Controls | Fidelity 90–100, stage switches, zero expansion, protected terms, custom-rule validation and three comment profiles tested |
| Citations | APA/IEEE/LaTeX markers; APA/IEEE/BibTeX/LaTeX/JSON exports; missing records retained/reported |
| ZipPy | Actual gzip round-trip; finite sparse/empty/long-text statistics; n-gram identity checks |
| Failure paths | Invalid UTF-8, corrupt ZIP, invalid DOCX, unsafe paths, upload size, expanded-entry and entry-count limits tested |

## Defect repaired
A protected multiword phrase split across differently formatted DOCX runs could be rewritten one run at a time. Paragraphs containing a supplied protected phrase are now conservatively skipped, even when the phrase crosses run boundaries. The regression fixture uses a bold first run and italic second run.

## Remaining limits
Only 27 bundled rules exist. This is a deterministic editing prototype, not a validated detector-evasion engine. No watermark removal, AI probability, factual equivalence, structural rewriting, proprietary database comparison or commercial-tool parity is established. Technical fidelity is an authored threshold, not learned context sensitivity. DOCX uses conservative raw-XML run editing and skips protected/complex paragraphs. These tests do not establish arbitrary DOCX/LaTeX semantic or rendering fidelity. Sources are supplied by the user; no factual source lookup occurs. PDF and code languages beyond the advertised set are unsupported for direct processing.
