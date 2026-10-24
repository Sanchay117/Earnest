Sync turn: an app icon, a Budget field fix, and job 5 in the evidence. No new features.

Since the last turn, agent #2730 was hired on Arc mainnet through the live app's Hire page by a wallet outside the
demo (job 5). The job was funded and completed in the app, and Earnest wrote the second paid review. Every
transaction is now in public/evidence/mainnet.json.

The attached files replace or add the ones at the same paths. Keep them exactly as attached; do not reformat or
rewrite them. What they change:

- public/favicon.svg, public/favicon-32.png, public/apple-touch-icon.png: the Earnest logo (a rating star inside
  a coin). The app had no icon, so browsers and wallets showed a placeholder.
- index.html: links those icons and sets theme-color. Nothing else changed.
- src/components/HirePage.tsx: the Budget field's min goes from 0.000001 to 0.01. With step 0.01, the old min
  made the arrows produce values like 0.050001. Nothing else changed.
- public/evidence/mainnet.json: the job 5 transactions, rows marked (live app).
- AGENTS.md: notes that job 5 was hired through the live app.

Then check, without deploying anything and without sending any transaction:
1. bun run check passes (lint and typecheck).
2. The app builds (vite build) and dist/ contains the three icon files.
Report the results in two lines. Do not change any other file.
