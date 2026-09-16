const state = {
  filters: null,
  version: null,
  initialized: false,
  loading: false,
  dashboardLoading: false,
  watchTimer: null,
  activeView: 'dashboard',
  lang: localStorage.getItem('pnr_lang') === 'zh-CN' ? 'zh-CN' : 'pt-BR',
  editor: { loaded: false, loading: false, page: 1, pages: 1, total: 0 },
};

const $ = (id) => document.getElementById(id);

const I18N = {
  'pt-BR': {
    operationalControl: 'CONTROLE OPERACIONAL', pnrIndicatorPrefix: 'Indicador de', subtitle: 'Visão consolidada de ocorrências, estações e ofensores por período.',
    autoUpdateActive: 'Atualização automática ativa', reconnecting: 'Reconectando atualização automática', lastUpdate: 'Última atualização', source: 'Fonte',
    dashboardTab: 'Dashboard', editorTab: 'Editar planilha', filters: 'FILTROS', globalCut: 'Recorte global', clearFilters: 'Limpar filtros', exportXlsx: 'Exportar tabelas XLSX', updateData: 'Atualizar dados',
    lastDay: 'Último dia', sevenDays: '7 dias', thirtyDays: '30 dias', allPeriod: 'Todo período', startDate: 'Data inicial', endDate: 'Data final', regional: 'Regional', supervisor: 'Supervisor', stationType: 'Tipo de estação', stationBase: 'Estação / Base', service: 'Atendimento', all: 'Todos',
    pnrPeriod: 'PNR NO PERÍODO', totalTickets: 'Total de tickets no recorte', ownBase: 'BASE PRÓPRIA', ownShort: 'Própria', franchise: 'Franquia', ofTotal: 'do total', basesInvolved: 'BASES ENVOLVIDAS', stationsWithPnr: 'Estações com PNR no período', drivers: 'MOTORISTAS', distinctDrivers: 'Motoristas distintos',
    management: 'GESTÃO', rmRanking: 'Ranking por RM', distribution: 'DISTRIBUIÇÃO', ownVsFranchise: 'Base própria x franquia', share: 'Participação', bases: 'Bases', topBase: 'Top base',
    topBases: 'Bases mais ofensoras', topDrivers: 'Motoristas ofensores', topOrigins: 'Origem do pedido', evolution: 'EVOLUÇÃO', pnrPerDay: 'PNR por dia',
    baseEditing: 'EDIÇÃO DA BASE', pnrSpreadsheet: 'Planilha do PNR', editorDescription: 'Altere os registros diretamente aqui. Ao salvar, os indicadores são recalculados e a mudança aparece para todos os usuários conectados.', refreshList: 'Atualizar lista', newRow: '+ Nova linha', saveChanges: 'Salvar alterações',
    searchAnyColumn: 'Buscar em qualquer coluna', searchPlaceholder: 'Ticket, motorista, base, origem...', rowsPerPage: 'Linhas por página', editPassword: 'Senha para aplicar alterações', passwordPlaceholder: 'Digite a senha', clear: 'Limpar', applyFilters: 'Aplicar filtros', unsavedHint: 'As células alteradas ficam destacadas até serem salvas.',
    date: 'Data', ticket: 'Ticket', orderOrigin: 'Origem do pedido', base: 'Base', driver: 'Motorista', reasonN1: 'Motivo N1', reasonN2: 'Motivo N2', action: 'Ação', previous: '← Anterior', next: 'Próxima →',
    sharedUpdate: 'ATUALIZAÇÃO COMPARTILHADA', updatePnrBase: 'Atualizar base do PNR', uploadDescription: 'Envie a nova planilha .xlsx. A base atual será substituída e todos os usuários conectados receberão a atualização automaticamente.', dropTitle: 'Clique ou arraste a planilha aqui', dropHelp: 'Limite: 40 MB · os mesmos cabeçalhos da planilha atual', updatePassword: 'Senha para atualizar os dados', preparing: 'Preparando...', importPublish: 'Importar e publicar atualização', updatingIndicators: 'Atualizando indicadores...',
    noDataFilters: 'Nenhum dado para os filtros selecionados.', noDataPeriod: 'Nenhum dado para o período.', noDaily: 'Sem dados diários para exibir.', noEditorRows: 'Nenhum registro encontrado com esses filtros.',
    recordsFound: '{n} registros encontrados', pageOf: 'Página {page} de {pages}', rowsInBase: '{n} registros na base', rms: '{n} RMs', pnrOf: 'do PNR', top: 'Top',
    selectXlsx: 'Selecione uma planilha .xlsx.', xlsxOnly: 'Envie apenas um arquivo .xlsx.', validatingImport: 'Validando e importando a nova base...', importedRows: '{n} registros publicados.',
    noChanges: 'Não há alterações para salvar.', savedRows: '{n} linha(s) salva(s). Dashboard atualizado.', deleteConfirm: 'Excluir definitivamente o registro #{id}?', deleted: 'Registro excluído e indicadores atualizados.',
    saveOrDiscard: 'Salve ou descarte as alterações antes de atualizar a lista.', editorLoadFailed: 'Falha ao carregar editor: {msg}', dashboardLoadFailed: 'Falha ao carregar dashboard: {msg}',
    otherUserSynced: 'A base foi alterada por outro usuário. Editor e dashboard sincronizados.', otherUserDirty: 'A base foi alterada por outro usuário. Suas edições locais foram mantidas; salve-as ou atualize a lista para sincronizar.', otherUserDashboard: 'A base foi atualizada por outro usuário. Dashboard sincronizado.',
    invalidPassword: 'Senha inválida. As alterações não foram aplicadas.', passwordRequired: 'Digite a senha antes de aplicar alterações.', exportStarted: 'Exportação XLSX iniciada.',
    deleteRow: 'Excluir linha', ownStation: 'Própria', franchiseStation: 'Franquia', notInformed: 'Não informado', languageAria: 'Alternar idioma',
  },
  'zh-CN': {
    operationalControl: '运营管控', pnrIndicatorPrefix: 'PNR 指标', subtitle: '按周期汇总查看异常、网点及主要责任对象。',
    autoUpdateActive: '自动更新已开启', reconnecting: '正在重新连接自动更新', lastUpdate: '最后更新', source: '数据来源',
    dashboardTab: '仪表盘', editorTab: '编辑表格', filters: '筛选', globalCut: '全局筛选', clearFilters: '清除筛选', exportXlsx: '导出表格 XLSX', updateData: '更新数据',
    lastDay: '最近一天', sevenDays: '7 天', thirtyDays: '30 天', allPeriod: '全部周期', startDate: '开始日期', endDate: '结束日期', regional: '区域', supervisor: '主管', stationType: '网点类型', stationBase: '网点 / 基地', service: '处理类型', all: '全部',
    pnrPeriod: '周期内 PNR', totalTickets: '当前筛选范围内的工单总数', ownBase: '直营网点', ownShort: '直营网点', franchise: '加盟网点', ofTotal: '占总量', basesInvolved: '涉及网点', stationsWithPnr: '周期内出现 PNR 的网点', drivers: '司机', distinctDrivers: '不同司机数量',
    management: '管理', rmRanking: 'RM 排名', distribution: '分布', ownVsFranchise: '直营网点 vs 加盟网点', share: '占比', bases: '网点数', topBase: '主要网点',
    topBases: 'PNR 最高的 10 个网点', topDrivers: 'PNR 最高的 10 名司机', topOrigins: '订单来源 TOP 10', evolution: '趋势', pnrPerDay: '每日 PNR',
    baseEditing: '数据编辑', pnrSpreadsheet: 'PNR 数据表', editorDescription: '可直接在此修改记录。保存后指标会重新计算，并同步给所有在线用户。', refreshList: '刷新列表', newRow: '+ 新增一行', saveChanges: '保存修改',
    searchAnyColumn: '搜索任意列', searchPlaceholder: '工单、司机、网点、来源...', rowsPerPage: '每页行数', editPassword: '应用修改的密码', passwordPlaceholder: '请输入密码', clear: '清除', applyFilters: '应用筛选', unsavedHint: '已修改的单元格在保存前会保持高亮。',
    date: '日期', ticket: '工单', orderOrigin: '订单来源', base: '网点', driver: '司机', reasonN1: '原因 N1', reasonN2: '原因 N2', action: '操作', previous: '← 上一页', next: '下一页 →',
    sharedUpdate: '共享更新', updatePnrBase: '更新 PNR 数据', uploadDescription: '上传新的 .xlsx 文件。当前数据将被替换，所有在线用户都会自动收到更新。', dropTitle: '点击或拖入 Excel 文件', dropHelp: '上限：40 MB · 请保持与当前表格相同的表头', updatePassword: '更新数据的密码', preparing: '准备中...', importPublish: '导入并发布更新', updatingIndicators: '正在更新指标...',
    noDataFilters: '当前筛选条件下没有数据。', noDataPeriod: '该周期内没有数据。', noDaily: '没有可显示的每日数据。', noEditorRows: '当前筛选条件下没有记录。',
    recordsFound: '找到 {n} 条记录', pageOf: '第 {page} 页，共 {pages} 页', rowsInBase: '数据表共 {n} 条记录', rms: '{n} 个 RM', pnrOf: '占 PNR', top: '最高',
    selectXlsx: '请选择 .xlsx 文件。', xlsxOnly: '仅支持 .xlsx 文件。', validatingImport: '正在校验并导入新数据...', importedRows: '已发布 {n} 条记录。',
    noChanges: '没有需要保存的修改。', savedRows: '已保存 {n} 行，仪表盘已更新。', deleteConfirm: '确定永久删除记录 #{id} 吗？', deleted: '记录已删除，指标已更新。',
    saveOrDiscard: '请先保存或放弃修改，再刷新列表。', editorLoadFailed: '加载编辑器失败：{msg}', dashboardLoadFailed: '加载仪表盘失败：{msg}',
    otherUserSynced: '其他用户已修改数据，编辑器和仪表盘已同步。', otherUserDirty: '其他用户已修改数据。你的本地修改已保留，请保存或刷新列表后同步。', otherUserDashboard: '其他用户已更新数据，仪表盘已同步。',
    invalidPassword: '密码错误，修改未应用。', passwordRequired: '请输入密码后再应用修改。', exportStarted: 'XLSX 导出已开始。',
    deleteRow: '删除行', ownStation: '直营网点', franchiseStation: '加盟网点', notInformed: '未填写', languageAria: '切换语言',
  },
};

function t(key, vars = {}) {
  let text = I18N[state.lang][key] ?? I18N['pt-BR'][key] ?? key;
  Object.entries(vars).forEach(([k, v]) => { text = text.replaceAll(`{${k}}`, v); });
  return text;
}

function locale() { return state.lang === 'zh-CN' ? 'zh-CN' : 'pt-BR'; }
function formatNum(value) { return new Intl.NumberFormat(locale()).format(Number(value || 0)); }
function pct(value) { return `${new Intl.NumberFormat(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(value || 0))}%`; }

function translateKnownValue(value) {
  if (state.lang !== 'zh-CN') return value;
  if (value === 'Própria') return t('ownStation');
  if (value === 'Franquia') return t('franchiseStation');
  if (value === 'Não informado') return t('notInformed');
  return value;
}

function applyTranslations() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  const toggle = $('langToggle');
  toggle.setAttribute('aria-label', t('languageAria'));
  toggle.querySelector('.lang-current').textContent = state.lang === 'pt-BR' ? 'PT-BR' : '简体中文';
  toggle.querySelector('.lang-next').textContent = state.lang === 'pt-BR' ? '简体中文' : 'PT-BR';
  refreshDynamicTexts();
}

function refreshDynamicTexts() {
  if (state.filters) {
    ['regionalFilter','supervisorFilter','rmFilter','stationFilter','baseFilter','atendimentoFilter','editorRegionalFilter','editorSupervisorFilter','editorRmFilter','editorStationFilter','editorBaseFilter','editorAtendimentoFilter'].forEach(id => {
      const select = $(id); if (!select) return;
      [...select.options].forEach(opt => { opt.textContent = opt.value === '__all__' ? t('all') : translateKnownValue(opt.value); });
    });
  }
  loadMeta().catch(() => {});
  if (state.initialized) loadDashboard().catch(() => {});
  if (state.activeView === 'editor' && state.editor.loaded && !dirtyRows().length) loadEditorRows({ preserveDirty: false }).catch(() => {});
}

function toast(message, type = '') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  $('toastStack').appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function setLoading(show) { state.loading = show; $('loadingLayer').classList.toggle('show', show); }

function translateServerError(message) {
  if (state.lang !== 'zh-CN') return message;
  const exact = {
    'Senha inválida. As alterações não foram aplicadas.': t('invalidPassword'),
    'Selecione um arquivo .xlsx.': t('selectXlsx'),
    'Formato não suportado. Envie um arquivo .xlsx.': t('xlsxOnly'),
  };
  return exact[message] || message;
}

async function api(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('X-Language', state.lang);
  const response = await fetch(url, { cache: 'no-store', ...options, headers });
  let body = {};
  try { body = await response.json(); } catch (_) {}
  if (!response.ok) throw new Error(translateServerError(body.message || `HTTP ${response.status}`));
  return body;
}

function setSelectOptions(id, items, selectedValue) {
  const select = $(id); if (!select) return;
  const current = selectedValue ?? select.value;
  select.innerHTML = '';
  const allOpt = document.createElement('option'); allOpt.value = '__all__'; allOpt.textContent = t('all'); select.appendChild(allOpt);
  for (const item of items || []) { const option = document.createElement('option'); option.value = item; option.textContent = translateKnownValue(item); select.appendChild(option); }
  select.value = [...select.options].some(o => o.value === current) ? current : '__all__';
}

function formatDateTime(iso) {
  if (!iso) return '—'; const d = new Date(iso); if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' });
}

function toISODate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function rangeDates(range) {
  const max = state.filters?.date_max, min = state.filters?.date_min; if (!max) return;
  $('endDate').value = max;
  if (range === 'all') $('startDate').value = min || max;
  else if (range === 'day') $('startDate').value = max;
  else { const end = new Date(`${max}T12:00:00`); end.setDate(end.getDate() - (Number(range) - 1)); const calc = toISODate(end); $('startDate').value = min && calc < min ? min : calc; }
}
function markChip(value) { document.querySelectorAll('.chip').forEach(btn => btn.classList.toggle('active', btn.dataset.range === value)); }

function captureEditorFilters() {
  return { start: $('editorStartDate')?.value || '', end: $('editorEndDate')?.value || '', regional: $('editorRegionalFilter')?.value || '__all__', supervisor: $('editorSupervisorFilter')?.value || '__all__', rm: $('editorRmFilter')?.value || '__all__', station: $('editorStationFilter')?.value || '__all__', base: $('editorBaseFilter')?.value || '__all__', atendimento: $('editorAtendimentoFilter')?.value || '__all__' };
}

function populateEditorFilters(f, previous = {}) {
  setSelectOptions('editorRegionalFilter', f.regional, previous.regional); setSelectOptions('editorSupervisorFilter', f.supervisor, previous.supervisor); setSelectOptions('editorRmFilter', f.rm, previous.rm); setSelectOptions('editorStationFilter', f.station, previous.station); setSelectOptions('editorBaseFilter', f.base, previous.base); setSelectOptions('editorAtendimentoFilter', f.atendimento, previous.atendimento);
  $('editorStartDate').min = f.date_min || ''; $('editorStartDate').max = f.date_max || ''; $('editorEndDate').min = f.date_min || ''; $('editorEndDate').max = f.date_max || '';
  $('editorStartDate').value = previous.start || f.date_min || ''; $('editorEndDate').value = previous.end || f.date_max || '';
}

async function loadFilters({ preserve = false } = {}) {
  const previous = preserve ? { regional: $('regionalFilter')?.value, supervisor: $('supervisorFilter')?.value, rm: $('rmFilter')?.value, station: $('stationFilter')?.value, base: $('baseFilter')?.value, atendimento: $('atendimentoFilter')?.value, start: $('startDate')?.value, end: $('endDate')?.value } : {};
  const editorPrevious = preserve ? captureEditorFilters() : {};
  const f = await api('/api/filters'); state.filters = f; state.version = f.version;
  setSelectOptions('regionalFilter', f.regional, previous.regional); setSelectOptions('supervisorFilter', f.supervisor, previous.supervisor); setSelectOptions('rmFilter', f.rm, previous.rm); setSelectOptions('stationFilter', f.station, previous.station); setSelectOptions('baseFilter', f.base, previous.base); setSelectOptions('atendimentoFilter', f.atendimento, previous.atendimento);
  $('startDate').min = f.date_min || ''; $('startDate').max = f.date_max || ''; $('endDate').min = f.date_min || ''; $('endDate').max = f.date_max || '';
  if (preserve && previous.start && previous.end) { $('startDate').value = previous.start > f.date_max ? f.date_max : previous.start; $('endDate').value = previous.end > f.date_max ? f.date_max : previous.end; } else rangeDates('day');
  populateEditorFilters(f, editorPrevious);
}

function queryString() {
  const params = new URLSearchParams();
  const mapping = { start_date: $('startDate').value, end_date: $('endDate').value, regional: $('regionalFilter').value, supervisor: $('supervisorFilter').value, rm: $('rmFilter').value, station: $('stationFilter').value, base: $('baseFilter').value, atendimento: $('atendimentoFilter').value };
  Object.entries(mapping).forEach(([key, value]) => { if (value) params.set(key, value); }); return params.toString();
}

function renderKpis(k) {
  $('kpiTotal').textContent = formatNum(k.total); $('kpiOwn').textContent = formatNum(k.own); $('kpiFranchise').textContent = formatNum(k.franchise); $('kpiBases').textContent = formatNum(k.bases); $('kpiDrivers').textContent = formatNum(k.drivers);
  $('kpiOwnPct').textContent = pct(k.total ? k.own / k.total * 100 : 0); $('kpiFranchisePct').textContent = pct(k.total ? k.franchise / k.total * 100 : 0);
}

function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }

function renderRm(rows) {
  $('rmCountBadge').textContent = t('rms', { n: formatNum(rows.length) }); const body = $('rmTableBody'); body.innerHTML = '';
  if (!rows.length) { body.innerHTML = `<tr><td colspan="6" class="empty-state">${escapeHtml(t('noDataFilters'))}</td></tr>`; return; }
  rows.forEach((r, i) => { const tr = document.createElement('tr'); tr.innerHTML = `<td><span class="rank-number ${i < 3 ? 'top' : ''}">${i+1}</span></td><td title="${escapeHtml(r.rm)}">${escapeHtml(r.rm)}</td><td class="num"><strong>${formatNum(r.count)}</strong></td><td class="num">${formatNum(r.own)}</td><td class="num">${formatNum(r.franchise)}</td><td class="num"><span class="share-cell"><span class="mini-track"><i style="width:${Math.min(100,r.share)}%"></i></span>${pct(r.share)}</span></td>`; body.appendChild(tr); });
}

function renderStations(rows) {
  const body = $('stationTableBody'); body.innerHTML = '';
  rows.forEach(r => { const tr = document.createElement('tr'); tr.innerHTML = `<td><span class="station-type-cell"><i class="station-dot ${r.station === 'Franquia' ? 'muted' : ''}"></i>${escapeHtml(translateKnownValue(r.station))}</span></td><td class="num"><strong>${formatNum(r.count)}</strong></td><td class="num">${pct(r.share)}</td><td class="num">${formatNum(r.bases)}</td><td title="${escapeHtml(r.top_base)}">${escapeHtml(r.top_base)}</td>`; body.appendChild(tr); });
}

function renderRanking(id, rows) {
  const root = $(id); root.innerHTML = ''; if (!rows.length) { root.innerHTML = `<div class="empty-state">${escapeHtml(t('noDataPeriod'))}</div>`; return; }
  const max = Math.max(...rows.map(r => r.count), 1);
  rows.forEach((r,i) => { const row = document.createElement('div'); row.className = 'rank-row'; row.innerHTML = `<div class="rank-pos">${String(i+1).padStart(2,'0')}</div><div class="rank-label-wrap"><div class="rank-label" title="${escapeHtml(r.label)}">${escapeHtml(r.label)}</div><div class="rank-track"><i style="width:${Math.max(2,r.count/max*100)}%"></i></div></div><div class="rank-count">${formatNum(r.count)}</div>`; root.appendChild(row); });
}

function renderDaily(rows) {
  const root = $('dailyChart'); root.innerHTML = ''; if (!rows.length) { root.innerHTML = `<div class="empty-state">${escapeHtml(t('noDaily'))}</div>`; return; }
  const max = Math.max(...rows.map(r => r.count), 1);
  rows.forEach(r => { const height = Math.max(3, r.count / max * 100); const col = document.createElement('div'); col.className = 'spark-col'; const d = new Date(`${r.date}T12:00:00`); const label = d.toLocaleDateString(locale(), { day:'2-digit', month:'2-digit' }); col.innerHTML = `<div class="spark-tip">${label} · ${formatNum(r.count)} PNR</div><div class="spark-bar" style="height:${height}%"></div><div class="spark-date">${label}</div>`; root.appendChild(col); });
}

async function loadMeta() {
  const meta = await api('/api/version');
  $('lastUpdate').textContent = `${t('lastUpdate')}: ${formatDateTime(meta.updated_at)}`; $('sourceBadge').textContent = `${t('source')}: ${meta.source_name || '—'}`; $('footerRows').textContent = t('rowsInBase', { n: formatNum(meta.row_count || 0) }); state.version = meta.version;
}

async function loadDashboard() {
  if (state.dashboardLoading) return; state.dashboardLoading = true;
  try {
    const data = await api(`/api/dashboard?${queryString()}`); renderKpis(data.kpis); renderRm(data.rm_ranking || []); renderStations(data.station_summary || []); renderRanking('topBases', data.top_bases || []); renderRanking('topDrivers', data.top_drivers || []); renderRanking('topOrigins', data.top_origins || []); renderDaily(data.daily || []);
    const start = $('startDate').value, end = $('endDate').value; $('periodBadge').textContent = start && end ? `${start.split('-').reverse().join('/')} → ${end.split('-').reverse().join('/')}` : '—';
  } finally { state.dashboardLoading = false; }
}

let filterTimer = null;
function scheduleFilterReload() { clearTimeout(filterTimer); markChip(''); filterTimer = setTimeout(() => loadDashboard().catch(err => toast(err.message,'error')), 180); }
async function resetFilters() {
  ['regionalFilter','supervisorFilter','rmFilter','stationFilter','baseFilter','atendimentoFilter'].forEach(id => $(id).value='__all__'); rangeDates('day'); markChip('day'); await loadDashboard();
}

function openModal() { $('uploadModal').classList.add('open'); $('uploadModal').setAttribute('aria-hidden','false'); }
function closeModal() { if ($('uploadProgressWrap').classList.contains('show')) return; $('uploadModal').classList.remove('open'); $('uploadModal').setAttribute('aria-hidden','true'); }
function setSelectedFile(file) { if (!file) return; if (!file.name.toLowerCase().endsWith('.xlsx')) return toast(t('xlsxOnly'),'error'); const dt = new DataTransfer(); dt.items.add(file); $('fileInput').files = dt.files; $('dropTitle').textContent = file.name; }

async function sendUpload() {
  const file = $('fileInput').files[0]; if (!file) return toast(t('selectXlsx'),'error');
  const key = $('adminKey').value.trim(); if (!key) return toast(t('passwordRequired'),'error');
  const form = new FormData(); form.append('file', file); form.append('admin_key', key);
  $('uploadProgressWrap').classList.add('show'); $('sendUpload').disabled = true; $('uploadStatus').textContent = t('validatingImport');
  try {
    const result = await api('/api/upload', { method:'POST', body:form }); $('uploadStatus').textContent = t('importedRows',{n:formatNum(result.rows)}); state.version = result.version ?? state.version; await loadFilters({preserve:false}); await Promise.all([loadDashboard(),loadMeta()]); if (state.activeView === 'editor') await loadEditorRows({preserveDirty:false}); toast(t('importedRows',{n:formatNum(result.rows)}),'success');
    setTimeout(() => { $('uploadProgressWrap').classList.remove('show'); $('sendUpload').disabled=false; $('uploadModal').classList.remove('open'); $('fileInput').value=''; $('dropTitle').textContent=t('dropTitle'); }, 700);
  } catch (err) { $('uploadProgressWrap').classList.remove('show'); $('sendUpload').disabled=false; toast(err.message,'error'); }
}

function exportTables() {
  const params = new URLSearchParams(queryString()); params.set('lang', state.lang); window.location.href = `/api/export?${params.toString()}`; toast(t('exportStarted'),'success');
}

function switchView(view) {
  state.activeView = view; document.querySelectorAll('.view-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.view===view)); $('dashboardView').classList.toggle('active',view==='dashboard'); $('editorView').classList.toggle('active',view==='editor'); if (view==='editor' && !state.editor.loaded) loadEditorRows();
}

function editorQueryString() {
  const params = new URLSearchParams(); const mapping = { start_date:$('editorStartDate').value, end_date:$('editorEndDate').value, regional:$('editorRegionalFilter').value, supervisor:$('editorSupervisorFilter').value, rm:$('editorRmFilter').value, station:$('editorStationFilter').value, base:$('editorBaseFilter').value, atendimento:$('editorAtendimentoFilter').value, q:$('editorSearch').value.trim(), page:state.editor.page, page_size:$('editorPageSize').value };
  Object.entries(mapping).forEach(([key,value]) => { if (value && value!=='__all__') params.set(key,value); }); return params.toString();
}
function dirtyRows() { return [...$('editorTableBody').querySelectorAll('tr.dirty')]; }
function updateDirtyCount() { const count=dirtyRows().length; $('dirtyCount').textContent=count; $('editorSaveBtn').disabled=count===0; }

function markDirty(tr) { tr.classList.add('dirty'); updateDirtyCount(); }
function appendEditorCell(tr, field, value, className='', type='text') {
  const td=document.createElement('td'); const input=document.createElement('input'); input.type=type; input.className=`editor-cell ${className}`.trim(); input.dataset.field=field; input.value=value ?? ''; input.addEventListener('input',()=>markDirty(tr)); td.appendChild(input); tr.appendChild(td); return input;
}
function createEditorRow(record, isNew=false) {
  const tr=document.createElement('tr'); const id=isNew?`new-${Date.now()}-${Math.random().toString(16).slice(2)}`:String(record.id); tr.dataset.id=id; if(isNew) tr.classList.add('dirty','new-row');
  const idTd=document.createElement('td'); idTd.className='sticky-col id-col'; const idSpan=document.createElement('span'); idSpan.className=`editor-id ${isNew?'new':''}`; idSpan.textContent=isNew?'NOVO':`#${record.id}`; idTd.appendChild(idSpan); tr.appendChild(idTd);
  appendEditorCell(tr,'data',record.data,'date','date'); appendEditorCell(tr,'filial',record.filial,'short'); appendEditorCell(tr,'ticket_number',record.ticket_number,'medium'); appendEditorCell(tr,'order_source',record.order_source,'long'); appendEditorCell(tr,'base',record.base,'medium'); appendEditorCell(tr,'driver',record.driver,'long'); appendEditorCell(tr,'rm',record.rm,'medium'); appendEditorCell(tr,'supervisor',record.supervisor,'medium'); appendEditorCell(tr,'station',record.station || 'Própria','medium'); appendEditorCell(tr,'atendimento',record.atendimento,'medium'); appendEditorCell(tr,'issue_l1',record.issue_l1,'long'); appendEditorCell(tr,'issue_l2',record.issue_l2,'long');
  const actionTd=document.createElement('td'); actionTd.className='action-col'; const del=document.createElement('button'); del.type='button'; del.className='delete-row'; del.title=t('deleteRow'); del.setAttribute('aria-label',t('deleteRow')); del.textContent='×'; del.addEventListener('click',()=>deleteEditorRow(tr)); actionTd.appendChild(del); tr.appendChild(actionTd); return tr;
}

function renderEditorRows(payload) {
  const body=$('editorTableBody'); body.innerHTML=''; for(const row of payload.rows||[]) body.appendChild(createEditorRow(row));
  if(!(payload.rows||[]).length){const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=14;td.className='empty-state';td.textContent=t('noEditorRows');tr.appendChild(td);body.appendChild(tr);}
  state.editor.page=payload.page||1;state.editor.pages=payload.pages||1;state.editor.total=payload.total||0;$('editorResultCount').textContent=t('recordsFound',{n:formatNum(state.editor.total)});$('editorPageLabel').textContent=t('pageOf',{page:state.editor.page,pages:state.editor.pages});$('editorPrevBtn').disabled=state.editor.page<=1;$('editorNextBtn').disabled=state.editor.page>=state.editor.pages;updateDirtyCount();
}

async function loadEditorRows({preserveDirty=true}={}) {
  if(state.editor.loading)return;if(preserveDirty&&dirtyRows().length){toast(t('saveOrDiscard'),'error');return;}state.editor.loading=true;
  try{const payload=await api(`/api/editor/rows?${editorQueryString()}`);renderEditorRows(payload);state.editor.loaded=true;}catch(err){toast(t('editorLoadFailed',{msg:err.message}),'error');}finally{state.editor.loading=false;}
}
function collectEditorRow(tr){const payload={id:tr.dataset.id.startsWith('new-')?null:Number(tr.dataset.id)};tr.querySelectorAll('[data-field]').forEach(input=>{payload[input.dataset.field]=input.value;});return payload;}
function addEditorRow(){const record={data:$('editorEndDate').value||state.filters?.date_max||'',filial:$('editorRegionalFilter').value!=='__all__'?$('editorRegionalFilter').value:'',ticket_number:'',order_source:'',base:$('editorBaseFilter').value!=='__all__'?$('editorBaseFilter').value:'',driver:'',rm:$('editorRmFilter').value!=='__all__'?$('editorRmFilter').value:'',supervisor:$('editorSupervisorFilter').value!=='__all__'?$('editorSupervisorFilter').value:'',station:$('editorStationFilter').value!=='__all__'?$('editorStationFilter').value:'Própria',atendimento:$('editorAtendimentoFilter').value!=='__all__'?$('editorAtendimentoFilter').value:'',issue_l1:'',issue_l2:''};const row=createEditorRow(record,true);$('editorTableBody').prepend(row);updateDirtyCount();$('editorTableBody').closest('.editor-table-wrap').scrollTop=0;}

async function saveEditorRows(){const rows=dirtyRows();if(!rows.length)return toast(t('noChanges'));const key=$('editorAdminKey').value.trim();if(!key)return toast(t('passwordRequired'),'error');const body={admin_key:key,rows:rows.map(collectEditorRow)};$('editorSaveBtn').disabled=true;try{const result=await api('/api/editor/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});state.version=result.version??state.version;toast(t('savedRows',{n:result.saved}),'success');await loadFilters({preserve:true});await Promise.all([loadDashboard(),loadMeta()]);await loadEditorRows({preserveDirty:false});}catch(err){toast(err.message,'error');updateDirtyCount();}}

async function deleteEditorRow(tr){if(tr.dataset.id.startsWith('new-')){tr.remove();updateDirtyCount();return;}const key=$('editorAdminKey').value.trim();if(!key)return toast(t('passwordRequired'),'error');const rowId=Number(tr.dataset.id);if(!window.confirm(t('deleteConfirm',{id:rowId})))return;try{const result=await api(`/api/editor/rows/${rowId}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({admin_key:key})});state.version=result.version??state.version;tr.remove();toast(t('deleted'),'success');await loadFilters({preserve:true});await Promise.all([loadDashboard(),loadMeta()]);if(!dirtyRows().length)await loadEditorRows({preserveDirty:false});else updateDirtyCount();}catch(err){toast(err.message,'error');}}

async function clearEditorFilters(){['editorRegionalFilter','editorSupervisorFilter','editorRmFilter','editorStationFilter','editorBaseFilter','editorAtendimentoFilter'].forEach(id=>$(id).value='__all__');$('editorStartDate').value=state.filters?.date_min||'';$('editorEndDate').value=state.filters?.date_max||'';$('editorSearch').value='';state.editor.page=1;await loadEditorRows();}

async function watchVersion(){try{const meta=await api('/api/version');$('liveBadge').classList.add('live');$('liveBadge').innerHTML=`<i></i><span>${escapeHtml(t('autoUpdateActive'))}</span>`;if(state.version!==null&&meta.version!==state.version){state.version=meta.version;const hasDirty=dirtyRows().length>0;await loadFilters({preserve:true});await Promise.all([loadDashboard(),loadMeta()]);if(state.activeView==='editor'&&!hasDirty){await loadEditorRows({preserveDirty:false});toast(t('otherUserSynced'),'success');}else if(hasDirty){toast(t('otherUserDirty'),'error');}else toast(t('otherUserDashboard'),'success');}}catch(_){$('liveBadge').classList.remove('live');$('liveBadge').innerHTML=`<i></i><span>${escapeHtml(t('reconnecting'))}</span>`;}}

function toggleLanguage(){state.lang=state.lang==='pt-BR'?'zh-CN':'pt-BR';localStorage.setItem('pnr_lang',state.lang);applyTranslations();}

function bindEvents(){
  ['startDate','endDate','regionalFilter','supervisorFilter','rmFilter','stationFilter','baseFilter','atendimentoFilter'].forEach(id=>$(id).addEventListener('change',scheduleFilterReload));
  document.querySelectorAll('.chip').forEach(btn=>btn.addEventListener('click',async()=>{rangeDates(btn.dataset.range);markChip(btn.dataset.range);await loadDashboard();}));
  $('resetBtn').addEventListener('click',resetFilters);$('exportBtn').addEventListener('click',exportTables);$('uploadBtn').addEventListener('click',openModal);$('langToggle').addEventListener('click',toggleLanguage);$('modalClose').addEventListener('click',closeModal);$('uploadModal').addEventListener('click',e=>{if(e.target===$('uploadModal'))closeModal();});
  $('fileInput').addEventListener('change',()=>{const file=$('fileInput').files[0];if(file)$('dropTitle').textContent=file.name;});const drop=$('dropZone');['dragenter','dragover'].forEach(evt=>drop.addEventListener(evt,e=>{e.preventDefault();drop.classList.add('drag');}));['dragleave','drop'].forEach(evt=>drop.addEventListener(evt,e=>{e.preventDefault();drop.classList.remove('drag');}));drop.addEventListener('drop',e=>setSelectedFile(e.dataTransfer.files[0]));$('sendUpload').addEventListener('click',sendUpload);
  document.querySelectorAll('.view-tab').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));$('editorApplyBtn').addEventListener('click',async()=>{state.editor.page=1;await loadEditorRows();});$('editorClearBtn').addEventListener('click',clearEditorFilters);$('editorRefreshBtn').addEventListener('click',()=>loadEditorRows());$('editorAddBtn').addEventListener('click',addEditorRow);$('editorSaveBtn').addEventListener('click',saveEditorRows);$('editorPrevBtn').addEventListener('click',async()=>{if(state.editor.page>1){state.editor.page-=1;await loadEditorRows();}});$('editorNextBtn').addEventListener('click',async()=>{if(state.editor.page<state.editor.pages){state.editor.page+=1;await loadEditorRows();}});$('editorPageSize').addEventListener('change',async()=>{state.editor.page=1;await loadEditorRows();});$('editorSearch').addEventListener('keydown',async e=>{if(e.key==='Enter'){e.preventDefault();state.editor.page=1;await loadEditorRows();}});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
}

async function init(){applyTranslations();bindEvents();$('editorSaveBtn').disabled=true;setLoading(true);try{await loadFilters();await Promise.all([loadDashboard(),loadMeta()]);state.initialized=true;}catch(err){toast(t('dashboardLoadFailed',{msg:err.message}),'error');}finally{setLoading(false);}state.watchTimer=setInterval(watchVersion,3000);}
document.addEventListener('DOMContentLoaded',init);
