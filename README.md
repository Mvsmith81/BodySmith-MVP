# BodySmith

BodySmith is a mobile-first workout PWA with cloud accounts, guided set logging, workout history, progress tracking, and a four-day muscle-building plan.

## Current release

The live app now supports:

- Separate BodySmith user accounts with private cloud data
- Username/password sign-in with server-side password hashing
- 30-day account sessions and sign-out
- Full 4-day plan: Push, Pull, Legs, Upper + Arms
- Cloud-saved workout sessions and individual sets
- Cross-device resume for an in-progress workout
- Weight, reps, RPE, elbow-pain, completion status, and notes per set
- Previous-session performance shown during workouts
- Automatic programmed rest timers
- Exercise skip and same-muscle swap controls
- Progression coaching based on rep range and RPE
- 4+/10 elbow caution and 6+/10 stop/swap guidance
- Workout summaries and BodySmith session score
- Workout history and 30-day training metrics
- Exercise library with search
- Profile settings and lb/kg preference
- Daily check-ins for body weight, calories, protein, steps, elbow pain, and notes
- Offline app shell, cached account data, and queued set-sync when connectivity returns
- Installable PWA behavior from GitHub Pages
- Custom exercise-specific vector anatomy illustrations with highlighted working muscles

## Architecture

- Front end: static HTML/CSS/JavaScript PWA hosted on GitHub Pages
- API: Supabase Edge Function (`bodysmith-api`)
- Database: Supabase Postgres
- Account security: password hashes and session tokens remain server-side; the browser stores only the user's BodySmith session token
- Data separation: each workout session, workout set, and daily check-in is scoped to one BodySmith account

The Supabase publishable key in the front end is intentionally public. Privileged database access remains inside the Edge Function and is never shipped to the browser.

## Training plan

1. Push Day — Chest + Shoulders + Triceps
2. Pull Day — Back + Biceps
3. Leg Day — Legs + Abs
4. Upper Arms Day — Upper Body + Arms

The plan, exercise prescriptions, cues, rest times, progression rules, and pain rules are stored in the BodySmith database rather than hard-coded as the only source of truth in the user interface.

## Development

No front-end build step is required. Serve the repository root as static files. GitHub Pages can deploy directly from `main` / root.

## Security notes

`app_users` and `app_sessions` have RLS enabled with no public policies by design. The browser cannot read these tables directly. Account and workout operations go through the BodySmith Edge Function, which authenticates the BodySmith session token before accessing account-specific records.
