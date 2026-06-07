// ═══════════════════════════════════════════════════════════════════════════
// SIDED+ — Plano de Curso: Análise IA + Pesquisador de Habilidades
// Usa Anthropic API diretamente (sem servidor proxy)
// Depende de: supabase (api/SUPABASE_URL/SUPABASE_KEY), calendário_plano.js
// ═══════════════════════════════════════════════════════════════════════════

// ── Estado local ─────────────────────────────────────────────────────────────
let _planoAnalise = null;

// ── HTML da seção de análise ──────────────────────────────────────────────────
function _planoIaHtml() {
  return `
  <div id="plano-ia-section" style="margin-top:24px;">

    <!-- Cabeçalho -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px;">
      <div style="display:flex;align-items:center;gap:8px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B4FE4" stroke-width="2.2" stroke-linecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        <span style="font-size:14px;font-weight:700;color:var(--text);">Análise IA do Plano</span>
      </div>
      <div style="display:flex;gap:8px;">
        <button id="btn-reprocessar-plano" onclick="reprocessarPlanoIA()"
          style="padding:7px 14px;border-radius:8px;border:1.5px solid var(--border);background:none;color:var(--text-muted);font-family:'Sora',sans-serif;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;transition:all 0.15s;"
          onmouseover="this.style.borderColor='var(--purple)';this.style.color='var(--purple)'"
          onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)'">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
          Reprocessar
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div id="plano-ia-loading" style="display:none;padding:24px;text-align:center;background:#F8F6FF;border-radius:12px;border:1.5px solid var(--border);">
      <div style="width:20px;height:20px;border:2.5px solid var(--border);border-top-color:var(--purple);border-radius:50%;animation:spin 0.7s linear infinite;margin:0 auto 10px;"></div>
      <div id="plano-ia-loading-msg" style="font-size:13px;color:var(--text-muted);font-family:'Sora',sans-serif;">Processando plano com IA...</div>
    </div>

    <!-- Resultado -->
    <div id="plano-ia-resultado" style="display:none;">
      <div style="background:#F8F6FF;border:1.5px solid #E0E7FF;border-radius:12px;padding:16px 18px;margin-bottom:16px;">
        <div style="font-size:11px;font-weight:700;color:#3B4FE4;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">Resumo do plano</div>
        <div id="plano-ia-resumo" style="font-size:13px;color:var(--text);line-height:1.7;"></div>
      </div>
      <div style="margin-bottom:16px;">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;">Objetivos e Conteúdos</div>
        <div id="plano-ia-objetivos" style="display:flex;flex-direction:column;gap:6px;"></div>
      </div>
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;">Habilidades BNCC / CRMG identificadas</div>
          <span id="plano-ia-count" style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:#EEF2FF;color:#3B4FE4;"></span>
        </div>
        <div id="plano-ia-habilidades" style="display:flex;flex-direction:column;gap:8px;"></div>
      </div>
    </div>

    <!-- Vazio -->
    <div id="plano-ia-vazio" style="padding:20px;text-align:center;background:#F8FAFF;border-radius:12px;border:1.5px dashed var(--border);">
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:10px;">Nenhuma análise disponível para este plano.</div>
      <button onclick="reprocessarPlanoIA()"
        style="padding:9px 20px;border-radius:9px;border:none;background:#3B4FE4;color:#fff;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:7px;transition:opacity 0.15s;"
        onmouseover="this.style.opacity=0.85" onmouseout="this.style.opacity=1">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        Analisar plano com IA agora
      </button>
    </div>

  </div>`;
}

// ── Injetar bloco HTML no plano-viewer ────────────────────────────────────────
function _garantirSecaoIA() {
  if (document.getElementById('plano-ia-section')) return;
  const viewer = document.getElementById('plano-viewer');
  if (!viewer) return;
  const div = document.createElement('div');
  div.innerHTML = _planoIaHtml();
  viewer.appendChild(div.firstElementChild);
}

// ── Controle de estado ────────────────────────────────────────────────────────
function _setEstadoIA(estado, msg) {
  const loading  = document.getElementById('plano-ia-loading');
  const resultado = document.getElementById('plano-ia-resultado');
  const vazio    = document.getElementById('plano-ia-vazio');
  const loadMsg  = document.getElementById('plano-ia-loading-msg');
  if (loading)  loading.style.display  = estado === 'loading'   ? 'block' : 'none';
  if (resultado) resultado.style.display = estado === 'resultado' ? 'block' : 'none';
  if (vazio)    vazio.style.display    = estado === 'vazio'     ? 'block' : 'none';
  if (loadMsg && msg) loadMsg.textContent = msg;
}

// ── Carregar análise salva no Supabase ────────────────────────────────────────
async function carregarAnaliseIA() {
  _garantirSecaoIA();
  if (!turmaAtiva?.id) return;
  _setEstadoIA('loading', 'Buscando análise salva...');
  try {
    const rows = await api(`plano_bncc?turma_id=eq.${turmaAtiva.id}&order=data_indexacao.desc&limit=80`);
    if (rows && rows.length > 0) {
      _planoAnalise = _reconstruirAnalise(rows);
      _renderizarAnalise(_planoAnalise);
    } else {
      _setEstadoIA('vazio');
    }
  } catch (err) {
    console.warn('[PLANO IA] Erro ao carregar:', err);
    _setEstadoIA('vazio');
  }
}

function _reconstruirAnalise(rows) {
  const habilidades = rows.map(r => ({
    codigo: r.codigo || '',
    descricao: r.descricao || '',
    contexto: r.contexto || ''
  }));
  const resumo = rows[0]?.resumo || `${rows.length} habilidade(s) indexada(s) a partir do plano de curso.`;
  const objetivos = rows[0]?.objetivos || [];
  return { habilidades, resumo, objetivos };
}

// ── Reprocessar: baixa PDF → extrai texto → chama Anthropic → salva ──────────
window.reprocessarPlanoIA = async function() {
  if (!turmaAtiva?.id) { mostrarToast('Selecione uma turma primeiro.'); return; }
  _garantirSecaoIA();
  _setEstadoIA('loading', 'Localizando arquivo do plano...');

  try {
    const ano = new Date().getFullYear();
    const dir = `planos/${turmaAtiva.id}_${ano}`;
    const files = await _storageList('documentos', `${dir}/`);
    if (!files.length) {
      mostrarToast('Nenhum arquivo de plano encontrado. Faça upload primeiro.');
      _setEstadoIA('vazio');
      return;
    }

    const fileName = files[0].name || files[0].path;
    _setEstadoIA('loading', `Baixando "${fileName}"...`);

    const fileUrl = _storagePublicUrl('documentos', `${dir}/${fileName}`);
    const blob = await fetch(fileUrl).then(r => r.blob());

    // Converter para base64
    _setEstadoIA('loading', 'Preparando documento...');
    const base64 = await _blobToBase64(blob);
    const mimeType = blob.type || 'application/pdf';

    // Chamar Anthropic diretamente
    _setEstadoIA('loading', 'Analisando com Claude AI...');
    const analise = await _analisarComAnthropic(base64, mimeType);

    // Salvar no Supabase
    _setEstadoIA('loading', 'Salvando resultado...');
    await _salvarAnalise(analise, turmaAtiva.id);

    _planoAnalise = analise;
    _renderizarAnalise(analise);
    mostrarToast('✅ Plano analisado com sucesso!');

  } catch (err) {
    console.error('[PLANO IA] Erro:', err);
    mostrarToast('❌ Erro: ' + err.message);
    _setEstadoIA('vazio');
  }
};

// ── Converter Blob para base64 ────────────────────────────────────────────────
function _blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── Chamar API Anthropic com o PDF ───────────────────────────────────────────
async function _analisarComAnthropic(base64, mimeType) {
  const SYSTEM = `Você é um especialista em currículo escolar brasileiro (BNCC e CRMG - Currículo Referência de Minas Gerais).
Analise o plano de curso fornecido e extraia todas as informações relevantes.

Retorne SOMENTE um JSON válido, sem markdown, sem explicações, exatamente neste formato:
{
  "resumo": "Resumo do plano em 2-3 frases",
  "objetivos": ["objetivo 1", "objetivo 2", "..."],
  "habilidades": [
    {
      "codigo": "EF08MA01",
      "descricao": "Descrição completa da habilidade",
      "contexto": "Trecho ou contexto onde aparece no plano"
    }
  ]
}

Instruções:
- Extraia TODOS os códigos de habilidades (formato EFxxMAxx, EFxxLPxx, EFxxCIxx, etc.)
- Se não houver código explícito mas houver descrição de habilidade, crie um item sem código
- objetivos: liste os principais conteúdos/objetivos de aprendizagem do plano
- resumo: síntese do plano (disciplina, ano, período, foco principal)`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: mimeType, data: base64 }
          },
          {
            type: 'text',
            text: 'Analise este plano de curso e retorne o JSON conforme instruído.'
          }
        ]
      }]
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.content?.map(c => c.text || '').join('') || '';

  // Limpar e parsear JSON
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    // Tenta extrair JSON do texto
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Resposta da IA não é JSON válido');
  }
}

// ── Salvar análise no Supabase (tabela plano_bncc) ───────────────────────────
async function _salvarAnalise(analise, turmaId) {
  // Deletar registros anteriores desta turma
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/plano_bncc?turma_id=eq.${turmaId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      }
    });
  } catch (_) { /* ignora */ }

  if (!analise.habilidades?.length) return;

  // Inserir novos registros
  const rows = analise.habilidades.map(h => ({
    turma_id: turmaId,
    codigo: h.codigo || 'SEM_CODIGO',
    descricao: h.descricao || '',
    contexto: h.contexto || '',
    resumo: analise.resumo || '',
    objetivos: analise.objetivos || [],
    fonte: 'plano_de_curso_bncc',
    data_indexacao: new Date().toISOString()
  }));

  const res = await fetch(`${SUPABASE_URL}/rest/v1/plano_bncc`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(rows)
  });

  if (!res.ok) {
    const err = await res.text();
    console.warn('[PLANO IA] Erro ao salvar:', err);
    // Não lança — a análise foi feita, só o save falhou
  }
}

// ── Renderizar análise na UI ──────────────────────────────────────────────────
function _renderizarAnalise(analise) {
  _garantirSecaoIA();
  _setEstadoIA('resultado');

  const resumoEl = document.getElementById('plano-ia-resumo');
  if (resumoEl) resumoEl.textContent = analise.resumo || '—';

  const objEl = document.getElementById('plano-ia-objetivos');
  if (objEl) {
    const itens = analise.objetivos || [];
    if (itens.length) {
      objEl.innerHTML = itens.map(o => `
        <div style="display:flex;align-items:flex-start;gap:8px;font-size:13px;color:var(--text);line-height:1.5;padding:8px 12px;background:#F8FAFC;border-radius:8px;border:1px solid var(--border);">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3B4FE4" stroke-width="2.5" stroke-linecap="round" style="flex-shrink:0;margin-top:2px;"><polyline points="20 6 9 17 4 12"/></svg>
          ${String(o).replace(/</g,'&lt;')}
        </div>`).join('');
    } else {
      objEl.innerHTML = '<div style="font-size:12px;color:var(--text-muted);">Objetivos extraídos da análise do plano.</div>';
    }
  }

  const habEl  = document.getElementById('plano-ia-habilidades');
  const countEl = document.getElementById('plano-ia-count');
  const habs = analise.habilidades || [];
  if (countEl) countEl.textContent = `${habs.length} habilidade${habs.length !== 1 ? 's' : ''}`;

  if (habEl) {
    if (!habs.length) {
      habEl.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:10px;">Nenhuma habilidade BNCC identificada no plano.</div>';
    } else {
      habEl.innerHTML = habs.map(h => {
        const cod = (h.codigo || 'SEM_COD').replace(/'/g, "\\'");
        return `
        <div style="background:var(--white);border:1.5px solid var(--border);border-radius:10px;padding:12px 14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="display:inline-flex;padding:3px 10px;border-radius:20px;background:#EEF2FF;color:#3B4FE4;font-size:11px;font-weight:700;font-family:'Space Mono',monospace;">${h.codigo || '—'}</span>
            </div>
            <div style="display:flex;gap:6px;">
              <button onclick="usarHabilidadeNoModal('${cod}', 'nova-aula')"
                style="padding:5px 11px;border-radius:6px;border:1.5px solid #3B4FE4;background:#EEF2FF;color:#3B4FE4;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;"
                onmouseover="this.style.background='#3B4FE4';this.style.color='#fff'"
                onmouseout="this.style.background='#EEF2FF';this.style.color='#3B4FE4'">
                + Aula
              </button>
              <button onclick="usarHabilidadeNoModal('${cod}', 'multi-aulas')"
                style="padding:5px 11px;border-radius:6px;border:1.5px solid var(--border);background:none;color:var(--text-muted);font-family:'Sora',sans-serif;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;"
                onmouseover="this.style.borderColor='var(--purple)';this.style.color='var(--purple)'"
                onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)'">
                + Multi-aulas
              </button>
            </div>
          </div>
          <div style="font-size:12px;color:var(--text);line-height:1.6;">${(h.descricao || '—').replace(/</g,'&lt;')}</div>
          ${h.contexto ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;font-style:italic;border-left:2px solid var(--border);padding-left:8px;line-height:1.5;">${String(h.contexto).replace(/</g,'&lt;')}</div>` : ''}
        </div>`;
      }).join('');
    }
  }
}

// ── Usar habilidade: preenche campo BNCC e abre modal ────────────────────────
window.usarHabilidadeNoModal = function(codigo, destino) {
  if (destino === 'nova-aula') {
    if (typeof abrirNovaAula === 'function') abrirNovaAula();
    setTimeout(() => {
      const el = document.getElementById('aula-bncc');
      if (el) { el.value = codigo; el.dispatchEvent(new Event('input')); el.focus(); }
      if (typeof buscarBNCC === 'function') buscarBNCC();
    }, 200);
  } else if (destino === 'multi-aulas') {
    if (typeof abrirMultiAulas === 'function') abrirMultiAulas();
    setTimeout(() => {
      const el = document.getElementById('multi-aulas-bncc');
      if (el) { el.value = codigo; el.focus(); }
    }, 200);
  }
  mostrarToast(`✓ Habilidade ${codigo} aplicada`);
};

// ── Pesquisador de habilidades ─────────────────────────────────────────────────
window.pesquisarHabilidadesPlano = async function() {
  const query = (document.getElementById('pesq-bncc-input')?.value || '').trim();
  const resEl = document.getElementById('pesq-bncc-resultado');
  if (!resEl) return;
  if (!query) { resEl.innerHTML = ''; return; }

  resEl.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">Buscando...</div>`;

  try {
    const rows = await api(
      `plano_bncc?or=(codigo.ilike.*${encodeURIComponent(query)}*,descricao.ilike.*${encodeURIComponent(query)}*)&turma_id=eq.${turmaAtiva?.id}&limit=10`
    );
    if (!rows?.length) {
      resEl.innerHTML = `<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">Nenhuma habilidade encontrada para "${query}".</div>`;
      return;
    }
    resEl.innerHTML = rows.map(h => {
      const cod = (h.codigo || '').replace(/'/g, "\\'");
      return `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;border:1px solid var(--border);border-radius:8px;background:var(--white);margin-bottom:6px;flex-wrap:wrap;">
        <div style="flex:1;min-width:0;">
          <span style="display:inline-flex;padding:2px 8px;border-radius:20px;background:#EEF2FF;color:#3B4FE4;font-size:11px;font-weight:700;font-family:'Space Mono',monospace;margin-bottom:4px;">${h.codigo}</span>
          <div style="font-size:12px;color:var(--text);line-height:1.5;">${(h.descricao || '—').replace(/</g,'&lt;')}</div>
        </div>
        <div style="display:flex;gap:5px;flex-shrink:0;">
          <button onclick="usarHabilidadeNoModal('${cod}','nova-aula')"
            style="padding:4px 10px;border-radius:6px;border:1.5px solid #3B4FE4;background:#EEF2FF;color:#3B4FE4;font-size:11px;font-weight:700;cursor:pointer;"
            onmouseover="this.style.background='#3B4FE4';this.style.color='#fff'"
            onmouseout="this.style.background='#EEF2FF';this.style.color='#3B4FE4'">+ Aula</button>
          <button onclick="usarHabilidadeNoModal('${cod}','multi-aulas')"
            style="padding:4px 10px;border-radius:6px;border:1.5px solid var(--border);background:none;color:var(--text-muted);font-size:11px;font-weight:700;cursor:pointer;"
            onmouseover="this.style.borderColor='var(--purple)';this.style.color='var(--purple)'"
            onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--text-muted)'">+ Multi-aulas</button>
        </div>
      </div>`;
    }).join('');
  } catch (err) {
    resEl.innerHTML = `<div style="font-size:12px;color:var(--danger);padding:8px 0;">Erro: ${err.message}</div>`;
  }
};

// ── Sugestões de habilidades no modal de nova aula ────────────────────────────
function _injetarSugestoesNoModal() {
  if (!_planoAnalise?.habilidades?.length) return;
  const alvo = document.getElementById('bncc-resultado');
  if (!alvo || document.getElementById('pesq-bncc-sugestoes-modal')) return;

  const sugestoes = document.createElement('div');
  sugestoes.id = 'pesq-bncc-sugestoes-modal';
  sugestoes.style.cssText = 'margin-top:8px;margin-bottom:4px;';

  const habs = _planoAnalise.habilidades.slice(0, 6);
  sugestoes.innerHTML = `
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;font-weight:600;">Do plano de curso:</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;">
      ${habs.map(h => `
        <button onclick="document.getElementById('aula-bncc').value='${(h.codigo||'').replace(/'/g,"\\'")}';if(typeof buscarBNCC==='function')buscarBNCC();document.getElementById('pesq-bncc-sugestoes-modal').style.display='none';"
          style="padding:4px 10px;border-radius:20px;border:1.5px solid #3B4FE4;background:#EEF2FF;color:#3B4FE4;font-family:'Space Mono',monospace;font-size:11px;font-weight:700;cursor:pointer;"
          onmouseover="this.style.background='#3B4FE4';this.style.color='#fff'"
          onmouseout="this.style.background='#EEF2FF';this.style.color='#3B4FE4'">
          ${h.codigo || '?'}
        </button>`).join('')}
    </div>`;
  alvo.parentElement?.insertBefore(sugestoes, alvo);
}

// ── Hooks sobre funções existentes ────────────────────────────────────────────
(function() {
  // Hook abrirNovaAula
  const orig = window.abrirNovaAula;
  window.abrirNovaAula = function(...args) {
    if (orig) orig.apply(this, args);
    setTimeout(() => _injetarSugestoesNoModal(), 350);
  };

  // Hook iniciarPlanoCurso
  const origPlano = window.iniciarPlanoCurso;
  window.iniciarPlanoCurso = async function(...args) {
    if (origPlano) await origPlano.apply(this, args);
    setTimeout(() => {
      if (document.getElementById('plano-viewer')?.style.display !== 'none') {
        carregarAnaliseIA();
      }
    }, 600);
  };
})();

// Expor ao window
window.carregarAnaliseIA = carregarAnaliseIA;
