# UI Redesign — Dark Mode + Animations

**Date:** 2026-04-03
**Scope:** Visual redesign of the TSC Daily Log System UI. No changes to API routes, business logic, or data flow.

---

## Summary

Redesign the frontend from a plain white card to a dark-mode interface with stacked section cards, subtle motion feedback, and improved status indicators. The goal is a tool that feels polished and satisfying to use for a quick daily logging workflow.

---

## Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Color scheme | Dark mode | Easier on eyes during long workdays |
| Layout | Stacked cards | Clean section separation, scannable |
| Animations | Subtle (A) | Quick-use tool — animations confirm, not distract |

---

## Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| Page background | `#0f172a` (slate-950) | Full page bg |
| Card background | `#1e293b` (slate-800) | Each section card |
| Card border | `#334155` (slate-700) | Card and input borders |
| Input background | `#0f172a` (slate-950) | Text inputs |
| Primary text | `#f1f5f9` (slate-100) | Headings, values |
| Secondary text | `#64748b` (slate-500) | Labels, dates, metadata |
| Muted text | `#475569` (slate-600) | Remove buttons, placeholders |
| Blue accent | `#3b82f6` (blue-500) | Verify button, TSC outline, focus rings |
| Teal accent | `#14b8a6` (teal-500) | HRM outline button |
| Purple accent | `#7c3aed` (violet-700) | Log All button |
| Success | `#22c55e` (green-500) | Success dot + checkmark |
| Error | `#ef4444` (red-500) | Error dot + message |
| Loading | `#3b82f6` (blue-500) | Spinner border |

---

## Layout

`app/page.tsx` — page background changes to `bg-slate-950`. The centered card becomes headerless; the `Welcome, Nam Nguyen` heading and date sit directly above the stacked cards with no outer wrapper card.

`components/LogForm.tsx` — the single `space-y-5` div with `<hr>` dividers is replaced with four distinct cards stacked vertically:

1. **Tickets card** — ticket input + Verify button + Jira status row + staged chips list
2. **Dates card** — date input + Add button + selected date chips
3. **Status card** — TSC Log status row + HRM Log status row + summary banner (when staged tickets + dates exist)
4. **Actions card** — Log TSC, Log HRM, Log All buttons

Each card: `bg-slate-800 border border-slate-700 rounded-xl px-5 py-4 space-y-3`
Card label: `text-[11px] font-semibold uppercase tracking-widest text-slate-500`

---

## Components

### `StatusIndicator` changes

Current: plain dot/spinner/check/cross with inline text.

New behavior:
- **idle:** `bg-slate-700` dot, no message
- **loading:** spinning ring (`border-slate-700 border-t-blue-500`), blue message text
- **success:** green dot that transitions in (`transition-colors duration-300`), green checkmark (`text-green-500`), green message that auto-fades after timeout (use `opacity-0 transition-opacity duration-500` triggered by a timeout)
- **error:** red dot + red X, red message, one shake animation (`animate-shake` — define in `tailwind.config`)

Adds one optional `fading?: boolean` prop to `StatusIndicator` — backward-compatible, existing callers unchanged.

### `LogForm` ticket chips

Current: `<li>` rows with text and an X button.

New: same structure but with enter animation:
- Add `animate-slide-in` (define in `tailwind.config`) — slides down from -6px + fades in over 180ms
- Remove: fade out + slide up before removal (`opacity-0 -translate-y-1.5 transition-all duration-150`), then remove from state after 150ms delay

### Button press micro-interaction

All action buttons get `active:scale-95 transition-transform duration-100`.

---

## Animations (Tailwind config additions)

Add to `tailwind.config.ts`:

```ts
theme: {
  extend: {
    keyframes: {
      slideIn: {
        '0%':   { opacity: '0', transform: 'translateY(-6px)' },
        '100%': { opacity: '1', transform: 'translateY(0)' },
      },
      shake: {
        '0%, 100%': { transform: 'translateX(0)' },
        '20%':      { transform: 'translateX(-4px)' },
        '40%':      { transform: 'translateX(4px)' },
        '60%':      { transform: 'translateX(-3px)' },
        '80%':      { transform: 'translateX(3px)' },
      },
      fadeOut: {
        '0%':   { opacity: '1' },
        '100%': { opacity: '0' },
      },
    },
    animation: {
      'slide-in': 'slideIn .18s ease-out',
      'shake':    'shake .35s ease-in-out',
      'fade-out': 'fadeOut .5s ease-in forwards',
    },
  },
},
```

---

## Status Feedback Improvements

The existing `useEffect` timers (20s for Jira, 10s for TSC/HRM) are kept. The visual improvements are:

1. **Transition between states** — `StatusIndicator` uses `transition-all duration-200` on its icon slot so the dot/spinner/checkmark/X swap feels smooth rather than instant.
2. **Success fade-out** — when the success `useEffect` fires (clears status back to idle), the message fades out over 500ms before state resets. This requires a short delay: set `fading: true` → render with `opacity-0` for 500ms → then call `setStatus(idle)`.
3. **Error shake** — on error state entry, the StatusIndicator row triggers `animate-shake` once.

Implementation: add a `fadingOut` boolean per status in `LogForm` (three separate `useState<boolean>` — one each for Jira, TSC, HRM). When the success timer fires, set `fadingOut = true`, wait 500ms, then reset status to idle and `fadingOut` to false. Pass `fading={fadingOut}` to the relevant `StatusIndicator`.

---

## File Changes

| File | Change |
|------|--------|
| `app/page.tsx` | Change bg to `bg-slate-950`, remove outer white card wrapper, add spacing |
| `app/globals.css` | No changes needed (Tailwind handles everything) |
| `tailwind.config.ts` | Add `slideIn`, `shake`, `fadeOut` keyframes + animation utilities |
| `components/LogForm.tsx` | Replace `<hr>` dividers with four section cards; add chip animations; add `fadingOut` state per status; add `active:scale-95` to buttons |
| `components/StatusIndicator.tsx` | Add transition classes; accept optional `fading` prop to trigger fade-out class |

No changes to API routes, `lib/`, or test files (tests cover behavior not styling).

---

## Out of Scope

- No new features
- No changes to Jira verify logic, SharePoint log, or HRM log
- No dark/light mode toggle (dark only)
- No mobile-specific layout changes (responsive behavior stays as-is)
