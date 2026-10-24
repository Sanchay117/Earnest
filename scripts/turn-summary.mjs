// Prints the useful parts of an Arc Studio result document. Usage: node scripts/turn-summary.mjs logs/turnN.json
import { readFileSync } from "node:fs";

const d = JSON.parse(readFileSync(process.argv[2], "utf8"));
console.log("status", d.status, "app", d.appId);
console.log("files", d.filesChanged);
console.log("deployments", JSON.stringify(d.deployments, null, 1));
console.log("---finalText (tail)---");
console.log((d.finalText ?? "").slice(-5000));
