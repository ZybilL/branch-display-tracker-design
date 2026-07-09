# Staff Submission Form → Google Sheet

A standalone, production-ready implementation of the **branch staff submission flow**
described in the top-level design handoff (`../README.md`): a branch picker (`index.html`)
followed by an entry form (`submit.html`) that writes each submission as a row in a
Google Sheet, via a Google Apps Script web app acting as a lightweight backend.

This covers only the staff-facing data collection piece — not the admin/designer
screens (Product List, Design Approval, Branch Summary, Display Report) from the
original handoff, which read the design-tool prototype's in-memory/localStorage data
and would need their own real backend if built out later.

## How it works

- `index.html` — branch picker, links to `submit.html?branch=<CODE>`.
- `submit.html` + `submit.js` — the entry form (location, existing item, new item,
  photo, notes). On submit, it POSTs a JSON payload to your Apps Script web app URL.
- `script.js` — shared branch list, the Apps Script URL config, an image-compression
  helper, and the `fetch` call.
- `apps-script/Code.gs` — paste into a Google Sheet's Apps Script editor. Appends one
  row per submission to a `Submissions` sheet (created automatically).

**Photos**: Google Sheets cells can't hold binary images, so photos are resized
client-side (down to as small as 360px wide / low JPEG quality if needed) and stored as
a Base64 data-URL string in the "Photo (Base64)" column. Sheets caps a single cell at
**50,000 characters**; the client keeps photos under ~45,000 to leave headroom. If a
photo can't be brought under that limit even at the lowest quality step, the form shows
an error and asks the person to retake it — the submission is not sent without a fix.
If you outgrow this later, switch to uploading photos to Google Drive from `doPost` and
storing just the file link instead (ask to have this added).

## Setup

1. **Create the Sheet.** Make a new Google Sheet (this will hold submissions).
2. **Add the script.** In the Sheet, go to *Extensions → Apps Script*. Delete the
   default `Code.gs` contents and paste in this folder's `apps-script/Code.gs`.
3. **Deploy as a web app.**
   - Click *Deploy → New deployment*.
   - Select type: **Web app**.
   - Execute as: **Me**.
   - Who has access: **Anyone**.
   - Click *Deploy*, authorize when prompted, then copy the **Web app URL**.
4. **Wire up the form.** Open `script.js` and set:
   ```js
   var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/XXXXXXXX/exec';
   ```
5. **Host the three static files** (`index.html`, `submit.html`, `script.js`, `submit.js`,
   `styles.css`) anywhere that serves static HTML — GitHub Pages, Google Sites, an S3
   bucket, Netlify/Vercel static hosting, or just internally. No build step is required.
6. **Share the branch-specific links** (or the `index.html` link) with branch staff.

Any time you edit `Code.gs` after the first deploy, use *Deploy → Manage deployments →
(pencil icon) → New version* — saving the script alone does not update the live URL.

## Data model

Each row appended to the `Submissions` sheet:

| Column | Source |
|---|---|
| Timestamp | server time at submission |
| Branch | one of the 14 branch codes |
| Location | free text, e.g. "Front window" |
| Existing Item Code / Name | optional — blank for a fresh placement |
| New Item Code / Name | required |
| Notes | free text |
| Photo (Base64) | data URL string, or blank if no photo |

This mirrors the `Entry` data model in the top-level handoff doc, minus the
workflow (`status`) and designer (`approval`) fields, which belong to the
admin-side screens this piece doesn't implement.

## Testing locally

Open `index.html` directly in a browser (no server needed), pick a branch, fill the
form, and submit — check the Google Sheet for the new row. If submission fails, open
the browser console: the most common causes are (a) `APPS_SCRIPT_URL` not set, or
(b) the deployment's access isn't set to "Anyone".
