import { BVBService } from "../lib/bvb";

async function main() {
  const service = new BVBService();

  const etfs = await service.getEtfs();

  console.table(etfs);
  console.log(`Count: ${etfs.length}`);
}

main().catch(console.error);
