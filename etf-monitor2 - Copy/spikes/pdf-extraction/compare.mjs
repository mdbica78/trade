// US-001 spike: compare candidate PDF text-extraction libraries against real
// BRD depositary report fixtures. Prints extracted text per library/fixture;
// findings are written by hand into FINDINGS.md from this output.
import { readFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "..", "..", "test", "fixtures");
const fixtures = readdirSync(fixturesDir).filter((f) => f.endsWith(".pdf"));

const libraries = {
  async unpdf(buf) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const doc = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(doc, { mergePages: true });
    return text;
  },
  async "pdf-parse"(buf) {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buf);
    return data.text;
  },
  async "pdfjs-dist"(buf) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    let text = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it) => it.str).join(" ") + "\n";
    }
    return text;
  },
};

for (const fixture of fixtures) {
  const buf = await readFile(path.join(fixturesDir, fixture));
  console.log(`\n${"=".repeat(80)}\nFIXTURE: ${fixture}\n${"=".repeat(80)}`);
  for (const [name, run] of Object.entries(libraries)) {
    console.log(`\n--- ${name} ---`);
    try {
      const text = await run(buf);
      console.log(text);
    } catch (err) {
      console.log(`CRASHED: ${err?.stack || err}`);
    }
  }
}
