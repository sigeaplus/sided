// ============================================
// ROUTER.JS — History API (Completo)
// SIDED+ Professor Dashboard
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

// ── Helpers de URL (Suporta Turma, Abas e Ficha de Aluno) ────────────────────
function _construirUrl(pagina, turmaId, opts = {}) {
  if (!turmaId || pagina === 'dashboard') return '/';
  
  // Tratamento da Ficha Individual do Aluno e suas subrotas
  if (opts.alunoId) {
    let subRotaAluno = '';
    if (opts.abaAluno) subRotaAluno = `/${opts.abaAluno}`; // /frequencia, /avaliacoes, etc.
    return `/turma/${turmaId}/aluno/${opts.alunoId}${subRotaAluno}`;
  }

  if (pagina === 'relatorio-geral') {
    const tri = opts.tri || document.getElementById('sel-rel-tri')?.value || '1';
    return `/turma/${turmaId}/relatorio?tri=${tri}`;
  }
  
  const seg = _abaParaSegmento[pagina];
  if (seg) return `/turma/${turmaId}/${seg}`;
  return `/turma/${turmaId}`;
}

function _parsearUrl(pathname, search) {
  // 1. Verifica padrão de Aluno: /turma/:id/aluno/:alunoId ou /turma/:id/aluno/:alunoId/:aba
  const matchAluno = pathname.match(/^\/turma\/(\d+)\/aluno\/([^\/]+)(?:\/([^\/]+))?/);
  if (matchAluno) {
    return {
      pagina: 'relatorio-individual',
      turmaId: matchAluno[1],
      alunoId: matchAluno[2],
      abaAluno: matchAluno[3] || 'visao-geral',
      tri: 1
    };
  }

  // 2. Verifica padrão de Rotas Gerais de Turma
  const match = pathname.match(/^\/turma\/(\d+)\/?([^/?]*)?/);
  if (!match) return { pagina: 'dashboard', turmaId: null, alunoId: null, abaAluno: null };
  
  const turmaId = match[1];
  const seg = match[2] || '';
  const pagina = seg ? (_segmentoParaAba[seg] || 'relatorio-geral') : 'relatorio-geral';
  const params = new URLSearchParams(search || '');
  const tri = parseInt(params.get('tri') || '1');
  
  return { pagina, turmaId, tri, alunoId: null, abaAluno: null };
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

// ── popstate — Botão Voltar/Avançar do Navegador ──────────────────────────────
window.addEventListener('popstate', async (e) => {
  try {
    const state = e.state;
    if (!state) {
      await _roteadorRestaurar(window.location.pathname, window.location.search, false);
      return;
    }
    const { pagina, turmaId, opts } = state;
    if (!pagina || pagina === 'dashboard') {
      _executarVoltarDashboard(false);
      return;
    }
    if (turmaId && (!turmaAtiva || String(turmaAtiva.id) !== String(turmaId))) {
      await _carregarContextoTurma(turmaId);
    }
    if (!turmaAtiva) { _executarVoltarDashboard(false); return; }
    await _executarAbrirPagina(pagina, opts || {}, false);
  } catch (e) {
    console.error('[ROUTER] popstate erro:', e);
  }
});

// ── Restauração por URL (F5 / Link Direto) ────────────────────────────────────
async function _roteadorRestaurar(pathname, search, substituirState = true) {
  try {
    const { pagina, turmaId, tri, alunoId, abaAluno } = _parsearUrl(pathname, search);
    if (pagina === 'dashboard' || !turmaId) {
      if (substituirState) _replaceRota('dashboard', null);
      return;
    }
    if (!turmaAtiva || String(turmaAtiva.id) !== String(turmaId)) {
      await _carregarContextoTurma(turmaId);
    }
    if (!turmaAtiva) {
      if (substituirState) _replaceRota('dashboard', null);
      return;
    }
    
    const opts = alunoId ? { alunoId, abaAluno } : (pagina === 'relatorio-geral' ? { tri } : {});
    if (substituirState) _replaceRota(pagina, turmaId, opts);
    
    await _executarAbrirPagina(pagina, opts, false);
  } catch (e) {
    console.error('[ROUTER] _roteadorRestaurar erro:', e);
  }
}

async function roteadorInicializar() {
  const pathname = window.location.pathname;
  const search   = window.location.search;
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
  const school  = profData.escolas?.nome || '';
  const codigo  = profData.escolas?.codigo_escola ? `Código: ${profData.escolas.codigo_escola}` : '';
  atualizarCabecalho({ info: codigo, titulo: school, detalhe: `Bem-vindo(a), ${(profData.nome || '').split(' ')[0]}!`, cor: 'var(--purple-dark)' });
  atualizarHeaderMobile('SIDED+', school, false, false);
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
      
      // Se houver um aluno ativo na URL (F5), restaura a ficha/aba dele diretamente
      if (opts.alunoId && typeof abrirFichaAlunoInterna === 'function') {
        await abrirFichaAlunoInterna(opts.alunoId, opts.abaAluno || 'visao-geral');
      }
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
      return;
  }

  if (comPush && turmaAtiva?.id) {
    _pushRota(pagina, turmaAtiva.id, opts);
  }
}

// ── API pública (Substitui as chamadas existentes) ────────────────────────────
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

// Nova função global para acionar a rota do aluno por cliques nos cards/linhas de UI
async function abrirCaminhoAluno(alunoId, abaAluno = 'visao-geral') {
  try {
    if (!turmaAtiva?.id) return;
    await _executarAbrirPagina('relatorio-individual', { alunoId, abaAluno }, true);
  } catch (e) {
    console.error('[ROUTER] Erro em abrirCaminhoAluno:', e);
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

function trocarTab(tab) { abrirPagina(tab); }