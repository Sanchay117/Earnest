Lint turn: clear the six require-await errors in src/components/CheatPage.tsx. No new features.

oxlint reports "Function has no 'await' expression" at lines 90, 130, 156, 167, 181 and 194. Each is an attack's
prepare function written as `async () => ({ ... })` that returns a fixed call and awaits nothing. The attached
src/components/CheatPage.tsx replaces the file at that path: those six now read `() => Promise.resolve({ ... })`,
which still returns Promise<PreparedCall> as the Attack interface requires. Nothing else in the file changed.
Keep it exactly as attached; do not reformat or rewrite it.

Then check, without deploying anything and without sending any transaction:
1. bun run check passes (lint and typecheck).
2. The app builds (vite build).
Report the results in two lines. Do not change any other file.
