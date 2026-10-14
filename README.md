# Job Hunt Quest

A React app for tracking job applications, interview questions, learning goals, and motivation. It supports local browser storage and Supabase accounts with per-user cloud sync.

## Getting started

```sh
npm install
npm run dev
```

Create a production build with `npm run build`, then use `npm run preview` to preview it locally.

## Enable Supabase cloud storage

1. Create a Supabase project and run [`supabase/schema.sql`](./supabase/schema.sql) in the project's SQL Editor.
2. Copy `.env.example` to `.env.local`, then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the project URL and publishable (or legacy anon) key.
3. In Supabase Authentication URL Configuration, set the Site URL to `https://iammarvel.github.io/job-hunt-quest-react/` and add both that URL and `http://localhost:5173` as allowed redirect URLs. Sign-up confirmation links return to the app’s login screen.
4. Restart `npm run dev`. The sign-in and account creation screen will appear once both environment values are set.
5. In the GitHub repository's **Settings → Secrets and variables → Actions → Variables**, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Push to `main` to deploy the cloud-enabled app.
6. Sign up or sign in. Data previously saved in this browser is merged into the account automatically once per account and browser; existing companies with the same name are skipped. New signed-in changes sync immediately.

To remove company duplicates already stored in Supabase, run [`supabase/dedupe_companies.sql`](./supabase/dedupe_companies.sql) once in the Supabase SQL Editor. It keeps the oldest entry for each company name per account (ignoring capitalization and surrounding spaces) and deletes the rest.

To enable the **AI interview** checkbox and stack for an existing Supabase project, run [`supabase/enable_ai_interview.sql`](./supabase/enable_ai_interview.sql) in the SQL Editor. New projects get this column when you run [`supabase/schema.sql`](./supabase/schema.sql).

The frontend key is public by design; Row Level Security policies in the schema restrict every record to its owning authenticated user. Never add a Supabase service-role key to the frontend or GitHub Pages build.

The app is configured for GitHub Pages at `/job-hunt-quest-react/`. Push to `main` to build and deploy through GitHub Actions.
