import { BVBService } from "../lib/bvb";
import { PDFService } from "../lib/pdf";

async function main() {
    const bvb = new BVBService();
    const pdf = new PDFService();

    const report = await bvb.getLatestReport("BTBETRETF");

    if (!report) throw new Error("Report not found");

    const buffer = await bvb.downloadReport(report);

    const text = await pdf.parse(buffer);

    console.log(text.substring(0, 3000));


    const text2 = await pdf.parse(buffer);

    const units = pdf.extractUnitsInCirculation(text2);

    console.log(units);
}

main().catch(console.error);
