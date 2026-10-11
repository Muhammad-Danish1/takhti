# Building a screen

The same steps for every screen from [Phase 5](../20-phases/phase-05-auth.md) on. Each portal phase lists its screens and points here for how.

By the time a screen is built, its backend, its api-service and its hooks already exist and are tested (Phases 2 and 3), and its components exist (Phase 4). A screen is assembly.

## Steps

1. **Read** the screen's row in its module spec (section 9: pattern and notes), the rules it must respect (section 5), and its failure cases (section 13). The failure cases are the screen's error states.
2. **Page file** — `apps/web/app/(app)/<portal>/<path>/page.tsx`. Sets the title and renders one feature component. Nothing else.
3. **Feature component** — `apps/web/src/features/<module>/<Screen>.tsx`, a client component, built from the page pattern named in the spec (`ListPage`, `DetailPage`, `Wizard`, …).
4. **Data** — hooks from `@takhti/hooks` only. List state (page, sort, filters, open tab) lives in the URL through `useListParams`.
5. **Forms** — `useContractForm` with the contract's schema. No validation rule is rewritten in the screen.
6. **Permissions** — the page checks its permission and shows the forbidden state; buttons a person cannot use are hidden with `<Can>`.
7. **Messages** — every string in `messages/en/<module>.json` and `messages/ur/<module>.json`. Urdu is written now, not later.
8. **Navigation** — add or confirm the item in the shell's `nav.ts`, matching the [navigation map](navigation.md).
9. **States** — loading, empty (with what to do next), error (with retry), forbidden, not found, and offline where the screen is offline-capable.
10. **Tests** — add the page to the role matrix (`tests/e2e/roles.ts`): who reaches it, who is refused. Write the browser test for its main task. Add it to the screenshot list if it is a key page.

## Done when

- [ ] The main task succeeds for each role that may use it.
- [ ] A role that may not use it is turned away with the forbidden state.
- [ ] Loading, empty, error and forbidden states render.
- [ ] A failed save shows the server's message under the right field; nothing is lost from the form.
- [ ] Every write button is disabled while its request is pending, and a double click cannot submit twice.
- [ ] Each failure case in the spec that a user can reach has been tried by hand.
- [ ] The page passes the automated accessibility check and works by keyboard alone.
- [ ] It renders in light and dark, English and Urdu, at 1440 px and 400 px, with no horizontal scrolling.
- [ ] No string, colour, radius or spacing value is written in the component.
- [ ] The page imports nothing from `@takhti/core` or `@takhti/db` and never calls `fetch`.
- [ ] `pnpm check` and the page's browser test pass.

## Rules that are easy to forget

- **Money.** Always `<Money>` and `MoneyField`. Never format or add amounts in a component.
- **Dates.** Always `<DateText>` and the date fields. The form value is a string.
- **Status.** Always `<StatusBadge>`, with a word as well as a colour.
- **Lists.** Server paging always. Never load "all" to filter in the browser.
- **Destructive actions.** An `AlertDialog` that names what will happen, and a typed confirmation for the few that cannot be undone.
- **Long operations.** Start a job, show its progress with `useJobProgress`, let the person leave the page.
- **Counters** (fee collection, library desk, point of sale): focus is in the search box on load and returns there after each commit; every action has a key.
- **Phone-first pages** (`/teach`, `/family`, `/learn`, `/school/gate`, `/school/trips`): touch targets of at least 40 px, one column, the main action reachable with a thumb.
- **Urdu.** Check the page in Urdu before calling it done. Numbers and codes stay left-to-right inside `<Ltr>`.
- **"Draft with AI" buttons** are placed where the spec's section 12 names them, behind `useAiStatus`, so they are invisible until [Phase 19](../20-phases/phase-19-ai.md) switches them on.
- **Print buttons** call `useDocument`; until [Phase 16](../20-phases/phase-16-documents-and-printing.md) the document is a placeholder page, and the button is already in its final place.
