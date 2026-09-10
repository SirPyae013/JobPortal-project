# Original design and restoration

The complete frontend before the Campus Modern refresh is saved in:

`frontend-original-20260909-135525.zip`

SHA-256: `3B5CEBDCC1555DA62B00D960B8B0DAA9D192AE07CB1159E8C304FF39D780DDA0`

It contains the original source, package manifest and lockfile, HTML, and build configuration. Generated dependencies (`node_modules`) and build output (`dist`) are excluded. The Django backend and its data are not part of this UI backup and were not changed by the redesign.

## Active design

Campus Modern is the only active design, as requested after reviewing the refresh. Open `http://localhost:3000/jobs`.

The original navigation and student view, the alternate recruiter layout, and the preview switch/preferences have been removed from the application. Old preview query parameters and saved browser preferences are ignored; every visit uses Campus Modern.

The active navigation, student view, and stylesheet live in `frontend/src/designs/modern/`. The recruiter page in `frontend/src/pages/RecruiterDashboard.tsx` uses the modern layout directly. `frontend/src/index.css` remains necessary for Tailwind, fonts, and shared theme tokens. The ZIP above is an offline recovery archive and is not included in the running application.

## Fully restore the archived frontend

1. Stop the frontend development server.
2. Rename the current `frontend` folder to a new, unused name such as `frontend-modern-kept-20260909`. Keep that folder as your backup of the refreshed design.
3. Create an empty `frontend` folder and extract the ZIP into it. Confirm that `frontend/package.json` and `frontend/src/main.tsx` are present directly inside that folder, without an extra nested `frontend` folder.
4. From the project root, run `npm.cmd --prefix frontend install` and then `npm.cmd --prefix frontend run dev`.

No backend files or database need to be restored. Do not extract over the modern source as a full rollback: that would leave additional modern files mixed into the old project.

## Design directions

| Direction | Appearance | Fit |
| --- | --- | --- |
| **Campus Modern — selected and implemented** | Navy and teal, crisp white panels, restrained borders, clear job cards | Balances an approachable student experience with employer credibility |
| Minimal Professional | White and charcoal, compact lists and tables, restrained accents | A more recruiter-focused product with high information density |
| Bold Graduate | Stronger accent colors, larger typography, more expressive student storytelling | A more youthful brand, especially for recruitment campaigns |

The recommended next direction is to keep Campus Modern consistent as the site grows. Keep the search and actual roles near the top, show compensation and application requirements clearly, and use imagery selectively so the job search stays fast.

Reference points: [Handshake's student and early-career audience](https://joinhandshake.com/students/) provides a relevant product context. [W3C guidance on page structure](https://www.w3.org/WAI/tutorials/page-structure/) supports labeled navigation, logical headings and skip links. The color and visual-direction recommendations are design judgments for this project.

## Validation

Run the existing type check and build, plus the focused regression checks:

```powershell
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run build
node --test frontend/tests/design.test.mjs
```

The six focused checks cover search/filter combinations, chronological sorting, compensation ranges, complete application history, pagination defaults, and repeated-page protection. The obsolete design-preference check was removed with the switch.

The initial refresh passed TypeScript, production build, and local API checks. The user reviewed and selected Campus Modern. Retiring the original does not modify the backend, accounts, jobs, applications, or uploads.
