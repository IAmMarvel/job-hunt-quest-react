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

To add the **Java/Python interview language** field to an existing Supabase project, run [`supabase/add_interview_language.sql`](./supabase/add_interview_language.sql) in the SQL Editor. New projects get this column when you run [`supabase/schema.sql`](./supabase/schema.sql). Existing companies remain unset until you edit them.

To add **interview collections** to an existing Supabase project, run [`supabase/add_collections.sql`](./supabase/add_collections.sql) in the SQL Editor. It creates a “Bangalore Interviews” collection for each existing account and moves that account’s unassigned companies into it. New projects get collections when you run [`supabase/schema.sql`](./supabase/schema.sql).

To add the optional **scheduled interview date and time** to an existing Supabase project, run [`supabase/add_scheduled_interview_at.sql`](./supabase/add_scheduled_interview_at.sql) in the SQL Editor. New projects get this column when you run [`supabase/schema.sql`](./supabase/schema.sql).

To enable cloud-synced **notes** for an existing Supabase project, run [`supabase/add_notes.sql`](./supabase/add_notes.sql) in the SQL Editor. New projects get the notes table when you run [`supabase/schema.sql`](./supabase/schema.sql). Existing browser notes are imported into the signed-in account on its next load.

The frontend key is public by design; Row Level Security policies in the schema restrict every record to its owning authenticated user. Never add a Supabase service-role key to the frontend or GitHub Pages build.

The app is configured for GitHub Pages at `/job-hunt-quest-react/`. Push to `main` to build and deploy through GitHub Actions.

## Deploy to Netlify

The repository includes [`netlify.toml`](./netlify.toml), which configures `npm run build`, the `dist` publish directory, and Node.js 22. In Netlify, import this repository and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as site environment variables. After the first deploy, add the Netlify site URL to Supabase Authentication's allowed redirect URLs and, if desired, set it as the Supabase Site URL.
