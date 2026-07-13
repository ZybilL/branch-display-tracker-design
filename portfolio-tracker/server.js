const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data', 'holdings.json');
const QUOTE_TTL_MS = 60 * 1000;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- Storage ----

function readHoldings() {
  if (!fs.existsSync(DATA_FILE)) return [];
  const raw = fs.readFileSync(DATA_FILE, 'utf8').trim();
  return raw ? JSON.parse(raw) : [];
}

function writeHoldings(holdings) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(holdings, null, 2));
}

// ---- Quotes (Yahoo Finance chart endpoint, no API key required) ----

const quoteCache = new Map(); // symbol -> { at, data }

async function fetchQuote(symbol) {
  const cached = quoteCache.get(symbol);
  if (cached && Date.now() - cached.at < QUOTE_TTL_MS) return cached.data;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortfolioTracker/1.0)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') throw new Error('No price in response');

    const data = {
      symbol,
      price: meta.regularMarketPrice,
      previousClose: meta.previousClose ?? meta.chartPreviousClose ?? null,
      currency: meta.currency || 'USD',
      ok: true,
      fetchedAt: new Date().toISOString(),
    };
    quoteCache.set(symbol, { at: Date.now(), data });
    return data;
  } catch (err) {
    const data = { symbol, ok: false, error: err.message };
    quoteCache.set(symbol, { at: Date.now(), data });
    return data;
  }
}

async function fetchQuotes(symbols) {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))];
  const results = await Promise.all(unique.map(fetchQuote));
  const bySymbol = {};
  for (const r of results) bySymbol[r.symbol] = r;
  return bySymbol;
}

// ---- Enrichment ----

function enrich(holding, quote) {
  const price = quote?.ok ? quote.price : holding.manualPrice ?? null;
  const priceSource = quote?.ok ? 'live' : holding.manualPrice != null ? 'manual' : 'unavailable';
  const costBasisTotal = holding.quantity * holding.costPerShare;
  const marketValue = price != null ? holding.quantity * price : null;
  const gainLoss = marketValue != null ? marketValue - costBasisTotal : null;
  const gainLossPct = marketValue != null && costBasisTotal > 0 ? (gainLoss / costBasisTotal) * 100 : null;
  const dayChange =
    quote?.ok && quote.previousClose != null ? (quote.price - quote.previousClose) * holding.quantity : null;
  const dayChangePct =
    quote?.ok && quote.previousClose ? ((quote.price - quote.previousClose) / quote.previousClose) * 100 : null;

  return {
    ...holding,
    currentPrice: price,
    priceSource,
    costBasisTotal,
    marketValue,
    gainLoss,
    gainLossPct,
    dayChange,
    dayChangePct,
    currency: quote?.ok ? quote.currency : holding.currency || 'USD',
  };
}

function summarize(enriched) {
  const withValue = enriched.filter((h) => h.marketValue != null);
  const totalValue = withValue.reduce((sum, h) => sum + h.marketValue, 0);
  const totalCost = enriched.reduce((sum, h) => sum + h.costBasisTotal, 0);
  // Gain/loss is only meaningful over holdings that actually have a current price,
  // so it's computed against pricedCost rather than totalCost (which may include
  // unpriced holdings and would otherwise skew the percentage).
  const pricedCost = withValue.reduce((sum, h) => sum + h.costBasisTotal, 0);
  const totalGainLoss = totalValue - pricedCost;
  const totalGainLossPct = pricedCost > 0 ? (totalGainLoss / pricedCost) * 100 : null;
  const totalDayChange = enriched.reduce((sum, h) => sum + (h.dayChange || 0), 0);
  const totalDayChangePct = totalValue - totalDayChange > 0 ? (totalDayChange / (totalValue - totalDayChange)) * 100 : null;
  const unpricedCount = enriched.length - withValue.length;

  return {
    holdingCount: enriched.length,
    unpricedCount,
    totalValue,
    totalCost,
    totalGainLoss,
    totalGainLossPct,
    totalDayChange,
    totalDayChangePct,
  };
}

// ---- Routes ----

app.get('/api/holdings', async (req, res) => {
  const holdings = readHoldings();
  const quotes = await fetchQuotes(holdings.map((h) => h.ticker));
  const enriched = holdings
    .map((h) => enrich(h, quotes[h.ticker.toUpperCase()]))
    .map((h) => ({
      ...h,
      allocationPct: null, // filled below once totalValue is known
    }));
  const summary = summarize(enriched);
  const withAllocation = enriched.map((h) => ({
    ...h,
    allocationPct: summary.totalValue > 0 && h.marketValue != null ? (h.marketValue / summary.totalValue) * 100 : null,
  }));
  res.json({ holdings: withAllocation, summary });
});

app.post('/api/holdings', (req, res) => {
  const { ticker, quantity, costPerShare, purchaseDate, notes, manualPrice } = req.body;
  if (!ticker || !quantity || costPerShare == null) {
    return res.status(400).json({ error: 'ticker, quantity, and costPerShare are required' });
  }
  const holdings = readHoldings();
  const holding = {
    id: crypto.randomUUID(),
    ticker: String(ticker).toUpperCase().trim(),
    quantity: Number(quantity),
    costPerShare: Number(costPerShare),
    purchaseDate: purchaseDate || null,
    notes: notes || '',
    manualPrice: manualPrice != null && manualPrice !== '' ? Number(manualPrice) : null,
  };
  holdings.push(holding);
  writeHoldings(holdings);
  res.status(201).json(holding);
});

app.put('/api/holdings/:id', (req, res) => {
  const holdings = readHoldings();
  const idx = holdings.findIndex((h) => h.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const { ticker, quantity, costPerShare, purchaseDate, notes, manualPrice } = req.body;
  const existing = holdings[idx];
  holdings[idx] = {
    ...existing,
    ticker: ticker !== undefined ? String(ticker).toUpperCase().trim() : existing.ticker,
    quantity: quantity !== undefined ? Number(quantity) : existing.quantity,
    costPerShare: costPerShare !== undefined ? Number(costPerShare) : existing.costPerShare,
    purchaseDate: purchaseDate !== undefined ? purchaseDate : existing.purchaseDate,
    notes: notes !== undefined ? notes : existing.notes,
    manualPrice:
      manualPrice !== undefined ? (manualPrice != null && manualPrice !== '' ? Number(manualPrice) : null) : existing.manualPrice,
  };
  writeHoldings(holdings);
  res.json(holdings[idx]);
});

app.delete('/api/holdings/:id', (req, res) => {
  const holdings = readHoldings();
  const next = holdings.filter((h) => h.id !== req.params.id);
  if (next.length === holdings.length) return res.status(404).json({ error: 'Not found' });
  writeHoldings(next);
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`Portfolio tracker running at http://localhost:${PORT}`);
});
