# BodySmith MVP

A no-build, mobile-first, installable workout PWA built for the BodySmith training system.

## What works now

- Push Day home screen with all seven programmed exercises
- Exercise-detail views and custom vector exercise illustrations
- Previous-session set references
- Guided set logging for weight, reps, RPE, and elbow pain
- Elbow warning at 4+/10 and stop/swap guidance at 6+/10
- Automatic rest timer using each exercise's programmed rest period
- Previous/next exercise controls
- Workout completion summary with duration, completion, average RPE, pain, and coaching note
- Basic progression logic
- Local history persistence
- Offline-friendly PWA shell and home-screen install support
- Navigation placeholders for Plan, Exercises, Progress, and Profile

## Run it

No build step is required. Serve the repository as static files. GitHub Pages works well.

## GitHub Pages

After the repository exists, enable Pages from the repository's default branch and root folder. The app uses relative paths and is ready for project-site hosting.

## Next build phase

1. Connect the existing BodySmith Apps Script backend for cloud sync.
2. Add Pull, Legs, and Upper + Arms from the existing workbook.
3. Replace MVP vector art with the final anatomical exercise-art library.
4. Build out Plan, Exercises, Progress, and Profile screens.
