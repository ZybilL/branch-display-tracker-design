# Portfolio Tracker

A small manual-entry investment portfolio tracker: log your holdings (ticker, quantity, cost basis), and it fetches live prices to compute market value, gain/loss, day change, and allocation.

## Run it

```
cd portfolio-tracker
npm install
npm start
```

Open http://localhost:3001.

## How it works

- **Holdings** are entered by hand (ticker, quantity, average cost per share, optional purchase date/notes) and persisted to `data/holdings.json`.
- **Prices** are fetched server-side from Yahoo Finance's public chart endpoint (no API key required) and cached for 60 seconds. This avoids CORS issues and keeps API calls off the client.
- If a ticker's price can't be fetched (bad symbol, API down, delisted, etc.), you can set a **manual price override** on that holding so it's still counted — otherwise it's excluded from portfolio totals and flagged in the UI.
- All computed fields (market value, gain/loss, allocation %, day change) are derived server-side in `server.js` and returned alongside the raw holding data.

## Notes

- This is a single-user local tool — no auth, no multi-portfolio support.
- Data lives in a flat JSON file (`data/holdings.json`); swap in a real database if you need concurrent access or history.
- If you deploy this somewhere with restricted outbound network access, live price lookups will fail — the manual price override exists for exactly that case.
