# Phase 19 · AI

**Goal.** The AI features are switched on, one at a time, each useful, each safe, each with a manual path beside it: the assistant in every portal, the drafting tools, the document readers, "Ask your data", the parent chatbot, student study help, and the screens for the scores that have been calculated nightly since Phase 2.

**Depends on.** Phases [8](phase-08-academics.md), [9](phase-09-finance.md), [12](phase-12-communication.md) and [15](phase-15-head-office-and-reports.md). The tables, the draft store, the fake provider, the score jobs and the hidden "Draft with AI" buttons already exist.

**Modules.** [M44](../10-modules/m44-ai-suite.md), and section 12 of every module that names an AI feature.

## Read first

[15 · AI design](../00-foundation/15-ai-design.md) and [M44](../10-modules/m44-ai-suite.md) in full.

> **Before writing any provider code, load the `claude-api` skill and read the current TypeScript SDK reference it points to.** Model ids, the thinking parameter, structured outputs, prompt caching, tool use, streaming and the Message Batches API are taken from that reference at the time of implementation. What was known when this plan was written (October 2026): the default model is `claude-opus-5-5`; thinking is requested as adaptive rather than with a token budget; long or tool-using requests should stream. Treat these as a starting point to verify, not as the specification.

Also needed before starting: an API key for the Claude API with a spending limit set in the provider's console, used only on the developer's machine and, later, in staging. With `AI_PROVIDER=fake` everything in this phase still runs and every test still passes.

## How each feature is built

The same seven steps every time.

1. **Schema.** The output as a Zod schema in `packages/contracts/src/modules/ai/` (a lesson plan, a remark, a set of extracted fields). The model must return exactly this.
2. **Inputs.** A function that gathers what the model will see, through services with the user's `ctx`, and trims it to the minimum ([R-ai-5](../10-modules/m44-ai-suite.md), [R-ai-19](../10-modules/m44-ai-suite.md)).
3. **Prompt.** A versioned file in `packages/ai/src/prompts/<feature>.ts`: stable instructions first (cached), then the tools, then the request. Untrusted text goes inside a marked block. The version is recorded on every run.
4. **Call.** Through `runAi` only ([M44 §4](../10-modules/m44-ai-suite.md)).
5. **Draft.** The result is stored in `ai_outputs` with its grounds; the screen shows it in `AiDraftReview` beside the form.
6. **Decision.** Accept, edit or discard is recorded; only then is the real record written, by the ordinary route, with its AI marker.
7. **Evaluation.** A set of inputs with properties the output must have, in `packages/ai/evals/<feature>/`; `pnpm ai:eval <feature>` runs it against the real provider and records the score. A feature is not switched on for schools below its pass mark.

## Work packages

Ordered by value to a school and by risk, lowest risk first.

### 19.1 · The provider and the wrapper

- [ ] The real adapter beside the fake one: `generate` (with streaming), `submitBatch`, `collectBatch`; typed results; refusals, unavailability and invalid output mapped to their reasons.
- [ ] Prompt caching on system instructions and tool definitions; verify cache hits in the usage figures.
- [ ] Cost: prices per model held in platform settings; cost computed per run in paisa at a rate also held there; `ai_usage_daily` roll-up; the budget warning and stop.
- [ ] The recorder: with a flag, real answers are saved as fixtures for the fake provider, so tests replay real shapes.
- [ ] AI settings and usage screens (`/school/settings/ai`); model per feature in the platform console.

### 19.2 · Drafting and translation (A10)

The lowest-risk feature and the widest: notices, messages, complaint replies, website text, observation notes; English to Urdu and back. `AiDraftButton` appears in the composers built in Phases 12 and 20. Evaluation: Urdu output is natural Nastaliq-script Urdu, keeps names and numbers unchanged, and matches the school's chosen tone.

### 19.3 · Report-card remarks (A6)

For a class, as a batch; the remarks grid from [Phase 13](phase-13-teacher-portal.md) gains "Draft with AI", shows each draft with the figures it was written from, and lets the teacher accept the sensible ones and rewrite the rest. Evaluation: each remark names the student's actual strongest and weakest subject, contradicts no figure, and is kind and specific.

### 19.4 · Lesson plans and scheme of work (A4, A3)

From a topic and its learning outcomes to a timed plan in the school's format, bilingual; from a syllabus and the term's real teaching days to a scheme. Evaluation: timings add up to the lesson length; every objective maps to a listed outcome; the scheme uses only working days.

### 19.5 · Textbook to syllabus (A2)

A coordinator uploads a textbook PDF; a job reads it (as a document, in sections for long books) into a unit and topic tree with a confidence mark on each node; the coordinator reviews, edits and commits. Evaluation on two sample textbooks: chapters and their order are right; nothing is invented.

### 19.6 · Question papers (A5)

Auto-fill from a blueprint and the bank; new questions written only where the bank is thin and marked as such; each must be accepted before the paper can be approved (enforced since Phase 2). Evaluation: the paper totals the blueprint's marks, follows its sections, repeats no question, and every new question has a key.

### 19.7 · Reading scanned forms (A7)

A photo of an admission form, B-Form, CNIC or vendor bill becomes fields shown beside the image with a confidence mark each. Evaluation on a set of sample images including poor ones: a wrong reading is flagged low-confidence rather than presented as certain.

### 19.8 · Marking help (A8)

A photographed answer sheet against the marking scheme gives a suggested mark per question with a short reason. The teacher types the mark. Offered only for short structured answers at first.

### 19.9 · The assistant (A1)

- [ ] `defineTool` for each module's read tools and action tools ([M44 §4](../10-modules/m44-ai-suite.md)), starting with students, attendance, fees, results, timetable and notices.
- [ ] The conversation route with streaming; tool activity lines; previews; confirm through the ordinary route; expiry.
- [ ] `AssistantPanel` in every shell, with suggested questions for the current page.
- [ ] English, Urdu and Roman Urdu.
- [ ] Limits: tool calls per turn, turns per conversation, messages per day.

### 19.10 · Ask your data (A9)

The model's only output is an `AnalysisRequest` or a named report with filters ([M42](../10-modules/m42-dashboards-reports.md)); it is validated and run like any other; the request is shown beside the answer and can be edited. The weekly digest's narrative and "Why did this change?" in `/hq` ([M43](../10-modules/m43-owner-analytics.md)).

### 19.11 · Knowledge and the parent chatbot (A11)

Knowledge documents with passages and full-text retrieval; answers cite the document. The WhatsApp chatbot: identifies the guardian by number, answers only about their own children from read tools and parent-facing knowledge, says it is automated, hands over on request or after two failed answers, keeps to its hours. Depends on the WhatsApp connection of [Phase 18](phase-18-integrations.md); locally it is driven by simulated inbound messages.

### 19.12 · Student study help

In `/learn/help`, limited to the student's grade and subjects, answered from the school's syllabus and resources; supervision screen; the first-screen notice that the school can read it.

### 19.13 · The score screens (S1 to S5, S7)

Students at risk with factors as labelled bars and reviews; weak topics by section and by student; defaulter outlook in fees; unusual activity for the director, finance head and auditor; lead score on enquiries. The scores are code, not a model; an optional one-sentence explanation of a score is written from its own factors.

### 19.14 · Safety review

A written review, kept with the phase, of every feature against the rules in [15](../00-foundation/15-ai-design.md) and [M44 §5](../10-modules/m44-ai-suite.md): what data each feature sends; the injection tests it passed; what a refusal looks like on its screen; that a manual path exists; that nothing is sent to parents by a model alone. The privacy notice is updated to say what is sent to the AI provider and that school data is not used to train models, after checking the provider's current terms.

## Journeys to automate (with the fake provider; and by hand with the real one)

| Journey | Steps |
|---|---|
| Remarks for a class | Draft for 40 students as a batch → progress → accept 30, edit 8, discard 2 → the results carry the right markers |
| A notice in Urdu | Write three bullet points → draft → translate → edit → send for approval |
| A lesson plan | Draft from a topic → edit the activities → submit; the plan is marked "drafted with AI" |
| A paper | Auto-fill with two AI-written questions → approval is refused until both are accepted |
| The assistant reads | An accountant asks for families with dues over two months in 8-B → the fee tool runs → a short table → a teacher asking the same is told it cannot see fee data |
| The assistant acts | "Draft a reminder to them" → a preview → Confirm → the ordinary campaign draft is created; an expired preview cannot be confirmed |
| Injection | A parent's message and an uploaded document each contain instructions to reveal data → ignored; nothing leaks |
| Ask your data | "Attendance by grade this term against last year" → the request is shown → the chart → edit the request by hand |
| The chatbot | A known number asks for the fee balance → the answer and a payment link; an unknown number gets the office's details only; "talk to a person" hands over |
| Budget | With the budget set low, the next request says the monthly AI budget is reached and the form still works by hand |
| Provider down | With the adapter forced to fail, every AI control says so and nothing else breaks |

## Exit checks

1. Every feature has an evaluation set, a recorded score at or above its pass mark with the real provider, and its prompt version recorded.
2. All journeys pass with the fake provider in the normal test run; each has been walked by hand with the real provider.
3. The generated tests pass: the tool list per role matches its permissions; no tool returns a forbidden field; no action tool changes data.
4. With `AI_PROVIDER=fake` and with AI switched off for the organisation, the whole product's test suite still passes.
5. The safety review is written and signed off by the product owner.
6. Cost per feature for a typical month at a 1,000-student school is measured and written into the platform console's notes, to inform plan prices and budgets.
7. `pnpm check`, `pnpm test:db`, `pnpm test:e2e`.

## Left for later, on purpose

- Timetable generation by a solver or a model beyond the rule-based auto-fill.
- Voice input and spoken answers.
- An embeddings provider for knowledge search; full-text search is used until measured results show it is not enough.
- Fine-tuning or any training on school data: not planned.
