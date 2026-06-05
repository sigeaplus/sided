// ============================================
// ROUTER.JS — History API
// SIDED+ Professor Dashboard
// ============================================
//
// COMO O F5 FUNCIONA AGORA:
//
//  1. O servidor (Vercel) deve redirecionar qualquer path para o mesmo HTML.
//     No vercel.json, adicione:
//       {
//         "rewrites": [{ "source": "/(.*)", "destination": "/professor_dashboard.html" }]
//       }
//
//  2. Ao fazer F5 em /turma/42/aulas, o HTML carrega normalmente.
//     Quando o app inicializa, ele lê window.location.pathname e chama
//     _roteadorRestaurar(), que reconstrói o estado correto:
//     autentica → carrega a turma → abre a aba.
//
//  3. pushState() é chamado automaticamente toda vez que o usuário
//     navega (abrirTurma, abrirPagina, voltarDashboard, voltarTurma).
//
//  4. O botão Voltar/Avançar do navegador dispara popstate e o router
//     reage da mesma forma que uma navegação programática.
//
// ROTAS SUPORTADAS:
//   /                          → dashboard
//   /turma/:id                 → relatório geral da turma (trimestre padrão)
//   /turma/:id/aulas           → aba Aulas
//   /turma/:id/chamada         → aba Chamada
//   /turma/:id/avaliacoes      → aba Avaliações
//   /turma/:id/relatorio       → Relatório Geral (aceita ?tri=N)
//   /turma/:id/relatorio-individual → Relatório Individual
//   /turma/:id/mapeamento      → Mapeamento de Sala
//   /turma/:id/calendario      → Calendário Escolar
//   /turma/:id/ocorrencias     → Ocorrências
//   /turma/:id/plano-curso     → Plano de Curso
//
// ============================================

// ── IDs de todas as páginas/abas do app ──────────────────────────────────────

const todasPaginas = [
  'turma-screen', 'pagina-aulas', 'pagina-chamada', 'pagina-avaliacoes',
  'notas-screen', 'pagina-relatorio-geral', 'pagina-relatorio-individual',
  'pagina-mapeamento-sala', 'pagina-calendario-escolar', 'pagina-ocorrencias',
  'pagina-comunicacao', 'pagina-plano-curso'
];

// ── Mapeamento aba → segmento de URL ─────────────────────────────────────────

const _abaParaSegmento = {
  'aulas':                'aulas',
  'chamada':              'chamada',
  'avaliacoes':           'avaliacoes',
  'relatorio-geral':      'relatorio',
  'relatorio-individual': 'relatorio-individual',
  'mapeamento-sala':      'mapeamento',
  'calendario-escolar':   'calendario',
  'ocorrencias':          'ocorrencias',
  'plano-curso':          'plano-curso'
};

const _segmentoParaAba = Object.fromEntries(
  Object.entries(_abaParaSegmento).map(([k, v]) => [v, k])
);

// ── Helpers de URL ────────────────────────────────────────────────────────────

function _construirUrl(pagina, turmaId, opts = {}) {
  if (!turmaId || pagina === 'dashboard') return '/';
  if (pagina === 'relatorio-geral') {
    const tri = opts.tri || document.getElementById('sel-rel-tri')?.value || '1';
    return `/turma/${turmaId}/relatorio?tri=${tri}`;
  }
  const seg = _abaParaSegmento[pagina];
  if (seg) return `/turma/${turmaId}/${seg}`;
  return `/turma/${turmaId}`;
}

function _parsearUrl(pathname, search) {
  // /  →  { pagina: 'dashboard' }
  // /turma/42  →  { pagina: 'relatorio-geral', turmaId: '42' }
  // /turma/42/aulas  →  { pagina: 'aulas', turmaId: '42' }
  const match = pathname.match(/^\/turma\/(\d+)\/?([^/?]*)?/);
  if (!match) return { pagina: 'dashboard', turmaId: null };
  const turmaId = match[1];
  const seg = match[2] || '';
  const pagina = seg ? (_segmentoParaAba[seg] || 'relatorio-geral') : 'relatorio-geral';
  const params = new URLSearchParams(search || '');
  const tri = parseInt(params.get('tri') || '1');
  return { pagina, turmaId, tri };
}

// ── pushState / replaceState ──────────────────────────────────────────────────

function _pushRota(pagina, turmaId, opts = {}) {
  const url = _construirUrl(pagina, turmaId, opts);
  const state = { pagina, turmaId: turmaId ? String(turmaId) : null, opts };
  window.history.pushState(state, '', url);
}

function _replaceRota(pagina, turmaId, opts = {}) {
  const url = _construirUrl(pagina, turmaId, opts);
  const state = { pagina, turmaId: turmaId ? String(turmaId) : null, opts };
  window.history.replaceState(state, '', url);
}

// ── popstate — botão Voltar/Avançar do navegador ──────────────────────────────

window.addEventListener('popstate', async (e) => {
  try {
    const state = e.state;
    if (!state) {
      // Sem state: interpretar a URL atual
      await _roteadorRestaurar(window.location.pathname, window.location.search, false);
      return;
    }
    const { pagina, turmaId, opts } = state;
    if (!pagina || pagina === 'dashboard') {
      _executarVoltarDashboard(false);
      return;
    }
    // Garantir turma carregada
    if (turmaId && (!turmaAtiva || String(turmaAtiva.id) !== String(turmaId))) {
      await _carregarContextoTurma(turmaId);
    }
    if (!turmaAtiva) { _executarVoltarDashboard(false); return; }
    await _executarAbrirPagina(pagina, opts || {}, false);
  } catch (e) {
    console.error('[ROUTER] popstate erro:', e);
  }
});

// ── Restauração por URL (F5 / link direto) ────────────────────────────────────

async function _roteadorRestaurar(pathname, search, substituirState = true) {
  try {
    const { pagina, turmaId, tri } = _parsearUrl(pathname, search);
    if (pagina === 'dashboard' || !turmaId) {
      if (substituirState) _replaceRota('dashboard', null);
      return; // O app já vai abrir no dashboard normalmente
    }
    // Carregar turma se necessário
    if (!turmaAtiva || String(turmaAtiva.id) !== String(turmaId)) {
      await _carregarContextoTurma(turmaId);
    }
    if (!turmaAtiva) {
      if (substituirState) _replaceRota('dashboard', null);
      return;
    }
    const opts = pagina === 'relatorio-geral' ? { tri } : {};
    if (substituirState) _replaceRota(pagina, turmaId, opts);
    await _executarAbrirPagina(pagina, opts, false);
  } catch (e) {
    console.error('[ROUTER] _roteadorRestaurar erro:', e);
  }
}

// Chame isso no final do fluxo de autenticação, depois que todasTurmas estiver populada:
//   await roteadorInicializar();
async function roteadorInicializar() {
  const pathname = window.location.pathname;
  const search   = window.location.search;
  // Se a URL for só "/" não precisa fazer nada especial — o dashboard vai abrir normalmente
  if (pathname === '/' || pathname === '') {
    _replaceRota('dashboard', null);
    return;
  }
  await _roteadorRestaurar(pathname, search, true);
}

// ── Carregar contexto da turma sem renderizar UI ainda ────────────────────────

async function _carregarContextoTurma(id) {
  if (!todasTurmas || todasTurmas.length === 0) return;
  turmaAtiva = todasTurmas.find(t => String(t.id) === String(id)) || null;
  if (!turmaAtiva) return;
  relatorioCache = [];
  alunosTurma   = [];
  await Promise.all([carregarAulas(), carregarAlunos(), carregarAvaliacoes()]);
}

// ── Helpers visuais ───────────────────────────────────────────────────────────

function _setSidebarEstadoTurma(dentroTurma) {
  const normal  = document.getElementById('sidebar-estado-normal');
  const menu    = document.getElementById('sidebar-turma-menu');
  const mini    = document.getElementById('btn-perfil-mini');
  const mobMenu = document.getElementById('mob-turma-menu');
  if (normal)  normal.style.display  = dentroTurma ? 'none' : 'flex';
  if (menu)    menu.style.display    = dentroTurma ? 'flex' : 'none';
  if (mini)    mini.style.display    = dentroTurma ? 'flex' : 'none';
  if (mobMenu) mobMenu.style.display = dentroTurma ? 'flex' : 'none';
}

function esconderTudo() {
  todasPaginas.forEach(p => {
    const el = document.getElementById(p);
    if (el) { el.style.display = 'none'; el.classList.remove('active'); }
  });
  const dash = document.getElementById('dashboard-screen');
  if (dash) dash.style.display = 'none';
}

function _paginaEstaVisivel(id) {
  const el = document.getElementById(id);
  return !!(el && el.style.display && el.style.display !== 'none');
}

// ── Execução pura de navegação (sem mexer no histórico) ───────────────────────

async function _executarAbrirTurma(id) {
  turmaAtiva    = todasTurmas.find(t => String(t.id) === String(id));
  relatorioCache = [];
  alunosTurma   = [];
  esconderTudo();

  const nome = turmaAtiva?.nome || '';
  atualizarCabecalho({ info: 'Relatórios', titulo: nome, detalhe: 'Voltar às turmas', voltarFn: 'voltarDashboard', cor: '#16A34A' });
  atualizarHeaderMobile('Relatório Geral', nome, true, false);
  _setSidebarEstadoTurma(true);

  await Promise.all([carregarAulas(), carregarAlunos(), carregarAvaliacoes()]);

  const selTri = parseInt(document.getElementById('sel-rel-tri')?.value || '1');
  document.getElementById('pagina-relatorio-geral').style.display = 'block';
  await carregarRelatorio(selTri);
}

function _executarVoltarDashboard(comPush = true) {
  esconderTudo();
  const dash = document.getElementById('dashboard-screen');
  if (dash) dash.style.display = 'block';
  turmaAtiva = null;
  _setSidebarEstadoTurma(false);
  const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  const escola  = profData.escolas?.nome || '';
  const codigo  = profData.escolas?.codigo_escola ? `Código: ${profData.escolas.codigo_escola}` : '';
  atualizarCabecalho({ info: codigo, titulo: escola, detalhe: `Bem-vindo(a), ${(profData.nome || '').split(' ')[0]}!`, cor: 'var(--purple-dark)' });
  atualizarHeaderMobile('SIDED+', escola, false, false);
  if (comPush) _pushRota('dashboard', null);
}

async function _executarAbrirPagina(pagina, opts = {}, comPush = true) {
  esconderTudo();
  const nome = turmaAtiva?.nome || '';

  if (turmaAtiva?.id) await garantirAlunosTurma();

  switch (pagina) {
    case 'aulas':
      document.getElementById('pagina-aulas').style.display = 'block';
      atualizarCabecalho({ info: 'Aulas', titulo: nome, detalhe: 'Voltar à turma', voltarFn: 'voltarTurma', cor: '#0F766E' });
      atualizarHeaderMobile('Aulas', nome, true, true);
      await carregarAulas();
      if (typeof _inicializarFiltroDiscAulas === 'function') await _inicializarFiltroDiscAulas();
      break;

    case 'chamada':
      document.getElementById('pagina-chamada').style.display = 'block';
      const chamadaTitulo = `${turmaAtiva.codigo || ''} — ${turmaAtiva.nome || ''} — ${turmaAtiva.disciplina || ''} — ${turmaAtiva.turno || ''} — ${turmaAtiva.escolas?.nome || ''}`;
      document.getElementById('chamada-turma-titulo').textContent = chamadaTitulo;
      atualizarCabecalho({ info: 'Chamada do Dia', titulo: nome, detalhe: 'Voltar à turma', voltarFn: 'voltarTurma', cor: '#6C4FD4' });
      atualizarHeaderMobile('Chamada do Dia', nome, true, true);
      await garantirAlunosTurma();
      await carregarChamadaHoje();
      break;

    case 'avaliacoes':
      document.getElementById('pagina-avaliacoes').style.display = 'block';
      document.getElementById('notas-screen').style.display = 'none';
      document.getElementById('aval-turma-titulo').textContent = `${turmaAtiva.codigo || ''} — ${turmaAtiva.nome || ''} — ${turmaAtiva.disciplina || ''} — ${turmaAtiva.turno || ''} — ${turmaAtiva.escolas?.nome || ''}`;
      const triAtual = detectarTrimestreAtual().tri;
      const sel = document.getElementById('sel-aval-tri'); if (sel) sel.value = String(triAtual);
      atualizarCabecalho({ info: 'Avaliações', titulo: nome, detalhe: 'Voltar à turma', voltarFn: 'voltarTurma', cor: '#FF8C38' });
      atualizarHeaderMobile('Avaliações', nome, true, true);
      if (typeof _inicializarFiltroDiscAval === 'function') await _inicializarFiltroDiscAval();
      await carregarAvaliacoes();
      break;

    case 'relatorio-geral':
      document.getElementById('pagina-relatorio-geral').style.display = 'block';
      atualizarCabecalho({ info: 'Relatórios', titulo: nome, detalhe: 'Voltar à turma', voltarFn: 'voltarTurma', cor: '#16A34A' });
      atualizarHeaderMobile('Relatório Geral', nome, true, true);
      await garantirAlunosTurma();
      const triRel = parseInt((opts.tri ?? document.getElementById('sel-rel-tri')?.value) || '1');
      const selRelTri = document.getElementById('sel-rel-tri');
      if (selRelTri) selRelTri.value = String(triRel);
      await carregarRelatorio(triRel);
      break;

    case 'relatorio-individual':
      document.getElementById('pagina-relatorio-individual').style.display = 'block';
      atualizarCabecalho({ info: 'Relatórios', titulo: nome, detalhe: 'Voltar à turma', voltarFn: 'voltarTurma', cor: '#F97316' });
      atualizarHeaderMobile('Relatório Individual', nome, true, true);
      await garantirAlunosTurma();
      if (typeof renderRelatorioIndividualMenu === 'function') await renderRelatorioIndividualMenu();
      break;

    case 'mapeamento-sala':
      document.getElementById('pagina-mapeamento-sala').style.display = 'block';
      document.getElementById('mapa-lista-view').style.display = 'block';
      document.getElementById('mapa-canvas-view').style.display = 'none';
      _mapaAtivo = null;
      atualizarCabecalho({ info: 'Turma', titulo: nome, detalhe: 'Voltar à turma', voltarFn: 'voltarTurma', cor: '#8B5CF6' });
      atualizarHeaderMobile('Mapeamento de Sala', nome, true, true);
      if (typeof renderListaMapeamentos === 'function') renderListaMapeamentos();
      break;

    case 'calendario-escolar':
      document.getElementById('pagina-calendario-escolar').style.display = 'block';
      atualizarCabecalho({ info: 'Turma', titulo: nome, detalhe: 'Voltar à turma', voltarFn: 'voltarTurma', cor: '#0EA5E9' });
      atualizarHeaderMobile('Calendário Escolar', nome, true, true);
      if (typeof iniciarCalendario === 'function') await iniciarCalendario();
      break;

    case 'ocorrencias':
      document.getElementById('pagina-ocorrencias').style.display = 'block';
      atualizarCabecalho({ info: 'Disciplina', titulo: nome, detalhe: 'Voltar à turma', voltarFn: 'voltarTurma', cor: '#B91C1C' });
      atualizarHeaderMobile('Ocorrências', nome, true, true);
      await garantirAlunosTurma();
      if (typeof iniciarOcorrencias === 'function') await iniciarOcorrencias();
      break;

    case 'plano-curso':
      document.getElementById('pagina-plano-curso').style.display = 'block';
      atualizarCabecalho({ info: 'Plano de Curso', titulo: nome, detalhe: 'Voltar à turma', voltarFn: 'voltarTurma', cor: '#BE185D' });
      atualizarHeaderMobile('Plano de Curso', nome, true, true);
      if (typeof iniciarPlanoCurso === 'function') await iniciarPlanoCurso();
      break;

    default:
      console.warn('[ROUTER] Página desconhecida:', pagina);
      return; // não faz pushState
  }

  if (comPush && turmaAtiva?.id) {
    _pushRota(pagina, turmaAtiva.id, opts);
  }
}

// ── API pública (substitui as chamadas existentes) ────────────────────────────

async function abrirTurma(id) {
  try {
    await _executarAbrirTurma(id);
    const selTri = parseInt(document.getElementById('sel-rel-tri')?.value || '1');
    _pushRota('relatorio-geral', id, { tri: selTri });
  } catch (e) {
    console.error('[ROUTER] Erro em abrirTurma:', e);
    mostrarToast('Erro ao abrir turma. Veja o console para detalhes.');
  }
}

function voltarDashboard() {
  try {
    _executarVoltarDashboard(true);
  } catch (e) {
    console.error('[ROUTER] Erro em voltarDashboard:', e);
  }
}

async function abrirPagina(pagina, opts = {}) {
  try {
    await _executarAbrirPagina(pagina, opts, true);
  } catch (e) {
    console.error('[ROUTER] Erro em abrirPagina:', e);
    mostrarToast('Erro ao abrir aba. Veja o console para detalhes.');
  }
}

async function voltarTurma() {
  try {
    esconderTudo();
    const nome = turmaAtiva?.nome || '';
    document.getElementById('pagina-relatorio-geral').style.display = 'block';
    atualizarCabecalho({ info: 'Relatórios', titulo: nome, detalhe: 'Voltar às turmas', voltarFn: 'voltarDashboard', cor: '#16A34A' });
    atualizarHeaderMobile('Relatório Geral', nome, true, false);
    const selTri = parseInt(document.getElementById('sel-rel-tri')?.value || '1');
    await carregarRelatorio(selTri);
    _pushRota('relatorio-geral', turmaAtiva?.id, { tri: selTri });
  } catch (e) {
    console.error('[ROUTER] Erro em voltarTurma:', e);
  }
}

async function abrirRelatorioUI(tri) {
  try {
    if (typeof fecharSidebar === 'function') fecharSidebar();
    await abrirPagina('relatorio-geral', { tri });
  } catch (e) {
    console.error('[ROUTER] Erro em abrirRelatorioUI:', e);
  }
}

// Compatibilidade com chamadas antigas
function trocarTab(tab) { abrirPagina(tab); }
