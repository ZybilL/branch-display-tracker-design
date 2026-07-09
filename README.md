# Handoff: Branch Product Display Tracker

## Overview
An internal tool for a 14-branch retail chain (branches: BTRD, BTB, BTK, BTP, BTRP, BTR, BTN, BTY, BTH, BTRY, BTKR, BTCM, BTSR, BTUD). Branch staff photograph their current in-store product display and log which item needs to be replaced with which new item. A designer reviews and approves/rejects each submission. Approved/rejected jobs are compiled into a report sent to the schematic (visual merchandising) team, who action the physical replacement.

## About the Design Files
The files in this bundle are **design references built in HTML** (a prototyping tool's proprietary "Design Component" format — `.dc.html`). They render correctly in a browser for review, but they are **not production code** — do not copy the markup or the `class Component extends DCLogic` logic directly into the app. Two files are internal helpers used only by the prototyping tool and should be ignored: `support.js` (if present) is the prototype runtime; `doc-page.js` and `image-slot.js` are stand-in placeholder components (paged-document shell and drag-and-drop image slot respectively) — replace their functionality with the target codebase's own equivalents (e.g. a real file upload and a real PDF/print stylesheet or reporting library).

**Task**: recreate these designs in the target codebase's existing environment (React, Vue, native app, etc.) using its established patterns, component library, and state management — or, if no environment exists yet, choose the most appropriate stack and build it there.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and copy shown are final — recreate pixel-close using the values below. Layout and interaction patterns (filters, pagination, modals) should be implemented faithfully.

## Data Model

A single **Entry** (a display-replacement job) has:
- `id` — unique identifier
- `branch` — one of the 14 branch codes above
- `location` — free text, e.g. "Front window", "Shelf 3, aisle 2", "Checkout counter"
- `photo` — the branch staff's photo of the current display (image upload)
- `existingItemCode` / `existingItemName` — the item currently in place (optional — may be blank for a fresh placement rather than a swap)
- `itemCode` / `itemName` — the new item to replace it with (required)
- `status` — one of `pending` / `in_progress` / `done` (workflow status of the physical replacement)
- `approval` — one of `needs_review` / `approved` / `rejected` (designer's decision, set on the Design Approval screen)
- `notes` — free text from branch staff
- `date` — submission date (used for month/year filtering and the summary charts)

In this prototype all data is in-memory sample data (reset on reload); the designer's approve/reject decisions are the one thing persisted, via the browser's `localStorage` under key `productDisplayApprovals` (a map of `branch|itemCode` → approval value), read by both the Design Approval screen and the Display Report screen so a decision made in one shows up in the other. **In production this entire model should live in a real database**, with photo uploads going to real object storage (S3/GCS/etc.), not localStorage.

### Note on the original ask
The user asked whether this could connect to a Google Sheet to collect submissions. It can't from within the prototype tool (no backend). The cleanest real implementation: branch staff submissions write rows to a database (or, if a lightweight Sheets-based backend is preferred, a Google Apps Script web app endpoint that appends rows to a Sheet) — the Landing Page → Product List submission flow below should POST to that endpoint instead of writing to local component state.

## Screens / Views

### 1. Landing Page (`Landing Page.dc.html`)
**Purpose**: Entry point shared with branch staff (a branch-specific link). Explains the 3-step task and lets the user pick their branch.
**Layout**: Centered white card (max-width 640px) on a light neutral background (`oklch(98% 0.004 250)` ≈ `#F7F8FA`), 18px border radius, 40px/36px padding.
**Content**:
- Title "Product Display Update" (26px/800 weight)
- Subtitle instructions (15px, gray `oklch(45% 0.02 250)` ≈ `#6B7280`)
- 3 numbered steps (26px circular badges, tinted background using the accent color at 14% mix with white)
- "SELECT YOUR BRANCH" label (13px, uppercase, bold)
- Grid of 14 branch buttons (`repeat(auto-fill, minmax(120px,1fr))`, 10px gap), each a pill-cornered (11px radius) bordered button; hover state fills with the accent-tinted background and border
- Accent color is a tweakable prop, default teal `#0F766E` (other options offered: `#2456C9`, `#4338CA`, `#0E7490`)
- Each branch button links to `Product List.dc.html?branch=<CODE>`

### 2. Product List (`Product List.dc.html`)
**Purpose**: Main tracker — branch staff/admin view and add entries for one branch at a time (branch selected via left sidebar or URL `?branch=` param).
**Layout**: Full-height flex row: fixed 230px white sidebar (right border) + flexible main content area.
**Sidebar**: logo mark (gradient square) + "Product Display" wordmark; nav items "All Items" (link to self), "Design Approval" (link to that screen), "Pending Action" (badge count), "My Items" (placeholder, non-functional in the prototype); "Branches" section — scrollable list of all 14 branches with entry counts, click to switch active branch (updates URL `?branch=`); "Reports" section — links to Branch Summary and Display Report.
**Top bar**: "← Branches" back link to Landing Page, search input (filters by location/item name), notification icon + "Admin" user chip (decorative).
**Content header**: page title = active branch code + total count; status filter pills (All/Pending/In Progress/Done, each showing a count); Month and Year filter dropdowns (populated from data present); "+ Add Entry" primary button (teal, `#0F766E`).
**Table** columns: Photo (64×64px thumbnail) · Location · Existing Code (monospace) · Existing Product Name · New Code (monospace) · New Product Name (bold) · Status (colored pill: pending = amber, in_progress = blue, done = green) · Progress (thin bar + %, tied to status: pending 20%, in_progress 60%, done 100%) · row-delete icon button.
Clicking anywhere on a row (except the delete icon) navigates to Product Detail for that entry. Pagination at the bottom (10 rows/page), prev/next + numbered pages.
**Add Entry modal**: centered overlay, fields — Branch (read-only, pre-filled), Display Location (text), Existing Item (Code + Product name, two inputs side by side — optional), New Item to Replace With (Code + Product name — required), Photo (image drop zone). Save adds the entry with status `pending` and today's date.

### 3. Product Detail (`Product Detail.dc.html`)
**Purpose**: Read-only detail view of a single entry, reached by clicking a Product List row (`?entry=<id>&branch=<code>`).
**Layout**: Slim header with "← Back to {branch}" link. Below: 2-column layout — large square photo on the left (340px, display-only, not editable/droppable here), info column on the right.
**Info column**: status pill + branch label; location as the page heading; two side-by-side cards for Location and Notes (always shown, "—" if empty); two side-by-side cards for Existing Item and New Item (code + name); Progress bar (same status→% mapping as the list); a "Remark" textarea at the bottom for the schematic team to leave a comment (local state only in the prototype).

### 4. Design Approval (`Design Approval.dc.html`)
**Purpose**: A designer reviews every submission and marks it Approved or Rejected before it's scheduled.
**Layout**: Same sidebar/top-bar shell as Product List, with "Design Approval" highlighted active in the sidebar and a badge showing the total count of items still `needs_review` across all branches.
**Content**: Approval filter pills (All/Needs Review/Approved/Rejected with counts). Table columns: Photo · Location · Existing Code/Name · New Code/Name · Approval (pill) · Decision (two buttons: "✓ Approve" / "✕ Reject" — the active choice is highlighted solid, the other stays outlined). Changing a row's decision marks it "Not yet submitted" under the pill until the designer clicks the page-level **"✓ Submit Decisions (N)"** button (disabled/grey when there are no pending changes), which commits all changed rows at once and writes them to shared storage (`localStorage` in the prototype — a real backend call in production) so the Display Report reflects the update.

### 5. Branch Summary (`Branch Summary.dc.html`)
**Purpose**: A mini executive dashboard across all 14 branches.
**Layout**: Same sidebar shell, "Summary" active.
**Content**, top to bottom:
- "Dashboard" eyebrow + "Display Update Summary" H1 + "Across all 14 branches" subtitle
- A single-row stat strip (6 cells sharing hairline dividers, no individual card borders): Total Entries, Pending, In Progress, Done, Items In (new placements — no existing item), Items Out (true swaps — has an existing item)
- Status summary: one stacked horizontal bar (pending = warm amber, in_progress = blue, done = green) + a legend row with counts/percentages underneath
- Two side-by-side charts: **Entries by month** (plain vertical bar chart, blue bars) and **Entries by year** (distinct visual treatment — light grey card containing horizontal bars) — deliberately styled differently from each other per a design decision to visually separate the two timeframes
- Entries by branch: a slim horizontal-bar list, one row per branch (code + proportional bar + count)

### 6. Display Report (`Display Report.dc.html`)
**Purpose**: A printable/exportable report of all open jobs, grouped by branch, for the schematic team.
**Layout**: Same sidebar shell ("Job Report" active) + a slim header (title + "⬇ Export to CSV" button) above the document. The document itself uses a "paged document" component (letter size, 0.75in margins) so it paginates correctly when printed to PDF; the sidebar and header are marked print-hidden so only the document prints.
**Document content**: H1 "Product Display Update — Job Report" + "Prepared for: Schematic Team" + today's date, an intro paragraph with live counts, then one H2 + table per branch. Table columns: Location · Existing Code · Existing Item · New Code · New Item (bold) · Status · Approval · Notes. "Export to CSV" downloads the same data (including any Approval decisions submitted from Design Approval) as a CSV file.

## Interactions & Behavior Summary
- Branch switching (sidebar click or `?branch=` URL param) is instant client-side filtering — no page reload.
- Row click → detail navigation; delete icon on a row stops that click from also triggering navigation (`stopPropagation`).
- Design Approval's Approve/Reject buttons stage a change; nothing is "official" until Submit Decisions is clicked (batch confirm pattern) — replicate this two-step (stage → confirm) interaction faithfully, it's intentional so a designer can review several rows before committing.
- Approved/Rejected decisions flow from Design Approval → Display Report. In production this must be a real write (API call to your backend), not localStorage.
- CSV export uses the current data including any approval overrides.

## Design Tokens
- **Base font**: Inter (400/500/600/700/800), fallback system sans-serif.
- **Accent (primary) color**: teal `#0F766E`, secondary usable options `#2456C9` (blue), `#4338CA` (indigo), `#0E7490` (cyan) — the Landing Page exposes this as a tweakable prop.
- **Neutral background**: `oklch(97–99% 0.002–0.006 250)` ≈ near-white cool grey (`#F6F7F9`–`#FAFAFB`).
- **Body text**: `oklch(22% 0.02 250)` ≈ `#1F2430` (near-black, slight blue tint).
- **Secondary text**: `oklch(45–52% 0.015–0.02 250)` ≈ `#6B7280`–`#7A8290` grey.
- **Borders/dividers**: `oklch(90–94% 0.005–0.01 250)` ≈ `#E5E7EB`–`#EDEEF1`.
- **Status colors**: Pending = amber (`oklch(93% 0.04 230)` bg / `oklch(45% 0.15 230)` text — actually rendered as a warm amber in the UI, treat as `#FDE9C8`/`#92620B`-ish); In Progress = blue (`#E3EBFC`/`#2D4C8C`-ish); Done = green (`#DEF3E6`/`#1F7A4C`-ish). Reuse the same three colors for Approval states: Needs Review (amber), Approved (green), Rejected (red, `#FBE1E1`/`#B33636`-ish).
- **Border radius scale**: 7–9px (buttons, inputs, pills use 999px), 12–16px (cards), 18px (Landing Page card).
- **Spacing scale**: primarily 6/8/10/12/14/16/18/22/24/28/32px steps.

## Assets
No custom icons — emoji glyphs are used as lightweight icons throughout (▤ 📊 🖨 ✓ 🔎 🔔 ⏱ ☰ 🗑 ⬇). Replace with your icon system if emoji aren't part of your brand. Photos are user-uploaded (drag-and-drop placeholders in the prototype, via a stand-in `<image-slot>` component) — wire to your real upload/storage flow.

## Files
- `Landing Page.dc.html` — branch picker / entry screen
- `Product List.dc.html` — per-branch entry list + add-entry flow
- `Product Detail.dc.html` — single-entry detail view
- `Design Approval.dc.html` — designer review/approve-reject flow
- `Branch Summary.dc.html` — cross-branch dashboard
- `Display Report.dc.html` — printable job report + CSV export

Open any `.dc.html` file directly in a browser to view/interact with the design. Reference screenshots of each screen are in `screenshots/`.
