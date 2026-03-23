// ── ALL EXPENSES ─────────────────────────────────────────────────
function populateExpenseFilters() {
  const months = [...new Set(expenses.map(e => e.date.slice(0,7)))].sort().reverse();
  const mSel = document.getElementById('filter-month');
  if (mSel) {
    const cur = mSel.value;
    mSel.innerHTML = '<option value="">All Months</option>' + months.map(m => {
      const d = new Date(m + '-01');
      return `<option value="${m}">${d.toLocaleDateString('en-GB', { month:'long', year:'numeric' })}</option>`;
    }).join('');
    mSel.value = cur;
  }
  const cats = [...new Set(expenses.map(e => e.category).filter(Boolean))].sort();
  const cSel = document.getElementById('filter-cat');
  if (cSel) {
    const cc = cSel.value;
    cSel.innerHTML = '<option value="">All Categories</option>' + cats.map(c => `<option>${c}</option>`).join('');
    cSel.value = cc;
  }
  buildOutletSelect('filter-outlet');
}

function renderExpenses() {
  const mF  = document.getElementById('filter-month')?.value || '';
  const ocF = document.getElementById('filter-overall-cat')?.value || '';
  const cF  = document.getElementById('filter-cat')?.value || '';
  const oF  = document.getElementById('filter-outlet')?.value || '';

  const filtered = expenses
    .filter(e => (!mF || e.date.startsWith(mF)) && (!ocF || e.overall_cat === ocF) && (!cF || e.category === cF) && (!oF || e.outlet === oF))
    .sort((a,b) => b.date.localeCompare(a.date));

  const tPaid   = filtered.reduce((s,e) => s + e.paid, 0);
  const tActual = filtered.reduce((s,e) => s + (e.actual || e.paid), 0);
  const tSaved  = tActual - tPaid;

  const totEl = document.getElementById('filtered-total');
  if (totEl) totEl.textContent = `${filtered.length} expenses · Paid ${fmt(tPaid)} · Actual ${fmt(tActual)} · Saved ${fmt(tSaved)}`;

  const tbody = document.getElementById('expenses-tbody');
  if (!tbody) return;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10">
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">No expenses found</div>
        <div class="empty-sub">Try adjusting your filters or add new expenses</div>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(e => `
    <tr>
      <td class="date-cell" style="white-space:nowrap">
        <span style="font-size:13px;color:var(--text2)">${fmtDate(e.date)}</span>
        <div class="date-tooltip">${e.day || ''}, ${e.month || ''}</div>
      </td>
      <td style="font-weight:500">${e.outlet}</td>
      <td>${catBadge(e.overall_cat)}</td>
      <td><span class="sub-cat-badge">${e.category || '—'}</span></td>
      <td style="font-size:12px;color:var(--text2)">${e.item || '—'}</td>
      <td class="mono">${fmt(e.paid)}</td>
      <td class="mono" style="color:var(--text2)">${fmt(e.actual)}</td>
      <td>${savingBadge(e.paid, e.actual)}</td>
      <td style="font-size:12px;color:var(--text3)">${e.payment}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteExpense(${e.id})">×</button></td>
    </tr>`).join('');
}

async function deleteExpense(id) {
  expenses = expenses.filter(e => e.id !== id);
  saveLocal();
  renderExpenses();
  toast('Expense deleted');
  await deleteFromSupabase(id);
}
