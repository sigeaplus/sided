// Dashboard page logic

async function init() {
  aplicarPreferenciaSidebarDesktop();
  const prof = await api(`professores?id_login=eq.${session.login}&select=*,escolas(*)&limit=1`);
  if (!prof || !prof[0]) { sair(); return; }
  const p = prof[0];
  sessionStorage.setItem('prof_data', JSON.stringify(p));
  document.getElementById('prof-nome-side').textContent = p.nome;
  document.getElementById('prof-escola-side').textContent = p.escolas?.nome || '—';
  document.getElementById('sidebar-prof-nome-display').textContent = p.nome;
  document.getElementById('sidebar-escola-display').textContent = p.escolas?.nome || '—';
  atualizarCabecalho({
    info: p.escolas?.codigo_escola ? `Código: ${p.escolas.codigo_escola}` : '',
    titulo: p.escolas?.nome || '—',
    detalhe: `Bem-vindo(a), ${p.nome.split(' ')[0]}!`,
    cor: 'var(--purple-dark)'
  });
  atualizarHeaderMobile('SIDED+', p.escolas?.nome || 'Sistema Inteligente de Diário Escolar Digital', false, false);
  await carregarTurmas(p.id);

  const _params = new URLSearchParams(window.location.search);
  const _turmaId = _params.get('turma_id');
  const _aba     = _params.get('aba');
  if (_turmaId && todasTurmas) {
    const _t = todasTurmas.find(t => String(t.id) === String(_turmaId));
    if (_t) {
      await abrirTurma(_t.id);
      if (_aba) await abrirPagina(_aba);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }
}

async function carregarTurmas(profId) {
  const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');

  const tdResult = await api(`turma_disciplinas?professor_id=eq.${profId}&select=id,disciplinas(id,nome,nivel),turmas(id,nome,ano,turno,nivel,codigo,escola_id,escolas(nome,codigo_escola))`);

  if (tdResult && tdResult.length) {
    const turmaMap = {};
    tdResult.forEach(td => {
      const t = td.turmas;
      if (!t) return;
      if (!turmaMap[t.id]) {
        turmaMap[t.id] = { ...t, disciplinas: [] };
      }
      if (td.disciplinas) turmaMap[t.id].disciplinas.push(td.disciplinas.nome);
    });
    todasTurmas = Object.values(turmaMap).map(t => ({
      ...t,
      disciplina: t.disciplinas.join(', ')
    }));
  } else {
    const pt = await api(`professor_turmas?professor_id=eq.${profId}&select=turma_id,disciplina`);
    if (!pt || !pt.length) {
      document.getElementById('turmas-grid').innerHTML = '<div class="turma-empty">Nenhuma turma associada.</div>';
      return;
    }
    const ids = pt.map(r => r.turma_id).join(',');
    todasTurmas = await api(`turmas?id=in.(${ids})&select=*,escolas(nome,codigo_escola)&order=nome`) || [];
    const ptMap = {};
    pt.forEach(r => { ptMap[r.turma_id] = r.disciplina; });
    todasTurmas = todasTurmas.map(t => ({ ...t, disciplina: t.disciplina || ptMap[t.id] || null }));
  }

  renderTurmas(todasTurmas);
}

function popularChips() {
  // Disciplina agora usa select fixo no filtro; não são mais necessários chips dinâmicos.
}

function toggleChip(el) {
  const grupo = el.dataset.grupo;
  const val = el.dataset.val;
  const isActive = el.classList.contains('active');
  document.querySelectorAll(`.chip[data-grupo="${grupo}"]`).forEach(c => c.classList.remove('active'));
  if (!isActive) { el.classList.add('active'); filtrosAtivos[grupo] = val; }
  else filtrosAtivos[grupo] = null;
  aplicarFiltros();
}

function atualizarFiltroAno() {
  const selAno = document.getElementById('sel-ano');
  filtrosAtivos.ano = selAno.value || null;
  aplicarFiltros();
}

function aplicarFiltros() {
  const q = document.getElementById('search-turma').value.toLowerCase();
  let lista = todasTurmas;
  if (filtrosAtivos.ano) lista = lista.filter(t => t.ano === filtrosAtivos.ano);
  if (filtrosAtivos.turno) lista = lista.filter(t => t.turno === filtrosAtivos.turno);
  if (q) lista = lista.filter(t => JSON.stringify(t).toLowerCase().includes(q));
  renderTurmas(lista);
}

function renderTurmas(lista) {
  const grid = document.getElementById('turmas-grid');

  lista = [...lista].sort((a, b) => {
    const nomeA = (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
    if (nomeA !== 0) return nomeA;
    return (a.disciplina || '').localeCompare(b.disciplina || '', 'pt-BR');
  });

  document.getElementById('turmas-header').textContent = `Minhas turmas (${lista.length})`;
  grid.innerHTML = lista.length
    ? lista.map((t, i) => {
        const discLabel = t.disciplina || '—';
        return `
          <div class="turma-card" style="animation-delay:${i * 0.04}s" onclick="abrirTurma('${t.id}')">
            <div class="turma-ano">${t.ano}</div>
            <div class="turma-codigo">${t.codigo ? `${t.codigo} — ` : ''}${t.nome}</div>
            <div class="turma-endereco">${t.escolas?.nome || ''}</div>
            <div class="turma-disciplina">${discLabel}</div>
            <div class="turma-turno">${t.turno || '—'}</div>
          </div>`;
      }).join('')
    : '<div class="turma-empty">Nenhuma turma encontrada com esses filtros.</div>';
}
