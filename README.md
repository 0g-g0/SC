# Cybersecurity 7H Coach

Local-first, bilingual (English-first / Arabic) cybersecurity competition study coach for September 17–November 30, 2026.

## Features
- Timestamp-based 7-hour study timer with pause/resume and local persistence.
- Debt calculation from unfinished normal study days.
- 12 break-day allowance with 24-hour persisted countdown.
- 25 cybersecurity topic blocks, each with 2 calendar days, theory/practical checklists and exactly 10 assessment questions.
- Mistake tracking and review.
- Deterministic, context-aware daily coach with multiple modes and no AI API.
- English/Arabic UI with RTL support and local language persistence.
- Calendar, streaks, accuracy, export/import/reset.
- Five visual styles: SOC, Terminal, Futuristic Cyber, Clean Dark, Light.
- Responsive desktop/mobile UI and reduced-motion support.
- Ready for GitHub → Vercel.

## Stack
Next.js 14, React 18, TypeScript, CSS, browser localStorage. No database and no required API keys.

## Install
```bash
npm install
npm run dev
```
Open the local URL printed by Next.js.

## Production
```bash
npm run build
npm start
```

## GitHub → Vercel
1. Create a GitHub repository.
2. Push this directory.
3. Import the repository into Vercel.
4. Vercel detects Next.js automatically. No environment variables are required.

## Content architecture
- `data/topics.ts` — 25 topics, checklists, questions, tools and reputable resources.
- `data/schedule.ts` — generated schedule configuration.
- `lib/coach.ts` — deterministic coach engine.
- `lib/i18n.ts` — UI translations.
- `types/index.ts` — TypeScript domain types.
- `app/page.tsx` — application shell and interaction logic.

## Persistence
Progress is stored in `localStorage` under `cyber7h-state`. Timer sessions use timestamps rather than `seconds++`, so refresh/reopen restores elapsed active time. Export creates a JSON backup; import validates the basic schema before replacement.

## Safety
Practical objectives are restricted to authorized labs, CTFs, sandboxes and intentionally vulnerable environments. No real-world exploitation workflow is included.

## Schedule arithmetic
September 17–November 28 is 73 calendar days. The planned core is 7 Satr days + 25×2 topic days = 57 days, leaving 16 days for the 12 break allocation and 4 final-review slots. November 29 is pre-competition and November 30 is competition day.

## Modify topics/questions/resources
Edit `data/topics.ts`. Each topic has theory/practical arrays, mistakes, tools, resources and exactly 10 questions.

## Modify coach
Edit `lib/coach.ts`. The local provider is deterministic and can later be wrapped behind a `CoachProvider` abstraction without changing the UI.
