# SkullBot feature release — November 5, 2026

## Implemented
- SkullBot Chat is the first sidebar tool: multi-turn Markdown answers, copy/regenerate, stop/retry, optional device storage and new chat. OpenRouter credentials remain server-side. Answers do not browse the web; verify factual claims and sources.
- Red wavy spelling/grammar marks with local English dictionary, basic grammar rules, replacement suggestions, and ignore controls. The dictionary ships with its license. This is a local proofreading aid, not a comprehensive grammar model.
- TurnitOFF v1.0.0 runs locally with **27 inspectable literal rules**, authored fidelity thresholds, zero-expansion mode (word count cannot increase), user-protected terms, validated custom JSON rules, protected spans and change logs. Rules (local) is also available under Humanizer.
- Separate citation engine resolves explicit source markers against supplied records and exports APA/IEEE templates, BibTeX, LaTeX and JSON. Five hierarchical subject taxonomies organize sources; they do not locate or verify evidence.
- ZipPy shows actual gzip size, UTF-8 byte Shannon entropy, sentence length/variation, and original/output 3–5-gram Jaccard overlap. These measurements are not model perplexity, AI probabilities, plagiarism scores or detector predictions.
- TXT/Markdown/LaTeX, DOCX and mixed ZIP processing. JavaScript/TypeScript and Python use parsers to identify eligible comments. Executable bytes, strings, Python docstrings, compiler/tool directives and unsupported entries stay unchanged. Three comment profiles adjust the fidelity threshold; they do not generate new comments.
- DOCX processing replaces eligible run text while checking raw XML tags/attributes and retaining all other package content. Paragraphs containing complex protected structures are skipped conservatively. ZIP limits: 10 MB upload, 500 entries, 20 MB per expanded entry and 50 MB total.

## Scope and limits
No external architecture documents or 4,000-rule catalog were supplied. The exact implemented rules and taxonomy can be downloaded in the app and inspected in source. Voice conversion, dependency-tree rewriting, sentence fusion/splitting, general language AST support, LZMA, automatic contextual source discovery, FastAPI and a mirrored availability cluster are not implemented. Metadata is retained, including provenance; watermark removal and detector/plagiarism evasion are not verified or promised. Facts and meaning still require human review after any linguistic edit.

## Validation
32 automated tests passed, covering prior tools and the new deterministic engine, mask integrity, numeric/newline preservation, custom-rule validation, code/docstring preservation, DOCX package fidelity, mixed ZIP preservation/failures/path limits, citation exports, metrics, proofreading ranges, and chat schema limits. TypeScript checking passed. Targeted source lint passed with warnings; the repository-wide lint command also traverses generated artifacts and is not a clean release gate.

Browser checks used the student leadership/Yin assignment, equations, citations, executable code, synthetic bibliography records and a seven-file academic project ZIP. Verified: chat generation and contextual follow-up, saved conversation restoration, red squiggles and replacement, local Humanizer, protected terms and math, citation marker resolution, invalid-rule errors, four metric cards, and ZIP per-file audit. Initial follow-up/citation checks had automation timing/selection errors and were rerun successfully. A blob download event did not resolve in browser automation; export serialization/package integrity is covered by automated tests, but that download was not independently verified through the browser. Mobile chat had no horizontal overflow at the tested compact viewport.

The recording is controlled through Recordly; its final export status is reported separately.
