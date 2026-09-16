const state = {
  filters: null,
  version: null,
  initialized: false,
  dashboardLoading: false,
  activeView: 'dashboard',
  lang: localStorage.getItem('pnr_lang') === 'zh-CN' ? 'zh-CN' : 'pt-BR',
  clickFilters: { driver: '', order_source: '', has_base: false, has_driver: false },
  editor: { loaded: false, loading: false, page: 1, pages: 1, total: 0 },
  chartSelectedRms: new Set(),
  lastDashboard: null,
  lastCharts: null,
  watchTimer: null,
};

const $ = (id) => document.getElementById(id);

const I18N = {
  'pt-BR': {
    operationalControl: 'CONTROLE OPERACIONAL', pnrIndicatorPrefix: 'Indicador de', subtitle: 'Visão consolidada de ocorrências, estações e ofensores por período.',
    autoUpdateActive: 'Atualização automática ativa', reconnecting: 'Reconectando atualização automática', lastUpdate: 'Última atualização', sources: 'Fontes',
    dashboardTab: 'Dashboard', chartsTab: 'Gráficos', editorTab: 'Editar planilha', filters: 'FILTROS', globalCut: 'Recorte global', clearFilters: 'Limpar filtros', exportXlsx: 'Exportar XLSX', updateData: 'Atualizar dados',
    clickToFilter: 'Clique para filtrar os demais indicadores', clickFilter: 'Filtro por clique', clearClickFilters: 'Limpar seleção', withBase: 'Com base informada', withDriver: 'Com motorista informado',
    lastDay: 'Último dia', sevenDays: '7 dias', thirtyDays: '30 dias', allPeriod: 'Todo período', startDate: 'Data inicial', endDate: 'Data final', regional: 'Regional', supervisor: 'Supervisor', stationType: 'Tipo de estação', stationBase: 'Estação / Base', service: 'Atendimento', all: 'Todos',
    pnrPeriod: 'PNR NO PERÍODO', totalTickets: 'Total de reclamações no recorte', ownBase: 'BASE PRÓPRIA', ownShort: 'Própria', franchise: 'Franquia', ofTotal: 'do total', basesInvolved: 'BASES ENVOLVIDAS', stationsWithPnr: 'Estações com PNR no período', drivers: 'MOTORISTAS', distinctDrivers: 'Motoristas distintos',
    management: 'GESTÃO', rmRanking: 'Ranking por RM', distribution: 'DISTRIBUIÇÃO', ownVsFranchise: 'Base própria x franquia', share: 'Participação', bases: 'Bases', topBase: 'Top base', merchandiseValue: 'Valor da mercadoria', pnrRate: 'Taxa PNR', variationD1: 'Variação D-1',
    topBases: 'Bases mais ofensoras', topDrivers: 'Motoristas ofensores', topOrigins: 'Origem do pedido', evolution: 'EVOLUÇÃO', pnrPerDay: 'PNR por dia', rateOn: 'Taxa em {date}', previousRate: 'D-1 {value}', noDelivery: 'Sem entregas',
    chartsAnalysis: 'ANÁLISE GRÁFICA', pnrRateEvolution: 'Evolução da Taxa de PNR', rmsFilter: "RM's", totalComplaints: 'RECLAMAÇÕES', selectedPeriod: 'No período selecionado', sumMerchandise: 'Soma das mercadorias reclamadas', franchiseComplaints: 'Reclamações em franquias', ownComplaints: 'Reclamações em bases próprias', sparklineModel: 'MODELO SPARKLINE', dailyRateByRm: 'Taxa diária de PNR por RM', rateFormula: 'Reclamações ÷ Entregas × 10.000', allRms: 'Todos os RMs', complaintsShort: 'recl.', deliveriesShort: 'entregas',
    baseEditing: 'EDIÇÃO DA BASE', pnrSpreadsheet: 'Planilha PNR BI', editorDescription: 'Altere os registros do PNR BI diretamente aqui. Ao salvar, os indicadores são recalculados e a mudança aparece para todos os usuários conectados.', refreshList: 'Atualizar lista', newRow: '+ Nova linha', saveChanges: 'Salvar alterações',
    searchAnyColumn: 'Buscar em qualquer coluna', searchPlaceholder: 'Ticket, motorista, base, origem...', rowsPerPage: 'Linhas por página', editPassword: 'Senha para aplicar alterações', passwordPlaceholder: 'Digite a senha', clear: 'Limpar', applyFilters: 'Aplicar filtros', unsavedHint: 'As células alteradas ficam destacadas até serem salvas.',
    date: 'Data', ticket: 'Ticket', orderOrigin: 'Origem do pedido', base: 'Base', driver: 'Motorista', reasonN1: 'Motivo N1', reasonN2: 'Motivo N2', action: 'Ação', previous: '← Anterior', next: 'Próxima →',
    sharedUpdate: 'ATUALIZAÇÃO COMPARTILHADA', updateBothBases: 'Atualizar PNR BI + Entregas BI', dualUploadDescription: 'As duas planilhas são obrigatórias. A atualização só será publicada quando PNR BI e Entregas BI forem enviadas juntas e validadas.', pnrBi: 'PNR BI', deliveryBi: 'Entregas BI', selectPnrBi: 'Selecionar planilha PNR BI', selectDeliveryBi: 'Selecionar planilha Entregas BI', pnrHelp: 'Base de reclamações e valor de mercadoria', deliveryHelp: 'Volume de entregas por data e RM', bothRequired: 'Obrigatório: envie os dois arquivos na mesma atualização.', updatePassword: 'Senha para atualizar os dados', preparing: 'Preparando...', importPublishBoth: 'Importar as duas e publicar', updatingIndicators: 'Atualizando indicadores...',
    noDataFilters: 'Nenhum dado para os filtros selecionados.', noDataPeriod: 'Nenhum dado para o período.', noDaily: 'Sem dados diários para exibir.', noEditorRows: 'Nenhum registro encontrado com esses filtros.', noChartData: 'Sem dados de taxa para exibir neste período.',
    recordsFound: '{n} registros encontrados', pageOf: 'Página {page} de {pages}', rowsInBase: '{n} PNR · {d} linhas de Entregas BI', rms: '{n} RMs', pnrOf: 'do PNR', top: 'Top',
    selectBothXlsx: 'Selecione as duas planilhas: PNR BI e Entregas BI.', xlsxOnly: 'As duas planilhas devem ser .xlsx.', validatingImport: 'Validando PNR BI e Entregas BI...', importedRows: '{n} PNR e {d} linhas de entregas publicados.',
    noChanges: 'Não há alterações para salvar.', savedRows: '{n} linha(s) salva(s). Dashboard atualizado.', deleteConfirm: 'Excluir definitivamente o registro #{id}?', deleted: 'Registro excluído e indicadores atualizados.',
    saveOrDiscard: 'Salve ou descarte as alterações antes de atualizar a lista.', editorLoadFailed: 'Falha ao carregar editor: {msg}', dashboardLoadFailed: 'Falha ao carregar dashboard: {msg}', chartLoadFailed: 'Falha ao carregar gráficos: {msg}',
    otherUserSynced: 'A base foi alterada por outro usuário. Editor e dashboard sincronizados.', otherUserDirty: 'A base foi alterada por outro usuário. Suas edições locais foram mantidas; salve-as ou atualize a lista para sincronizar.', otherUserDashboard: 'A base foi atualizada por outro usuário. Dashboard sincronizado.',
    passwordRequired: 'Digite a senha antes de aplicar alterações.', exportStarted: 'Exportação XLSX iniciada. A aba PNR BI inclui todos os valores da base filtrada.', deleteRow: 'Excluir linha', ownStation: 'Própria', franchiseStation: 'Franquia', notInformed: 'Não informado', languageAria: 'Alternar idioma',
  },
  'zh-CN': {
    operationalControl: '运营管控', pnrIndicatorPrefix: 'PNR 指标', subtitle: '按周期汇总查看异常、网点及主要责任对象。',
    autoUpdateActive: '自动更新已开启', reconnecting: '正在重新连接自动更新', lastUpdate: '最后更新', sources: '数据来源',
    dashboardTab: '仪表盘', chartsTab: '图表', editorTab: '编辑表格', filters: '筛选', globalCut: '全局筛选', clearFilters: '清除筛选', exportXlsx: '导出 XLSX', updateData: '更新数据',
    clickToFilter: '点击后联动筛选其他指标', clickFilter: '点击筛选', clearClickFilters: '清除选择', withBase: '已填写网点', withDriver: '已填写司机',
    lastDay: '最近一天', sevenDays: '7 天', thirtyDays: '30 天', allPeriod: '全部周期', startDate: '开始日期', endDate: '结束日期', regional: '区域', supervisor: '主管', stationType: '网点类型', stationBase: '网点 / 基地', service: '处理类型', all: '全部',
    pnrPeriod: '周期内 PNR', totalTickets: '当前筛选范围内的投诉总数', ownBase: '直营网点', ownShort: '直营网点', franchise: '加盟网点', ofTotal: '占总量', basesInvolved: '涉及网点', stationsWithPnr: '周期内出现 PNR 的网点', drivers: '司机', distinctDrivers: '不同司机数量',
    management: '管理', rmRanking: 'RM 排名', distribution: '分布', ownVsFranchise: '直营网点 vs 加盟网点', share: '占比', bases: '网点数', topBase: '主要网点', merchandiseValue: '货值', pnrRate: 'PNR 率', variationD1: '较前一日变化',
    topBases: 'PNR 最高的 10 个网点', topDrivers: 'PNR 最高的 10 名司机', topOrigins: '订单来源 TOP 10', evolution: '趋势', pnrPerDay: '每日 PNR', rateOn: '{date} 的费率', previousRate: '前一日 {value}', noDelivery: '无配送量',
    chartsAnalysis: '图表分析', pnrRateEvolution: 'PNR 率趋势', rmsFilter: 'RM', totalComplaints: '投诉量', selectedPeriod: '所选周期', sumMerchandise: '投诉货值合计', franchiseComplaints: '加盟网点投诉量', ownComplaints: '直营网点投诉量', sparklineModel: 'SPARKLINE 模式', dailyRateByRm: '各 RM 每日 PNR 率', rateFormula: '投诉量 ÷ 配送量 × 10,000', allRms: '全部 RM', complaintsShort: '投诉', deliveriesShort: '配送',
    baseEditing: '数据编辑', pnrSpreadsheet: 'PNR BI 数据表', editorDescription: '可直接在此修改 PNR BI 记录。保存后指标会重新计算，并同步给所有在线用户。', refreshList: '刷新列表', newRow: '+ 新增一行', saveChanges: '保存修改',
    searchAnyColumn: '搜索任意列', searchPlaceholder: '工单、司机、网点、来源...', rowsPerPage: '每页行数', editPassword: '应用修改的密码', passwordPlaceholder: '请输入密码', clear: '清除', applyFilters: '应用筛选', unsavedHint: '已修改的单元格在保存前会保持高亮。',
    date: '日期', ticket: '工单', orderOrigin: '订单来源', base: '网点', driver: '司机', reasonN1: '原因 N1', reasonN2: '原因 N2', action: '操作', previous: '← 上一页', next: '下一页 →',
    sharedUpdate: '共享更新', updateBothBases: '更新 PNR BI + Entregas BI', dualUploadDescription: '两个文件均为必填。只有 PNR BI 与 Entregas BI 同时上传并校验通过后才会发布更新。', pnrBi: 'PNR BI', deliveryBi: 'Entregas BI', selectPnrBi: '选择 PNR BI 表格', selectDeliveryBi: '选择 Entregas BI 表格', pnrHelp: '投诉及货值数据', deliveryHelp: '按日期和 RM 的配送量', bothRequired: '必填：同一次更新必须上传两个文件。', updatePassword: '更新数据的密码', preparing: '准备中...', importPublishBoth: '导入两个文件并发布', updatingIndicators: '正在更新指标...',
    noDataFilters: '当前筛选条件下没有数据。', noDataPeriod: '该周期内没有数据。', noDaily: '没有可显示的每日数据。', noEditorRows: '当前筛选条件下没有记录。', noChartData: '该周期内没有可显示的费率数据。',
    recordsFound: '找到 {n} 条记录', pageOf: '第 {page} 页，共 {pages} 页', rowsInBase: 'PNR {n} 条 · Entregas BI {d} 行', rms: '{n} 个 RM', pnrOf: '占 PNR', top: '最高',
    selectBothXlsx: '请选择 PNR BI 和 Entregas BI 两个表格。', xlsxOnly: '两个文件都必须为 .xlsx。', validatingImport: '正在校验 PNR BI 和 Entregas BI...', importedRows: '已发布 {n} 条 PNR 和 {d} 行配送数据。',
    noChanges: '没有需要保存的修改。', savedRows: '已保存 {n} 行，仪表盘已更新。', deleteConfirm: '确定永久删除记录 #{id} 吗？', deleted: '记录已删除，指标已更新。',
    saveOrDiscard: '请先保存或放弃修改，再刷新列表。', editorLoadFailed: '加载编辑器失败：{msg}', dashboardLoadFailed: '加载仪表盘失败：{msg}', chartLoadFailed: '加载图表失败：{msg}',
    otherUserSynced: '其他用户已修改数据，编辑器和仪表盘已同步。', otherUserDirty: '其他用户已修改数据。你的本地修改已保留，请保存或刷新列表后同步。', otherUserDashboard: '其他用户已更新数据，仪表盘已同步。',
    passwordRequired: '请输入密码后再应用修改。', exportStarted: 'XLSX 导出已开始。PNR BI 工作表包含筛选后的全部原始值。', deleteRow: '删除行', ownStation: '直营网点', franchiseStation: '加盟网点', notInformed: '未填写', languageAria: '切换语言',
  },
};

function t(key, vars = {}) {
  let text = I18N[state.lang][key] ?? I18N['pt-BR'][key] ?? key;
  Object.entries(vars).forEach(([k, v]) => { text = text.replaceAll(`{${k}}`, v); });
  return text;
}

function locale() { return state.lang === 'zh-CN' ? 'zh-CN' : 'pt-BR'; }
function formatNum(value) { return new Intl.NumberFormat(locale()).format(Number(value || 0)); }
function formatRate(value) { return value === null || value === undefined ? '—' : new Intl.NumberFormat(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value)); }
function formatCurrency(value) { return new Intl.NumberFormat(locale(), { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(Number(value || 0)); }
function pct(value) { return `${new Intl.NumberFormat(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(value || 0))}%`; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function formatDate(value) { if (!value) return '—'; const [y,m,d] = value.split('-'); return state.lang === 'zh-CN' ? `${y}/${m}/${d}` : `${d}/${m}/${y}`; }
function addDays(value, days) { const [y,m,d] = value.split('-').map(Number); const dt = new Date(Date.UTC(y,m-1,d)); dt.setUTCDate(dt.getUTCDate()+days); return dt.toISOString().slice(0,10); }

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
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  const toggle = $('langToggle');
  toggle.setAttribute('aria-label', t('languageAria'));
  toggle.querySelector('.lang-current').textContent = state.lang === 'pt-BR' ? 'PT-BR' : '简体中文';
  toggle.querySelector('.lang-next').textContent = state.lang === 'pt-BR' ? '简体中文' : 'PT-BR';
  if (state.filters) refreshSelectLabels();
  if (state.lastDashboard) renderDashboard(state.lastDashboard);
  if (state.lastCharts) renderCharts(state.lastCharts);
  if (state.editor.loaded) refreshEditorLabels();
}

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new Error(payload?.message || `HTTP ${response.status}`);
  return payload;
}

function toast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  $('toastStack').appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 4200);
}
function setLoading(active) { $('loadingLayer').classList.toggle('show', !!active); }

function fillSelect(id, values, preserve = true) {
  const el = $(id);
  if (!el) return;
  const old = preserve ? el.value : '__all__';
  el.innerHTML = '';
  const all = document.createElement('option'); all.value = '__all__'; all.textContent = t('all'); el.appendChild(all);
  for (const value of values || []) {
    const option = document.createElement('option'); option.value = value; option.textContent = translateKnownValue(value); el.appendChild(option);
  }
  el.value = [...el.options].some(o => o.value === old) ? old : '__all__';
}
function refreshSelectLabels() {
  const ids = ['regionalFilter','supervisorFilter','rmFilter','stationFilter','baseFilter','atendimentoFilter','editorRegionalFilter','editorSupervisorFilter','editorRmFilter','editorStationFilter','editorBaseFilter','editorAtendimentoFilter','chartRegionalFilter'];
  ids.forEach(id => {
    const el = $(id); if (!el) return;
    [...el.options].forEach(opt => { opt.textContent = opt.value === '__all__' ? t('all') : translateKnownValue(opt.value); });
  });
  renderChartRmChips();
}

async function loadFilters({ preserve = false } = {}) {
  const old = {};
  if (preserve) ['startDate','endDate','regionalFilter','supervisorFilter','rmFilter','stationFilter','baseFilter','atendimentoFilter','chartStartDate','chartEndDate','chartRegionalFilter'].forEach(id => { if ($(id)) old[id] = $(id).value; });
  const payload = await api('/api/filters');
  state.filters = payload;
  state.chartSelectedRms = new Set([...state.chartSelectedRms].filter(rm => (payload.rm || []).includes(rm)));
  if (state.version === null) state.version = payload.version;

  const mainMap = [
    ['regionalFilter','regional'],['supervisorFilter','supervisor'],['rmFilter','rm'],['stationFilter','station'],['baseFilter','base'],['atendimentoFilter','atendimento'],
    ['editorRegionalFilter','regional'],['editorSupervisorFilter','supervisor'],['editorRmFilter','rm'],['editorStationFilter','station'],['editorBaseFilter','base'],['editorAtendimentoFilter','atendimento'],
  ];
  mainMap.forEach(([id,key]) => fillSelect(id, payload[key], preserve));
  fillSelect('chartRegionalFilter', payload.regional, preserve);

  ['startDate','endDate','editorStartDate','editorEndDate','chartStartDate','chartEndDate'].forEach(id => {
    const el = $(id); if (!el) return; el.min = payload.date_min || ''; el.max = payload.date_max || '';
  });
  if (!preserve || !$('startDate').value) { $('startDate').value = payload.date_max || ''; $('endDate').value = payload.date_max || ''; }
  if (!preserve || !$('editorStartDate').value) { $('editorStartDate').value = payload.date_min || ''; $('editorEndDate').value = payload.date_max || ''; }
  if (!preserve || !$('chartStartDate').value) { $('chartStartDate').value = payload.delivery_date_min || payload.date_min || ''; $('chartEndDate').value = payload.delivery_date_max || payload.date_max || ''; }
  if (preserve) Object.entries(old).forEach(([id,value]) => { const el=$(id); if (!el || !value) return; if (el.tagName === 'SELECT' && ![...el.options].some(o=>o.value===value)) return; el.value=value; });
  renderChartRmChips();
}

async function loadMeta() {
  const meta = await api('/api/version');
  state.version = meta.version;
  const dt = meta.updated_at ? new Date(meta.updated_at) : null;
  $('lastUpdate').textContent = `${t('lastUpdate')}: ${dt ? new Intl.DateTimeFormat(locale(), { dateStyle:'short', timeStyle:'short' }).format(dt) : '—'}`;
  const pnr = meta.pnr_source_name || '—'; const delivery = meta.delivery_source_name || '—';
  $('sourceBadge').textContent = `${t('sources')}: PNR ${pnr} · Entregas ${delivery}`;
  $('footerRows').textContent = t('rowsInBase', { n: formatNum(meta.row_count || 0), d: formatNum(meta.delivery_row_count || 0) });
}

function queryString() {
  const params = new URLSearchParams();
  const pairs = [['start_date','startDate'],['end_date','endDate'],['regional','regionalFilter'],['supervisor','supervisorFilter'],['rm','rmFilter'],['station','stationFilter'],['base','baseFilter'],['atendimento','atendimentoFilter']];
  pairs.forEach(([key,id]) => { const v=$(id).value; if (v && v !== '__all__') params.set(key,v); });
  if (state.clickFilters.driver) params.set('driver', state.clickFilters.driver);
  if (state.clickFilters.order_source) params.set('order_source', state.clickFilters.order_source);
  if (state.clickFilters.has_base) params.set('has_base','1');
  if (state.clickFilters.has_driver) params.set('has_driver','1');
  return params.toString();
}

async function loadDashboard() {
  if (state.dashboardLoading) return;
  state.dashboardLoading = true;
  try {
    const payload = await api(`/api/dashboard?${queryString()}`);
    state.lastDashboard = payload;
    renderDashboard(payload);
  } finally { state.dashboardLoading = false; }
}

function renderDashboard(data) {
  const k = data.kpis || {};
  $('kpiTotal').textContent = formatNum(k.total); $('kpiOwn').textContent = formatNum(k.own); $('kpiFranchise').textContent = formatNum(k.franchise); $('kpiBases').textContent = formatNum(k.bases); $('kpiDrivers').textContent = formatNum(k.drivers);
  $('kpiOwnPct').textContent = pct(k.total ? k.own/k.total*100 : 0); $('kpiFranchisePct').textContent = pct(k.total ? k.franchise/k.total*100 : 0);
  $('rmCountBadge').textContent = t('rms', {n: formatNum(k.rms || 0)});
  $('rateDateBadge').textContent = data.rate_reference_date ? t('rateOn', {date: formatDate(data.rate_reference_date)}) : '—';
  renderRmTable(data.rm_ranking || []);
  renderStationTable(data.station_summary || []);
  renderRanking('topBases', data.top_bases || [], 'base');
  renderRanking('topDrivers', data.top_drivers || [], 'driver');
  renderRanking('topOrigins', data.top_origins || [], 'order_source');
  renderDaily(data.daily || []);
  renderClickFilterBar();
}

function renderRmTable(rows) {
  const body = $('rmTableBody'); body.innerHTML = '';
  if (!rows.length) { body.innerHTML = `<tr><td colspan="8" class="empty-state">${escapeHtml(t('noDataFilters'))}</td></tr>`; return; }
  rows.forEach((row, i) => {
    const tr = document.createElement('tr'); tr.className = 'click-row'; tr.tabIndex = 0;
    const variation = row.variation;
    const vClass = variation === null ? 'neutral' : variation > 0 ? 'up' : variation < 0 ? 'down' : 'neutral';
    const vText = variation === null ? '—' : `${variation > 0 ? '+' : ''}${formatRate(variation)}`;
    const rateText = row.rate === null ? `<span class="no-rate">${escapeHtml(t('noDelivery'))}</span>` : `<strong>${formatRate(row.rate)}</strong><small>${escapeHtml(t('previousRate', {value: formatRate(row.previous_rate)}))}</small>`;
    tr.innerHTML = `<td><span class="rank-number ${i<3?'top':''}">${i+1}</span></td><td><strong>${escapeHtml(row.rm)}</strong></td><td class="num">${formatNum(row.count)}</td><td class="num">${formatNum(row.own)}</td><td class="num">${formatNum(row.franchise)}</td><td class="num money-cell">${formatCurrency(row.merchandise_value)}</td><td class="num rate-cell">${rateText}</td><td class="num"><span class="variation-pill ${vClass}">${vText}</span></td>`;
    const apply = async () => { $('rmFilter').value = row.rm; await loadDashboard(); };
    tr.addEventListener('click', apply); tr.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){e.preventDefault();apply();} }); body.appendChild(tr);
  });
}

function renderStationTable(rows) {
  const body = $('stationTableBody'); body.innerHTML = '';
  rows.forEach(row => {
    const tr = document.createElement('tr'); tr.className = 'click-row'; tr.tabIndex=0;
    tr.innerHTML = `<td><span class="station-type-cell"><i class="station-dot ${row.station==='Franquia'?'muted':''}"></i>${escapeHtml(translateKnownValue(row.station))}</span></td><td class="num">${formatNum(row.count)}</td><td class="num">${pct(row.share)}</td><td class="num">${formatNum(row.bases)}</td><td>${escapeHtml(row.top_base)}</td>`;
    const apply=async()=>{$('stationFilter').value=row.station;await loadDashboard();}; tr.addEventListener('click',apply);tr.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();apply();}}); body.appendChild(tr);
  });
}

function renderRanking(id, rows, filterKey) {
  const root = $(id); root.innerHTML = '';
  if (!rows.length) { root.innerHTML = `<div class="empty-state">${escapeHtml(t('noDataPeriod'))}</div>`; return; }
  const max = Math.max(...rows.map(r=>r.count),1);
  rows.forEach((row,i)=>{
    const item=document.createElement('button'); item.type='button'; item.className='rank-item';
    item.innerHTML=`<span class="rank-pos">${String(i+1).padStart(2,'0')}</span><span class="rank-main"><strong class="rank-label">${escapeHtml(row.label)}</strong><span class="rank-track"><i style="width:${Math.max(4,row.count/max*100)}%"></i></span></span><strong class="rank-count">${formatNum(row.count)}</strong>`;
    item.addEventListener('click', async()=>{ if(filterKey==='base') $('baseFilter').value=row.label; else state.clickFilters[filterKey]=state.clickFilters[filterKey]===row.label?'':row.label; await loadDashboard(); });
    root.appendChild(item);
  });
}

function renderDaily(rows) {
  const root=$('dailyChart'); root.innerHTML='';
  if(!rows.length){root.innerHTML=`<div class="empty-state">${escapeHtml(t('noDaily'))}</div>`;$('periodBadge').textContent='—';return;}
  const max=Math.max(...rows.map(r=>r.count),1); $('periodBadge').textContent=`${formatDate(rows[0].date)} — ${formatDate(rows[rows.length-1].date)}`;
  const bars=document.createElement('div');bars.className='daily-bars';
  rows.forEach(row=>{const btn=document.createElement('button');btn.type='button';btn.className='daily-bar';btn.title=`${formatDate(row.date)} · ${formatNum(row.count)} PNR`;btn.innerHTML=`<span class="daily-value">${formatNum(row.count)}</span><i style="height:${Math.max(8,row.count/max*100)}%"></i><small>${formatDate(row.date).slice(0,5)}</small>`;btn.addEventListener('click',async()=>{$('startDate').value=row.date;$('endDate').value=row.date;markChip('custom');await loadDashboard();});bars.appendChild(btn);});
  root.appendChild(bars);
}

function renderClickFilterBar(){
  const chips=[]; if(state.clickFilters.driver)chips.push(['driver',`${t('driver')}: ${state.clickFilters.driver}`]); if(state.clickFilters.order_source)chips.push(['order_source',`${t('orderOrigin')}: ${state.clickFilters.order_source}`]); if(state.clickFilters.has_base)chips.push(['has_base',t('withBase')]); if(state.clickFilters.has_driver)chips.push(['has_driver',t('withDriver')]);
  $('clickFilterBar').hidden=!chips.length; const root=$('clickFilterChips');root.innerHTML='';chips.forEach(([key,label])=>{const b=document.createElement('button');b.type='button';b.className='click-filter-chip';b.textContent=`${label} ×`;b.addEventListener('click',async()=>{if(key==='has_base'||key==='has_driver')state.clickFilters[key]=false;else state.clickFilters[key]='';await loadDashboard();});root.appendChild(b);});
}
async function clearClickFilters(){state.clickFilters={driver:'',order_source:'',has_base:false,has_driver:false};await loadDashboard();}
async function applyKpiCrossFilter(type){if(type==='total'){state.clickFilters={driver:'',order_source:'',has_base:false,has_driver:false};$('stationFilter').value='__all__';}else if(type==='own'){$('stationFilter').value='Própria';}else if(type==='franchise'){$('stationFilter').value='Franquia';}else if(type==='bases'){state.clickFilters.has_base=!state.clickFilters.has_base;}else if(type==='drivers'){state.clickFilters.has_driver=!state.clickFilters.has_driver;}await loadDashboard();}

function markChip(range){document.querySelectorAll('.quick-dates .chip').forEach(b=>b.classList.toggle('active',b.dataset.range===range));}
function rangeDates(range){const max=state.filters?.date_max;if(!max)return;if(range==='day'){$('startDate').value=max;$('endDate').value=max;}else if(range==='7'){$('startDate').value=addDays(max,-6);$('endDate').value=max;}else if(range==='30'){$('startDate').value=addDays(max,-29);$('endDate').value=max;}else{$('startDate').value=state.filters.date_min||'';$('endDate').value=max;} }
async function resetFilters(){['regionalFilter','supervisorFilter','rmFilter','stationFilter','baseFilter','atendimentoFilter'].forEach(id=>$(id).value='__all__');state.clickFilters={driver:'',order_source:'',has_base:false,has_driver:false};rangeDates('day');markChip('day');await loadDashboard();}
let reloadTimer=null;function scheduleFilterReload(){clearTimeout(reloadTimer);markChip('custom');reloadTimer=setTimeout(()=>loadDashboard().catch(err=>toast(err.message,'error')),160);}

function exportTables(){const qs=queryString();const url=`/api/export?${qs}${qs?'&':''}lang=${encodeURIComponent(state.lang)}`;window.location.href=url;toast(t('exportStarted'),'success');}

function renderChartRmChips(){
  const root=$('chartRmChips'); if(!root||!state.filters)return; root.innerHTML='';
  const all=document.createElement('button');all.type='button';all.className=`rm-filter-chip ${state.chartSelectedRms.size===0?'active':''}`;all.textContent=t('allRms');all.addEventListener('click',async()=>{state.chartSelectedRms.clear();renderChartRmChips();await loadCharts();});root.appendChild(all);
  (state.filters.rm||[]).forEach(rm=>{const btn=document.createElement('button');btn.type='button';btn.className=`rm-filter-chip ${state.chartSelectedRms.has(rm)?'active':''}`;btn.textContent=rm;btn.addEventListener('click',async()=>{if(state.chartSelectedRms.has(rm))state.chartSelectedRms.delete(rm);else state.chartSelectedRms.add(rm);renderChartRmChips();await loadCharts();});root.appendChild(btn);});
}
function chartQueryString(){const p=new URLSearchParams();if($('chartStartDate').value)p.set('start_date',$('chartStartDate').value);if($('chartEndDate').value)p.set('end_date',$('chartEndDate').value);if($('chartRegionalFilter').value&&$('chartRegionalFilter').value!=='__all__')p.set('regional',$('chartRegionalFilter').value);if(state.chartSelectedRms.size)p.set('rms',[...state.chartSelectedRms].join('|'));return p.toString();}
async function loadCharts(){try{const payload=await api(`/api/charts?${chartQueryString()}`);state.lastCharts=payload;renderCharts(payload);}catch(err){toast(t('chartLoadFailed',{msg:err.message}),'error');}}
function renderCharts(data){const c=data.cards||{};$('chartKpiComplaints').textContent=formatNum(c.total);$('chartKpiValue').textContent=formatCurrency(c.value);$('chartKpiFranchise').textContent=formatNum(c.franchise);$('chartKpiOwn').textContent=formatNum(c.own);renderRmLineChart(data);}
function renderRmLineChart(data){
  const root=$('rmLineChart');const legend=$('chartLegend');root.innerHTML='';legend.innerHTML='';const series=data.series||[];const dates=data.dates||[];
  const palette=['#ed1c24','#2563eb','#16a34a','#9333ea','#ea580c','#0891b2','#d97706','#4f46e5','#db2777','#059669'];
  series.forEach((s,i)=>{const item=document.createElement('div');item.className='legend-item';item.innerHTML=`<i style="background:${palette[i%palette.length]}"></i><span>${escapeHtml(s.rm)}</span>`;legend.appendChild(item);});
  const valid=series.flatMap(s=>s.points||[]).filter(p=>p.rate!==null&&p.rate!==undefined);if(!dates.length||!series.length||!valid.length){root.innerHTML=`<div class="empty-state chart-empty">${escapeHtml(t('noChartData'))}</div>`;return;}
  const maxRate=Math.max(...valid.map(p=>Number(p.rate)),1);const width=Math.max(920,dates.length*96);const height=520;const m={l:64,r:30,t:72,b:74};const cw=width-m.l-m.r;const ch=height-m.t-m.b;const x=i=>m.l+(dates.length===1?cw/2:i*cw/(dates.length-1));const y=v=>m.t+ch-(Number(v)/maxRate)*ch;
  let svg=`<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeHtml(t('dailyRateByRm'))}">`;
  for(let i=0;i<=5;i++){const val=maxRate*i/5;const yy=y(val);svg+=`<line x1="${m.l}" y1="${yy}" x2="${width-m.r}" y2="${yy}" class="chart-grid-line"/><text x="${m.l-10}" y="${yy+4}" text-anchor="end" class="axis-label">${formatRate(val)}</text>`;}
  dates.forEach((d,i)=>{const xx=x(i);svg+=`<line x1="${xx}" y1="${m.t}" x2="${xx}" y2="${m.t+ch}" class="chart-grid-line vertical"/><text transform="translate(${xx},${height-m.b+24}) rotate(-35)" text-anchor="end" class="axis-label date-axis">${escapeHtml(formatDate(d))}</text>`;});
  series.forEach((s,si)=>{const color=palette[si%palette.length];const pts=(s.points||[]).map((p,i)=>({...p,i})).filter(p=>p.rate!==null&&p.rate!==undefined);if(!pts.length)return;const d=pts.map((p,j)=>`${j?'L':'M'} ${x(p.i).toFixed(1)} ${y(p.rate).toFixed(1)}`).join(' ');svg+=`<path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;pts.forEach((p,pi)=>{const xx=x(p.i),yy=y(p.rate);const offset=12+(si%3)*22;svg+=`<g class="chart-point"><circle cx="${xx}" cy="${yy}" r="5.5" fill="#fff" stroke="${color}" stroke-width="3"/><text x="${xx}" y="${Math.max(18,yy-offset)}" text-anchor="middle" class="point-label" fill="${color}"><tspan x="${xx}" font-weight="800">${formatRate(p.rate)}</tspan><tspan x="${xx}" dy="12">${formatNum(p.complaints)} ${escapeHtml(t('complaintsShort'))}</tspan></text><title>${escapeHtml(s.rm)} · ${escapeHtml(formatDate(p.date))} · ${formatRate(p.rate)} · ${formatNum(p.complaints)} ${escapeHtml(t('complaintsShort'))} · ${formatNum(p.deliveries)} ${escapeHtml(t('deliveriesShort'))}</title></g>`;});});
  svg+=`</svg>`;root.innerHTML=svg;
}
async function resetCharts(){state.chartSelectedRms.clear();$('chartRegionalFilter').value='__all__';$('chartStartDate').value=state.filters?.delivery_date_min||state.filters?.date_min||'';$('chartEndDate').value=state.filters?.delivery_date_max||state.filters?.date_max||'';renderChartRmChips();await loadCharts();}

function openModal(){$('uploadModal').classList.add('show');$('uploadModal').setAttribute('aria-hidden','false');$('pnrFileInput').value='';$('deliveryFileInput').value='';$('pnrDropTitle').textContent=t('selectPnrBi');$('deliveryDropTitle').textContent=t('selectDeliveryBi');$('uploadProgressWrap').classList.remove('show');$('uploadProgressBar').style.width='0%';}
function closeModal(){$('uploadModal').classList.remove('show');$('uploadModal').setAttribute('aria-hidden','true');}
function validXlsx(file){return !!file&&file.name.toLowerCase().endsWith('.xlsx');}
function setupDropZone(zoneId,inputId,titleId){const zone=$(zoneId),input=$(inputId);input.addEventListener('change',()=>{const f=input.files[0];if(f)$(titleId).textContent=f.name;});['dragenter','dragover'].forEach(evt=>zone.addEventListener(evt,e=>{e.preventDefault();zone.classList.add('drag');}));['dragleave','drop'].forEach(evt=>zone.addEventListener(evt,e=>{e.preventDefault();zone.classList.remove('drag');}));zone.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(!f)return;const dt=new DataTransfer();dt.items.add(f);input.files=dt.files;$(titleId).textContent=f.name;});}
async function sendUpload(){const pnr=$('pnrFileInput').files[0],delivery=$('deliveryFileInput').files[0],key=$('adminKey').value.trim();if(!pnr||!delivery)return toast(t('selectBothXlsx'),'error');if(!validXlsx(pnr)||!validXlsx(delivery))return toast(t('xlsxOnly'),'error');if(!key)return toast(t('passwordRequired'),'error');const form=new FormData();form.append('pnr_file',pnr);form.append('delivery_file',delivery);form.append('admin_key',key);$('uploadProgressWrap').classList.add('show');$('uploadProgressBar').style.width='35%';$('uploadStatus').textContent=t('validatingImport');$('sendUpload').disabled=true;try{const result=await api('/api/upload',{method:'POST',body:form});$('uploadProgressBar').style.width='100%';toast(t('importedRows',{n:formatNum(result.rows),d:formatNum(result.delivery_rows)}),'success');closeModal();await loadFilters();await Promise.all([loadDashboard(),loadMeta()]);if(state.activeView==='charts')await loadCharts();if(state.activeView==='editor')await loadEditorRows({preserveDirty:false});}catch(err){toast(err.message,'error');$('uploadProgressBar').style.width='0%';}finally{$('sendUpload').disabled=false;}}

function switchView(view){state.activeView=view;document.querySelectorAll('.view-tab').forEach(b=>b.classList.toggle('active',b.dataset.view===view));document.querySelectorAll('.app-view').forEach(v=>v.classList.remove('active'));$(`${view}View`).classList.add('active');if(view==='editor'&&!state.editor.loaded)loadEditorRows({preserveDirty:false});if(view==='charts')loadCharts();}
function editorQueryString(){const p=new URLSearchParams();const pairs=[['start_date','editorStartDate'],['end_date','editorEndDate'],['regional','editorRegionalFilter'],['supervisor','editorSupervisorFilter'],['rm','editorRmFilter'],['station','editorStationFilter'],['base','editorBaseFilter'],['atendimento','editorAtendimentoFilter']];pairs.forEach(([k,id])=>{const v=$(id).value;if(v&&v!=='__all__')p.set(k,v);});if($('editorSearch').value.trim())p.set('q',$('editorSearch').value.trim());p.set('page',state.editor.page);p.set('page_size',$('editorPageSize').value);return p.toString();}
function dirtyRows(){return [...document.querySelectorAll('#editorTableBody tr.dirty')];}
function updateDirtyCount(){const n=dirtyRows().length;$('dirtyCount').textContent=n;$('editorSaveBtn').disabled=n===0;}
function markDirty(tr){tr.classList.add('dirty');updateDirtyCount();}
function appendEditorCell(tr,field,value,cls='',type='text'){const td=document.createElement('td');const input=document.createElement('input');input.className=`editor-cell ${cls}`;input.type=type;input.dataset.field=field;input.value=value??'';if(type==='number')input.step='0.01';input.addEventListener('input',()=>markDirty(tr));td.appendChild(input);tr.appendChild(td);return input;}
function createEditorRow(record,isNew=false){const tr=document.createElement('tr');const id=isNew?`new-${Date.now()}-${Math.random().toString(16).slice(2)}`:String(record.id);tr.dataset.id=id;if(isNew)tr.classList.add('dirty','new-row');const idTd=document.createElement('td');idTd.className='sticky-col id-col';idTd.innerHTML=`<span class="editor-id ${isNew?'new':''}">${isNew?'NOVO':`#${record.id}`}</span>`;tr.appendChild(idTd);appendEditorCell(tr,'data',record.data,'date','date');appendEditorCell(tr,'filial',record.filial,'short');appendEditorCell(tr,'ticket_number',record.ticket_number,'medium');appendEditorCell(tr,'order_source',record.order_source,'long');appendEditorCell(tr,'base',record.base,'medium');appendEditorCell(tr,'driver',record.driver,'long');appendEditorCell(tr,'rm',record.rm,'medium');appendEditorCell(tr,'supervisor',record.supervisor,'medium');appendEditorCell(tr,'station',record.station||'Própria','medium');appendEditorCell(tr,'atendimento',record.atendimento,'medium');appendEditorCell(tr,'issue_l1',record.issue_l1,'long');appendEditorCell(tr,'issue_l2',record.issue_l2,'long');appendEditorCell(tr,'merchandise_value',record.merchandise_value,'money','number');const actionTd=document.createElement('td');actionTd.className='action-col';const del=document.createElement('button');del.type='button';del.className='delete-row';del.title=t('deleteRow');del.setAttribute('aria-label',t('deleteRow'));del.textContent='×';del.addEventListener('click',()=>deleteEditorRow(tr));actionTd.appendChild(del);tr.appendChild(actionTd);return tr;}
function refreshEditorLabels(){document.querySelectorAll('.delete-row').forEach(btn=>{btn.title=t('deleteRow');btn.setAttribute('aria-label',t('deleteRow'));});if(state.editor.loaded){$('editorResultCount').textContent=t('recordsFound',{n:formatNum(state.editor.total)});$('editorPageLabel').textContent=t('pageOf',{page:state.editor.page,pages:state.editor.pages});}}
function renderEditorRows(payload){const body=$('editorTableBody');body.innerHTML='';for(const row of payload.rows||[])body.appendChild(createEditorRow(row));if(!(payload.rows||[]).length){const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=15;td.className='empty-state';td.textContent=t('noEditorRows');tr.appendChild(td);body.appendChild(tr);}state.editor.page=payload.page||1;state.editor.pages=payload.pages||1;state.editor.total=payload.total||0;refreshEditorLabels();$('editorPrevBtn').disabled=state.editor.page<=1;$('editorNextBtn').disabled=state.editor.page>=state.editor.pages;updateDirtyCount();}
async function loadEditorRows({preserveDirty=true}={}){if(state.editor.loading)return;if(preserveDirty&&dirtyRows().length){toast(t('saveOrDiscard'),'error');return;}state.editor.loading=true;try{const payload=await api(`/api/editor/rows?${editorQueryString()}`);renderEditorRows(payload);state.editor.loaded=true;}catch(err){toast(t('editorLoadFailed',{msg:err.message}),'error');}finally{state.editor.loading=false;}}
function collectEditorRow(tr){const payload={id:tr.dataset.id.startsWith('new-')?null:Number(tr.dataset.id)};tr.querySelectorAll('[data-field]').forEach(input=>{payload[input.dataset.field]=input.value;});return payload;}
function addEditorRow(){const record={data:$('editorEndDate').value||state.filters?.date_max||'',filial:$('editorRegionalFilter').value!=='__all__'?$('editorRegionalFilter').value:'',ticket_number:'',order_source:'',base:$('editorBaseFilter').value!=='__all__'?$('editorBaseFilter').value:'',driver:'',rm:$('editorRmFilter').value!=='__all__'?$('editorRmFilter').value:'',supervisor:$('editorSupervisorFilter').value!=='__all__'?$('editorSupervisorFilter').value:'',station:$('editorStationFilter').value!=='__all__'?$('editorStationFilter').value:'Própria',atendimento:$('editorAtendimentoFilter').value!=='__all__'?$('editorAtendimentoFilter').value:'',issue_l1:'',issue_l2:'',merchandise_value:0};const row=createEditorRow(record,true);$('editorTableBody').prepend(row);updateDirtyCount();$('editorTableBody').closest('.editor-table-wrap').scrollTop=0;}
async function saveEditorRows(){const rows=dirtyRows();if(!rows.length)return toast(t('noChanges'));const key=$('editorAdminKey').value.trim();if(!key)return toast(t('passwordRequired'),'error');$('editorSaveBtn').disabled=true;try{const result=await api('/api/editor/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({admin_key:key,rows:rows.map(collectEditorRow)})});state.version=result.version??state.version;toast(t('savedRows',{n:result.saved}),'success');await loadFilters({preserve:true});await Promise.all([loadDashboard(),loadMeta()]);if(state.lastCharts)await loadCharts();await loadEditorRows({preserveDirty:false});}catch(err){toast(err.message,'error');updateDirtyCount();}}
async function deleteEditorRow(tr){if(tr.dataset.id.startsWith('new-')){tr.remove();updateDirtyCount();return;}const key=$('editorAdminKey').value.trim();if(!key)return toast(t('passwordRequired'),'error');const rowId=Number(tr.dataset.id);if(!window.confirm(t('deleteConfirm',{id:rowId})))return;try{const result=await api(`/api/editor/rows/${rowId}`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({admin_key:key})});state.version=result.version??state.version;tr.remove();toast(t('deleted'),'success');await loadFilters({preserve:true});await Promise.all([loadDashboard(),loadMeta()]);if(state.lastCharts)await loadCharts();if(!dirtyRows().length)await loadEditorRows({preserveDirty:false});else updateDirtyCount();}catch(err){toast(err.message,'error');}}
async function clearEditorFilters(){['editorRegionalFilter','editorSupervisorFilter','editorRmFilter','editorStationFilter','editorBaseFilter','editorAtendimentoFilter'].forEach(id=>$(id).value='__all__');$('editorStartDate').value=state.filters?.date_min||'';$('editorEndDate').value=state.filters?.date_max||'';$('editorSearch').value='';state.editor.page=1;await loadEditorRows();}

async function watchVersion(){try{const meta=await api('/api/version');$('liveBadge').classList.add('live');$('liveBadge').innerHTML=`<i></i><span>${escapeHtml(t('autoUpdateActive'))}</span>`;if(state.version!==null&&meta.version!==state.version){state.version=meta.version;const hasDirty=dirtyRows().length>0;await loadFilters({preserve:true});await Promise.all([loadDashboard(),loadMeta()]);if(state.activeView==='charts')await loadCharts();if(state.activeView==='editor'&&!hasDirty){await loadEditorRows({preserveDirty:false});toast(t('otherUserSynced'),'success');}else if(hasDirty){toast(t('otherUserDirty'),'error');}else toast(t('otherUserDashboard'),'success');}}catch(_){$('liveBadge').classList.remove('live');$('liveBadge').innerHTML=`<i></i><span>${escapeHtml(t('reconnecting'))}</span>`;}}
function toggleLanguage(){state.lang=state.lang==='pt-BR'?'zh-CN':'pt-BR';localStorage.setItem('pnr_lang',state.lang);applyTranslations();}

function bindEvents(){
  ['startDate','endDate','regionalFilter','supervisorFilter','rmFilter','stationFilter','baseFilter','atendimentoFilter'].forEach(id=>$(id).addEventListener('change',scheduleFilterReload));
  document.querySelectorAll('.quick-dates .chip').forEach(btn=>btn.addEventListener('click',async()=>{rangeDates(btn.dataset.range);markChip(btn.dataset.range);await loadDashboard();}));
  document.querySelectorAll('[data-kpi-filter]').forEach(card=>{const run=()=>applyKpiCrossFilter(card.dataset.kpiFilter).catch(err=>toast(err.message,'error'));card.addEventListener('click',run);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();run();}});});
  $('clearClickFiltersBtn').addEventListener('click',()=>clearClickFilters().catch(err=>toast(err.message,'error')));$('resetBtn').addEventListener('click',resetFilters);$('exportBtn').addEventListener('click',exportTables);$('uploadBtn').addEventListener('click',openModal);$('langToggle').addEventListener('click',toggleLanguage);$('modalClose').addEventListener('click',closeModal);$('uploadModal').addEventListener('click',e=>{if(e.target===$('uploadModal'))closeModal();});
  setupDropZone('pnrDropZone','pnrFileInput','pnrDropTitle');setupDropZone('deliveryDropZone','deliveryFileInput','deliveryDropTitle');$('sendUpload').addEventListener('click',sendUpload);
  document.querySelectorAll('.view-tab').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));
  ['chartStartDate','chartEndDate','chartRegionalFilter'].forEach(id=>$(id).addEventListener('change',()=>loadCharts()));$('chartResetBtn').addEventListener('click',resetCharts);
  $('editorApplyBtn').addEventListener('click',async()=>{state.editor.page=1;await loadEditorRows();});$('editorClearBtn').addEventListener('click',clearEditorFilters);$('editorRefreshBtn').addEventListener('click',()=>loadEditorRows());$('editorAddBtn').addEventListener('click',addEditorRow);$('editorSaveBtn').addEventListener('click',saveEditorRows);$('editorPrevBtn').addEventListener('click',async()=>{if(state.editor.page>1){state.editor.page-=1;await loadEditorRows();}});$('editorNextBtn').addEventListener('click',async()=>{if(state.editor.page<state.editor.pages){state.editor.page+=1;await loadEditorRows();}});$('editorPageSize').addEventListener('change',async()=>{state.editor.page=1;await loadEditorRows();});$('editorSearch').addEventListener('keydown',async e=>{if(e.key==='Enter'){e.preventDefault();state.editor.page=1;await loadEditorRows();}});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
}

async function init(){applyTranslations();bindEvents();$('editorSaveBtn').disabled=true;setLoading(true);try{await loadFilters();await Promise.all([loadDashboard(),loadMeta()]);state.initialized=true;}catch(err){toast(t('dashboardLoadFailed',{msg:err.message}),'error');}finally{setLoading(false);}state.watchTimer=setInterval(watchVersion,3000);}
document.addEventListener('DOMContentLoaded',init);
