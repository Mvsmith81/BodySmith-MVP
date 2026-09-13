# BodySmith 2.0

Mobile workout PWA: https://mvsmith81.github.io/BodySmith-MVP/

## Using the release

Sign in with your existing BodySmith username/password. New profiles complete onboarding and choose a plan. Michael Muscle Builder remains the recommended four-day starter. Five other templates and a personal plan editor are available in Plan. Saving edits creates a private revision; templates and historical workout snapshots remain intact.

Start a workout while connected. Sets, substitutions, rest deadlines, and completion are saved locally before cloud synchronization. An active workout can continue offline and be resumed after reopening. Pending entries show a Retry sync control. Keep the same device/browser and sign in again if your session expires; do not clear site storage while entries are pending. Sign-out is blocked during an active workout or pending sync.

Tap exercise artwork for a two-position movement guide, setup cues, play/pause, and speed controls. Twenty-nine anatomy sheets cover thirty exercises; equivalent neutral-grip pulldowns share a guide. Compound choice entries demonstrate leg press and split squat respectively. Custom exercises use your own instructions. Illustrations are generated training references; the written movement cues should guide setup and control.

Supplements includes user-entered doses, schedules, active status, Taken/Skipped/Snoozed logging and history. No doses are prescribed. Save reminder category preferences, enable each supplement's reminders, then explicitly enable device notifications. Permission is never requested on first load. Scheduled workout reminders use onboarding weekdays and the chosen reminder time. In-app reminders remain available when push is unavailable. iPhone/iPad push requires a supported version and installation to the Home Screen.

## Architecture and security

Static GitHub Pages frontend and Supabase Edge Function. Existing custom PBKDF2 account authentication is preserved. Tokens are hashed server-side. Cloud operations resolve the account from the session token and scope private rows by user ID. Private tables deny anon/authenticated table access via RLS and grants. The service-role key and VAPID private key never enter the frontend. Public exercise templates remain readable; custom exercises are owner-only.

Additive SQL migrations are in `supabase/migrations`. `save_bodysmith_plan` creates atomic user-owned revisions. No existing account or workout records are deleted. Notification subscriptions belong to an account, and scheduler authentication comes from a server-only database secret. `pg_cron` calls the reminder worker every minute through `pg_net`. Times are interpreted in the user's saved IANA timezone. Expired subscriptions are removed. Check `net._http_response` for worker health; successful dispatch reports sent/failed counts. Browser push delivery requires a valid user-approved subscription and browser/network availability.

## Validation

- `npm ci --ignore-scripts`
- `npm test`: JavaScript syntax plus jsdom workout/onboarding/editor/offline UI tests.
- `node tests/assets-smoke.cjs`: PWA cache paths and media completeness.
- `npm run test:backend`: live independent-account registration/login, onboarding, template loading, active session protection, set validation/idempotency, substitution, completion/history, private plan edits, supplements and cross-user isolation. Creates uniquely named QA accounts; credentials/tokens are not printed. Run intentionally rather than for every commit.

GitHub Actions validates each push/PR. The live backend suite can be run manually with workflow_dispatch. Production backend source is in `supabase/functions/bodysmith-api`. Deploy with JWT verification disabled only because this function implements the existing custom authentication and separately authenticated scheduler. Apply migrations before deploying API changes.

## PWA updates

Release 2.0 versions the HTML asset references and service-worker cache together. App shell, raster install icons and exercise media are precached. Updates activate without deleting local workout storage. Close/reopen the installed app after a deployment to load the new frontend. Starting new sessions, plan editing and supplement creation require connectivity; active workout logging and supplement state logging queue offline.
