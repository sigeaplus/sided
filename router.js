// ============================================
// ROUTER.JS - Navegação e Controle de Páginas
// Reescrito: navegação consistente, await em carregamentos, helpers
// ============================================

// IDs de todas as páginas/abas usadas no app
const todasPaginas = [
  'turma-screen','pagina-aulas','pagina-chamada','pagina-avaliacoes','notas-screen',
  'pagina-relatorio-geral','pagina-relatorio-individual','pagina-mapeamento-sala',
  'pagina-calendario-escolar','pagina-ocorrencias','pagina-comunicacao','pagina-plano-curso'
];

// Helper para mostrar/ocultar sidebar conforme estado
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

// Esconde todas as páginas (centralizado para consistência)
function esconderTudo() {
  todasPaginas.forEach(p => {
    const el = document.getElementById(p);
    if (el) { el.style.display = 'none'; el.classList.remove('active'); }
  });
  const dash = document.getElementById('dashboard-screen');
  if (dash) dash.style.display = 'none';
}

// Verifica se uma página está visível (usado por outros módulos)
function _paginaEstaVisivel(id) {
  const el = document.getElementById(id);
  return !!(el && el.style.display && el.style.display !== 'none');
}

// Abre turma: prepara contexto e garante carregamentos necessários
async function abrirTurma(id) {
  try {
    turmaAtiva = todasTurmas.find(t => String(t.id) === String(id));
    relatorioCache = [];
    alunosTurma = [];
    esconderTudo();

    const nome = turmaAtiva?.nome || '';
    atualizarCabecalho({ info: 'Relatórios', titulo: nome, detalhe: 'Voltar às turmas', voltarFn: 'voltarDashboard', cor: '#16A34A' });
    atualizarHeaderMobile('Relatório Geral', nome, true, false);
    _setSidebarEstadoTurma(true);

    // Carregamentos que podem rodar em paralelo
    await Promise.all([carregarAulas(), carregarAlunos(), carregarAvaliacoes()]);

    // Mostrar relatório e aguardar seu carregamento (IMPORTANTE para evitar race conditions)
    const selTri = parseInt(document.getElementById('sel-rel-tri')?.value || '1');
    document.getElementById('pagina-relatorio-geral').style.display = 'block';
    await carregarRelatorio(selTri);
  } catch (e) {
    console.error('[ROUTER] Erro em abrirTurma:', e);
    mostrarToast('Erro ao abrir turma. Veja o console para detalhes.');
  }
}

// Volta ao dashboard
function voltarDashboard() {
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

// Função genérica para abrir uma página/aba dentro da turma
async function abrirPagina(pagina, opts = {}) {
  try {
    esconderTudo();
    const nome = turmaAtiva?.nome || '';

    // Sempre garantir alunos no contexto quando estivermos dentro de uma turma
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
  } catch (e) {
    console.error('[ROUTER] Erro em abrirPagina:', e);
    mostrarToast('Erro ao abrir aba. Veja o console para detalhes.');
  }
}

// Volta à turma (mostra relatório geral) — agora garantido como assíncrono
async function voltarTurma() {
  try {
    esconderTudo();
    const nome = turmaAtiva?.nome || '';
    document.getElementById('pagina-relatorio-geral').style.display = 'block';
    atualizarCabecalho({ info: 'Relatórios', titulo: nome, detalhe: 'Voltar às turmas', voltarFn: 'voltarDashboard', cor: '#16A34A' });
    atualizarHeaderMobile('Relatório Geral', nome, true, false);
    await carregarRelatorio(parseInt(document.getElementById('sel-rel-tri')?.value || '1'));
  } catch (e) {
    console.error('[ROUTER] Erro em voltarTurma:', e);
  }
}

// Compatibilidade com chamadas antigas
function trocarTab(tab) { abrirPagina(tab); }

// Helper para abrir o relatório geral a partir de botões/HTML inline
async function abrirRelatorioUI(tri) {
  try {
    if (typeof fecharSidebar === 'function') fecharSidebar();
    await abrirPagina('relatorio-geral', { tri });
  } catch (e) {
    console.error('[ROUTER] Erro em abrirRelatorioUI:', e);
  }
}
