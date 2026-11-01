# Focused lesson interface verification

Verified locally on November 1, 2026.

- JavaScript syntax, factory assets/motion checks, and both mission API smoke tests passed.
- First arrival shows only the brand, part navigation, lesson title, prominent scenario and objective, and Start lesson. The factory and tools appear after Start lesson. Switching parts presents that part’s introduction. Selecting the current part preserves progress.
- Removed repeated part metadata, aggregate factory status, header tagline, persistent connection copy, footer instructions, hint link, empty counters, decorative progress pips, and the duplicate completion panel.
- The default workspace shows the factory and one current-action card. Zero progress is not repeated in the action card; useful counts appear as orders are accepted or saved. Empty queue badges are hidden. Operational status remains on the database and worker.
- Help & tools has explicitly named actions for step help, progress, factory definitions, request history, the missing-order inspector when relevant, and restart. Help, progress, definitions, and history each open a single panel beside the factory with Back to lesson.
- The progress tool retains server-defined counts and completion states. A failed direct request leaves accepted progress at zero. Queued requests advance it through 1, 2, and 3. Recovery saves those same protected orders, with completion shown once in the action card.
- Part 2 has its own introduction. Its order inspector shows the accepted-but-unsaved request. Returning to the lesson and starting the worker saves the exact reported order. The progress tool then shows 1 of 1 saved.
- Source code remains a large, independently scrolling desktop panel with 14px type alongside the factory. The page has no horizontal overflow at 1280 × 720.
- At 390 × 844, the introduction and Start lesson fit the viewport without horizontal overflow. Enter starts the lesson and opens the named help tool. Code headers clear the sticky toolbar.
- No browser console errors or warnings were observed during the walkthrough.

Previews: [opening introduction](screenshots/focused-intro.png), [clean factory workspace](screenshots/focused-workspace.png).

Production: `deployment-01M6CGARF6XRCN3Z5MSZ0SFQ8M` built and deployed successfully. The machine health check and both mission smoke tests passed. Live browser checks confirmed the prominent introduction, factory hidden until Start lesson, the simplified default action card, and absence of the removed status strip, footer, hint link, and empty progress. No console warnings or errors were observed. [Live introduction](screenshots/focused-intro-live.png), [live factory](screenshots/focused-workspace-live.png).
