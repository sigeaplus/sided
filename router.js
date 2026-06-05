// ============================================
// ROUTER.JS - Sistema de Rotas com History API
// SIDED+ Professor Dashboard
// ============================================

const todasPaginas = [
  'turma-screen','pagina-aulas','pagina-chamada','pagina-avaliacoes','notas-screen',
  'pagina-relatorio-geral','pagina-relatorio-individual','pagina-mapeamento-sala',
  'pagina-calendario-escolar','pagina-ocorrencias','pagina-comunicacao','pagina-plano-curso'
];

const _abaParaSegmento = {
  'aulas': 'aulas',
  'chamada': 'chamada',
  'avaliacoes': 'avaliacoes',
  'relatorio-geral': 'relatorio',
  'relatorio-individual': 'relatorio-individual',
  'mapeamento-sala': 'mapeamento',
  'calendario-escolar': 'calendario',
  'ocorrencias': 'ocorrencias',
  'plano-curso': 'plano-curso'
};

const _segmentoParaAba = Object.fromEntries(
  Object.entries(_abaParaSegmento).map(([k, v]) => [v, k])
);

// Auxiliar para transformar o nome da turma em texto limpo para a URL
function _gerarSlug(texto) {
  if (!texto) return '';
  return texto.toString().toLowerCase().trim()
    .replace(/[\s_]+/g, '-') 
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

// Reconstrói a URL combinando Nome Resumido + ID
function _construirUrl(pagina, turmaObj, opts = {}) {
  if (!turmaObj || pagina === 'dashboard') return '/dashboard';
  
  const id = turmaObj.id;
  const slugNome = _gerarSlug(turmaObj.nome);
  const identificador = slugNome ? `${slugNome}-${id}` : id;

  if (pagina === 'relatorio-geral') {
    const tri = opts.tri || document.getElementById('sel-rel-tri')?.value || '1';
    return `/turma/${identificador}/relatorio?tri=${tri}`;
  }
  const seg = _abaParaSegmento[pagina];
  return seg ? `/turma/${identificador}/${seg}` : `/turma/${identificador}`;
}

// Extrai o ID real do final do segmento da URL
function _parsearUrl(pathname, search) {
  const match = pathname.match(/^\/turma\/([^\/]+)\/?([^/?]*)?/);
  if (!match) return { pagina: 'dashboard', turmaId: null };

  const segmentoCompleto = match[1]; 
  const segAba = match[2] || '';

  // Captura o UUID de 36 caracteres no final do segmento
  const uuidMatch = segmentoCompleto.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i);
  const turmaId = uuidMatch ? uuidMatch[1] : segmentoCompleto;

  const pagina = segAba ? (_segmentoParaAba[segAba] || 'relatorio-geral') : 'relatorio-geral';
  const params = new URLSearchParams(search || '');
  const tri = parseInt(params.get('tri') || '1');

  return { pagina, turmaId, tri };
}

function _setSidebarEstadoTurma(dentroTurma) {
  const normal = document.getElementById('sidebar-estado-normal');
  const menu   = document.getElementById('sidebar-turma-menu');
  const mini   = document.getElementById('btn-perfil-mini');
  const mobMenu = document.getElementById('mob-turma-menu');
  if (normal) normal.style.display = dentroTurma ? 'none' : 'flex';
  if (menu)   menu.style.display = dentroTurma ? 'flex' : 'none';
  if (mini)   mini.style.display = dentroTurma ? 'flex' : 'none';
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

function _limparCachesVisuais() {
  const containers = ['cards-aulas-container', 'lista-avaliacoes-container', 'chamada-alunos-corpo'];
  containers.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
}

function _paginaEstaVisivel(id) {
  const el = document.getElementById(id);
  return !!(el && el.style.display && el.style.display !== 'none');
}

// CORRIGIDO: não retorna mais cedo se todasTurmas estiver vazio —
// busca as turmas on-demand para garantir que o F5 em rota de turma funcione.
async function _carregarContextoTurma(id) {
  // Se todasTurmas ainda não foi carregado, buscar agora
  if (!todasTurmas || todasTurmas.length === 0) {
    if (typeof buscarTodasTurmasDoProfessor === 'function') {
      await buscarTodasTurmasDoProfessor();
    }
  }
  // Ainda vazio após tentativa = professor sem turmas ou erro de API
  if (!todasTurmas || todasTurmas.length === 0) return;

  turmaAtiva = todasTurmas.find(t => String(t.id) === String(id)) || null;
  if (!turmaAtiva) return;
  relatorioCache = [];
  alunosTurma = [];
  _limparCachesVisuais();
  await Promise.all([carregarAulas(), carregarAlunos(), carregarAvaliacoes()]);
}

async function _executarAbrirTurma(id) {
  await _carregarContextoTurma(id);
  if (!turmaAtiva) return;
  esconderTudo();

  const nome = turmaAtiva?.nome || '';
  atualizarCabecalho({ info: 'Relatórios', titulo: nome, detalhe: 'Voltar às turmas', voltarFn: 'voltarDashboard', cor: '#16A34A' });
  atualizarHeaderMobile('Relatório Geral', nome, true, false);
  _setSidebarEstadoTurma(true);

  const selTri = parseInt(document.getElementById('sel-rel-tri')?.value || '1');
  document.getElementById('pagina-relatorio-geral').style.display = 'block';
  await carregarRelatorio(selTri);
}

function _executarVoltarDashboard() {
  esconderTudo();
  const dash = document.getElementById('dashboard-screen');
  if (dash) dash.style.display = 'block';
  turmaAtiva = null;
  _setSidebarEstadoTurma(false);
  const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  const escola = profData.escolas?.nome || '';
  const codigo = profData.escolas?.codigo_escola ? `Código: ${profData.escolas.codigo_escola}` : '';
  atualizarCabecalho({ info: codigo, titulo: escola, detalhe: `Bem-vindo(a), ${(profData.nome || '').split(' ')[0]}!`, cor: 'var(--purple-dark)' });
  atualizarHeaderMobile('SIDED+', escola, false, false);
}

async function _executarAbrirPagina(pagina, opts = {}) {
  esconderTudo();
  _limparCachesVisuais();
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
      break;
  }
}

// Controla a entrada/restauração por URL
async function roteadorRestaurar() {
  const { pagina, turmaId, tri } = _parsearUrl(window.location.pathname, window.location.search);

  if (!turmaId || pagina === 'dashboard') {
    _executarVoltarDashboard();
    window.history.replaceState({ pagina: 'dashboard', turmaId: null }, '', '/dashboard');
    return;
  }

  // _carregarContextoTurma agora busca as turmas internamente se precisar
  await _carregarContextoTurma(turmaId);

  if (!turmaAtiva) {
    _executarVoltarDashboard();
    return;
  }

  const opts = pagina === 'relatorio-geral' ? { tri } : {};
  window.history.replaceState({ pagina, turmaId, opts }, '', _construirUrl(pagina, turmaAtiva, opts));
  await _executarAbrirPagina(pagina, opts);
}

// Inicializa os escutadores do History API
async function roteadorInicializar() {
  window.addEventListener('popstate', async (e) => {
    if (e.state) {
      const { pagina, turmaId, opts } = e.state;
      if (pagina === 'dashboard' || !turmaId) {
        _executarVoltarDashboard();
      } else {
        if (!turmaAtiva || String(turmaAtiva.id) !== String(turmaId)) {
          await _carregarContextoTurma(turmaId);
        }
        await _executarAbrirPagina(pagina, opts || {});
      }
    } else {
      await roteadorRestaurar();
    }
  });
  await roteadorRestaurar();
}

// APIs Públicas do sistema
async function abrirTurma(id) {
  try {
    await _executarAbrirTurma(id);
    if (!turmaAtiva) return;
    const selTri = parseInt(document.getElementById('sel-rel-tri')?.value || '1');
    const url = _construirUrl('relatorio-geral', turmaAtiva, { tri: selTri });
    window.history.pushState({ pagina: 'relatorio-geral', turmaId: String(id), opts: { tri: selTri } }, '', url);
  } catch (e) {
    console.error(e);
  }
}

function voltarDashboard() {
  _executarVoltarDashboard();
  window.history.pushState({ pagina: 'dashboard', turmaId: null }, '', '/dashboard');
}

async function abrirPagina(pagina, opts = {}) {
  if (!turmaAtiva) return;
  await _executarAbrirPagina(pagina, opts);
  const url = _construirUrl(pagina, turmaAtiva, opts);
  window.history.pushState({ pagina, turmaId: String(turmaAtiva.id), opts }, '', url);
}

async function voltarTurma() {
  if (!turmaAtiva) return;
  const selTri = parseInt(document.getElementById('sel-rel-tri')?.value || '1');
  await abrirPagina('relatorio-geral', { tri: selTri });
}

function trocarTab(tab) { abrirPagina(tab); }

async function abrirRelatorioUI(tri) {
  if (typeof fecharSidebar === 'function') fecharSidebar();
  await abrirPagina('relatorio-geral', { tri });
}
