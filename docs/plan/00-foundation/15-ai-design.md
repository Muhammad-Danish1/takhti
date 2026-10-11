# 15 · AI design

Built in [Phase 19](../20-phases/phase-19-ai.md). The data model in [M44](../10-modules/m44-ai-suite.md) is created in Phase 1 so earlier phases can leave the right hooks.

## Principles

1. **AI drafts, people approve.** Anything that will be stored as a record or sent to a parent is a draft until a named person accepts it. The draft, the accepted version and who accepted it are all kept.
2. **AI sees only what the asking user may see.** Its tools are the same service functions, called with the user's `ctx`. There is no separate "AI access".
3. **Every answer shows its grounds.** A remark on a report card lists the figures it was written from. A report answers with the filters it used.
4. **The manual path always exists.** No task can be done only with AI. If the provider is down, the feature is hidden and nothing else changes.
5. **Cost is visible and capped** per school group.

## Provider

- The **Claude API** through the official TypeScript SDK (`@anthropic-ai/sdk`), behind a small adapter in `packages/core/src/providers/ai/`.
- Default model: **`claude-opus-5-5`**. A cheaper model for a high-volume feature (for example the parent chatbot) is a cost decision for the owner of Takhti, made per feature in the platform console, never hard-coded.
- Bulk work that does not need an instant answer (remarks for a whole class, translating a notice set) goes through the **Message Batches API** at half price.
- Long, stable instructions and tool definitions are placed first and cached (**prompt caching**).
- Typed results use **structured outputs** validated by the same Zod schemas as the rest of the product.
- Textbooks and scanned forms are sent as documents and images.
- The adapter handles a refusal or an unavailable provider by returning a typed "unavailable" result, which every feature must handle.
- Locally and in tests a **fake provider** replays recorded answers, so the suite runs without a key or the internet.

> Before writing any code in Phase 19, load the `claude-api` skill. SDK shapes changed during 2025–2026 and must be taken from current documentation, not from memory.

## Features

| # | Feature | Who | How it works | Approval |
|---|---|---|---|---|
| A1 | **Assistant** in every portal, in English, Urdu or Roman Urdu | Everyone | A chat with read tools ("students with dues over two months in 8-B") and action tools ("draft a reminder") | Actions show a preview and need a click |
| A2 | **Textbook to syllabus** | Coordinator | Reads a textbook PDF into a unit and topic tree with a confidence mark on each node | Coordinator reviews and commits |
| A3 | **Scheme of work** | Coordinator | Spreads the syllabus over the term's real teaching days | Coordinator edits and approves |
| A4 | **Lesson plans**, bilingual | Teacher | Objectives, timed activities, classwork, homework for a topic | Teacher edits; coordinator approves |
| A5 | **Question paper generator** | Teacher, exam controller | Fills a board-pattern blueprint from the question bank; writes new questions only where the bank is thin, and says so | Every AI-written question must be read and accepted before the paper can be approved |
| A6 | **Report-card remarks**, English and Urdu | Class teacher | A remark per student from marks, attendance and behaviour | Teacher accepts or rewrites each one |
| A7 | **Reading scanned forms** | Admissions officer | Pulls fields from a photo of an admission form, B-Form or CNIC | Shown beside the image for checking before saving |
| A8 | **Marking help** | Teacher | Reads a photographed answer sheet against the marking scheme and suggests marks | A suggestion only; the teacher enters the mark |
| A9 | **Ask your data** | Leaders, finance | A question becomes a *report request* (measure, filters, grouping) run by the reports service | The request used is shown with the answer |
| A10 | **Drafting and translation** | Staff | Notices, circulars, replies to complaints; English to Urdu and back | Staff edit and send |
| A11 | **Parent chatbot** on WhatsApp | Guardians | Fee balance, attendance, results, a payment link, school timings | Read-only; hands over to a person on request |

Analytics features that need no language model are ordinary code, with AI used only to explain the result in a sentence:

| # | Feature | Method |
|---|---|---|
| S1 | Students at risk | A score from attendance trend, marks trend, behaviour records and fee stress, recalculated nightly |
| S2 | Board readiness by weak chapter | Marks per question tagged with a syllabus topic, weighted by recency |
| S3 | Fee-defaulter prediction | A score from payment history, with suggested next action |
| S4 | Cash-flow forecast | Expected collections from open vouchers and past payment timing |
| S5 | Unusual activity | Rules and simple statistics: concessions above the norm, cancelled receipts, edits after closing |
| S6 | Timetable auto-fill and substitute suggestions | A constraint search in code |
| S7 | Admission lead scoring | A rule-based score from source, response time and follow-ups |

## How the assistant works

```
user message
   │
   ▼
system instructions (cached): who the user is, their role, today's date, the rules below
tools (cached): the read and action tools this role's permissions allow
   │
   ▼
model ⇄ tools           each tool call runs a service with the user's ctx
   │                    read tools return compact, already-permitted data
   │                    action tools return a PREVIEW, never a change
   ▼
answer + any previews
   │
   ▼
user clicks Confirm on a preview → the normal API route performs the action
```

- A tool is defined from the module's contract schema, so its inputs are validated like any API call.
- Tools return small, shaped results (counts, top rows, totals), not whole tables.
- The list of tools is filtered by the user's permissions before the model ever sees it.
- A conversation is stored with its tool calls, token counts and cost.

## Safety rules

1. **Untrusted text stays data.** Content from uploaded documents, parents' messages and student submissions is passed as quoted material. Instructions inside it are ignored, and the system instructions say so.
2. **Minimum data.** Identity numbers, phone numbers and medical notes are left out of tool results unless the feature needs them and the role allows it.
3. **No free SQL.** "Ask your data" produces a typed report request from a fixed vocabulary of measures and dimensions; the reports service runs it under row-level security.
4. **Children.** The student-facing assistant is limited to study help on the school's own syllabus, does not discuss other people, and its conversations are visible to a supervising role.
5. **Labelled.** Anything AI wrote carries a marker until a person accepts it, and the accepted record keeps "drafted with AI".
6. **Declines are handled.** If the model declines or is unavailable, the screen says so plainly and offers the manual path.
7. **No training on school data.** The provider's terms on data use are checked and stated in the privacy notice.

## Cost control

- Each school group has a monthly AI budget from its plan. Usage is recorded per run in `ai_runs` (model, input, cached and output tokens, cost in paisa).
- At 80% of budget the owner is told. At 100% interactive features pause with a clear message; nothing is lost.
- Platform staff see cost per feature and per organisation, which is what the model-choice decision is based on.
- Cheap wins are applied first: caching, compact tool results, batches for bulk work.

## Quality

- Each feature has an **evaluation set**: real-shaped inputs with expected properties (a Grade 9 Physics paper totals 60 marks and follows the board's sections; an Urdu remark mentions the student's actual weakest subject).
- An evaluation runs before any prompt or model change is released, and the score is recorded.
- Staff can rate any output. Ratings and edits made before approval feed the evaluation sets.

## What earlier phases must leave ready

| Hook | Phase |
|---|---|
| Tables in [M44](../10-modules/m44-ai-suite.md) | 1 |
| Services return compact, permission-filtered results suitable as tool outputs | 2 |
| Report service that runs a typed report request | 2 |
| Every record AI can draft has an AI marker and an approval state; the marker for each kind of record is listed in [M44](../10-modules/m44-ai-suite.md) section 4 | 1 |
| Marks can be tagged to syllabus topics | 1 |
| A provider adapter with a fake implementation | 0 |
| "Draft with AI" buttons are designed into the screens but hidden behind the module flag | 7 to 15 |
