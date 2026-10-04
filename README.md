# WebOpt Lab

Live demos of React performance tricks. You interact with a slow and a fast version of the same feature
and watch frame rate, main-thread load, memory and DOM size change in real time.

**Live site:** https://sidhilsivdas.github.io/webopt-lab/ · **Test results:** https://sidhilsivdas.github.io/webopt-lab/results.html

## Trick #1: Rendering huge lists

The same list of users (10,000 to 100,000 rows) is shown three ways:

| Version | How it works |
|---|---|
| Without TanStack Query | Fetches every row at once and renders all of them |
| TanStack Query | `useInfiniteQuery` fetches 200 rows at a time, but every loaded row stays rendered |
| TanStack Query + Virtual | Paged fetching, plus `@tanstack/react-virtual` renders only the visible rows |

At 25,000 rows, the virtual version opens the list 45× faster, responds to clicks 84× faster, and scrolls at
60 fps instead of 9. The [test results page](https://sidhilsivdas.github.io/webopt-lab/results.html) has the full
measurements.

Everything runs in the browser. Data comes from a fake in-browser API, so no server is needed.

## Run it

```sh
npm install
npm run dev          # http://localhost:5173
npm run build        # production build in dist/
npm run preview      # serve the production build (use for realistic numbers)
```

Use Chrome or Edge. The memory and long-task metrics rely on Chromium-only APIs.

## Tests

[Playwright](https://playwright.dev) tests drive the app in the locally installed Chrome:

```sh
npm run test:quick   # functional tests (~10 min)
npm run test:e2e     # functional tests + performance matrix (~15 min)
npm run test:report  # write TEST-MATRIX.md and refresh the results page data
```

## Stack

Vite, React 19, TypeScript, Tailwind CSS v4, TanStack Query, TanStack Virtual, Playwright.
The results page is plain TypeScript with no framework, which keeps it lightweight.

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.
