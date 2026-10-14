# PoliVid

News videos with receipts. Type a story, and PoliVid finds the numbers on primary sources, cites every one on screen, and builds a short video (vertical, square or wide).

The core rule: **the AI arranges the story, and code fills in every number from its source.** The AI never types a figure. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill it in; see docs/SETUP.md
npm run db:push              # create the tables in Postgres
npm run dev                  # http://localhost:3100
```

Without `OPENROUTER_API_KEY` the app runs in **demo mode**, where every generated video uses fictional sample data that is labeled as such. Sign-in still needs the database plus Google or Resend.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server on port 3100 (WriteStack uses 3000) |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run db:push` | Sync `prisma/schema.prisma` to the database (early development) |
| `npm run db:migrate` | Create and apply a migration (once the schema settles) |
| `npm run db:studio` | Browse the database in Prisma Studio |
| `npm run try -- "story"` | Run the generation pipeline in the terminal (no app or DB needed; spends OpenRouter credits) |

## Docs

- [docs/PRD.md](docs/PRD.md): what we are building: users, principles, screens, video spec, requirements, milestones.
- [docs/SETUP.md](docs/SETUP.md): every environment variable and where to get it (Postgres, Google, Resend, OpenRouter).
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the app is built (pipeline, rendering, auth, data model, folder map).
- [docs/PLAN.md](docs/PLAN.md): product and go-to-market plan.

## Stack

Next.js 16 (App Router, Cache Components) · React 19 · Tailwind 4 + shadcn (Base UI) · Remotion 4 (video) · AI SDK 7 + OpenRouter · Auth.js v5 (Google + Resend) · Prisma 6 + Postgres on AWS RDS.

## Status

Built: landing page, sign-in, dashboard, prompt-to-video generation with live progress, in-browser preview, and a receipts panel listing every fact with its source.

Not built yet: MP4 export (Remotion Lambda), voiceover, payments, and editing a video after generation.
# polivid
