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
// divisao_id, temas[]). Modelo N:1 — uma linha por turma. Vincular a outra
// turma = INSERT (cópia) com novo turma_disciplina_id, nunca uma tabela N:N.
// Editar = PATCH no registro atual (não afeta cópias em outras turmas nem
// aula_habilidades, que referencia o id fixo do registro).
// CRUD: criar (POST), editar (PATCH), vincular a outra turma (POST cópia),
// deletar (DELETE).
// ═════════════════════════════════════════════════════════════════════════════

let _habilidadesPlanejamentoCache = [];
const _nomesTrimestre = {1:'1º Tri', 2:'2º Tri', 3:'3º Tri'};

function _nomeTrimestrePorDivisaoId(divisaoId) {
  const d = (_divisoesCache || []).find(d => String(d.id) === String(divisaoId));
  if (!d) return '';
  return _nomesTrimestre[d.ordem] || d.valor || `Divisão ${d.ordem}`;
}

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

function _habilidadePlanejamentoPorId(id) {
  return _habilidadesPlanejamentoCache.find(h => String(h.id) === String(id));
}

function _renderHabilidadesPlanejamento() {
  const wrap = document.getElementById('planejamento-habilidades-lista');
  if (!wrap) return;
  if (!_habilidadesPlanejamentoCache.length) {
    wrap.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">Nenhuma habilidade cadastrada ainda.</div>`;
    return;
  }
  wrap.innerHTML = _habilidadesPlanejamentoCache.map(h => {
    const trimestre = _nomeTrimestrePorDivisaoId(h.divisao_id);
    const descricao = (h.descricao || '').replace(/</g, '&lt;');
    const tags = (h.temas || []).map(t =>
      `<span class="hab-plan-tag">${String(t).replace(/</g,'&lt;')}</span>`
    ).join('');
    return `<div class="hab-plan-card">
      <div class="hab-plan-card-top">
        <span class="hab-plan-codigo">${h.codigo}</span>
        ${trimestre ? `<span class="hab-plan-trimestre">${trimestre}</span>` : ''}
      </div>
      <div class="hab-plan-descricao">${descricao}</div>
      ${tags ? `<div class="hab-plan-tags">${tags}</div>` : ''}
      <div class="hab-plan-actions">
        <button class="hab-plan-action-btn action-vincular" title="Vincular a outra turma" onclick="abrirModalVinculoHabilidadePlanejamento('${h.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M10 13a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07l-1.29 1.29"/><path d="M14 11a5 5 0 00-7.07 0L4.1 13.83a5 5 0 007.07 7.07l1.29-1.29"/></svg>
        </button>
        <button class="hab-plan-action-btn action-editar" title="Editar" onclick="abrirModalHabilidadePlanejamento('${h.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="hab-plan-action-btn action-excluir" title="Excluir" onclick="removerHabilidadePlanejamento('${h.id}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

// ── Modal unificado: criar / editar ──────────────────────────────────────────
// Sem id → cria (POST). Com id → edita (PATCH), preenchendo os campos primeiro.
function abrirModalHabilidadePlanejamento(id) {
  const modal = document.getElementById('modal-habilidade-planejamento');
  if (!modal) return;

  const h = id ? _habilidadePlanejamentoPorId(id) : null;

  document.getElementById('hab-plan-id').value = h ? h.id : '';
  document.getElementById('hab-plan-titulo').textContent = h ? 'Editar habilidade BNCC' : 'Nova habilidade BNCC';
  document.getElementById('hab-plan-codigo').value = h ? (h.codigo || '') : '';
  document.getElementById('hab-plan-descricao').value = h ? (h.descricao || '') : '';
  document.getElementById('hab-plan-temas').value = h ? (h.temas || []).join(', ') : '';
  document.getElementById('hab-plan-alert').style.display = 'none';

  _preencherSelectDivisoesPlanejamento();
  if (h) document.getElementById('hab-plan-divisao').value = h.divisao_id || '';

  const btn = document.getElementById('btn-salvar-habilidade-plan');
  if (btn) btn.textContent = h ? 'Salvar alterações' : 'Salvar';

  modal.classList.add('open');
}

function _preencherSelectDivisoesPlanejamento() {
  const sel = document.getElementById('hab-plan-divisao');
  if (!sel) return;
  const divisoes = _divisoesCache || [];
  sel.innerHTML = '<option value="">Selecione a divisão...</option>' +
    divisoes.map(d => `<option value="${d.id}">${_nomesTrimestre[d.ordem] || d.valor || ('Divisão ' + d.ordem)}</option>`).join('');
}

async function salvarHabilidadePlanejamento() {
  const alEl = document.getElementById('hab-plan-alert');
  alEl.style.display = 'none';

  const id = document.getElementById('hab-plan-id').value;
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
  if (btn) { btn.disabled = true; btn.textContent = id ? 'Salvando...' : 'Salvando...'; }

  try {
    if (id) {
      // Edição: PATCH no registro atual. Não mexe em turma_disciplina_id,
      // então não afeta cópias em outras turmas nem aula_habilidades (que
      // referencia este id fixo).
      await api(`habilidades_planejamento?id=eq.${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ codigo, descricao, divisao_id: divisaoId, temas }),
      });
      mostrarToast('✅ Habilidade atualizada!');
    } else {
      const tdId = turmaDisciplinaAtiva?.id;
      if (!tdId) { alEl.textContent = 'Nenhuma turma/disciplina ativa.'; alEl.style.display = 'block'; return; }
      await api('habilidades_planejamento', {
        method: 'POST',
        body: JSON.stringify({ turma_disciplina_id: tdId, codigo, descricao, divisao_id: divisaoId, temas }),
      });
      mostrarToast('✅ Habilidade cadastrada!');
    }
    fecharModal('modal-habilidade-planejamento');
    await carregarHabilidadesPlanejamento();
  } catch (e) {
    console.error('[PLANEJAMENTO] Erro ao salvar habilidade:', e);
    alEl.textContent = 'Erro ao salvar. Tente novamente.';
    alEl.style.display = 'block';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = id ? 'Salvar alterações' : 'Salvar'; }
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

// ── Modal: vincular a outra turma (cópia via POST) ───────────────────────────
// Não cria vínculo N:N. Duplica a linha da habilidade com o turma_disciplina_id
// de destino — vira um registro independente, com seu próprio id.
function abrirModalVinculoHabilidadePlanejamento(id) {
  const h = _habilidadePlanejamentoPorId(id);
  if (!h) return;

  const modal = document.getElementById('modal-vincular-habilidade');
  if (!modal) return;

  document.getElementById('vinc-hab-id').value = id;
  document.getElementById('vinc-hab-alert').style.display = 'none';
  document.getElementById('vinc-hab-preview').innerHTML =
    `<span style="font-weight:700;color:#3B4FE4;font-family:'Space Mono',monospace;">${h.codigo}</span> — ${(h.descricao || '').replace(/</g,'&lt;')}`;

  _preencherSelectTurmasVinculoPlanejamento(h.turma_disciplina_id);

  modal.classList.add('open');
}

function _preencherSelectTurmasVinculoPlanejamento(tdIdAtual) {
  const sel = document.getElementById('vinc-hab-turma-disciplina');
  if (!sel) return;
  const lista = window.todasTurmaDisciplinas || [];
  const opcoes = lista
    .filter(td => String(td.id) !== String(tdIdAtual)) // não oferece a turma de origem
    .map(td => {
      const turma = td.turmas?.nome || '';
      const disc = td.disciplinas?.nome || '';
      const label = [turma, disc].filter(Boolean).join(' · ');
      return `<option value="${td.id}">${label}</option>`;
    });
  sel.innerHTML = '<option value="">Selecione a turma...</option>' + opcoes.join('');
}

async function confirmarVinculoHabilidadePlanejamento() {
  const alEl = document.getElementById('vinc-hab-alert');
  alEl.style.display = 'none';

  const id = document.getElementById('vinc-hab-id').value;
  const tdDestino = document.getElementById('vinc-hab-turma-disciplina').value;
  const h = _habilidadePlanejamentoPorId(id);

  if (!h) { alEl.textContent = 'Habilidade não encontrada.'; alEl.style.display = 'block'; return; }
  if (!tdDestino) { alEl.textContent = 'Selecione a turma de destino.'; alEl.style.display = 'block'; return; }

  const btn = document.getElementById('btn-confirmar-vinculo-hab');
  if (btn) { btn.disabled = true; btn.textContent = 'Vinculando...'; }

  try {
    // INSERT (cópia): novo id, novo turma_disciplina_id, mesmo conteúdo.
    // Registro totalmente independente do original a partir daqui.
    await api('habilidades_planejamento', {
      method: 'POST',
      body: JSON.stringify({
        turma_disciplina_id: tdDestino,
        codigo: h.codigo,
        descricao: h.descricao,
        divisao_id: h.divisao_id,
        temas: h.temas || [],
      }),
    });
    mostrarToast('✅ Habilidade vinculada à turma selecionada!');
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
window.salvarHabilidadePlanejamento = salvarHabilidadePlanejamento;
window.removerHabilidadePlanejamento = removerHabilidadePlanejamento;
window.abrirModalVinculoHabilidadePlanejamento = abrirModalVinculoHabilidadePlanejamento;
window.confirmarVinculoHabilidadePlanejamento = confirmarVinculoHabilidadePlanejamento;
