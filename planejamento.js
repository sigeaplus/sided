// ═════════════════════════════════════════════════════════════════════════════
// SIDED+ — Módulo Planejamento
// Substitui completamente o antigo "Plano de Curso" (calendario_plano.js +
// plano-ia.js). Mantém upload de PDF/imagem (sem análise por IA) e adiciona
// cadastro manual de habilidades BNCC vinculáveis a aulas via aula_habilidades.
// ═════════════════════════════════════════════════════════════════════════════

// ── STORAGE: upload/listagem/remoção de arquivos (portado de calendario_plano.js) ──

function _planejamentoStorageDir() {
  const ano = new Date().getFullYear();
  const tdId = turmaDisciplinaAtiva?.id;
  const base = tdId ? `td_${tdId}` : (turmaAtiva?.id || 'turma');
  return `planejamento/${base}_${ano}`;
}

function _sanitizarNomeArquivoPlanejamento(nome) {
  return nome
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/\//g, '-')
    .replace(/\\/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '_')  // só ASCII seguro
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .trim();
}

function _planejamentoStoragePath(fileName) {
  if (!fileName) return _planejamentoStorageDir();
  return `${_planejamentoStorageDir()}/${_sanitizarNomeArquivoPlanejamento(fileName)}`;
}

function _planejamentoRenderLista(files) {
  const lista = document.getElementById('planejamento-arquivos-lista');
  if (!lista) return;
  if (!files.length) {
    lista.style.display = 'none';
    lista.innerHTML = '';
    return;
  }

  lista.style.display = 'flex';
  lista.style.flexWrap = 'wrap';
  lista.innerHTML = files.map(file => {
    const safeName = String(file.name || file.path || '').replace(/'/g, "\\'");
    const displayName = safeName.replace(/^.*\/(.*)$/, '$1');
    return `<div style="display:flex;align-items:center;gap:6px;padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:#F8FAFC;">
      <button onclick="planejamentoExibirArquivo('${safeName}')" style="padding:0;border:none;background:none;color:var(--text-muted);font-size:12px;cursor:pointer;white-space:nowrap;flex:1;text-align:left;">${displayName}</button>
      <button onclick="planejamentoRemoverArquivo('${safeName}')" style="padding:3px 6px;border:1px solid #FBBFBF;border-radius:5px;background:none;color:#DC2626;font-size:11px;font-weight:600;cursor:pointer;" onmouseover="this.style.background='#FEE2E2'" onmouseout="this.style.background='none'">✕</button>
    </div>`;
  }).join('');
}

async function iniciarPlanejamento() {
  const label = document.getElementById('planejamento-turma-label');
  const discLabel = turmaDisciplinaAtiva?.disciplinas?.nome || turmaAtiva?.disciplina || '';
  if (label) label.textContent = turmaAtiva ? `${turmaAtiva.nome} · ${discLabel} · ${new Date().getFullYear()}` : '';

  document.getElementById('planejamento-empty').style.display = 'none';
  document.getElementById('planejamento-viewer').style.display = 'none';
  document.getElementById('planejamento-btn-trocar').style.display = 'none';
  document.getElementById('planejamento-arquivos-lista').style.display = 'none';

  mostrarToast('Verificando planejamento...');
  const files = await _storageList('documentos', `${_planejamentoStorageDir()}/`);
  if (files.length) {
    _planejamentoRenderLista(files);
    const first = files[0];
    const name = first.name || first.path;
    if (name) {
      planejamentoExibirArquivo(name);
    } else {
      document.getElementById('planejamento-empty').style.display = 'flex';
    }
  } else {
    document.getElementById('planejamento-empty').style.display = 'flex';
  }

  await carregarHabilidadesPlanejamento();
}

function _planejamentoExibirUrl(url, isPdf = false) {
  document.getElementById('planejamento-empty').style.display = 'none';
  document.getElementById('planejamento-viewer').style.display = 'block';
  document.getElementById('planejamento-btn-trocar').style.display = 'flex';
  const iframe = document.getElementById('planejamento-iframe');
  const img    = document.getElementById('planejamento-img');
  const linkMob = document.getElementById('planejamento-link-mob');
  const linkMobA = document.getElementById('planejamento-link-mob-a');
  const urlNocache = url + '?t=' + Date.now();
  const isMobile = window.innerWidth <= 768;
  if (isPdf) {
    if (isMobile) {
      iframe.style.display = 'none'; img.style.display = 'none';
      if (linkMob) { linkMob.style.display = 'block'; linkMobA.href = urlNocache; }
    } else {
      if (linkMob) linkMob.style.display = 'none';
      iframe.style.display = 'block'; img.style.display = 'none';
      iframe.src = urlNocache;
    }
  } else {
    if (linkMob) linkMob.style.display = 'none';
    img.style.display = 'block'; iframe.style.display = 'none';
    img.src = urlNocache;
  }
}

function planejamentoExibirArquivo(fileName) {
  const url = _storagePublicUrl('documentos', _planejamentoStoragePath(fileName));
  const isPdf = fileName.toLowerCase().endsWith('.pdf');
  _planejamentoExibirUrl(url, isPdf);
}

async function planejamentoRemoverArquivo(fileName) {
  if (!confirm(`Tem certeza que quer deletar "${fileName}"?`)) {
    return;
  }

  mostrarToast('Removendo arquivo...');
  try {
    const path = _planejamentoStoragePath(fileName);
    await _storageDelete('documentos', path);
    mostrarToast('✅ Arquivo removido!');
    await iniciarPlanejamento();
  } catch(err) {
    console.error('[PLANEJAMENTO] Erro ao remover:', err);
    mostrarToast('❌ Erro ao remover: ' + err.message);
  }
}

async function planejamentoHandleFile(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;
  const invalid = files.find(file => file.size > 50 * 1024 * 1024);
  if (invalid) {
    mostrarToast('Arquivo muito grande. Máx. 50 MB cada.');
    return;
  }

  mostrarToast(`Enviando ${files.length} arquivo${files.length > 1 ? 's' : ''}...`);
  try {
    await Promise.all(files.map(file => {
      const path = _planejamentoStoragePath(file.name);
      return _storageUpload('documentos', path, file);
    }));

    mostrarToast(`✅ ${files.length} arquivo${files.length > 1 ? 's' : ''} salvo${files.length > 1 ? 's' : ''}!`);
    await iniciarPlanejamento();
  } catch(err) {
    console.error('[PLANEJAMENTO] Erro upload:', err);
    mostrarToast('❌ Erro ao salvar: ' + err.message);
  }
  input.value = '';
}

window.iniciarPlanejamento = iniciarPlanejamento;
window.planejamentoExibirArquivo = planejamentoExibirArquivo;
window.planejamentoRemoverArquivo = planejamentoRemoverArquivo;
window.planejamentoHandleFile = planejamentoHandleFile;

// ═════════════════════════════════════════════════════════════════════════════
// CADASTRO MANUAL DE HABILIDADES BNCC
// Tabela: habilidades_planejamento (turma_disciplina_id, codigo, descricao,
// divisao_id, temas[]). CRUD completo: criar, listar, editar, deletar.
// Vínculo a múltiplas turmas: uma linha por turma_disciplina_id — "vincular a
// outra turma" cria uma nova linha (cópia dos dados) com outro
// turma_disciplina_id, e cada linha pode ser editada/deletada independente.
// ═════════════════════════════════════════════════════════════════════════════

let _habilidadesPlanejamentoCache = [];
let _editandoHabilidadeId = null; // null = criando nova

async function carregarHabilidadesPlanejamento() {
  const tdId = turmaDisciplinaAtiva?.id;
  if (!tdId) { _habilidadesPlanejamentoCache = []; _renderHabilidadesPlanejamento(); return; }
  try {
    _habilidadesPlanejamentoCache = await api(
      `habilidades_planejamento?turma_disciplina_id=eq.${tdId}&select=*&order=codigo.asc`
    ) || [];
  } catch (e) {
    console.error('[PLANEJAMENTO] Erro ao carregar habilidades:', e);
    _habilidadesPlanejamentoCache = [];
  }
  _renderHabilidadesPlanejamento();
  // Invalida o cache local usado pelo autocomplete do formulário de aula
  if (typeof window._habilidadesAulaInvalidarCache === 'function') window._habilidadesAulaInvalidarCache();
}

const _NOMES_TRIMESTRE = { 1: '1º tri', 2: '2º tri', 3: '3º tri' };

function _nomeTrimestreDaHabilidade(h) {
  const div = (_divisoesCache || []).find(d => String(d.id) === String(h.divisao_id));
  if (!div) return '';
  return _NOMES_TRIMESTRE[div.ordem] || div.valor || '';
}

function _renderHabilidadesPlanejamento() {
  const wrap = document.getElementById('planejamento-habilidades-lista');
  if (!wrap) return;
  if (!_habilidadesPlanejamentoCache.length) {
    wrap.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">Nenhuma habilidade cadastrada ainda.</div>`;
    return;
  }
  wrap.style.display = 'grid';
  wrap.style.gap = '10px';
  wrap.innerHTML = _habilidadesPlanejamentoCache.map(h => {
    const trimestre = _nomeTrimestreDaHabilidade(h);
    const temas = Array.isArray(h.temas) ? h.temas : [];
    return `<div style="background:var(--white);border:1.5px solid var(--border);border-radius:12px;padding:14px 16px;">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
        <div style="min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
            <span style="font-family:'Space Mono',monospace;font-size:13px;font-weight:700;color:#3B4FE4;">${h.codigo}</span>
            ${trimestre ? `<span style="font-size:12px;color:var(--text-muted);">${trimestre}</span>` : ''}
          </div>
          <p style="font-size:13px;color:var(--text);margin:0 0 8px;line-height:1.5;">${(h.descricao || '').replace(/</g, '&lt;')}</p>
          ${temas.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${temas.map(t => `<span style="font-size:11px;padding:3px 9px;border-radius:20px;background:#EEF2FF;color:#3B4FE4;">${String(t).replace(/</g, '&lt;')}</span>`).join('')}
          </div>` : ''}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;">
          <button onclick="abrirModalVincularHabilidade('${h.id}')" title="Vincular a outra turma" style="width:30px;height:30px;padding:0;border:1.5px solid var(--border);border-radius:8px;background:none;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          </button>
          <button onclick="abrirModalHabilidadePlanejamento('${h.id}')" title="Editar" style="width:30px;height:30px;padding:0;border:1.5px solid var(--border);border-radius:8px;background:none;color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onclick="removerHabilidadePlanejamento('${h.id}')" title="Excluir" style="width:30px;height:30px;padding:0;border:1.5px solid #FBBFBF;border-radius:8px;background:none;color:#DC2626;cursor:pointer;display:flex;align-items:center;justify-content:center;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Criar / Editar (modal unificado) ──────────────────────────────────────────
let _turmasExtraCriacaoSelecionadas = new Set();

function abrirModalHabilidadePlanejamento(idParaEditar) {
  const modal = document.getElementById('modal-habilidade-planejamento');
  if (!modal) return;
  _editandoHabilidadeId = idParaEditar || null;
  _turmasExtraCriacaoSelecionadas = new Set();
  const existente = idParaEditar ? _habilidadesPlanejamentoCache.find(h => String(h.id) === String(idParaEditar)) : null;

  document.getElementById('modal-habilidade-planejamento-titulo').textContent = existente ? 'Editar habilidade BNCC' : 'Nova habilidade BNCC';
  document.getElementById('hab-plan-codigo').value = existente?.codigo || '';
  document.getElementById('hab-plan-descricao').value = existente?.descricao || '';
  document.getElementById('hab-plan-temas').value = (existente?.temas || []).join(', ');
  document.getElementById('hab-plan-alert').style.display = 'none';
  _preencherSelectDivisoesPlanejamento();
  if (existente?.divisao_id) document.getElementById('hab-plan-divisao').value = existente.divisao_id;
  document.getElementById('btn-salvar-habilidade-plan').textContent = existente ? 'Salvar alterações' : 'Salvar';

  // Seleção de turmas extras: só faz sentido ao criar (edição altera 1 linha só)
  const blocoTurmasExtra = document.getElementById('hab-plan-turmas-extra-bloco');
  if (blocoTurmasExtra) {
    blocoTurmasExtra.style.display = existente ? 'none' : 'block';
    if (!existente) _carregarTurmasExtraCriacao();
  }

  modal.classList.add('open');
}

async function _carregarTurmasExtraCriacao() {
  const wrap = document.getElementById('hab-plan-turmas-extra-lista');
  if (!wrap) return;
  wrap.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Carregando turmas...</span>';
  try {
    const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
    const tds = await api(`turma_disciplinas?professor_id=eq.${profData.id}&select=id,turmas(nome),disciplinas(nome)`) || [];
    const tdAtualId = turmaDisciplinaAtiva?.id;
    const outras = tds.filter(td => String(td.id) !== String(tdAtualId));
    if (!outras.length) {
      wrap.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Nenhuma outra turma disponível.</span>';
      return;
    }
    wrap.innerHTML = outras.map(td => `
      <span class="turma-extra-chip" data-td="${td.id}" onclick="_toggleTurmaExtraCriacao(this)"
        style="display:inline-flex;align-items:center;padding:6px 11px;border-radius:20px;border:1.5px solid var(--border);font-size:11px;cursor:pointer;margin:0 5px 5px 0;">
        ${td.turmas?.nome || '(turma)'} — ${td.disciplinas?.nome || ''}
      </span>
    `).join('');
  } catch (e) {
    console.error('[PLANEJAMENTO] Erro ao carregar turmas extras:', e);
    wrap.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Erro ao carregar turmas.</span>';
  }
}

function _toggleTurmaExtraCriacao(el) {
  const td = el.dataset.td;
  if (_turmasExtraCriacaoSelecionadas.has(td)) {
    _turmasExtraCriacaoSelecionadas.delete(td);
    el.style.background = 'none'; el.style.borderColor = 'var(--border)'; el.style.color = 'var(--text)';
  } else {
    _turmasExtraCriacaoSelecionadas.add(td);
    el.style.background = '#3B4FE4'; el.style.borderColor = '#3B4FE4'; el.style.color = '#fff';
  }
}

function _preencherSelectDivisoesPlanejamento() {
  const sel = document.getElementById('hab-plan-divisao');
  if (!sel) return;
  const divisoes = _divisoesCache || [];
  sel.innerHTML = '<option value="">Selecione a divisão...</option>' +
    divisoes.map(d => `<option value="${d.id}">${_NOMES_TRIMESTRE[d.ordem] || d.valor || ('Divisão ' + d.ordem)}</option>`).join('');
}

async function salvarHabilidadePlanejamento() {
  const alEl = document.getElementById('hab-plan-alert');
  alEl.style.display = 'none';

  const codigo = document.getElementById('hab-plan-codigo').value.trim();
  const descricao = document.getElementById('hab-plan-descricao').value.trim();
  const divisaoId = document.getElementById('hab-plan-divisao').value;
  const temasRaw = document.getElementById('hab-plan-temas').value.trim();
  const temas = temasRaw.split(',').map(t => t.trim()).filter(Boolean);

  if (!codigo) { alEl.textContent = 'O código é obrigatório.'; alEl.style.display = 'block'; return; }
  if (!descricao) { alEl.textContent = 'A descrição é obrigatória.'; alEl.style.display = 'block'; return; }
  if (!divisaoId) { alEl.textContent = 'Selecione a divisão.'; alEl.style.display = 'block'; return; }
  if (!temas.length) { alEl.textContent = 'Informe ao menos um tema (separado por vírgula).'; alEl.style.display = 'block'; return; }

  const btn = document.getElementById('btn-salvar-habilidade-plan');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando...'; }

  try {
    if (_editandoHabilidadeId) {
      await api(`habilidades_planejamento?id=eq.${_editandoHabilidadeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ codigo, descricao, divisao_id: divisaoId, temas }),
      });
      mostrarToast('✅ Habilidade atualizada!');
    } else {
      const tdId = turmaDisciplinaAtiva?.id;
      if (!tdId) { alEl.textContent = 'Nenhuma turma/disciplina ativa.'; alEl.style.display = 'block'; return; }
      const tdIds = [tdId, ...Array.from(_turmasExtraCriacaoSelecionadas)];
      const payload = tdIds.map(id => ({ turma_disciplina_id: id, codigo, descricao, divisao_id: divisaoId, temas }));
      await api('habilidades_planejamento', { method: 'POST', body: JSON.stringify(payload) });
      mostrarToast(tdIds.length > 1 ? `✅ Habilidade cadastrada em ${tdIds.length} turmas!` : '✅ Habilidade cadastrada!');
    }
    fecharModal('modal-habilidade-planejamento');
    await carregarHabilidadesPlanejamento();
  } catch (e) {
    console.error('[PLANEJAMENTO] Erro ao salvar habilidade:', e);
    alEl.textContent = 'Erro ao salvar. Tente novamente.';
    alEl.style.display = 'block';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = _editandoHabilidadeId ? 'Salvar alterações' : 'Salvar'; }
  }
}

async function removerHabilidadePlanejamento(id) {
  if (!confirm('Remover esta habilidade? Ela também será desvinculada de qualquer aula.')) return;
  try {
    await api(`habilidades_planejamento?id=eq.${id}`, { method: 'DELETE' });
    mostrarToast('✅ Habilidade removida!');
    await carregarHabilidadesPlanejamento();
  } catch (e) {
    console.error('[PLANEJAMENTO] Erro ao remover habilidade:', e);
    mostrarToast('❌ Erro ao remover.');
  }
}

// ── Vincular a outra turma (cria uma cópia independente com outro td_id) ─────
let _vinculandoHabilidadeId = null;
let _turmasParaVincularSelecionadas = new Set();

async function abrirModalVincularHabilidade(habilidadeId) {
  const modal = document.getElementById('modal-vincular-habilidade');
  if (!modal) return;
  _vinculandoHabilidadeId = habilidadeId;
  _turmasParaVincularSelecionadas = new Set();
  const h = _habilidadesPlanejamentoCache.find(x => String(x.id) === String(habilidadeId));
  document.getElementById('vincular-hab-codigo').textContent = h?.codigo || '';
  document.getElementById('vincular-hab-alert').style.display = 'none';

  const wrap = document.getElementById('vincular-turmas-lista');
  wrap.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Carregando turmas...</span>';
  modal.classList.add('open');

  try {
    const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
    const tds = await api(`turma_disciplinas?professor_id=eq.${profData.id}&select=id,turmas(nome),disciplinas(nome)`) || [];
    const tdAtualId = turmaDisciplinaAtiva?.id;
    const outras = tds.filter(td => String(td.id) !== String(tdAtualId));
    if (!outras.length) {
      wrap.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Nenhuma outra turma disponível.</span>';
      return;
    }
    wrap.innerHTML = outras.map(td => `
      <span class="vincular-turma-chip" data-td="${td.id}" onclick="_toggleTurmaVincular(this)"
        style="display:inline-flex;align-items:center;padding:7px 12px;border-radius:20px;border:1.5px solid var(--border);font-size:12px;cursor:pointer;margin:0 6px 6px 0;">
        ${td.turmas?.nome || '(turma)'} — ${td.disciplinas?.nome || ''}
      </span>
    `).join('');
  } catch (e) {
    console.error('[PLANEJAMENTO] Erro ao carregar turmas para vincular:', e);
    wrap.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">Erro ao carregar turmas.</span>';
  }
}

function _toggleTurmaVincular(el) {
  const td = el.dataset.td;
  if (_turmasParaVincularSelecionadas.has(td)) {
    _turmasParaVincularSelecionadas.delete(td);
    el.style.background = 'none'; el.style.borderColor = 'var(--border)'; el.style.color = 'var(--text)';
  } else {
    _turmasParaVincularSelecionadas.add(td);
    el.style.background = '#3B4FE4'; el.style.borderColor = '#3B4FE4'; el.style.color = '#fff';
  }
}

async function confirmarVincularHabilidade() {
  const alEl = document.getElementById('vincular-hab-alert');
  alEl.style.display = 'none';
  if (!_turmasParaVincularSelecionadas.size) {
    alEl.textContent = 'Selecione ao menos uma turma.';
    alEl.style.display = 'block';
    return;
  }
  const h = _habilidadesPlanejamentoCache.find(x => String(x.id) === String(_vinculandoHabilidadeId));
  if (!h) return;

  const btn = document.getElementById('btn-confirmar-vincular-habilidade');
  if (btn) { btn.disabled = true; btn.textContent = 'Vinculando...'; }
  try {
    const payload = Array.from(_turmasParaVincularSelecionadas).map(tdId => ({
      turma_disciplina_id: tdId,
      codigo: h.codigo,
      descricao: h.descricao,
      divisao_id: h.divisao_id,
      temas: h.temas,
    }));
    await api('habilidades_planejamento', { method: 'POST', body: JSON.stringify(payload) });
    mostrarToast(`✅ Vinculada a ${payload.length} turma${payload.length > 1 ? 's' : ''}!`);
    fecharModal('modal-vincular-habilidade');
  } catch (e) {
    console.error('[PLANEJAMENTO] Erro ao vincular habilidade:', e);
    alEl.textContent = 'Erro ao vincular. Tente novamente.';
    alEl.style.display = 'block';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Vincular'; }
  }
}

window.carregarHabilidadesPlanejamento = carregarHabilidadesPlanejamento;
window.abrirModalHabilidadePlanejamento = abrirModalHabilidadePlanejamento;
window._toggleTurmaExtraCriacao = _toggleTurmaExtraCriacao;
window.salvarHabilidadePlanejamento = salvarHabilidadePlanejamento;
window.removerHabilidadePlanejamento = removerHabilidadePlanejamento;
window.abrirModalVincularHabilidade = abrirModalVincularHabilidade;
window._toggleTurmaVincular = _toggleTurmaVincular;
window.confirmarVincularHabilidade = confirmarVincularHabilidade;
