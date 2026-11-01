# Macofu: first prototype brief

The current playable revision has two missions in the same factory: **Rush hour**, a dispatch puzzle built after the founder rejected both versions of the icon diagram, and **Accepted, but missing**, a follow-up investigation of one accepted order that has not reached SQLite. The second mission adds a live order journey linking receipts, correlated events, database lookups, and executing source. See [README](../README.md) for current controls and implementation boundaries. The earlier investigation concept below records the direction that led to this revision. Both missions still need founder assessment; implementation is not evidence of learning or enjoyment.

## Definition

Macofu is a visual investigation lab where developers trace real requests, experiment with backend systems, and test their understanding of what happens beyond an endpoint.

## Target user and problem

The working target is a junior backend developer who can write or find an endpoint but gets overwhelmed by unfamiliar libraries and architecture beyond it. ASP.NET is the initial environment because it matches the founder's experience. Understanding individual syntax has not supplied a connected model of the system.

## Core loop and differentiation

Encounter a mystery, inspect code and live state, predict behavior, change one operational condition, and compare the result with the prediction. The proposed distinction is connecting actual running code to visible system behavior in one recurring application. Whether this outperforms existing learning tools has not been researched or demonstrated.

## First playable scope

One missing-order investigation: a handler accepts an order, but the paused consumer has not written it to the database. The learner predicts the result, submits an HTTP request, inspects components, resumes the worker, and follows the correlated evidence into SQLite.

The prototype includes a visual component map, actual source files, live queue and database state, event logs, prediction feedback, an optional queue explanation, and reset. The time budget is a few evenings over two weeks.

## Explicit cuts

DSA, multiple worlds, multiple languages, cloud provisioning, a creator platform, multiplayer, accounts, payments, streaks, achievements, AI agents, and in-browser code editing are outside the first prototype. Several mysteries remain a possible next step after the first is useful.

## Three riskiest assumptions and proposed checks

1. **Understanding transfers.** After the first investigation, attempt a changed scenario without looking at its solution. Explain the expected HTTP response, queue state, and database state before running it. Solo testing is biased because the creator may already know the answer.
2. **Investigation is satisfying enough to repeat.** Record whether the founder voluntarily returns for another mystery and which interaction prompts that return. Later test with coworkers or friends; recruitment is deferred at the founder's request.
3. **New content is affordable.** Time the creation of a second mystery in the same system. Note which infrastructure is reused and which explanation, instrumentation, and validation work must be repeated.

These checks are proposals, not completed validation or agreed quantitative thresholds.

## Current architecture

A .NET 10 ASP.NET Minimal API hosts the UI and lab endpoints. A background service consumes an in-memory queue and writes to SQLite. The frontend polls state and displays explicit trace events and whitelisted source files. The app runs locally and shares one lab state across tabs. Reset and startup clear orders. Production hosting, user isolation, durable messaging, and cloud integrations remain undecided.

## Business possibilities

Paid investigation packs or team onboarding/training are plausible paths to explore after the experience proves useful. Neither willingness to pay nor a monetization model is established.

## Why it could fail

The map may let learners recognize an explanation without acquiring independent reasoning. The prototype may be too obvious to feel like an investigation, or too complex to avoid the original overwhelm. Bespoke content may take more work than repeat use justifies. Founder enthusiasm may not generalize.

## What would make it compelling

A learner encounters a confusing system at work, recognizes a pattern explored in Macofu, and independently chooses useful evidence to investigate. That would be stronger evidence than finishing a challenge or liking its visuals.

## Next three actions

1. Play the missing-order investigation and note where the interface either reveals too much or leaves you lost.
2. Repeat with two queued orders; write predictions before inspecting the result.
3. Pick one second mystery only after identifying what the first taught and what it failed to teach.

## Verification completed

The initial implementation builds without warnings or errors. An API smoke test verifies paused processing, accepted-but-not-yet-readable orders, eventual SQLite reads, correlated event order, batch consumption, source allowlisting, and reset. A browser walkthrough verified prediction feedback, submission, resume, database evidence, and completion feedback with no browser console errors observed. These checks verify software behavior, not learning effectiveness.

Rush hour adds tested direct-write failure during an injected outage, queued acceptance, worker pause/resume, recovery, exact order identity in the win condition, direct-write success, bounded queue capacity, and restart. Browser checks verified that one drag submits one order, the three-order challenge completes, and source inspection opens the executing routing code. Mobile navigation provides access to the full factory scene without overflowing the page.
