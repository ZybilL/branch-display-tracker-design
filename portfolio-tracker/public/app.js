const statStrip = document.getElementById('statStrip');
const holdingsBody = document.getElementById('holdingsBody');
const holdingCount = document.getElementById('holdingCount');
const emptyState = document.getElementById('emptyState');
const allocationList = document.getElementById('allocationList');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const holdingForm = document.getElementById('holdingForm');

const fmtUSD = (n) =>
  n == null ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const fmtPct = (n) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`);
const signClass = (n) => (n == null ? 'neutral' : n > 0 ? 'positive' : n < 0 ? 'negative' : 'neutral');

async function loadHoldings() {
  const res = await fetch('/api/holdings');
  const { holdings, summary } = await res.json();
  renderSummary(summary);
  renderTable(holdings);
  renderAllocation(holdings);
  document.getElementById('unpricedNote').hidden = !summary.unpricedCount;
  document.getElementById('unpricedNote').textContent = summary.unpricedCount
    ? `${summary.unpricedCount} holding${summary.unpricedCount === 1 ? ' has' : 's have'} no price available — totals exclude them. Add a manual price override to include them.`
    : '';
}

function renderSummary(s) {
  const cells = [
    { label: 'Total Value', value: fmtUSD(s.totalValue) },
    { label: 'Total Cost Basis', value: fmtUSD(s.totalCost) },
    {
      label: 'Total Gain/Loss',
      value: fmtUSD(s.totalGainLoss),
      sub: fmtPct(s.totalGainLossPct),
      cls: signClass(s.totalGainLoss),
    },
    {
      label: 'Day Change',
      value: fmtUSD(s.totalDayChange),
      sub: fmtPct(s.totalDayChangePct),
      cls: signClass(s.totalDayChange),
    },
    { label: 'Holdings', value: String(s.holdingCount) },
  ];
  statStrip.innerHTML = cells
    .map(
      (c) => `
    <div class="stat-cell">
      <div class="stat-label">${c.label}</div>
      <div class="stat-value ${c.cls || ''}">${c.value}</div>
      ${c.sub ? `<div class="stat-sub ${c.cls || ''}">${c.sub}</div>` : ''}
    </div>`
    )
    .join('');
}

function renderTable(holdings) {
  holdingCount.textContent = holdings.length ? `${holdings.length} position${holdings.length === 1 ? '' : 's'}` : '';
  emptyState.hidden = holdings.length > 0;

  holdingsBody.innerHTML = holdings
    .map((h) => {
      const priceBadge =
        h.priceSource === 'manual'
          ? '<span class="badge badge-manual">manual</span>'
          : h.priceSource === 'unavailable'
          ? '<span class="badge badge-unavailable">no price</span>'
          : '';
      return `
      <tr data-id="${h.id}">
        <td class="ticker-cell">${h.ticker}</td>
        <td class="mono">${h.quantity}</td>
        <td class="mono">${fmtUSD(h.costPerShare)}</td>
        <td class="mono">${fmtUSD(h.currentPrice)}${priceBadge}</td>
        <td class="mono">${fmtUSD(h.marketValue)}</td>
        <td class="mono ${signClass(h.gainLoss)}">${fmtUSD(h.gainLoss)}<br><span class="stat-sub">${fmtPct(h.gainLossPct)}</span></td>
        <td class="mono ${signClass(h.dayChange)}">${fmtUSD(h.dayChange)}<br><span class="stat-sub">${fmtPct(h.dayChangePct)}</span></td>
        <td class="mono">${h.allocationPct == null ? '—' : h.allocationPct.toFixed(1) + '%'}</td>
        <td>
          <button class="icon-btn edit-btn" title="Edit">✎</button>
          <button class="icon-btn delete-btn" title="Delete">🗑</button>
        </td>
      </tr>`;
    })
    .join('');

  holdingsBody.querySelectorAll('.edit-btn').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      const id = e.target.closest('tr').dataset.id;
      const holding = holdings.find((h) => h.id === id);
      openModal(holding);
    })
  );
  holdingsBody.querySelectorAll('.delete-btn').forEach((btn) =>
    btn.addEventListener('click', async (e) => {
      const id = e.target.closest('tr').dataset.id;
      if (!confirm('Remove this holding?')) return;
      await fetch(`/api/holdings/${id}`, { method: 'DELETE' });
      loadHoldings();
    })
  );
}

function renderAllocation(holdings) {
  const sorted = [...holdings].filter((h) => h.allocationPct != null).sort((a, b) => b.allocationPct - a.allocationPct);
  if (!sorted.length) {
    allocationList.innerHTML = '<p class="muted">No priced holdings yet.</p>';
    return;
  }
  allocationList.innerHTML = sorted
    .map(
      (h) => `
    <div class="allocation-row">
      <span class="ticker-cell">${h.ticker}</span>
      <span class="allocation-bar-track"><span class="allocation-bar-fill" style="width:${h.allocationPct}%"></span></span>
      <span class="mono">${h.allocationPct.toFixed(1)}%</span>
    </div>`
    )
    .join('');
}

function openModal(holding) {
  modalTitle.textContent = holding ? `Edit ${holding.ticker}` : 'Add Holding';
  document.getElementById('holdingId').value = holding?.id || '';
  document.getElementById('ticker').value = holding?.ticker || '';
  document.getElementById('quantity').value = holding?.quantity ?? '';
  document.getElementById('costPerShare').value = holding?.costPerShare ?? '';
  document.getElementById('purchaseDate').value = holding?.purchaseDate || '';
  document.getElementById('manualPrice').value = holding?.manualPrice ?? '';
  document.getElementById('notes').value = holding?.notes || '';
  modalOverlay.hidden = false;
}

function closeModal() {
  modalOverlay.hidden = true;
  holdingForm.reset();
}

document.getElementById('addBtn').addEventListener('click', () => openModal(null));
document.getElementById('cancelBtn').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});
document.getElementById('refreshBtn').addEventListener('click', loadHoldings);

holdingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('holdingId').value;
  const payload = {
    ticker: document.getElementById('ticker').value,
    quantity: document.getElementById('quantity').value,
    costPerShare: document.getElementById('costPerShare').value,
    purchaseDate: document.getElementById('purchaseDate').value || null,
    manualPrice: document.getElementById('manualPrice').value || null,
    notes: document.getElementById('notes').value,
  };
  if (id) {
    await fetch(`/api/holdings/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } else {
    await fetch('/api/holdings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }
  closeModal();
  loadHoldings();
});

loadHoldings();
