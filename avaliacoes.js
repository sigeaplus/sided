async function _inicializarFiltroDiscAval() {
  const box = document.getElementById('aval-disciplina-filtro');
  const tabsContainer = document.getElementById('aval-disciplina-tabs');
  if (!box || !tabsContainer) return;

  if (!isFundamentalI()) {
    box.style.display = 'none';
    avalDiscFiltro = null;
    return;
  }

  box.style.display = 'block';
  tabsContainer.innerHTML = '<span style="font-size:12px;color:var(--text-muted);padding:10px;">Carregando...</span>';

  try {
    const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
    const td = await api(`turma_disciplinas?professor_id=eq.${profData.id}&turma_id=eq.${turmaAtiva.id}&select=disciplinas(id,nome)`);
    let discs = (td || []).map(r => r.disciplinas?.nome).filter(Boolean);
    if (!discs.length && profData.disciplina) discs = [profData.disciplina];
    if (!discs.length) { box.style.display = 'none'; return; }

    if (!avalDiscFiltro || !discs.includes(avalDiscFiltro)) avalDiscFiltro = discs[0];

    _renderTabsDisc(discs);
  } catch(e) {
    box.style.display = 'none';
  }
}

function _renderTabsDisc(discs) {
  const tabsContainer = document.getElementById('aval-disciplina-tabs');
  if (!tabsContainer) return;
  tabsContainer.innerHTML = discs.map(d => {
    const ativo = d === avalDiscFiltro;
    return `<button onclick="selecionarDiscAval('${d}')"
      style="padding:10px 20px;border:none;border-bottom:3px solid ${ativo ? 'var(--purple)' : 'transparent'};
        background:none;font-family:'Sora',sans-serif;font-size:13px;font-weight:${ativo ? '700' : '500'};
        color:${ativo ? 'var(--purple)' : 'var(--text-muted)'};cursor:pointer;white-space:nowrap;
        transition:all 0.15s;" id="tab-disc-${d.replace(/\s+/g,'_')}">
      ${d}
    </button>`;
  }).join('');
}

function selecionarDiscAval(disc) {
  avalDiscFiltro = disc;
  // Atualizar visual das abas
  document.querySelectorAll('[id^="tab-disc-"]').forEach(btn => {
    const ativo = btn.id === `tab-disc-${disc.replace(/\s+/g,'_')}`;
    btn.style.borderBottom = ativo ? '3px solid var(--purple)' : '3px solid transparent';
    btn.style.color = ativo ? 'var(--purple)' : 'var(--text-muted)';
    btn.style.fontWeight = ativo ? '700' : '500';
  });
  carregarAvaliacoes();
}
// Estado global carregado via state.js

let _cntSomaAtual = 0;

async function abrirConfirmarNotaTrimestral() {
  // Popular select trimestre com o trimestre atual
  const triAtual = detectarTrimestreAtual?.()?.tri || 1;
  const selTri = document.getElementById('cnt-tri');
  if (selTri) selTri.value = String(triAtual);

  // Popular select alunos
  const selAluno = document.getElementById('cnt-aluno');
  if (selAluno) {
    selAluno.innerHTML = '<option value="">Selecione o(a) aluno(a)...</option>' +
      (alunosTurma || []).map(a => `<option value="${a.id}">${a.nome_completo}</option>`).join('');
  }

  // Limpar campos
  document.getElementById('cnt-nota').value = '';
  document.getElementById('cnt-justificativa').value = '';
  document.getElementById('cnt-soma-wrap').style.display = 'none';
  document.getElementById('cnt-diff-wrap').style.display = 'none';
  document.getElementById('cnt-alert').style.display = 'none';
  document.getElementById('cnt-btn-salvar').disabled = true;
  document.getElementById('cnt-btn-salvar').style.opacity = '0.5';
  document.getElementById('cnt-btn-remover').style.display = 'none';

  document.getElementById('modal-confirmar-nota-tri').classList.add('open');
}

function cntSelecionarAluno(alunoId, nomeAluno) {
  // Atualiza o select oculto para compatibilidade com cnt_atualizarSoma()
  const sel = document.getElementById('cnt-aluno');
  if (sel) {
    let opt = sel.querySelector(`option[value="${alunoId}"]`);
    if (!opt) {
      opt = document.createElement('option');
      opt.value = alunoId;
      opt.textContent = nomeAluno;
      sel.appendChild(opt);
    }
    sel.value = alunoId;
    sel.dispatchEvent(new Event('change'));
  }
  // Atualiza label visual
  const lbl = document.getElementById('cnt-aluno-nome-label');
  if (lbl) { lbl.textContent = nomeAluno; lbl.style.color = 'var(--text)'; lbl.style.fontWeight = '700'; }
  const disp = document.getElementById('cnt-aluno-display');
  if (disp) { disp.style.borderColor = 'var(--purple)'; disp.style.background = 'var(--purple-light)'; }
}

async function cnt_carregarDados() {
  const tri = document.getElementById('cnt-tri')?.value;
  const alunoId = document.getElementById('cnt-aluno')?.value;
  document.getElementById('cnt-nota').value = '';
  document.getElementById('cnt-justificativa').value = '';
  document.getElementById('cnt-soma-wrap').style.display = 'none';
  document.getElementById('cnt-diff-wrap').style.display = 'none';
  document.getElementById('cnt-btn-remover').style.display = 'none';
  document.getElementById('cnt-btn-salvar').disabled = true;
  document.getElementById('cnt-btn-salvar').style.opacity = '0.5';
  if (alunoId) await cnt_atualizarSoma();
}

async function cnt_atualizarSoma() {
  const tri = document.getElementById('cnt-tri')?.value;
  const alunoId = document.getElementById('cnt-aluno')?.value;
  if (!tri || !alunoId || !turmaAtiva) return;

  const somaTxt = document.getElementById('cnt-soma-valor');
  const somaDetalhe = document.getElementById('cnt-soma-detalhe');
  const somaWrap = document.getElementById('cnt-soma-wrap');
  const notaConfAtual = document.getElementById('cnt-nota-confirmada-atual');
  const btnRemover = document.getElementById('cnt-btn-remover');

  somaTxt.textContent = '...';
  somaWrap.style.display = 'block';

  const soma = await _cntCalcularSoma(tri, alunoId);
  _cntSomaAtual = soma;
  const max = parseInt(tri) === 3 ? 40 : 30;
  somaTxt.textContent = soma.toFixed(2).replace('.',',');
  somaDetalhe.textContent = `de ${max} pts`;

  // Verificar se já tem nota confirmada no Supabase
  const _tdFilter = turmaDisciplinaAtiva?.id ? `&turma_disciplina_id=eq.${turmaDisciplinaAtiva.id}` : '';
  const ja = await api(
    `notas_confirmadas?aluno_id=eq.${alunoId}&trimestre=eq.${tri}${_tdFilter}&select=*&limit=1`
  );

  if (ja && ja[0]) {
    const reg = ja[0];
    notaConfAtual.style.display = 'block';
    notaConfAtual.textContent = `✓ Nota confirmada atual: ${Number(reg.nota_final).toFixed(2).replace('.',',')} pts — "${reg.justificativa}"`;
    btnRemover.style.display = 'inline-flex';
    document.getElementById('cnt-nota').value = reg.nota_final;
    document.getElementById('cnt-justificativa').value = reg.justificativa;
    cnt_validar();
  } else {
    notaConfAtual.style.display = 'none';
    btnRemover.style.display = 'none';
  }
}

function cnt_validar() {
  const nota = parseFloat(document.getElementById('cnt-nota').value);
  const just = document.getElementById('cnt-justificativa').value.trim();
  const tri = document.getElementById('cnt-tri')?.value;
  const alunoId = document.getElementById('cnt-aluno')?.value;
  const btnSalvar = document.getElementById('cnt-btn-salvar');
  const diffWrap = document.getElementById('cnt-diff-wrap');

  const valido = !isNaN(nota) && nota >= 0 && just.length >= 5 && alunoId;

  btnSalvar.disabled = !valido;
  btnSalvar.style.opacity = valido ? '1' : '0.5';

  if (!isNaN(nota) && alunoId && document.getElementById('cnt-soma-wrap').style.display !== 'none') {
    const diff = nota - _cntSomaAtual;
    const max = parseInt(tri) === 3 ? 40 : 30;
    if (Math.abs(diff) > 0.01) {
      const pos = diff > 0;
      diffWrap.style.display = 'block';
      diffWrap.style.background = pos ? '#F0FDF4' : '#FFF4F4';
      diffWrap.style.border = `1px solid ${pos ? '#BBF7D0' : '#FBBFBF'}`;
      diffWrap.style.color = pos ? '#166534' : '#B91C1C';
      diffWrap.innerHTML = `<strong>${pos ? '▲' : '▼'} ${Math.abs(diff).toFixed(2).replace('.',',')} pts</strong> em relação à soma calculada (${_cntSomaAtual.toFixed(2).replace('.',',')} → ${nota.toFixed(2).replace('.',',')} / ${max} pts)`;
    } else {
      diffWrap.style.display = 'none';
    }
  } else {
    diffWrap.style.display = 'none';
  }
}

async function cnt_salvar() {
  const nota = parseFloat(document.getElementById('cnt-nota').value);
  const just = document.getElementById('cnt-justificativa').value.trim();
  const tri = document.getElementById('cnt-tri')?.value;
  const alunoId = document.getElementById('cnt-aluno')?.value;
  const alertEl = document.getElementById('cnt-alert');
  alertEl.style.display = 'none';

  console.log('[CNT] Iniciando salvar:', { nota, just, tri, alunoId, turmaAtiva: turmaAtiva?.id, profData: typeof profData !== 'undefined' ? profData?.id : 'UNDEFINED', turmaDisciplinaAtiva: turmaDisciplinaAtiva?.id });

  if (isNaN(nota) || nota < 0) { alertEl.textContent = 'Digite uma nota válida.'; alertEl.style.display = 'block'; return; }
  if (!just || just.length < 5) { alertEl.textContent = 'A justificativa deve ter ao menos 5 caracteres.'; alertEl.style.display = 'block'; return; }
  if (!alunoId) { alertEl.textContent = 'Selecione um(a) aluno(a).'; alertEl.style.display = 'block'; return; }
  if (!turmaAtiva) { alertEl.textContent = 'Nenhuma turma ativa.'; alertEl.style.display = 'block'; return; }

  const aluno = (alunosTurma || []).find(a => String(a.id) === String(alunoId));
  const tipo = document.getElementById('cnt-tipo')?.value || 'trimestral';

  const payload = {
    turma_id             : turmaAtiva.id,
    turma_disciplina_id  : turmaDisciplinaAtiva?.id || null,
    aluno_id             : parseInt(alunoId),
    professor_id         : profData.id,
    trimestre            : parseInt(tri),
    nota_final           : nota,
    soma_original        : _cntSomaAtual,
    justificativa        : just,
    updated_at           : new Date().toISOString()
  };

  try {
    const res = await api('notas_confirmadas?on_conflict=aluno_id,trimestre,turma_disciplina_id', {
      method : 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body   : JSON.stringify(payload)
    });
    console.log('[CNT] Salvo:', res);
    mostrarToast(`✓ Nota ${nota} confirmada para ${aluno?.nome_completo?.split(' ')[0] || 'aluno(a)'} no ${tri}º trimestre.`);
    fecharModal('modal-confirmar-nota-tri');
  } catch (e) {
    console.error('[CNT] Erro completo:', e, JSON.stringify(payload));
    alertEl.textContent = 'Erro: ' + (e?.message || JSON.stringify(e) || 'Tente novamente.');
    alertEl.style.display = 'block';
  }
}

async function cnt_remover() {
  const tri = document.getElementById('cnt-tri')?.value;
  const alunoId = document.getElementById('cnt-aluno')?.value;
  if (!alunoId || !turmaAtiva) return;
  if (!confirm('Remover a nota confirmada? A soma calculada voltará a ser exibida.')) return;

  try {
    const _tdFilterRem = turmaDisciplinaAtiva?.id ? `&turma_disciplina_id=eq.${turmaDisciplinaAtiva.id}` : '';
    await api(
      `notas_confirmadas?aluno_id=eq.${alunoId}&trimestre=eq.${tri}${_tdFilterRem}`,
      { method: 'DELETE' }
    );
    mostrarToast('Nota confirmada removida.');
    fecharModal('modal-confirmar-nota-tri');
  } catch (e) {
    mostrarToast('Erro ao remover. Tente novamente.');
    console.error('[CNT] Erro ao remover:', e);
  }
}

// Expõe a nota confirmada para uso no relatório/ficha do aluno (async — Supabase)
async function cntObterNotaFinal(turmaId, tri, alunoId) {
  const _tdFilter = turmaDisciplinaAtiva?.id ? `&turma_disciplina_id=eq.${turmaDisciplinaAtiva.id}` : '';
  const res = await api(
    `notas_confirmadas?aluno_id=eq.${alunoId}&trimestre=eq.${tri}${_tdFilter}&select=nota_final&limit=1`
  );
  return res && res[0] ? res[0].nota_final : null;
}

function _configGrupoKey(id) { return `${turmaAtiva?.id || 'turma'}:${id}`; }
function _salvarConfigsGrupo() { localStorage.setItem('sided_grupos_avaliacoes', JSON.stringify(gruposAvaliacaoConfig)); }
function _obterConfigGrupo(id) {
  const cfg = gruposAvaliacaoConfig[_configGrupoKey(id)] || {};
  return { children: cfg.children || [], mode: cfg.mode || null };
}
function _setConfigGrupo(id, cfg) {
  gruposAvaliacaoConfig[_configGrupoKey(id)] = { children: cfg.children || [], mode: cfg.mode || null };
  _salvarConfigsGrupo();
}
function _mapaFilhosGrupos() {
  const ownerByChild = {};
  avaliacoesTurma.forEach(av => {
    const cfg = _obterConfigGrupo(av.id);
    if (!_isGrupoTipo(cfg.mode)) return;
    (cfg.children || []).forEach(childId => {
      ownerByChild[childId] = av.id;
    });
  });
  return ownerByChild;
}
function _isGrupoTipo(tipo) { return tipo === 'soma' || tipo === 'media'; }
function _isNotaFinal(aval) { return aval && typeof aval.nome === 'string' && aval.nome.startsWith('__NOTA_FINAL__'); }
function _nomeExibicaoAval(aval) { return _isNotaFinal(aval) ? aval.nome.replace('__NOTA_FINAL__', '') || 'Nota Final' : aval.nome; }
function _tipoExibicaoAval(aval) {
  if (!aval) return 'normal';
  const cfg = _obterConfigGrupo(aval.id);
  if (_isNotaFinal(aval)) return 'confirmar_nota';
  if (aval.tipo === 'normal' && _isGrupoTipo(cfg.mode)) return cfg.mode;
  return aval.tipo;
}
function _labelTipo(tipo) {
  if (tipo === 'confirmar_nota') return 'Nota Final';
  if (tipo === 'soma') return 'Soma';
  if (tipo === 'media') return 'Média';
  if (tipo === 'recuperacao') return 'Recuperação';
  return 'Normal';
}
function _recalcularPontosGrupo() {
  const tipo = document.getElementById('aval-tipo').value;
  const subAvals = avaliacoesTurma.filter(a => grupoComposicaoSelecionada.includes(a.id));
  const total = subAvals.reduce((acc, a) => acc + Number(a.pontos || 0), 0);
  const pontosCalculados = tipo === 'media' && subAvals.length ? (total / subAvals.length) : total;
  document.getElementById('grupo-pontos-total').textContent = pontosCalculados.toFixed(1).replace('.0', '');
  document.getElementById('aval-pontos').value = pontosCalculados ? pontosCalculados.toFixed(1).replace('.0', '') : '';
}
function _renderChecklistGrupo() {
  const tri = parseInt(document.getElementById('aval-tri').value);
  const listEl = document.getElementById('grupo-avaliacoes-list');
  const ownerByChild = _mapaFilhosGrupos();
  const candidates = avaliacoesTurma.filter(a =>
    !_isGrupoTipo(_tipoExibicaoAval(a)) &&
    a.tipo !== 'recuperacao' && !_isNotaFinal(a) &&
    parseInt(a.trimestre) === tri &&
    a.id !== editandoAvalId &&
    (!ownerByChild[a.id] || ownerByChild[a.id] === editandoAvalId)
  );
  if (!candidates.length) {
    listEl.innerHTML = '<div style="font-size:12px;color:var(--text-muted);">Nenhuma avaliação normal disponível neste trimestre.</div>';
    grupoComposicaoSelecionada = [];
    _recalcularPontosGrupo();
    return;
  }
  listEl.innerHTML = candidates.map(a => `
    <label class="grupo-avaliacoes-item">
      <input type="checkbox" ${grupoComposicaoSelecionada.includes(a.id) ? 'checked' : ''} onchange="toggleSubAvaliacaoGrupo('${a.id}', this.checked)">
      <span>${a.nome} (${Number(a.pontos || 0)} pts)</span>
    </label>
  `).join('');
  _recalcularPontosGrupo();
}
function selecionarTipoAvaliacao(btn) {
  document.querySelectorAll('.tipo-card').forEach(el => el.classList.remove('active'));
  btn.classList.add('active');
  const tipo = btn.dataset.tipo;
  document.getElementById('aval-tipo').value = tipo;
  const isGrupo = _isGrupoTipo(tipo);
  const isNotaFinal = tipo === 'confirmar_nota';
  document.getElementById('grupo-composicao').classList.toggle('open', isGrupo);
  document.getElementById('aval-pontos').readOnly = isGrupo;
  document.getElementById('aval-pontos').style.opacity = isGrupo ? '0.75' : '1';

  // Para NOTA FINAL: esconde nome e campo de pontos
  const nomeField = document.getElementById('aval-nome')?.closest('.field');
  const pontosRow = document.querySelector('.field-row');
  if (nomeField) nomeField.style.display = isNotaFinal ? 'none' : '';
  if (pontosRow) pontosRow.style.display = isNotaFinal ? 'none' : '';

  if (isGrupo) _renderChecklistGrupo();
}
function toggleSubAvaliacaoGrupo(id, checked) {
  if (checked) {
    if (!grupoComposicaoSelecionada.includes(id)) grupoComposicaoSelecionada.push(id);
  } else {
    grupoComposicaoSelecionada = grupoComposicaoSelecionada.filter(v => v !== id);
  }
  _recalcularPontosGrupo();
}
function entrarNoGrupo(id) {
  abrirNotasGrupo(id);
}

async function carregarAvaliacoes() {
  const _tdId = turmaDisciplinaAtiva?.id;
  avaliacoesTurma = await apiCached(
    _tdId
      ? `avaliacoes?turma_disciplina_id=eq.${_tdId}&select=*&order=created_at`
      : `avaliacoes?turma_id=eq.${turmaAtiva.id}&professor_id=eq.${JSON.parse(sessionStorage.getItem('prof_data')||'{}').id}&select=*&order=created_at`,
    turmaAtiva.id, 'avaliacoes', 30000
  );
  
  // garantir que alunos estão carregados
  if (!alunosTurma.length) {
    alunosTurma = await api(`alunos?turma_id=eq.${turmaAtiva.id}&select=*&order=nome_completo`) || [];
  }
  const totalAlunos = alunosTurma.length;

  let contPorAval = {};
  if (avaliacoesTurma.length && totalAlunos) {
    const ids = avaliacoesTurma.map(a => a.id).join(',');
    const notas = await api(`notas?avaliacao_id=in.(${ids})&select=avaliacao_id,aluno_id,nota,nao_realizado`) || [];
    const alunosSet = new Set(alunosTurma.map(a => a.id));
    notas.forEach(n => {
      if (alunosSet.has(n.aluno_id) && (n.nota !== null || n.nao_realizado)) {
        contPorAval[n.avaliacao_id] = (contPorAval[n.avaliacao_id] || 0) + 1;
      }
    });
  }

  // Trimestre ativo no seletor — usa atual se vazio
  const triSelRaw = document.getElementById('sel-aval-tri')?.value || '';
  const triSel = triSelRaw ? parseInt(triSelRaw) : detectarTrimestreAtual().tri;

  // Máximo esperado: 
  // - Fundamental I: sempre 30 por DISCIPLINA (não soma entre disciplinas)
  // - Outros: por trimestre (1º=30, 2º=30, 3º=40)
  const maxPorTri = { 1: 30, 2: 30, 3: 40 };
  const maxEsperado = isFundamentalI() ? 30 : maxPorTri[triSel] || 30;

  // Pontos lançados = soma dos pontos das avaliações normais do trimestre
  // onde TODOS os alunos têm nota. Para Fundamental I, filtra pela disciplina ativa.
  let pontosLancados = 0;
  if (totalAlunos > 0) {
    avaliacoesTurma.forEach(aval => {
      if (aval.tipo === 'recuperacao') return;
      if (_isNotaFinal(aval)) return;  // Nota final nunca é contabilizada
      if (parseInt(aval.trimestre) !== parseInt(triSel)) return;
      if (isFundamentalI() && avalDiscFiltro && aval.disciplina !== avalDiscFiltro) return;
      const count = contPorAval[aval.id] || 0;
      if (count >= totalAlunos) {
        // Garantir que não ultrapasse 30 por disciplina em Fundamental I
        if (isFundamentalI() && (pontosLancados + Number(aval.pontos || 0)) > 30) {
          // Avaliação ultrapassa o limite - não contar
          return;
        }
        pontosLancados += Number(aval.pontos || 0);
      }
    });
  }

  document.getElementById('counter-notas').textContent = `${pontosLancados} de ${maxEsperado}`;

  // salvar globalmente para uso no fechar trimestre
  window._pontosLancadosPorTri = window._pontosLancadosPorTri || {};
  window._pontosLancadosPorTri[triSel] = { pontosLancados, maxEsperado, totalAlunos };
  window._contPorAval = contPorAval;

  renderAvaliacoes(avaliacoesTurma, contPorAval, totalAlunos);
}

function filtrarTriSelect(val) {
  triAtivo = val;
  // garantir que o select reflete o valor
  const sel = document.getElementById('sel-aval-tri');
  if (sel) sel.value = val;
  carregarAvaliacoes();
}

function filtrarTri(el) {
  document.querySelectorAll('.chip[data-grupo="tri"]').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  triAtivo = el.dataset.val;
  filtrarTriSelect(triAtivo);
}

function renderAvaliacoes(lista, contPorAval, totalAlunos) {
  totalAlunos = totalAlunos || alunosTurma.length;
  const el = document.getElementById('avaliacoes-list');

  // filtrar pelo trimestre selecionado
  const triSel = document.getElementById('sel-aval-tri')?.value || '';
  let listaFiltrada = triSel ? lista.filter(a => String(a.trimestre) === triSel) : lista;

  // filtrar por disciplina se Fundamental I
  if (isFundamentalI() && avalDiscFiltro) {
    listaFiltrada = listaFiltrada.filter(a => a.disciplina === avalDiscFiltro);
  }

  // Sub-avaliações vinculadas a grupos não aparecem na listagem principal.
  // Elas ficam visíveis apenas dentro do card do grupo.
  const ownerByChild = _mapaFilhosGrupos();
  listaFiltrada = listaFiltrada.filter(a => {
    const ownerId = ownerByChild[a.id];
    if (!ownerId) return true;
    const tipoExibicao = _tipoExibicaoAval(a);
    return _isGrupoTipo(tipoExibicao);
  });

  if (!listaFiltrada.length) {
    el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:13px;">Nenhuma avaliação cadastrada</div>';
    return;
  }

  const nomesTri = { 1: '1º Trimestre', 2: '2º Trimestre', 3: '3º Trimestre' };
  const grupos = {};
  listaFiltrada.forEach(a => {
    const t = a.trimestre;
    if (!grupos[t]) grupos[t] = [];
    grupos[t].push(a);
  });

  el.innerHTML = Object.keys(grupos).sort().map(tri => `
    <div style="margin-bottom:24px;">
      <div style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:12px;display:flex;align-items:center;gap:12px;">
        ${nomesTri[tri] || tri + 'º Trimestre'}
        <div style="flex:1;height:1px;background:var(--border);"></div>
      </div>
      ${grupos[tri].map(a => {
        const tipoExibicao = _tipoExibicaoAval(a);
        const isGrupo = _isGrupoTipo(tipoExibicao);
        const cfg = isGrupo ? _obterConfigGrupo(a.id) : { children: [] };
        const subs = cfg.children.map(id => lista.find(x => x.id === id)).filter(Boolean);
        const lancadas = contPorAval[a.id] || 0;
        const status = lancadas === 0 ? 'vazia' : lancadas < totalAlunos ? 'pendente' : 'lancada';
        const statusTxt = status === 'lancada' ? 'Nota registrada' : status === 'pendente' ? 'Nota pendente' : '';
        const statusBg = status === 'lancada' ? '#DCFCE7' : '#FEF3C7';
        const statusClr = status === 'lancada' ? '#166534' : '#92400E';
        return `
        <div class="aval-card ${tipoExibicao === 'soma' ? 'grupo-card-soma' : ''} ${tipoExibicao === 'media' ? 'grupo-card-media' : ''}" style="cursor:${isGrupo ? 'default' : 'pointer'};${_isNotaFinal(a) ? 'border-color:#C4B5FD;background:#FAF5FF;' : ''}" ${isGrupo ? '' : `onclick="abrirNotas('${a.id}')"`}>
          ${!isGrupo && status !== 'vazia' ? `<span class="aval-status-badge-inline" style="position:absolute;top:14px;right:14px;background:${statusBg};color:${statusClr};font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;">${statusTxt}</span>` : ''}
          <div class="aval-card-header" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding-right:${isGrupo ? '0' : '130px'}">
            <span style="font-size:14px;font-weight:700;color:var(--purple);text-decoration:underline;">${_nomeExibicaoAval(a)}</span>
            ${a.disciplina ? `<span style="font-size:10px;font-weight:700;background:var(--purple-light);color:var(--purple);padding:2px 8px;border-radius:20px;">${a.disciplina}</span>` : ''}
            <button onclick="event.stopPropagation();editarAvaliacao('${a.id}')" style="background:none;border:none;cursor:pointer;color:var(--purple);padding:2px;display:flex;align-items:center;" title="${isGrupo ? 'Editar grupo' : 'Editar'}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          </div>
          <div style="font-size:13px;color:var(--text);line-height:1.8;">
            ${_isNotaFinal(a) ? '' : `Valor Total: <strong>${a.pontos}</strong><br>`}
            Tipo: <strong>${_labelTipo(tipoExibicao)}</strong><br>
            Divisão: <strong>${nomesTri[a.trimestre] || ''}</strong>
          </div>
          ${isGrupo ? `
            <div style="display:flex;gap:8px;margin-top:10px;">
              <button class="btn-entrar-grupo" onclick="event.stopPropagation();entrarNoGrupo('${a.id}')">→ Entrar</button>
              <button class="btn-editar-grupo" onclick="event.stopPropagation();editarAvaliacao('${a.id}')">Editar grupo</button>
            </div>
            <div class="grupo-sublista" style="${grupoEntrouId === a.id ? '' : 'opacity:0.95;'}">
              ${subs.length ? subs.map(s => `
                <div class="grupo-subitem">
                  <span>${s.nome} (${Number(s.pontos || 0)} pts)</span>
                  <span>
                    <button class="btn-editar-grupo" onclick="event.stopPropagation();editarAvaliacao('${s.id}')">Editar</button>
                    <button class="btn-entrar-grupo" onclick="event.stopPropagation();abrirNotas('${s.id}')">Lançar</button>
                  </span>
                </div>
              `).join('') : '<div style="font-size:12px;color:var(--text-muted);">Sem sub-avaliações selecionadas.</div>'}
            </div>
          ` : ''}
          <div style="display:flex;justify-content:flex-end;margin-top:10px;">
            <button onclick="event.stopPropagation();excluirAvaliacao('${a.id}')" style="background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:5px;color:#E24B4A;font-family:'Sora',sans-serif;font-size:12px;font-weight:600;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              Excluir
            </button>
          </div>
        </div>`;
      }).join('')}
    </div>`).join('');
}

async function abrirModalAvaliacao(data) {
  editandoAvalId = data?.id || null;
  const tipoAtual = data ? _tipoExibicaoAval(data) : 'normal';
  document.getElementById('modal-aval-title').textContent = editandoAvalId ? 'Editar avaliação' : 'Nova avaliação';
  document.getElementById('aval-nome').value = data?.nome || '';
  document.getElementById('aval-pontos').value = data?.pontos || '';
  document.getElementById('aval-tri').value = data?.trimestre || detectarTrimestreAtual().tri || '1';
  document.getElementById('aval-tipo').value = tipoAtual;
  const _avalAlert = document.getElementById('aval-alert'); _avalAlert.style.display = 'none'; _avalAlert.textContent = '';
  grupoComposicaoSelecionada = editandoAvalId ? [..._obterConfigGrupo(editandoAvalId).children] : [];

  // Verificar se é Fundamental I
  const isFundI = isFundamentalI();
  const fieldDisc = document.getElementById('aval-field-disciplina');
  const selDisc = document.getElementById('aval-disciplina');

  if (isFundI) {
    fieldDisc.style.display = 'block';
    // Buscar disciplinas do professor para essa turma
    try {
      const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
      const td = await api(`turma_disciplinas?professor_id=eq.${profData.id}&turma_id=eq.${turmaAtiva.id}&select=disciplinas(id,nome)`);
      selDisc.innerHTML = '<option value="">Selecione a disciplina...</option>';
      (td || []).forEach(r => {
        if (r.disciplinas) {
          const opt = document.createElement('option');
          opt.value = r.disciplinas.nome;
          opt.textContent = r.disciplinas.nome;
          if (data?.disciplina === r.disciplinas.nome) opt.selected = true;
          selDisc.appendChild(opt);
        }
      });
      // Se não veio nada do turma_disciplinas, usa disciplina do profData
      if (selDisc.options.length <= 1 && profData.disciplina) {
        const opt = document.createElement('option');
        opt.value = profData.disciplina;
        opt.textContent = profData.disciplina;
        opt.selected = true;
        selDisc.appendChild(opt);
      }
    } catch(e) { fieldDisc.style.display = 'none'; }
  } else {
    fieldDisc.style.display = 'none';
    selDisc.innerHTML = '';
  }

  document.querySelectorAll('.tipo-card').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tipo === tipoAtual);
  });
  selecionarTipoAvaliacao(document.querySelector(`.tipo-card[data-tipo="${tipoAtual}"]`));

  const isGrupo = _isGrupoTipo(tipoAtual);
  const triSelect = document.getElementById('aval-tri');
  triSelect.disabled = !!(isGrupo && editandoAvalId);
  if (isGrupo && editandoAvalId) triSelect.title = 'Trimestre do grupo não pode ser alterado.';
  else triSelect.title = '';

  document.getElementById('modal-avaliacao').classList.add('open');
}

function editarAvaliacao(id) { abrirModalAvaliacao(avaliacoesTurma.find(a => a.id === id)); }

async function salvarAvaliacao() {
  const btn = document.getElementById('btn-salvar-aval');
  btn.disabled = true;
  const alEl = document.getElementById('aval-alert');
  alEl.style.display = 'none';
  const nome = document.getElementById('aval-nome').value.trim();
  const pontos = parseFloat(document.getElementById('aval-pontos').value);
  const tipo = document.getElementById('aval-tipo').value;
  if (tipo !== 'confirmar_nota' && (!nome || !pontos)) { alEl.textContent = 'Preencha nome e pontos.'; alEl.style.display = 'block'; btn.disabled = false; return; }
  if (_isGrupoTipo(tipo) && !grupoComposicaoSelecionada.length) {
    alEl.textContent = 'Selecione ao menos uma sub-avaliação para o grupo.';
    alEl.style.display = 'block';
    btn.disabled = false;
    return;
  }

  // Disciplina — obrigatória se campo visível (Fundamental I)
  const fieldDisc = document.getElementById('aval-field-disciplina');
  const isFundI = fieldDisc && fieldDisc.style.display !== 'none';
  const disciplina = isFundI ? document.getElementById('aval-disciplina').value : null;
  if (isFundI && !disciplina && tipo !== 'confirmar_nota') { alEl.textContent = 'Selecione a disciplina.'; alEl.style.display = 'block'; btn.disabled = false; return; }

  // Validação: em Fundamental I, cada disciplina tem máximo 30 pts
  if (isFundI && disciplina && !_isGrupoTipo(tipo)) {
    const triAtual = parseInt(document.getElementById('aval-tri').value);
    let totalPontosDisc = 0;
    
    avaliacoesTurma.forEach(aval => {
      // Contar apenas avaliações normais (não recuperação) do mesmo trimestre e disciplina
      if (aval.tipo !== 'recuperacao' && !_isNotaFinal(aval) && 
          parseInt(aval.trimestre) === triAtual && 
          aval.disciplina === disciplina &&
          aval.id !== editandoAvalId) { // se editando, não contar a avaliação atual
        totalPontosDisc += Number(aval.pontos || 0);
      }
    });
    
    if (totalPontosDisc + pontos > 30) {
      alEl.textContent = `Erro: a disciplina "${disciplina}" já tem ${totalPontosDisc} pts. Máximo por disciplina é 30 pts.`;
      alEl.style.display = 'block'; 
      btn.disabled = false; 
      return;
    }
  }

  const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  const tipoPersistir = (_isGrupoTipo(tipo) || tipo === 'confirmar_nota') ? 'normal' : tipo;
  // Para confirmar_nota: nome com prefixo especial, pontos mínimo válido
  const nomeReal = tipo === 'confirmar_nota' ? '__NOTA_FINAL__' + (nome || 'Nota Final') : nome;
  const pontosReal = tipo === 'confirmar_nota' ? 1 : pontos;
  const body = {
    nome: nomeReal, pontos: pontosReal,
    trimestre: parseInt(document.getElementById('aval-tri').value),
    tipo: tipoPersistir,
    turma_id: turmaAtiva.id,
    turma_disciplina_id: turmaDisciplinaAtiva?.id || null,
    professor_id: profData.id,
    ...(disciplina ? { disciplina } : {})
  };
  try {
    if (editandoAvalId) {
      await api(`avaliacoes?id=eq.${editandoAvalId}`, { method: 'PATCH', body: JSON.stringify(body) });
      const idx = avaliacoesTurma.findIndex(a => a.id === editandoAvalId);
      if (idx !== -1) avaliacoesTurma[idx] = { ...avaliacoesTurma[idx], ...body };
      if (_isGrupoTipo(tipo)) _setConfigGrupo(editandoAvalId, { children: grupoComposicaoSelecionada, mode: tipo });
      else {
        delete gruposAvaliacaoConfig[_configGrupoKey(editandoAvalId)];
        _salvarConfigsGrupo();
      }
    } else {
      const res = await api('avaliacoes', { method: 'POST', body: JSON.stringify(body) });
      // Garantir que disciplina está no objeto local (Supabase às vezes omite campos no retorno)
      const nova = (res && res[0]) ? { ...body, ...res[0], disciplina: body.disciplina || res[0].disciplina } : { ...body, id: Date.now() };
      avaliacoesTurma.push(nova);
      if (_isGrupoTipo(tipo)) _setConfigGrupo(nova.id, { children: grupoComposicaoSelecionada, mode: tipo });
    }
    cacheSalvar(turmaAtiva.id, 'avaliacoes', avaliacoesTurma);
    fecharModal('modal-avaliacao');
    // Invalidar cache de avaliações para forçar rebusca com campo disciplina
    delete _cache[_cacheKey(turmaAtiva.id, 'avaliacoes')];
    // Recarregar com contagem real de notas
    await carregarAvaliacoes();
  } catch(e) {
    alEl.textContent = `Erro ao salvar. ${e?.message || ''}`.trim();
    alEl.style.display = 'block';
  }
  btn.disabled = false;
}

async function excluirAvaliacao(id) {
  if (!confirm('Excluir esta avaliação?')) return;
  await api(`avaliacoes?id=eq.${id}`, { method: 'DELETE' });
  avaliacoesTurma = avaliacoesTurma.filter(a => a.id !== id);
  delete gruposAvaliacaoConfig[_configGrupoKey(id)];
  _salvarConfigsGrupo();
  cacheSalvar(turmaAtiva.id, 'avaliacoes', avaliacoesTurma);
  renderAvaliacoes(avaliacoesTurma, {}, alunosTurma.length);
}

// NOTAS
// IDs dos alunos incluídos manualmente na recuperação
let alunosRecuperacaoExtra = new Set();

async function abrirNotas(avalId) {
  modoGrupoNotasAtivo = null;
  avaliacaoAtiva = avaliacoesTurma.find(a => String(a.id) === String(avalId));
  if (!avaliacaoAtiva) return;
  alunosRecuperacaoExtra = new Set();
  const isConfirmar = _isNotaFinal(avaliacaoAtiva);

  const notaPadraoWrap = document.getElementById('nota-padrao-wrap');
  if (notaPadraoWrap) notaPadraoWrap.style.display = isConfirmar ? 'none' : 'flex';

  // Garantir alunos carregados — sempre rebusca para nota final
  if (!alunosTurma.length || isConfirmar) {
    const fetchedAlunos = await api(`alunos?turma_id=eq.${turmaAtiva.id}&select=*&order=nome_completo`) || [];
    if (fetchedAlunos.length) alunosTurma = fetchedAlunos;
  }
  // Se ainda vazio, tentar uma vez mais sem cache
  if (!alunosTurma.length) {
    alunosTurma = await api(`alunos?turma_id=eq.${turmaAtiva.id}&select=*&order=nome_completo`) || [];
  }

  // trocar telas
  document.getElementById('pagina-avaliacoes').style.display = 'none';
  document.getElementById('notas-screen').style.display = 'block';

  atualizarCabecalho({ info: isConfirmar ? 'Avaliações — Nota Final' : 'Avaliações — Lançar Notas', titulo: _nomeExibicaoAval(avaliacaoAtiva), detalhe: 'Voltar às avaliações', voltarFn: 'voltarAvaliacoes', cor: '#FF8C38' });

  const nomesTri = { 1: '1º Trimestre', 2: '2º Trimestre', 3: '3º Trimestre' };
  const totalTri = avaliacoesTurma
    .filter(a => a.trimestre === avaliacaoAtiva.trimestre && a.tipo !== 'recuperacao' && !_isNotaFinal(a))
    .reduce((s,a) => s + Number(a.pontos), 0);

  document.getElementById('notas-title').textContent = _nomeExibicaoAval(avaliacaoAtiva);
  document.getElementById('notas-pontos').textContent = isConfirmar ? '—' : `${avaliacaoAtiva.pontos} pts`;
  document.getElementById('notas-tri').textContent = nomesTri[avaliacaoAtiva.trimestre] || '';
  document.getElementById('notas-tipo').textContent = isConfirmar ? 'Nota Final' : (avaliacaoAtiva.tipo === 'normal' ? 'Normal' : 'Recuperação');
  document.getElementById('notas-total-tri').textContent = isConfirmar ? `${totalTri} pts no trimestre` : `${totalTri} pts`;

  atualizarHeaderMobile(_nomeExibicaoAval(avaliacaoAtiva), isConfirmar ? `Nota Final · ${nomesTri[avaliacaoAtiva.trimestre]}` : `${avaliacaoAtiva.pontos}pts · ${nomesTri[avaliacaoAtiva.trimestre]}`, true, true);

  // Soma do trimestre por aluno — igual ao relatório geral
  let avaisNormais = avaliacoesTurma.filter(a => a.trimestre === avaliacaoAtiva.trimestre && a.tipo !== 'recuperacao' && !_isNotaFinal(a));
  const avaisRecup  = avaliacoesTurma.filter(a => a.trimestre === avaliacaoAtiva.trimestre && a.tipo === 'recuperacao');
  if (isFundamentalI() && avalDiscFiltro) {
    avaisNormais = avaisNormais.filter(a => a.disciplina === avalDiscFiltro);
  }
  let somaTri = {};
  const todosIdsParaSoma = [
    ...avaisNormais.map(a => a.id),
    ...avaisRecup.map(a => a.id)
  ];
  if (todosIdsParaSoma.length) {
    const todasNotas = await api(`notas?avaliacao_id=in.(${todosIdsParaSoma.join(',')})&select=*`) || [];
    todasNotas.forEach(n => {
      if (!n.nao_realizado && !n.ausente) {
        if (n.nota !== null && n.nota !== undefined)
          somaTri[n.aluno_id] = (somaTri[n.aluno_id] || 0) + Number(n.nota);
        if (n.recuperacao_paralela !== null && n.recuperacao_paralela !== undefined)
          somaTri[n.aluno_id] = (somaTri[n.aluno_id] || 0) + Number(n.recuperacao_paralela);
      }
    });
  }

  // Para confirmar_nota: notas salvas na tabela 'notas' com recuperacao_paralela = nota final
  let mapNotas = {};
  if (isConfirmar) {
    const notasSalvas = await api(`notas?avaliacao_id=eq.${avalId}&select=*`) || [];
    notasSalvas.forEach(n => { mapNotas[n.aluno_id] = n; });
  } else {
    const notasSalvas = await api(`notas?avaliacao_id=eq.${avalId}&select=*`) || [];
    notasSalvas.forEach(n => { mapNotas[n.aluno_id] = n; });
  }

  const maxTri = isFundamentalI() ? 30 : (avaliacaoAtiva.trimestre === 3 ? 40 : 30);
  const mediaMin = isFundamentalI() ? 18 : (avaliacaoAtiva.trimestre === 3 ? 24 : 18);
  const limiteRecup = maxTri * 0.6;

  window._somaTri = somaTri;
  window._mapNotas = mapNotas;

  const isRecup = avaliacaoAtiva.tipo === 'recuperacao';

  const alunosVisiveis = isRecup
    ? alunosTurma.filter(a => (somaTri[a.id] || 0) < limiteRecup)
    : [...alunosTurma];

  renderNotasAlunos(alunosVisiveis, mapNotas, somaTri, mediaMin, isRecup, totalTri, maxTri, isConfirmar);

  setTimeout(() => configurarNavegacaoNotas(), 100);
}

async function abrirNotasGrupo(grupoId) {
  const grupo = avaliacoesTurma.find(a => a.id === grupoId);
  if (!grupo) return;
  const cfg = _obterConfigGrupo(grupoId);
  const tipoGrupo = _tipoExibicaoAval(grupo);
  const subAvals = (cfg.children || []).map(id => avaliacoesTurma.find(a => a.id === id)).filter(Boolean);
  if (!subAvals.length) {
    mostrarToast('Grupo sem sub-avaliações para editar.');
    return;
  }
  modoGrupoNotasAtivo = { grupoId, tipo: tipoGrupo, subAvals };
  avaliacaoAtiva = grupo;
  alunosRecuperacaoExtra = new Set();
  if (!alunosTurma.length) {
    alunosTurma = await api(`alunos?turma_id=eq.${turmaAtiva.id}&select=*&order=nome_completo`) || [];
  }

  document.getElementById('pagina-avaliacoes').style.display = 'none';
  document.getElementById('notas-screen').style.display = 'block';
  const notaPadraoWrap = document.getElementById('nota-padrao-wrap');
  if (notaPadraoWrap) notaPadraoWrap.style.display = 'none';

  const nomesTri = { 1: '1º Trimestre', 2: '2º Trimestre', 3: '3º Trimestre' };
  atualizarCabecalho({ info: 'Avaliações — Grupo', titulo: grupo.nome, detalhe: 'Voltar às avaliações', voltarFn: 'voltarAvaliacoes', cor: '#FF8C38' });
  atualizarHeaderMobile(grupo.nome, `${_labelTipo(tipoGrupo)} · ${nomesTri[grupo.trimestre] || ''}`, true, true);

  document.getElementById('notas-title').textContent = `${grupo.nome} (Grupo)`;
  document.getElementById('notas-pontos').textContent = `${grupo.pontos} pts`;
  document.getElementById('notas-tri').textContent = nomesTri[grupo.trimestre] || '';
  document.getElementById('notas-tipo').textContent = `${_labelTipo(tipoGrupo)} (editável)`;
  document.getElementById('notas-total-tri').textContent = `${subAvals.length} sub-avaliações`;

  const ids = subAvals.map(a => a.id).join(',');
  const notasTodas = await api(`notas?avaliacao_id=in.(${ids})&select=*`) || [];
  const notasPorAvalAluno = {};
  notasTodas.forEach(n => {
    notasPorAvalAluno[`${n.avaliacao_id}::${n.aluno_id}`] = n;
  });

  const headerCols = subAvals.map(sa => `<th style="white-space:nowrap;">${sa.nome}<br><span style="font-weight:400;color:var(--text-muted);font-size:10px;">${Number(sa.pontos || 0)} pts</span></th>`).join('');
  const rotuloFinal = tipoGrupo === 'media' ? 'Média do aluno' : 'Soma do aluno';
  document.getElementById('notas-list').innerHTML = `
    <div style="overflow:auto;border:1px solid var(--border);border-radius:12px;background:#fff;">
      <table class="relatorio-table" style="min-width:880px;">
        <thead><tr><th>Aluno</th>${headerCols}<th>${rotuloFinal}</th></tr></thead>
        <tbody>
          ${alunosTurma.map(al => `
            <tr>
              <td style="font-weight:600;">${al.nome_completo}${tagRemanejado(al)}</td>
              ${subAvals.map(sa => {
                const notaAtual = notasPorAvalAluno[`${sa.id}::${al.id}`]?.nota;
                return `<td><input id="gnota-${sa.id}-${al.id}" type="number" min="0" max="${Number(sa.pontos || 0)}" step="0.5"
                  value="${notaAtual !== null && notaAtual !== undefined ? Number(notaAtual) : ''}"
                  oninput="atualizarTotalGrupoAluno('${al.id}')"
                  style="width:86px;padding:6px 8px;border:1px solid var(--border);border-radius:8px;font-family:'Sora',sans-serif;font-size:12px;outline:none;" /></td>`;
              }).join('')}
              <td id="gtotal-${al.id}" style="font-weight:700;color:var(--purple);">0.0</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;

  alunosTurma.forEach(al => atualizarTotalGrupoAluno(al.id));
}

function atualizarTotalGrupoAluno(alunoId) {
  if (!modoGrupoNotasAtivo || !modoGrupoNotasAtivo.subAvals?.length) return;
  const valores = modoGrupoNotasAtivo.subAvals.map(sa => Number(document.getElementById(`gnota-${sa.id}-${alunoId}`)?.value || 0));
  const soma = valores.reduce((acc, v) => acc + v, 0);
  const finalValor = modoGrupoNotasAtivo.tipo === 'media' && valores.length ? (soma / valores.length) : soma;
  const target = document.getElementById(`gtotal-${alunoId}`);
  if (target) target.textContent = finalValor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

const renderNotasAlunos = (lista, mapNotas, somaTri, mediaMin, isRecup, totalTri, maxTri, isConfirmar = false) => {
  // adicionar extras manualmente incluídos
  alunosRecuperacaoExtra.forEach(id => {
    if (!lista.find(a => a.id === id)) {
      const aluno = alunosTurma.find(a => a.id === id);
      if (aluno) lista.push(aluno);
    }
  });

  if (!lista.length) {
    document.getElementById('notas-list').innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:14px;">Nenhum aluno encontrado para esta turma.</div>';
    return;
  }
  document.getElementById('notas-list').innerHTML = lista.map(a => {
    const n = mapNotas[a.id] || {};
    const totalNormal = somaTri[a.id] || 0;
    const recNota     = (n.nota !== null && n.nota !== undefined) ? Number(n.nota) : 0;
    const recParalela = (n.recuperacao_paralela !== null && n.recuperacao_paralela !== undefined) ? Number(n.recuperacao_paralela) : 0;

    // nota final = soma do trimestre + nota da recuperação + recuperação paralela (igual ao relatório)
    const notaFinal = isRecup && !n.nao_realizado
      ? totalNormal + recNota + recParalela
      : totalNormal;

    const abaixo = notaFinal < mediaMin;

    // percentual atual (antes da recuperação)
    const pct = maxTri > 0 ? ((totalNormal / maxTri) * 100).toFixed(0) : 0;

    return `<div class="nota-aluno-card ${abaixo ? 'abaixo' : ''}" id="ncard-${a.id}">

      <!-- LINHA 1: avatar + matrícula + nome (+ badge recup se for recuperação) -->
      <div class="nota-aluno-header">
        <div class="nota-aluno-avatar">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <span class="nota-aluno-matricula">${a.codigo_simade || ''}</span>
        <span class="nota-aluno-nome" style="cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;" onclick="abrirNotasAluno('${a.id}')" title="Ver todas as avaliações deste aluno">${a.nome_completo}${tagRemanejado(a)}</span>
        ${isRecup ? `<span style="margin-left:auto;font-size:11px;color:#92400E;background:#FEF3C7;padding:3px 10px;border-radius:20px;font-weight:600;flex-shrink:0;">Nota atual: ${totalNormal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${pct}%)</span>` : ''}
      </div>

      <!-- LINHA 2: Nota: [pill] ............. Recuperação Paralela / Nota Final: [pill] -->
      <div class="nota-row-inputs">
        <div class="nota-inline-group">
          <span class="nota-inline-label">${isConfirmar ? 'Nota somada:' : isRecup ? 'Nota da recuperação:' : 'Nota:'}</span>
          <input class="nota-input-pill" id="nota-${a.id}" type="number" min="0" max="${avaliacaoAtiva.pontos}" step="0.5"
            value="${isConfirmar ? (somaTri[a.id] || 0).toFixed(2) : (n.nota !== undefined && n.nota !== null ? n.nota : '')}"
            placeholder="–"
            ${n.nao_realizado ? 'disabled' : ''}
            ${isConfirmar ? 'readonly tabindex="-1" style="opacity:0.65;cursor:not-allowed;background:#EEF2FF;border-color:#C7D2FE;"' : ''}
            oninput="atualizarTotal('${a.id}')"/>
        </div>
        <div class="nota-inline-group">
          <span class="nota-inline-label" style="${isConfirmar ? 'color:#7C3AED;font-weight:700;' : ''}">${isConfirmar ? 'Nota final:' : 'Recuperação Paralela:'}</span>
          <input class="nota-input-pill" id="rec-${a.id}" type="number" min="0" step="0.5"
            value="${n.recuperacao_paralela !== undefined && n.recuperacao_paralela !== null ? n.recuperacao_paralela : ''}"
            placeholder="${isConfirmar ? 'Inserir nota final' : '–'}"
            style="${isConfirmar ? 'border-color:#7C3AED;font-weight:700;color:#7C3AED;' : ''}"
            oninput="atualizarTotal('${a.id}')"/>
        </div>
      </div>

      <!-- LINHA 3: Não realizada [checkbox] ............. Notas do Aluno: X -->
      <div class="nota-row-footer">
        <div class="nao-realizado-wrap" ${isConfirmar ? 'style="visibility:hidden;"' : ''} style="gap:16px;">
          <span style="display:flex;align-items:center;gap:6px;">
            <input type="checkbox" id="nr-${a.id}" ${n.nao_realizado ? 'checked' : ''} onchange="toggleNaoRealizado('${a.id}', 'nr')"/>
            <label for="nr-${a.id}" style="font-size:13px;color:var(--text);cursor:pointer;">Não realizado</label>
          </span>
          <span style="display:flex;align-items:center;gap:6px;">
            <input type="checkbox" id="aus-${a.id}" ${n.ausente ? 'checked' : ''} onchange="toggleNaoRealizado('${a.id}', 'aus')"/>
            <label for="aus-${a.id}" style="font-size:13px;color:var(--text);cursor:pointer;">Ausente</label>
          </span>
        </div>
        <div class="nota-total" id="total-${a.id}">
          ${isConfirmar
            ? (n.recuperacao_paralela !== null && n.recuperacao_paralela !== undefined
                ? `Nota final aplicada: <strong style="color:#7C3AED;">${Number(n.recuperacao_paralela).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> <span style="font-size:11px;color:#7C3AED;">(substitui a soma)</span>`
                : `Nota somada: <strong>${(somaTri[a.id]||0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> — <span style="font-size:11px;color:var(--text-muted);">sem nota final definida</span>`)
            : isRecup
              ? `Nota final: <strong>${notaFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>${(recNota > 0 || recParalela > 0) ? ` <span style="font-size:11px;color:#166534;">(${totalNormal.toFixed(1)} + ${(recNota+recParalela).toFixed(1)} rec.)</span>` : ''}`
              : `Notas do Aluno: <strong>${totalNormal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>`}
        </div>
      </div>

    </div>`;
  }).join('');

  // Botão incluir aluno (só na recuperação)
  if (isRecup) {
    const alunosNaoListados = alunosTurma.filter(a => !lista.find(l => l.id === a.id));
    if (alunosNaoListados.length) {
      document.getElementById('notas-list').insertAdjacentHTML('beforeend', `
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">Incluir aluno manualmente na recuperação:</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <select id="sel-incluir-aluno" style="flex:1;padding:9px 12px;background:#F8F6FF;border:1.5px solid var(--border);border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;color:var(--text);outline:none;">
              <option value="">Selecione um aluno...</option>
              ${alunosNaoListados.map(a => `<option value="${a.id}">${a.nome_completo}</option>`).join('')}
            </select>
            <button onclick="incluirAlunoRecuperacao()" style="padding:9px 18px;border-radius:8px;border:none;background:var(--purple);color:#fff;font-family:'Sora',sans-serif;font-size:13px;font-weight:600;cursor:pointer;">
              Incluir aluno
            </button>
          </div>
        </div>`);
    }
  }
};

function configurarNavegacaoNotas() {
  // Enter em "nota-X" vai para "nota-Y" (próximo aluno)
  // Enter em "rec-X"  vai para "rec-Y"  (próximo aluno)
  const cards = Array.from(document.querySelectorAll('.nota-aluno-card'));

  const listaNotas = [];
  const listaRec   = [];

  cards.forEach(card => {
    const alunoId = (card.id || '').replace('ncard-', '');
    if (!alunoId) return;
    const inputNota = document.getElementById(`nota-${alunoId}`);
    const inputRec  = document.getElementById(`rec-${alunoId}`);
    if (inputNota) listaNotas.push(inputNota);
    if (inputRec)  listaRec.push(inputRec);
  });

  // Fallback
  if (!listaNotas.length) {
    document.querySelectorAll('input[id^="nota-"]').forEach(inp => listaNotas.push(inp));
  }

  const registrar = (lista) => {
    // Clonar para remover listeners antigos
    const clones = lista.map((inp, i) => {
      const c = inp.cloneNode(true);
      inp.parentNode.replaceChild(c, inp);
      return c;
    });
    clones.forEach((inp, i) => {
      inp.addEventListener('keydown', function(e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const prox = clones[(i + 1) % clones.length];
        prox.focus();
        prox.select();
      });
    });
  };

  registrar(listaNotas);
  registrar(listaRec);
}

// ── LANÇAMENTO DE NOTAS POR ALUNO (modal individual) ──────────────────────────
let _mnaAlunoIdx = 0;
let _mnaAlunoLista = [];

async function abrirNotasAluno(alunoId) {
  if (!avaliacaoAtiva || !alunosTurma.length) return;

  // Construir lista de alunos visíveis no notas-screen
  const isRecup = avaliacaoAtiva.tipo === 'recuperacao';
  const somaTri = window._somaTri || {};
  const maxTri = isFundamentalI() ? 30 : (avaliacaoAtiva.trimestre === 3 ? 40 : 30);
  const limiteRecup = maxTri * 0.6;
  _mnaAlunoLista = isRecup
    ? alunosTurma.filter(a => (somaTri[a.id] || 0) < limiteRecup)
    : [...alunosTurma];

  _mnaAlunoIdx = _mnaAlunoLista.findIndex(a => String(a.id) === String(alunoId));
  if (_mnaAlunoIdx < 0) _mnaAlunoIdx = 0;

  // Popular dropdown
  const sel = document.getElementById('mna-select-aluno');
  sel.innerHTML = _mnaAlunoLista.map((a, i) =>
    `<option value="${i}" ${i === _mnaAlunoIdx ? 'selected' : ''}>${a.nome_completo}</option>`
  ).join('');

  await renderModalNotasAluno();
  document.getElementById('modal-notas-aluno').classList.add('open');
}

function irParaAlunoModal(idx) {
  _mnaAlunoIdx = parseInt(idx, 10);
  renderModalNotasAluno();
}

function navNotasAluno(dir) {
  const total = _mnaAlunoLista.length;
  if (!total) return;
  _mnaAlunoIdx = (_mnaAlunoIdx + dir + total) % total;
  document.getElementById('mna-select-aluno').value = _mnaAlunoIdx;
  renderModalNotasAluno();
}

async function renderModalNotasAluno() {
  const aluno = _mnaAlunoLista[_mnaAlunoIdx];
  if (!aluno || !avaliacaoAtiva) return;

  document.getElementById('mna-nome').textContent = aluno.nome_completo;
  document.getElementById('mna-posicao').textContent =
    `${_mnaAlunoIdx + 1} de ${_mnaAlunoLista.length}`;

  const el = document.getElementById('mna-lista');
  el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;">Carregando...</div>';

  try {
    const tri = avaliacaoAtiva.trimestre;
    let avalisTri = avaliacoesTurma.filter(a =>
      a.trimestre === tri && a.tipo !== 'recuperacao' && !_isNotaFinal(a)
    );
    if (isFundamentalI() && avalDiscFiltro)
      avalisTri = avalisTri.filter(a => a.disciplina === avalDiscFiltro);

    // Buscar notas existentes para este aluno no trimestre
    const ids = avalisTri.map(a => a.id);
    let mapNotas = {};
    if (ids.length) {
      const notasSalvas = await api(
        `notas?avaliacao_id=in.(${ids.join(',')})&aluno_id=eq.${aluno.id}&select=*`
      ) || [];
      notasSalvas.forEach(n => { mapNotas[n.avaliacao_id] = n; });
    }

    if (!avalisTri.length) {
      el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text-muted);">Nenhuma avaliação neste trimestre.</div>';
      return;
    }

    el.innerHTML = avalisTri.map(aval => {
      const n = mapNotas[aval.id] || {};
      const valNota = (n.nota !== undefined && n.nota !== null) ? n.nota : '';
      const isAtiva = String(aval.id) === String(avaliacaoAtiva.id);
      return `
      <div style="padding:12px 14px;border-radius:10px;border:1.5px solid ${isAtiva ? '#FF8C38' : 'var(--border)'};background:${isAtiva ? '#FFF7ED' : '#fff'};margin-bottom:8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <div>
            <div style="font-size:13px;font-weight:700;color:${isAtiva ? '#FF8C38' : 'var(--text)'};">${_nomeExibicaoAval(aval)}${isAtiva ? ' <span style="font-size:10px;background:#FF8C38;color:#fff;padding:2px 6px;border-radius:10px;vertical-align:middle;">atual</span>' : ''}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${aval.pontos} pts · ${aval.tipo === 'normal' ? 'Normal' : 'Recuperação'}</div>
          </div>
          <input id="mna-nota-${aval.id}" type="number" min="0" max="${aval.pontos}" step="0.5"
            value="${valNota}" placeholder="–"
            style="width:80px;padding:8px 10px;border:1.5px solid ${isAtiva ? '#FF8C38' : 'var(--border)'};border-radius:8px;font-family:'Sora',sans-serif;font-size:15px;font-weight:700;color:${isAtiva ? '#FF8C38' : 'var(--text)'};text-align:center;outline:none;"
            onfocus="this.style.borderColor='#FF8C38'"
            onblur="this.style.borderColor='${isAtiva ? '#FF8C38' : 'var(--border)'}'">
        </div>
      </div>`;
    }).join('');

    // Focar no campo da avaliação ativa
    setTimeout(() => {
      const inp = document.getElementById(`mna-nota-${avaliacaoAtiva.id}`);
      if (inp) { inp.focus(); inp.select(); }
    }, 80);

  } catch(e) {
    el.innerHTML = `<div style="color:#DC2626;text-align:center;padding:24px;">Erro ao carregar notas.</div>`;
  }
}

async function salvarNotasAluno(avancar = false) {
  const aluno = _mnaAlunoLista[_mnaAlunoIdx];
  if (!aluno || !avaliacaoAtiva) return;

  const btn = document.getElementById('mna-btn-salvar');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

  try {
    const tri = avaliacaoAtiva.trimestre;
    let avalisTri = avaliacoesTurma.filter(a =>
      a.trimestre === tri && a.tipo !== 'recuperacao' && !_isNotaFinal(a)
    );
    if (isFundamentalI() && avalDiscFiltro)
      avalisTri = avalisTri.filter(a => a.disciplina === avalDiscFiltro);

    const saves = avalisTri.map(async (aval) => {
      const inp = document.getElementById(`mna-nota-${aval.id}`);
      if (!inp) return;
      const val = inp.value !== '' ? parseFloat(inp.value) : null;
      const row = {
        avaliacao_id: aval.id,
        aluno_id: aluno.id,
        nota: val,
        nao_realizado: false,
        ausente: false
      };
      await api('notas?on_conflict=avaliacao_id,aluno_id', {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(row)
      });
      // Sincronizar input na tela principal se existir
      const mainInp = document.getElementById(`nota-${aluno.id}`);
      if (mainInp && String(aval.id) === String(avaliacaoAtiva.id))
        mainInp.value = val !== null ? val : '';
    });

    await Promise.all(saves);
    mostrarToast(`✓ Notas de ${aluno.nome_completo.split(' ')[0]} salvas!`);

    if (avancar && _mnaAlunoIdx < _mnaAlunoLista.length - 1) {
      _mnaAlunoIdx++;
      document.getElementById('mna-select-aluno').value = _mnaAlunoIdx;
      await renderModalNotasAluno();
    }
  } catch(e) {
    mostrarToast('Erro ao salvar notas: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Salvar e avançar'; }
  }
}

function incluirAlunoRecuperacao() {
  const sel = document.getElementById('sel-incluir-aluno');
  const id = sel.value;
  if (!id) return;

  // salvar valores atuais da tela antes de re-renderizar
  const mapNotasAtual = {};
  alunosTurma.forEach(a => {
    const notaEl = document.getElementById(`nota-${a.id}`);
    const recEl  = document.getElementById(`rec-${a.id}`);
    const nrEl   = document.getElementById(`nr-${a.id}`);
    if (notaEl) mapNotasAtual[a.id] = {
      nota: notaEl.value !== '' ? parseFloat(notaEl.value) : null,
      recuperacao_paralela: recEl?.value !== '' ? parseFloat(recEl?.value) : null,
      nao_realizado: nrEl?.checked || false,
      ausente: document.getElementById(`aus-${a.id}`)?.checked || false
    };
  });

  alunosRecuperacaoExtra.add(id);

  const maxTri    = avaliacaoAtiva.trimestre === 3 ? 40 : 30;
  const mediaMin  = avaliacaoAtiva.trimestre === 3 ? 24 : 18;
  const limiteRecup = maxTri * 0.6;

  // recalcular somaTri a partir dos dados já salvos na memória (não faz nova query)
  const somaTri = window._somaTri || {};

  const alunosBase = alunosTurma.filter(a => (somaTri[a.id] || 0) < limiteRecup);
  renderNotasAlunos(alunosBase, mapNotasAtual, somaTri, mediaMin, true, 0, maxTri);
}

function editarAvaliacaoAtiva() {
  if (avaliacaoAtiva) editarAvaliacao(avaliacaoAtiva.id);
}

async function salvarTodasNotas() {
  if (avaliacaoAtiva && await verificarBloqueio(avaliacaoAtiva.trimestre)) return;
  const btn = document.getElementById('btn-salvar-todas-notas');
  const btnOriginalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Salvando...';

  const resetBtn = () => {
    btn.disabled = false;
    btn.innerHTML = btnOriginalHTML;
  };

  try {
    if (modoGrupoNotasAtivo && modoGrupoNotasAtivo.subAvals?.length) {
      for (const sub of modoGrupoNotasAtivo.subAvals) {
        const rowsSub = alunosTurma.map(a => ({
          avaliacao_id: sub.id,
          aluno_id: a.id,
          nota: document.getElementById(`gnota-${sub.id}-${a.id}`)?.value !== '' && document.getElementById(`gnota-${sub.id}-${a.id}`)?.value != null ? parseFloat(document.getElementById(`gnota-${sub.id}-${a.id}`)?.value) : null,
          recuperacao_paralela: null,
          nao_realizado: false,
          lancado_em: new Date().toISOString()
        }));
        if (rowsSub.length) await api('notas?on_conflict=avaliacao_id,aluno_id', {
          method : 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
          body   : JSON.stringify(rowsSub)
        });
      }
      const chaveAval = turmaAtiva.id + '::avaliacoes';
      Object.keys(_cache).forEach(k => { if (k === chaveAval) delete _cache[k]; });
      mostrarToast('Grupo salvo com sucesso!');
      setTimeout(() => { resetBtn(); voltarAvaliacoes(); }, 900);
      return;
    }

    // pegar apenas alunos que têm campos na tela
    const rows = alunosTurma
      .filter(a => document.getElementById(`nota-${a.id}`) !== null)
      .map(a => ({
        avaliacao_id: avaliacaoAtiva.id,
        aluno_id: a.id,
        nota: document.getElementById(`nr-${a.id}`)?.checked ? null : (document.getElementById(`nota-${a.id}`)?.value !== '' && document.getElementById(`nota-${a.id}`)?.value != null ? parseFloat(document.getElementById(`nota-${a.id}`)?.value) : null),
        recuperacao_paralela: document.getElementById(`rec-${a.id}`)?.value !== '' && document.getElementById(`rec-${a.id}`)?.value != null ? parseFloat(document.getElementById(`rec-${a.id}`)?.value) : null,
        nao_realizado: document.getElementById(`nr-${a.id}`)?.checked || false,
        lancado_em: new Date().toISOString()
      }));

    if (_isNotaFinal(avaliacaoAtiva)) {
      // Nota Final: salva em 'notas' usando avaliacao_id da avaliação __NOTA_FINAL__
      // nota = soma calculada (readonly), recuperacao_paralela = nota final inserida pelo professor
      const somaTri = window._somaTri || {};
      const upserts = alunosTurma.map(a => {
        const recEl = document.getElementById(`rec-${a.id}`);
        const notaFinalVal = recEl && recEl.value !== '' ? parseFloat(recEl.value) : null;
        return {
          avaliacao_id         : avaliacaoAtiva.id,
          aluno_id             : a.id,
          nota                 : somaTri[a.id] ?? 0,
          recuperacao_paralela : notaFinalVal,
          nao_realizado        : false
        };
      });
      await api('notas?on_conflict=avaliacao_id,aluno_id', {
        method : 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body   : JSON.stringify(upserts)
      });
    } else {
      if (rows.length) await api('notas?on_conflict=avaliacao_id,aluno_id', {
        method : 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body   : JSON.stringify(rows)
      });
    }

    // Invalida só o cache de avaliações (notas mudaram, mas aulas/alunos permanecem válidos)
    const chaveAval = turmaAtiva.id + '::avaliacoes';
    Object.keys(_cache).forEach(k => { if (k === chaveAval) delete _cache[k]; });
    mostrarToastNotas();
    resetBtn();
  } catch (e) {
    console.error('Erro ao salvar notas:', e);
    mostrarToast('Erro ao salvar: ' + (e.message || 'Tente novamente.'));
    resetBtn();
  }
}

function toggleNaoRealizado(alunoId, origem) {
  const nrEl  = document.getElementById(`nr-${alunoId}`);
  const ausEl = document.getElementById(`aus-${alunoId}`);
  // Cada um é independente — mas ambos desabilitam a nota
  const desabilitar = nrEl?.checked || ausEl?.checked;
  const notaEl = document.getElementById(`nota-${alunoId}`);
  if (notaEl) {
    notaEl.disabled = desabilitar;
    if (desabilitar) notaEl.value = '';
  }
  atualizarTotal(alunoId);
}

function atualizarTotal(alunoId) {
  const somaTri = window._somaTri || {};
  const mapNotas = window._mapNotas || {};
  const isConfirmar = _isNotaFinal(avaliacaoAtiva);

  if (isConfirmar) {
    // Para nota final: mostra a nota que vai substituir a soma
    const notaFinalVal = parseFloat(document.getElementById(`rec-${alunoId}`)?.value);
    const somaAtual = (somaTri[alunoId] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const el = document.getElementById(`total-${alunoId}`);
    if (!el) return;
    if (!isNaN(notaFinalVal)) {
      el.innerHTML = `Nota final aplicada: <strong style="color:#7C3AED;">${notaFinalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> <span style="font-size:11px;color:#7C3AED;">(substitui a soma)</span>`;
    } else {
      el.innerHTML = `Nota somada: <strong>${somaAtual}</strong> — <span style="font-size:11px;color:var(--text-muted);">sem nota final definida</span>`;
    }
    return;
  }

  const isRecupAtual = avaliacaoAtiva?.tipo === 'recuperacao';
  const somaTurma = (somaTri[alunoId] || 0);
  const nota = parseFloat(document.getElementById(`nota-${alunoId}`)?.value) || 0;
  const rec  = parseFloat(document.getElementById(`rec-${alunoId}`)?.value)  || 0;
  const el   = document.getElementById(`total-${alunoId}`);
  if (!el) return;

  if (isRecupAtual) {
    const nrChecked  = document.getElementById(`nr-${alunoId}`)?.checked || false;
    const ausChecked = document.getElementById(`aus-${alunoId}`)?.checked || false;
    const notaRecup  = (nrChecked || ausChecked) ? 0 : nota;
    // soma: total do trimestre + nota da recuperação + recuperação paralela
    const novaTotal = somaTurma + notaRecup + rec;
    const breakdown = (notaRecup > 0 || rec > 0) ? ` <span style="font-size:11px;color:#166534;">(${somaTurma.toFixed(1)} + ${(notaRecup+rec).toFixed(1)} rec.)</span>` : '';
    el.innerHTML = `Nota final: <strong>${novaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>${breakdown}`;
  } else {
    const notaSalva = mapNotas[alunoId]?.nota;
    const notaSalvaNum = (notaSalva !== null && notaSalva !== undefined) ? Number(notaSalva) : 0;
    const totalSemAtual = somaTurma - notaSalvaNum;
    const totalComNova = totalSemAtual + nota + rec;
    el.innerHTML = `Notas do Aluno: <strong>${totalComNova.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>`;
  }
}

function aplicarNotaPadrao() {
  const notaPadrao = parseFloat(document.getElementById('nota-padrao').value);
  if (!notaPadrao && notaPadrao !== 0) {
    alert('Digite uma nota válida');
    return;
  }

  // Aplicar a nota padrão a todos os alunos
  alunosTurma.forEach(aluno => {
    const inputNota = document.getElementById(`nota-${aluno.id}`);
    if (inputNota && !inputNota.disabled) {
      inputNota.value = notaPadrao;
      // Dispara o evento oninput para atualizar o total
      const event = new Event('input', { bubbles: true });
      inputNota.dispatchEvent(event);
    }
  });
  
  // Limpar campo de nota padrão após aplicar
  document.getElementById('nota-padrao').value = '';
}

async function salvarNotas() {
  const rows = alunosTurma.map(a => ({
    avaliacao_id: avaliacaoAtiva.id,
    aluno_id: a.id,
    nota: document.getElementById(`nota-${a.id}`).value !== '' ? parseFloat(document.getElementById(`nota-${a.id}`).value) : null,
    recuperacao_paralela: document.getElementById(`rec-${a.id}`).value !== '' ? parseFloat(document.getElementById(`rec-${a.id}`).value) : null,
    nao_realizado: (document.getElementById(`nr-${a.id}`)?.checked || document.getElementById(`aus-${a.id}`)?.checked || false),
    lancado_em: new Date().toISOString()
  }));
  await api('notas?on_conflict=avaliacao_id,aluno_id', {
    method : 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body   : JSON.stringify(rows)
  });
  voltarAvaliacoes();
  await carregarAvaliacoes();
}

function voltarAvaliacoes() {
  modoGrupoNotasAtivo = null;
  document.getElementById('notas-screen').style.display = 'none';
  document.getElementById('pagina-avaliacoes').style.display = 'block';
  const notaPadraoWrap = document.getElementById('nota-padrao-wrap');
  if (notaPadraoWrap) notaPadraoWrap.style.display = 'flex';
  atualizarCabecalho({ info: 'Avaliações', titulo: turmaAtiva?.nome || '', detalhe: 'Voltar à turma', voltarFn: 'voltarTurma', cor: '#FF8C38' });
  atualizarHeaderMobile('Avaliações', turmaAtiva?.nome || '', true, true);
  // Só busca do banco se cache inválido; senão renderiza o que já está em memória
  const hit = cacheLer(turmaAtiva.id, 'avaliacoes', 30000);
  if (hit !== null) {
    renderAvaliacoes(avaliacoesTurma, {}, alunosTurma.length);
  } else {
    carregarAvaliacoes();
  }
}

let _layoutAvaliacoes = 'lista'; // 'lista' | 'grade'

function setLayoutAvaliacoes(modo) {
  _layoutAvaliacoes = modo;
  const btnLista = document.getElementById('btn-layout-lista-aval');
  const btnGrade = document.getElementById('btn-layout-grade-aval');
  if (btnLista) {
    btnLista.style.background = modo === 'lista' ? 'var(--purple)' : 'none';
    btnLista.style.color = modo === 'lista' ? '#fff' : 'var(--text-muted)';
  }
  if (btnGrade) {
    btnGrade.style.background = modo === 'grade' ? 'var(--purple)' : 'none';
    btnGrade.style.color = modo === 'grade' ? '#fff' : 'var(--text-muted)';
  }
  const el = document.getElementById('avaliacoes-list');
  if (!el) return;
  if (modo === 'grade') {
    el.querySelectorAll('[class^="aval-card"], .aval-card').forEach(card => {
      const parent = card.parentElement;
      if (parent && !parent.dataset.gradeAvalAplicada) {
        parent.style.display = 'grid';
        parent.style.gridTemplateColumns = 'repeat(auto-fill, minmax(230px, 1fr))';
        parent.style.gap = '12px';
        parent.dataset.gradeAvalAplicada = '1';
      }
    });
  } else {
    el.querySelectorAll('[data-grade-aval-aplicada]').forEach(p => {
      p.style.display = '';
      p.style.gridTemplateColumns = '';
      p.style.gap = '';
      delete p.dataset.gradeAvalAplicada;
    });
  }
}

// Re-aplicar layout grade após renderAvaliacoes
const _renderAvaliaCoes_orig = renderAvaliacoes;
renderAvaliacoes = function(lista, contPorAval, totalAlunos) {
  _renderAvaliaCoes_orig(lista, contPorAval, totalAlunos);
  if (_layoutAvaliacoes === 'grade') setLayoutAvaliacoes('grade');
};

// ═══════════════════════════════════════════════════════
// HEATMAP NO RELATÓRIO GERAL
