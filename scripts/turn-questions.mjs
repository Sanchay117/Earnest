// Prints the planning questions from an Arc Studio needs_input result. Usage: node scripts/turn-questions.mjs logs/turnN.json
import { readFileSync } from "node:fs";

const d = JSON.parse(readFileSync(process.argv[2], "utf8"));
console.log(JSON.stringify(d.questions, null, 2));
