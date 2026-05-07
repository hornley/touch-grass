# Abandon Quest (Skip) Design

## Summary
Add an "ABANDON QUEST" action in the main quest card that opens the existing confirmation modal. On confirm, the quest is cleared, no XP is awarded, and history records the quest as `skipped`. The slot stays empty until the user taps "Give me a quest".

## UX
- Place an "ABANDON QUEST" button at the bottom of the main quest card (only when a quest is active).
- Button opens the existing skip confirmation modal (same overlay style as current skip modal).
- Disable the button when `loadingNextQuest` is true.
- After confirmation, show the "No quest active" empty state; do not auto-assign a new quest.

## Data & Logic
- Reuse `skipConfirmOpen`, `pendingSkipQuest`, and `confirmSkip` in `app/page.tsx`.
- Wire the main quest card button to `handleSkipClick` (opens modal and sets `pendingSkipQuest`).
- Keep `confirmSkip` to finalize the quest with `outcome: 'skipped'` and `xpEarned: 0` via `finalizeQuestState`.
- Do not modify debug panel controls unless requested.

## Edge Cases
- If there is no active quest, the button is not rendered.
- If a quest completes between opening the modal and confirming, `confirmSkip` no-ops safely (guard exists).

## Testing
- Start app with active quest, click "ABANDON QUEST", confirm. Quest clears, history shows outcome `skipped`, XP unchanged.
- With no active quest, the button does not show.
- With `loadingNextQuest` true, button is disabled.
