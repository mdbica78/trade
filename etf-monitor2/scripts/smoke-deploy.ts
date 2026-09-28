import { runDeploySmoke } from "../lib/smoke/deploy";

runDeploySmoke(process.argv.slice(2), { fetchImpl: globalThis.fetch }).then((outcome) => {
  for (const line of outcome.lines) {
    console.log(line);
  }
  process.exitCode = outcome.exitCode;
});
