const state = {
  filters: null,
  version: null,
  initialized: false,
  loading: false,
  dashboardLoading: false,
  watchTimer: null,
  activeView: 'dashboard',
  editor: {
    loaded: false,
    loading: false,
    page: 1,
    pages: 1,
    total: 0,
  },
};

const $ = (id) => document.getElementById(id);
const num = new Intl.NumberFormat('pt-BR');
const pct = (value) => `${Number(value || 0).toFixed(1).replace('.', ',')}%`;

function toast(message, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  $('toastStack').appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function setLoading(show) {
  state.loading = show;
  $('loadingLayer').classList.toggle('show', show);
}

async function api(url, options = {}) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  let body = {};
  try { body = await response.json(); } catch (_) {}
  if (!response.ok) throw new Error(body.message || `Erro HTTP ${response.status}`);
  return body;
}

function setSelectOptions(id, items, selectedValue) {
  const select = $(id);
  if (!select) return;
  const current = selectedValue ?? select.value;
  select.innerHTML = '<option value="__all__">Todos</option>';
  for (const item of items || []) {
    const option = document.createElement('option');
    option.value = item;
    option.textContent = item;
    select.appendChild(option);
  }
  if ([...select.options].some(o => o.value === current)) select.value = current;
  else select.value = '__all__';
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function toISODate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function rangeDates(range) {
  const max = state.filters?.date_max;
  const min = state.filters?.date_min;
  if (!max) return;
  $('endDate').value = max;
  if (range === 'all') {
    $('startDate').value = min || max;
  } else if (range === 'day') {
    $('startDate').value = max;
  } else {
    const end = new Date(`${max}T12:00:00`);
    end.setDate(end.getDate() - (Number(range) - 1));
    const calc = toISODate(end);
    $('startDate').value = min && calc < min ? min : calc;
  }
}

function markChip(value) {
  document.querySelectorAll('.chip').forEach(btn => btn.classList.toggle('active', btn.dataset.range === value));
}

function captureEditorFilters() {
  return {
    start: $('editorStartDate')?.value || '',
    end: $('editorEndDate')?.value || '',
    regional: $('editorRegionalFilter')?.value || '__all__',
    supervisor: $('editorSupervisorFilter')?.value || '__all__',
    rm: $('editorRmFilter')?.value || '__all__',
    station: $('editorStationFilter')?.value || '__all__',
    base: $('editorBaseFilter')?.value || '__all__',
    atendimento: $('editorAtendimentoFilter')?.value || '__all__',
  };
}

function populateEditorFilters(f, previous = {}) {
  setSelectOptions('editorRegionalFilter', f.regional, previous.regional);
  setSelectOptions('editorSupervisorFilter', f.supervisor, previous.supervisor);
  setSelectOptions('editorRmFilter', f.rm, previous.rm);
  setSelectOptions('editorStationFilter', f.station, previous.station);
  setSelectOptions('editorBaseFilter', f.base, previous.base);
  setSelectOptions('editorAtendimentoFilter', f.atendimento, previous.atendimento);

  $('editorStartDate').min = f.date_min || '';
  $('editorStartDate').max = f.date_max || '';
  $('editorEndDate').min = f.date_min || '';
  $('editorEndDate').max = f.date_max || '';
  $('editorStartDate').value = previous.start || f.date_min || '';
  $('editorEndDate').value = previous.end || f.date_max || '';
}

async function loadFilters({ preserve = false } = {}) {
  const previous = preserve ? {
    regional: $('regionalFilter')?.value,
    supervisor: $('supervisorFilter')?.value,
    rm: $('rmFilter')?.value,
    station: $('stationFilter')?.value,
    base: $('baseFilter')?.value,
    atendimento: $('atendimentoFilter')?.value,
    start: $('startDate')?.value,
    end: $('endDate')?.value,
  } : {};
  const editorPrevious = preserve ? captureEditorFilters() : {};

  const f = await api('/api/filters');
  state.filters = f;
  state.version = f.version;

  setSelectOptions('regionalFilter', f.regional, previous.regional);
  setSelectOptions('supervisorFilter', f.supervisor, previous.supervisor);
  setSelectOptions('rmFilter', f.rm, previous.rm);
  setSelectOptions('stationFilter', f.station, previous.station);
  setSelectOptions('baseFilter', f.base, previous.base);
  setSelectOptions('atendimentoFilter', f.atendimento, previous.atendimento);

  $('startDate').min = f.date_min || '';
  $('startDate').max = f.date_max || '';
  $('endDate').min = f.date_min || '';
  $('endDate').max = f.date_max || '';

  if (preserve && previous.start && previous.end) {
    $('startDate').value = previous.start > f.date_max ? f.date_max : previous.start;
    $('endDate').value = previous.end > f.date_max ? f.date_max : previous.end;
  } else {
    rangeDates('day');
  }

  populateEditorFilters(f, editorPrevious);
}

function queryString() {
  const params = new URLSearchParams();
  const mapping = {
    start_date: $('startDate').value,
    end_date: $('endDate').value,
    regional: $('regionalFilter').value,
    supervisor: $('supervisorFilter').value,
    rm: $('rmFilter').value,
    station: $('stationFilter').value,
    base: $('baseFilter').value,
    atendimento: $('atendimentoFilter').value,
  };
  Object.entries(mapping).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return params.toString();
}

function renderKpis(k) {
  $('kpiTotal').textContent = num.format(k.total || 0);
  $('kpiOwn').textContent = num.format(k.own || 0);
  $('kpiFranchise').textContent = num.format(k.franchise || 0);
  $('kpiBases').textContent = num.format(k.bases || 0);
  $('kpiDrivers').textContent = num.format(k.drivers || 0);
  $('kpiOwnPct').textContent = pct(k.total ? k.own / k.total * 100 : 0);
  $('kpiFranchisePct').textContent = pct(k.total ? k.franchise / k.total * 100 : 0);
}

function renderRm(rows) {
  $('rmCountBadge').textContent = `${rows.length} RMs`;
  const body = $('rmTableBody');
  body.innerHTML = '';
  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum dado para os filtros selecionados.</td></tr>';
    return;
  }
  rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="rank-number ${i < 3 ? 'top' : ''}">${i + 1}</span></td>
      <td title="${escapeHtml(r.rm)}">${escapeHtml(r.rm)}</td>
      <td class="num"><strong>${num.format(r.count)}</strong></td>
      <td class="num">${num.format(r.own)}</td>
      <td class="num">${num.format(r.franchise)}</td>
      <td class="num"><span class="share-cell"><span class="mini-track"><i style="width:${Math.min(100, r.share)}%"></i></span>${pct(r.share)}</span></td>`;
    body.appendChild(tr);
  });
}

function renderStations(rows) {
  const root = $('stationCards');
  root.innerHTML = '';
  rows.forEach(r => {
    const card = document.createElement('div');
    card.className = `station-card ${r.station === 'Franquia' ? 'franchise' : ''}`;
    card.innerHTML = `
      <div class="station-top"><div class="station-name"><span class="station-dot"></span>${escapeHtml(r.station)}</div><div class="station-count">${num.format(r.count)}</div></div>
      <div class="station-track"><i style="width:${Math.min(100, r.share)}%"></i></div>
      <div class="station-meta"><span><strong>${pct(r.share)}</strong> do PNR</span><span><strong>${num.format(r.bases)}</strong> bases</span><span>Top: <strong>${escapeHtml(r.top_base)}</strong></span></div>`;
    root.appendChild(card);
  });
}

function renderRanking(id, rows) {
  const root = $(id);
  root.innerHTML = '';
  if (!rows.length) {
    root.innerHTML = '<div class="empty-state">Nenhum dado para o período.</div>';
    return;
  }
  const max = Math.max(...rows.map(r => r.count), 1);
  rows.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'rank-row';
    row.innerHTML = `
      <div class="rank-pos">${String(i + 1).padStart(2, '0')}</div>
      <div class="rank-label-wrap"><div class="rank-label" title="${escapeHtml(r.label)}">${escapeHtml(r.label)}</div><div class="rank-track"><i style="width:${Math.max(2, r.count / max * 100)}%"></i></div></div>
      <div class="rank-count">${num.format(r.count)}</div>`;
    root.appendChild(row);
  });
}

function renderDaily(rows) {
  const root = $('dailyChart');
  root.innerHTML = '';
  if (!rows.length) {
    root.innerHTML = '<div class="empty-state">Sem dados diários para exibir.</div>';
    return;
  }
  const max = Math.max(...rows.map(r => r.count), 1);
  rows.forEach(r => {
    const height = Math.max(3, r.count / max * 100);
    const col = document.createElement('div');
    col.className = 'spark-col';
    col.style.setProperty('--h', `${height}%`);
    const d = new Date(`${r.date}T12:00:00`);
    const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    col.innerHTML = `<div class="spark-tip">${label} · ${num.format(r.count)} PNR</div><div class="spark-bar" style="height:${height}%"></div><div class="spark-date">${label}</div>`;
    root.appendChild(col);
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
}

async function loadMeta() {
  const meta = await api('/api/version');
  $('lastUpdate').textContent = `Última atualização: ${formatDateTime(meta.updated_at)}`;
  $('sourceBadge').textContent = `Fonte: ${meta.source_name || '—'}`;
  $('footerRows').textContent = `${num.format(meta.row_count || 0)} registros na base`;
  return meta;
}

async function loadDashboard({ overlay = false } = {}) {
  if (state.dashboardLoading) return;
  state.dashboardLoading = true;
  if (overlay) setLoading(true);
  try {
    const data = await api(`/api/dashboard?${queryString()}`);
    renderKpis(data.kpis);
    renderRm(data.rm_ranking || []);
    renderStations(data.station_summary || []);
    renderRanking('topBases', data.top_bases || []);
    renderRanking('topDrivers', data.top_drivers || []);
    renderRanking('topOrigins', data.top_origins || []);
    renderDaily(data.daily || []);
    const start = $('startDate').value ? new Date(`${$('startDate').value}T12:00:00`).toLocaleDateString('pt-BR') : '—';
    const end = $('endDate').value ? new Date(`${$('endDate').value}T12:00:00`).toLocaleDateString('pt-BR') : '—';
    $('periodBadge').textContent = start === end ? start : `${start} → ${end}`;
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    state.dashboardLoading = false;
    if (overlay) setLoading(false);
  }
}

let filterDebounce;
function scheduleFilterReload() {
  clearTimeout(filterDebounce);
  filterDebounce = setTimeout(() => loadDashboard(), 160);
  document.querySelectorAll('.chip').forEach(btn => btn.classList.remove('active'));
}

async function resetFilters() {
  ['regionalFilter','supervisorFilter','rmFilter','stationFilter','baseFilter','atendimentoFilter'].forEach(id => $(id).value = '__all__');
  rangeDates('day');
  markChip('day');
  await loadDashboard();
}

function openModal() {
  $('uploadModal').classList.add('open');
  $('uploadModal').setAttribute('aria-hidden', 'false');
}
function closeModal() {
  if ($('uploadProgressWrap').classList.contains('show')) return;
  $('uploadModal').classList.remove('open');
  $('uploadModal').setAttribute('aria-hidden', 'true');
}

function setSelectedFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    toast('Selecione uma planilha .xlsx.', 'error');
    return;
  }
  const dt = new DataTransfer();
  dt.items.add(file);
  $('fileInput').files = dt.files;
  $('dropTitle').textContent = file.name;
}

async function sendUpload() {
  const file = $('fileInput').files[0];
  if (!file) return toast('Selecione a planilha que deseja publicar.', 'error');
  const form = new FormData();
  form.append('file', file);
  const key = $('adminKey').value.trim();
  if (key) form.append('admin_key', key);

  $('uploadProgressWrap').classList.add('show');
  $('sendUpload').disabled = true;
  $('uploadStatus').textContent = 'Validando e importando a nova base...';
  try {
    const result = await api('/api/upload', { method: 'POST', body: form });
    state.version = result.version ?? state.version;
    $('uploadStatus').textContent = `${num.format(result.rows)} registros publicados.`;
    toast(`Base atualizada: ${num.format(result.rows)} registros.`, 'success');
    await loadFilters({ preserve: false });
    markChip('day');
    await Promise.all([loadDashboard(), loadMeta()]);
    if (state.activeView === 'editor') await loadEditorRows({ preserveDirty: false });
    setTimeout(() => {
      $('uploadProgressWrap').classList.remove('show');
      $('sendUpload').disabled = false;
      $('fileInput').value = '';
      $('dropTitle').textContent = 'Clique ou arraste a planilha aqui';
      $('uploadModal').classList.remove('open');
    }, 650);
  } catch (err) {
    $('uploadProgressWrap').classList.remove('show');
    $('sendUpload').disabled = false;
    toast(err.message, 'error');
  }
}

/* ===== Editor de base ===== */
function switchView(view) {
  state.activeView = view;
  document.querySelectorAll('.view-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  $('dashboardView').classList.toggle('active', view === 'dashboard');
  $('editorView').classList.toggle('active', view === 'editor');
  if (view === 'editor' && !state.editor.loaded) loadEditorRows();
}

function editorQueryString() {
  const params = new URLSearchParams();
  const mapping = {
    start_date: $('editorStartDate').value,
    end_date: $('editorEndDate').value,
    regional: $('editorRegionalFilter').value,
    supervisor: $('editorSupervisorFilter').value,
    rm: $('editorRmFilter').value,
    station: $('editorStationFilter').value,
    base: $('editorBaseFilter').value,
    atendimento: $('editorAtendimentoFilter').value,
    q: $('editorSearch').value.trim(),
    page: state.editor.page,
    page_size: $('editorPageSize').value,
  };
  Object.entries(mapping).forEach(([key, value]) => {
    if (value && value !== '__all__') params.set(key, value);
  });
  return params.toString();
}

function dirtyRows() {
  return [...$('editorTableBody').querySelectorAll('tr.dirty')];
}

function updateDirtyCount() {
  const count = dirtyRows().length;
  $('dirtyCount').textContent = count;
  $('editorSaveBtn').disabled = count === 0;
}

function markRowDirty(tr) {
  tr.classList.add('dirty');
  updateDirtyCount();
}

function makeEditorInput(field, value, className = '') {
  let input;
  if (field === 'station') {
    input = document.createElement('select');
    for (const item of ['Própria', 'Franquia', 'Não informado']) {
      const opt = document.createElement('option');
      opt.value = item;
      opt.textContent = item;
      input.appendChild(opt);
    }
    input.value = value || 'Não informado';
  } else {
    input = document.createElement('input');
    input.type = field === 'data' ? 'date' : 'text';
    input.value = value ?? '';
  }
  input.dataset.field = field;
  input.className = `editor-cell ${className}`.trim();
  return input;
}

function appendEditorCell(tr, field, value, className = '') {
  const td = document.createElement('td');
  const input = makeEditorInput(field, value, className);
  input.addEventListener('input', () => markRowDirty(tr));
  input.addEventListener('change', () => markRowDirty(tr));
  td.appendChild(input);
  tr.appendChild(td);
}

function createEditorRow(record, isNew = false) {
  const tr = document.createElement('tr');
  const rowKey = isNew ? `new-${Date.now()}-${Math.random().toString(16).slice(2)}` : String(record.id);
  tr.dataset.id = rowKey;
  if (isNew) tr.classList.add('new-row', 'dirty');

  const idTd = document.createElement('td');
  idTd.className = 'sticky-col id-col';
  const idSpan = document.createElement('span');
  idSpan.className = `editor-id ${isNew ? 'new' : ''}`;
  idSpan.textContent = isNew ? 'NOVO' : `#${record.id}`;
  idTd.appendChild(idSpan);
  tr.appendChild(idTd);

  appendEditorCell(tr, 'data', record.data, 'date');
  appendEditorCell(tr, 'filial', record.filial, 'short');
  appendEditorCell(tr, 'ticket_number', record.ticket_number, 'medium');
  appendEditorCell(tr, 'order_source', record.order_source, 'long');
  appendEditorCell(tr, 'base', record.base, 'medium');
  appendEditorCell(tr, 'driver', record.driver, 'long');
  appendEditorCell(tr, 'rm', record.rm, 'medium');
  appendEditorCell(tr, 'supervisor', record.supervisor, 'medium');
  appendEditorCell(tr, 'station', record.station || 'Própria', 'medium');
  appendEditorCell(tr, 'atendimento', record.atendimento, 'medium');
  appendEditorCell(tr, 'issue_l1', record.issue_l1, 'long');
  appendEditorCell(tr, 'issue_l2', record.issue_l2, 'long');

  const actionTd = document.createElement('td');
  actionTd.className = 'action-col';
  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'delete-row';
  del.title = 'Excluir linha';
  del.setAttribute('aria-label', 'Excluir linha');
  del.textContent = '×';
  del.addEventListener('click', () => deleteEditorRow(tr));
  actionTd.appendChild(del);
  tr.appendChild(actionTd);
  return tr;
}

function renderEditorRows(payload) {
  const body = $('editorTableBody');
  body.innerHTML = '';
  for (const row of payload.rows || []) body.appendChild(createEditorRow(row));
  if (!(payload.rows || []).length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 14;
    td.className = 'empty-state';
    td.textContent = 'Nenhum registro encontrado com esses filtros.';
    tr.appendChild(td);
    body.appendChild(tr);
  }

  state.editor.page = payload.page || 1;
  state.editor.pages = payload.pages || 1;
  state.editor.total = payload.total || 0;
  $('editorResultCount').textContent = `${num.format(state.editor.total)} registros encontrados`;
  $('editorPageLabel').textContent = `Página ${state.editor.page} de ${state.editor.pages}`;
  $('editorPrevBtn').disabled = state.editor.page <= 1;
  $('editorNextBtn').disabled = state.editor.page >= state.editor.pages;
  updateDirtyCount();
}

async function loadEditorRows({ preserveDirty = true } = {}) {
  if (state.editor.loading) return;
  if (preserveDirty && dirtyRows().length) {
    toast('Salve ou descarte as alterações antes de atualizar a lista.', 'error');
    return;
  }
  state.editor.loading = true;
  try {
    const payload = await api(`/api/editor/rows?${editorQueryString()}`);
    renderEditorRows(payload);
    state.editor.loaded = true;
  } catch (err) {
    toast(`Falha ao carregar editor: ${err.message}`, 'error');
  } finally {
    state.editor.loading = false;
  }
}

function collectEditorRow(tr) {
  const payload = { id: tr.dataset.id.startsWith('new-') ? null : Number(tr.dataset.id) };
  tr.querySelectorAll('[data-field]').forEach(input => { payload[input.dataset.field] = input.value; });
  return payload;
}

function addEditorRow() {
  const record = {
    data: $('editorEndDate').value || state.filters?.date_max || '',
    filial: $('editorRegionalFilter').value !== '__all__' ? $('editorRegionalFilter').value : '',
    ticket_number: '',
    order_source: '',
    base: $('editorBaseFilter').value !== '__all__' ? $('editorBaseFilter').value : '',
    driver: '',
    rm: $('editorRmFilter').value !== '__all__' ? $('editorRmFilter').value : '',
    supervisor: $('editorSupervisorFilter').value !== '__all__' ? $('editorSupervisorFilter').value : '',
    station: $('editorStationFilter').value !== '__all__' ? $('editorStationFilter').value : 'Própria',
    atendimento: $('editorAtendimentoFilter').value !== '__all__' ? $('editorAtendimentoFilter').value : '',
    issue_l1: '',
    issue_l2: '',
  };
  const row = createEditorRow(record, true);
  $('editorTableBody').prepend(row);
  updateDirtyCount();
  $('editorTableBody').closest('.editor-table-wrap').scrollTop = 0;
}

async function saveEditorRows() {
  const rows = dirtyRows();
  if (!rows.length) return toast('Não há alterações para salvar.');
  const body = {
    admin_key: $('editorAdminKey').value.trim(),
    rows: rows.map(collectEditorRow),
  };
  $('editorSaveBtn').disabled = true;
  try {
    const result = await api('/api/editor/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    state.version = result.version ?? state.version;
    toast(`${result.saved} linha(s) salva(s). Dashboard atualizado.`, 'success');
    await loadFilters({ preserve: true });
    await Promise.all([loadDashboard(), loadMeta()]);
    await loadEditorRows({ preserveDirty: false });
  } catch (err) {
    toast(err.message, 'error');
    updateDirtyCount();
  }
}

async function deleteEditorRow(tr) {
  if (tr.dataset.id.startsWith('new-')) {
    tr.remove();
    updateDirtyCount();
    return;
  }
  const rowId = Number(tr.dataset.id);
  if (!window.confirm(`Excluir definitivamente o registro #${rowId}?`)) return;
  try {
    const result = await api(`/api/editor/rows/${rowId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_key: $('editorAdminKey').value.trim() }),
    });
    state.version = result.version ?? state.version;
    tr.remove();
    toast('Registro excluído e indicadores atualizados.', 'success');
    await loadFilters({ preserve: true });
    await Promise.all([loadDashboard(), loadMeta()]);
    if (!dirtyRows().length) await loadEditorRows({ preserveDirty: false });
    else updateDirtyCount();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function clearEditorFilters() {
  ['editorRegionalFilter','editorSupervisorFilter','editorRmFilter','editorStationFilter','editorBaseFilter','editorAtendimentoFilter'].forEach(id => $(id).value = '__all__');
  $('editorStartDate').value = state.filters?.date_min || '';
  $('editorEndDate').value = state.filters?.date_max || '';
  $('editorSearch').value = '';
  state.editor.page = 1;
  await loadEditorRows();
}

async function watchVersion() {
  try {
    const meta = await api('/api/version');
    $('liveBadge').classList.add('live');
    $('liveBadge').innerHTML = '<i></i> Atualização automática ativa';
    if (state.version !== null && meta.version !== state.version) {
      state.version = meta.version;
      const hasDirty = dirtyRows().length > 0;
      await loadFilters({ preserve: true });
      await Promise.all([loadDashboard(), loadMeta()]);
      if (state.activeView === 'editor' && !hasDirty) {
        await loadEditorRows({ preserveDirty: false });
        toast('A base foi alterada por outro usuário. Editor e dashboard sincronizados.', 'success');
      } else if (hasDirty) {
        toast('A base foi alterada por outro usuário. Suas edições locais foram mantidas; salve-as ou atualize a lista para sincronizar.', 'error');
      } else {
        toast('A base foi atualizada por outro usuário. Dashboard sincronizado.', 'success');
      }
    }
  } catch (_) {
    $('liveBadge').classList.remove('live');
    $('liveBadge').innerHTML = '<i></i> Reconectando atualização automática';
  }
}

function bindEvents() {
  ['startDate','endDate','regionalFilter','supervisorFilter','rmFilter','stationFilter','baseFilter','atendimentoFilter']
    .forEach(id => $(id).addEventListener('change', scheduleFilterReload));

  document.querySelectorAll('.chip').forEach(btn => btn.addEventListener('click', async () => {
    rangeDates(btn.dataset.range);
    markChip(btn.dataset.range);
    await loadDashboard();
  }));
  $('resetBtn').addEventListener('click', resetFilters);
  $('uploadBtn').addEventListener('click', openModal);
  $('modalClose').addEventListener('click', closeModal);
  $('uploadModal').addEventListener('click', e => { if (e.target === $('uploadModal')) closeModal(); });
  $('fileInput').addEventListener('change', () => {
    const file = $('fileInput').files[0];
    if (file) $('dropTitle').textContent = file.name;
  });
  const drop = $('dropZone');
  ['dragenter','dragover'].forEach(evt => drop.addEventListener(evt, e => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave','drop'].forEach(evt => drop.addEventListener(evt, e => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', e => setSelectedFile(e.dataTransfer.files[0]));
  $('sendUpload').addEventListener('click', sendUpload);

  document.querySelectorAll('.view-tab').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
  $('editorApplyBtn').addEventListener('click', async () => { state.editor.page = 1; await loadEditorRows(); });
  $('editorClearBtn').addEventListener('click', clearEditorFilters);
  $('editorRefreshBtn').addEventListener('click', () => loadEditorRows());
  $('editorAddBtn').addEventListener('click', addEditorRow);
  $('editorSaveBtn').addEventListener('click', saveEditorRows);
  $('editorPrevBtn').addEventListener('click', async () => { if (state.editor.page > 1) { state.editor.page -= 1; await loadEditorRows(); } });
  $('editorNextBtn').addEventListener('click', async () => { if (state.editor.page < state.editor.pages) { state.editor.page += 1; await loadEditorRows(); } });
  $('editorPageSize').addEventListener('change', async () => { state.editor.page = 1; await loadEditorRows(); });
  $('editorSearch').addEventListener('keydown', async e => { if (e.key === 'Enter') { e.preventDefault(); state.editor.page = 1; await loadEditorRows(); } });

  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
}

async function init() {
  bindEvents();
  $('editorSaveBtn').disabled = true;
  setLoading(true);
  try {
    await loadFilters();
    await Promise.all([loadDashboard(), loadMeta()]);
    state.initialized = true;
  } catch (err) {
    toast(`Falha ao carregar dashboard: ${err.message}`, 'error');
  } finally {
    setLoading(false);
  }
  state.watchTimer = setInterval(watchVersion, 3000);
}

document.addEventListener('DOMContentLoaded', init);
