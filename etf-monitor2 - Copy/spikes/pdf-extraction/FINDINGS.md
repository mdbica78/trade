# US-001 findings — PDF text extraction from BRD depositary reports

Fixtures used (committed under `test/fixtures/`): `BTBETRETF-2026-09-21.pdf`, `TVBETETF-2026-09-21.pdf`, `PTENGETF-2026-09-21.pdf` — real reports downloaded from the "Stiri" tab of each instrument's bvb.ro page. All three are 1-page, vector-text PDFs (confirmed by `file`), not scans.

## Result: text is directly extractable, no OCR needed

All three candidate libraries produce full, correct text from all three fixtures. **No OCR is required.**

## Per-library results

### unpdf — works
Runs cleanly against all three fixtures via `getDocumentProxy` + `extractText({ mergePages: true })`. Returns one flattened string with single spaces between tokens (loses original line breaks). Every target field is present and locatable by its label string. Excerpt (BTBETRETF):
```
...ACTIV NET (in valuta clasa UF - RON) 415,591,664.27 ACTIV NET (in valuta fond - RON) 415,591,664.27
NUMAR U.F. in circulatie, din care detinute de: 37,470,000 Persoane fizice 29,733,778 Persoane juridice 7,736,222
11.091 Numar investitori, din care: 18,708 Persoane fizice 18,631 Persoane juridice 77...
```
Emits a harmless `Warning: TT: undefined function: 32` (font hint warning) to stderr on every file; does not affect output.

### pdf-parse — works
`pdfParse(buffer)` → `data.text`. Preserves the original line breaks (each label and most values land on their own line rather than being run together), which is easier to parse reliably than unpdf's flattened output. All target fields present. Excerpt (BTBETRETF):
```
ACTIV NET (in valuta clasa UF - RON)415,591,664.27
ACTIV NET (in valuta fond - RON)415,591,664.27
NUMAR U.F. in circulatie, din care detinute de:37,470,000
          Persoane fizice29,733,778
          Persoane juridice7,736,222
11.091
Numar investitori, din care:18,708
```
Same stderr font warning as unpdf (same underlying pdf.js lineage).

### pdfjs-dist — works, but only in isolation (trap)
Using `getDocument` + `page.getTextContent()` (joining `item.str` with spaces) extracts every field correctly when pdfjs-dist is the only PDF library loaded in the process. **Trap found**: if `unpdf` is imported first in the same Node process, pdfjs-dist then throws `The API version "4.10.38" does not match the Worker version "4.3.136"` on `getDocument()` — unpdf bundles its own pinned copy of pdf.js and the two collide via a shared global. This only matters if a future adapter tries to use more than one of these libraries in the same process; using pdfjs-dist alone is unaffected. Excerpt (BTBETRETF, isolated run):
```
BT Index România ETF BET–TR  Decizie autorizare: 255/06.08.2008 ... ACTIV NET (in valuta clasa UF - RON) 415,591,664.27 ...
```

## Number formatting (AC5)

- **Thousands separator: comma (`,`)**. **Decimal separator: dot (`.`)**. Consistent across all three issuers/fixtures and all fields (e.g. `415,591,664.27`, `37,470,000`, `1,517,663,423.87`).
- Some UF-in-circulation and holder-breakdown figures carry two decimals in some reports (`8,640,000.00`) and none in others (`37,470,000`) — the parser must not assume a fixed decimal count, just split on the last `.` when present.
- VUAN (unit value) is a small number with no thousands separator in these samples (`11.091`, `14.8856`, `54.1373`) — decimal-only, variable precision.
- No currency symbols or spaces inside numbers; RON is stated once in the header/footer, not per-value.

## Other traps found

1. **VUAN's label and its value are far apart in the raw text.** The value (e.g. `11.091`) appears inline right after the `Persoane juridice` sub-value of "NUMAR U.F. in circulatie", **before** "Numar investitori, din care:" — while the label `VALOARE UNITARA A ACTIVULUI NET (VUAN) (RON)` itself appears much later, near the signature block at the end of the document. An adapter must not assume label-then-value-on-same-line for this field; it needs a positional rule (the number between the UF/holder block and "Numar investitori").
2. **Two different dates appear in the header/footer that must not be confused**: a filing/submission timestamp near the top (`16426/22.09.2026` — BVB's own receipt stamp) and the actual report date in the footer line `Raport depozitar la data de 21.09.2026 in valuta RON`. The report date (AC's target) is the footer one, one day behind the filing stamp.
3. Sub-labels (`Persoane fizice`, `Persoane juridice`) are indented with leading whitespace in pdf-parse's line-preserving output but not distinguishable that way in unpdf's flattened output — positional order (label immediately before its number) is the only reliable anchor in both.

## Recommendation

**Use `unpdf`.** It is actively maintained, purpose-built for serverless/edge runtimes (no filesystem worker file to configure, unlike pdfjs-dist, which needs care in a Vercel serverless function), and its flattened single-string output is sufficient since the production parser will match on label text and positional order, not line structure. `pdf-parse` is a solid fallback (better preserves line breaks, which could simplify future adapters) but is effectively unmaintained upstream. Avoid mixing `unpdf` and `pdfjs-dist` in the same process (see trap above) — pick one.

**OCR: not needed.** All three report templates (BRD depositary format, covering BTBETRETF/TVBETETF/PTENGETF) are vector-text PDFs with 100% of target fields extractable as plain text.
