# FitLog — Workout Tracker

A free workout log with **real-time analytics**. Data is stored in your browser (`localStorage`) — no server required. Works on GitHub Pages.

## Features

- **Log workouts:** day, type, calories, hours
- **Edit & delete** any entry from the table
- **Live analytics** that update instantly when you change data:
  - Summary stats (totals and averages)
  - Text insights (top type, best session, kcal/hour)
  - Calories over time (line)
  - Hours & calories by workout type (bar)
  - Sessions by type (doughnut)
  - Weekly calorie comparison (bar)
  - Hours by day of week (bar)

## Preview locally

```bash
cd my-website
python3 -m http.server 8080
```

Open http://localhost:8080

## Publish updates

```bash
git add .
git commit -m "Update workout tracker"
git push
```

Live site: https://aaronshaijan.github.io/my-website/

## Customize workout types

Edit the `<select id="workout-type">` options in `index.html`.

## Note on data

Workouts are saved **only in this browser** on this device. Clearing site data removes them. For sync across devices you’d need a database (can be added later).
