# Macofu discovery

## Current direction

- The founder's own difficulty learning concepts during college and junior development is the starting point. Demand from other people remains untested.
- The founder enjoyed Bandit's concrete goals and freedom to research commands while reasoning independently. The reported outcome was mainly satisfaction; transfer to other problems has not been established.
- The desired outcome is solving useful programming problems, initially focused on backend, cloud, and DevOps.
- Tracing a slow request, locating the delay, and explaining its cause is an accepted example of sufficient understanding. Exhaustive knowledge of every underlying technology is not required.
- The founder is an ASP.NET developer who can inspect browser requests and locate a handler, but gets overwhelmed by unfamiliar in-house dependencies and architectural choices such as repository calls versus message buses and handlers.
- The immediate difficulty includes learning syntax, frameworks, libraries, and architectural reasoning simultaneously. Performance diagnosis alone may presuppose missing knowledge.
- Given a choice between making a feature change and investigating an existing request with tools exposing its paths and consequences, the founder chose investigation. This is the preferred initial experience to explore, not yet a validated MVP.
- The founder finds this candidate challenge compelling: an API returns success, but a new order is not visible; investigate code, logs, and the message queue to explain what happened and predict whether the order will appear. This is stated interest, not observed engagement or learning.
- Agreed starting scope: one small ASP.NET application with a database and message queue, with several investigations in that recurring system. Exploring multiple technologies is deferred so understanding can accumulate across investigations.
- Visual support is desired. The exact navigation and amount of information revealed remain undecided.
- The founder supports predicting behavior and receiving feedback, and explicitly clarified that "follow requests" means tracing an HTTP request through the system, not follow-up challenges.
- When explicitly choosing between backend system understanding and DSA understanding/retention, the founder selected backend systems for the first prototype. DSA is outside this prototype's scope.
- The founder reports classmates struggling with DSA retention, but no other prospective learner with the backend request-flow problem has been identified yet. The DSA reports do not validate the chosen backend focus.
- Coworkers and friends are available as potential testers, but the founder prefers solo testing for now and has asked to defer further first-user discussion. External demand and learning transfer remain untested.
- The founder accepted a small experiment for an unfamiliar message bus before prediction: send a message, pause the consumer, inspect changes, and optionally read an explanation. This is a proposed interaction to test, not evidence of effectiveness.
- The founder's stated reason to return is another mystery tied to networking, system design, or web development. The working scope remains one recurring application; this expresses a retention hypothesis, not observed return behavior.
- The founder wants real code alongside the visualizer. The working interpretation of their assent is code reading plus operational controls first (send requests, pause workers, change inputs), with code editing deferred. The execution environment remains undecided.
- The founder accepted a two-week cap to build one complete playable investigation before deciding whether to continue, with only a few evenings available. This narrows the first prototype from several investigations to one; the recurring application remains the intended foundation for later mysteries.
- The founder asked to end the interview and move toward building. The first local prototype now implements prediction, real HTTP submission, component inspection, a pause/resume consumer, correlated event logs, SQLite writes, and reset.
- After trying the prototype, the founder rejected the monochrome green theme and dense subtitles. Requested palette: #390099, #9e0059, #ff0054, #ff5400, #ffbd00. The revised interface uses a neutral light background, an animated request diagram, explicit worker state, and on-demand code/evidence and logs. Animation replays recorded events; counters remain live.
- The founder also rejected the revised icon diagram as insufficiently fun, responsive, and visual. The current prototype, Rush hour, replaces the prediction/replay interaction with a dispatch puzzle: drag or click parcels into a real API, choose direct writes or a queue, control a simulated database write outage, and deliver three orders accepted during that outage. Progress and completion are verified by the server. Parcel animations do not lock controls. Whether this interaction is enjoyable remains for the founder to assess.
- A second mission, Accepted, but missing, now uses the same factory to investigate one accepted order that has not reached the database. Its order inspector connects the original receipt, current state, correlated events, and executing source. Both missions still need founder assessment.
- The founder rejected the accumulated small subtitles and explanatory captions as clutter. The interface now keeps objectives and operational state visible, with explanations behind Hint, order inspection, and expandable logs. The latest requested palette is #780000, #c1121f, #fdf0d5, #003049, and #669bbc; it replaces the earlier purple/orange palette across the interface and factory artwork. A new M mark replaces the arrow logo.

## Still open

- First target user beyond the founder and their prerequisite knowledge (discussion deferred during solo prototyping).
- What demonstrates understanding beyond following a displayed path or recognizing an answer, and how the tracing and prediction interactions work in practice.
- How much guidance enables independent reasoning without leaving the learner lost.
- Gameplay, learning transfer, return behavior, MVP scope, business model, architecture, and validation.

The original multi-world arcade and its suggested games are proposals, not committed scope. The prototype uses a single ASP.NET process, an in-memory queue, SQLite, and a plain HTML/CSS/JavaScript interface. These are reversible prototype choices, not a commitment to production architecture.
