const _ocrMotivos = [
  [1,'Desrespeitou professores, funcionários ou colegas de turma'],
  [2,'Desobedeceu a regras e tumultuou a aula'],
  [3,'Agressão verbal ou física contra colegas, professores ou funcionários (Arts. 129, 140, 147)'],
  [4,'Destruição ou dano ao patrimônio escolar (Art. 163)'],
  [5,'Uso indevido de aparelhos eletrônicos (15.100/2025)'],
  [6,'Recusa ou negligência na realização de atividades escolares'],
  [7,'Conversas excessivas durante as aulas, atrapalhando o andamento'],
  [8,'Chegou atrasado com frequência e sem justificativa'],
  [9,'Circulou nos corredores sem permissão durante a aula'],
  [10,'Saiu da escola ou sala de aula sem autorização'],
  [11,'Usou linguagem ofensiva ou palavrões em ambiente escolar'],
  [12,'Falsificou assinatura ou documento escolar (Arts. 297 a 302)'],
  [13,'Consumiu ou levou produtos proibidos (11.343/2006)'],
  [14,'Recusa a colaborar em trabalhos ou atividades'],
  [15,'Caderno todo incompleto ao longo do ano/bimestre'],
  [16,'Desobedeceu orientações da direção, supervisão ou do(a) professor(a)'],
  [17,'Praticou bullying, ameaças ou provocações intencionais (13.185/2015)'],
  [18,'Mentiu para professores, funcionários ou colegas para evitar responsabilidades'],
  [19,'Tirou fotos ou gravou vídeos sem autorização, infringindo a privacidade (13.709/2018)'],
  [20,'Roubou materiais/pertences de colegas, professores ou da escola (Art. 155)']
];

const _ocrCons = [
  [1,'Realização de atividade reflexiva sobre a atitude cometida'],
  [2,'Reparação de danos materiais causados (financeiramente)'],
  [3,'Suspensão temporária das aulas (até 05 dias)'],
  [4,'Encaminhamento à Supervisão Escolar para análise da reincidência'],
  [5,'Transferência temporária, conforme regimento da escola'],
  [6,'Transferência ou remanejamento de sala (troca de turma)'],
  [7,'Perda de ponto(s) em todas ou algumas disciplinas (a definir pela Supervisão)'],
  [8,'Reunião obrigatória com os responsáveis'],
  [9,'Acompanhamento pedagógico obrigatório (a decidir pela Supervisão)'],
  [10,'Perda de atividades extracurriculares ou fora de sala']
];

let _ocrInicializado = false;

function _ocrKey() { return `ocr_${turmaAtiva?.id || 'turma'}`; }
function _ocrCarregar() { try { return JSON.parse(localStorage.getItem(_ocrKey()) || '[]'); } catch(e) { return []; } }
function _ocrSalvar(lista) { localStorage.setItem(_ocrKey(), JSON.stringify(lista)); }

// ── Supabase helpers para Ocorrências ──────────────────────────────────────
async function _ocrCarregarSupabase(alunoId) {
  try {
    let path = `ocorrencias?turma_id=eq.${turmaAtiva?.id}&order=data_registro.desc`;
    if (alunoId) path += `&aluno_id=eq.${alunoId}`;
    const rows = await api(path + '&select=*');
    return (rows || []).map(r => ({
      id: r.id,
      alunoId: String(r.aluno_id),
      alunoNome: r.aluno_nome || '—',
      motivos: Array.isArray(r.motivos) ? r.motivos : (r.motivos ? JSON.parse(r.motivos) : []),
      outroMotivo: r.outro_motivo || '',
      consequencias: Array.isArray(r.consequencias) ? r.consequencias : (r.consequencias ? JSON.parse(r.consequencias) : []),
      outraCons: r.outra_consequencia || '',
      obs: r.observacao || '',
      dataAto: r.data_ato || '',
      dataReg: r.data_registro || ''
    }));
  } catch(e) {
    console.error('[OCR] Falha ao carregar do Supabase:', e.message);
    mostrarToast('⚠️ Erro ao carregar ocorrências: ' + e.message);
    return [];
  }
}

async function _ocrSalvarSupabase(ocr) {
  const row = {
    turma_id: turmaAtiva?.id,
    aluno_id: ocr.alunoId,
    aluno_nome: ocr.alunoNome,
    motivos: ocr.motivos,
    outro_motivo: ocr.outroMotivo || null,
    consequencias: ocr.consequencias,
    outra_consequencia: ocr.outraCons || null,
    observacao: ocr.obs || null,
    data_ato: ocr.dataAto || null,
    data_registro: ocr.dataReg || new Date().toISOString().slice(0,10)
  };
  try {
    const result = await api('ocorrencias', { method: 'POST', body: JSON.stringify(row) });
    return result && result[0] ? result[0].id : null;
  } catch(e) {
    console.error('[OCR] Erro ao salvar no Supabase:', e.message, '| Dados enviados:', JSON.stringify(row));
    throw e;
  }
}

async function _ocrExcluirSupabase(id) {
  await api(`ocorrencias?id=eq.${id}`, { method: 'DELETE' });
}

function _ocrBuildGrid(items, gridId, prefix) {
  const g = document.getElementById(gridId);
  if (!g) return;
  g.innerHTML = items.map(([code, label]) => `
    <label id="opt-${prefix}-${code}" style="display:flex;align-items:flex-start;gap:8px;padding:7px 10px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg);cursor:pointer;transition:all .15s;" onmouseover="this.style.background='#FEE2E2';this.style.borderColor='#FBBFBF'" onmouseout="if(!document.getElementById('${prefix}-${code}').checked){this.style.background='var(--bg)';this.style.borderColor='var(--border)'}">
      <input type="checkbox" id="${prefix}-${code}" onchange="ocrCheckChange('${prefix}',${code},this)" style="margin-top:2px;flex-shrink:0;accent-color:#DC2626;cursor:pointer;">
      <span style="font-size:12px;color:var(--text);line-height:1.4;">${label}</span>
    </label>`).join('');
}

function ocrCheckChange(prefix, code, cb) {
  const lbl = document.getElementById(`opt-${prefix}-${code}`);
  if (lbl) {
    lbl.style.background = cb.checked ? '#FEE2E2' : 'var(--bg)';
    lbl.style.borderColor = cb.checked ? '#FBBFBF' : 'var(--border)';
  }
  ocrAtualizarResumo();
}

function ocrToggleOutroMotivo(cb) {
  const w = document.getElementById('ocr-outro-motivo-wrap');
  const t = document.getElementById('ocr-outro-motivo-toggle');
  if (w) w.style.display = cb.checked ? 'block' : 'none';
  if (t) { t.style.background = cb.checked ? '#FEE2E2' : '#F8F6FF'; t.style.borderColor = cb.checked ? '#FBBFBF' : 'var(--border)'; }
  ocrAtualizarResumo();
}

function ocrToggleOutraCons(cb) {
  const w = document.getElementById('ocr-outro-cons-wrap');
  const t = document.getElementById('ocr-outro-cons-toggle');
  if (w) w.style.display = cb.checked ? 'block' : 'none';
  if (t) { t.style.background = cb.checked ? '#FEE2E2' : '#F8F6FF'; t.style.borderColor = cb.checked ? '#FBBFBF' : 'var(--border)'; }
  ocrAtualizarResumo();
}

function _ocrGetSelected(items, prefix) {
  return items.filter(([code]) => { const el = document.getElementById(`${prefix}-${code}`); return el && el.checked; }).map(([code]) => String(code).padStart(2,'0'));
}

function _ocrGetSelectedLabels(items, prefix) {
  return items.filter(([code]) => { const el = document.getElementById(`${prefix}-${code}`); return el && el.checked; }).map(([,label]) => label);
}

function ocrAtualizarResumo() {
  const sm = _ocrGetSelected(_ocrMotivos, 'm');
  if (document.getElementById('ocr-cb-outro-motivo')?.checked) sm.push('00');
  const sc = _ocrGetSelected(_ocrCons, 'c');
  if (document.getElementById('ocr-cb-outro-cons')?.checked) sc.push('00');

  const smLabels = _ocrGetSelectedLabels(_ocrMotivos, 'm');
  const outroMotTxt = document.getElementById('ocr-outro-motivo-txt')?.value.trim();
  if (document.getElementById('ocr-cb-outro-motivo')?.checked) smLabels.push(outroMotTxt || 'Outro motivo');

  const scLabels = _ocrGetSelectedLabels(_ocrCons, 'c');
  const outroConsTxt = document.getElementById('ocr-outro-cons-txt')?.value.trim();
  if (document.getElementById('ocr-cb-outro-cons')?.checked) scLabels.push(outroConsTxt || 'Outra consequência');

  const rm = document.getElementById('ocr-resumo-motivos');
  const rc = document.getElementById('ocr-resumo-cons');
  if (rm) rm.innerHTML = smLabels.length
    ? `<strong style="color:var(--text);display:block;margin-bottom:4px;">Motivo(s):</strong>${smLabels.map(l => `<span style="display:block;font-size:12px;color:var(--text);padding:2px 0;">• ${l}</span>`).join('')}`
    : `Motivo(s): <strong style="color:var(--text);">nenhum selecionado</strong>`;
  if (rc) rc.innerHTML = scLabels.length
    ? `<strong style="color:var(--text);display:block;margin-bottom:4px;">Consequência(s):</strong>${scLabels.map(l => `<span style="display:block;font-size:12px;color:var(--text);padding:2px 0;">• ${l}</span>`).join('')}`
    : `Consequência(s): <strong style="color:var(--text);">nenhuma selecionada</strong>`;
}

function _ocrPopularAlunos() {
  const sel = document.getElementById('ocr-select-aluno');
  if (!sel) return;
  sel.innerHTML = '<option value="">Selecione o(a) aluno(a)...</option>' +
    (alunosTurma || []).map(a => `<option value="${a.id}">${a.nome_completo}</option>`).join('');
  sel.onchange = () => ocrRenderHistorico();
}

function _ocrResetForm() {
  _ocrMotivos.forEach(([code]) => { const el = document.getElementById(`m-${code}`); if(el) el.checked = false; ocrCheckChange('m', code, {checked:false}); });
  _ocrCons.forEach(([code]) => { const el = document.getElementById(`c-${code}`); if(el) el.checked = false; ocrCheckChange('c', code, {checked:false}); });
  const cbM = document.getElementById('ocr-cb-outro-motivo');
  const cbC = document.getElementById('ocr-cb-outro-cons');
  if (cbM) { cbM.checked = false; ocrToggleOutroMotivo(cbM); }
  if (cbC) { cbC.checked = false; ocrToggleOutraCons(cbC); }
  const otm = document.getElementById('ocr-outro-motivo-txt'); if(otm) otm.value='';
  const otc = document.getElementById('ocr-outro-cons-txt'); if(otc) otc.value='';
  const obs = document.getElementById('ocr-obs'); if(obs) obs.value='';
  const da = document.getElementById('ocr-data-ato'); if(da) da.value='';
  const dr = document.getElementById('ocr-data-reg'); if(dr) dr.value = new Date().toISOString().slice(0,10);
  ocrAtualizarResumo();
}

async function ocrSalvar() {
  const sel = document.getElementById('ocr-select-aluno');
  const alunoId = sel?.value;
  if (!alunoId) { mostrarToast('Selecione um(a) aluno(a) antes de registrar.'); return; }

  const sm = _ocrGetSelected(_ocrMotivos, 'm');
  if (document.getElementById('ocr-cb-outro-motivo')?.checked) sm.push('00');
  if (!sm.length) { mostrarToast('Selecione ao menos um motivo.'); return; }

  const sc = _ocrGetSelected(_ocrCons, 'c');
  if (document.getElementById('ocr-cb-outro-cons')?.checked) sc.push('00');
  if (!sc.length) { mostrarToast('Selecione ao menos uma consequência.'); return; }

  let aluno = (alunosTurma||[]).find(a => _idAluno(a.id) === _idAluno(alunoId));
  if (!aluno) aluno = await garantirAlunoNoContexto(alunoId);
  const outroMotivo = document.getElementById('ocr-outro-motivo-txt')?.value.trim() || '';
  const outraCons = document.getElementById('ocr-outro-cons-txt')?.value.trim() || '';
  const obs = document.getElementById('ocr-obs')?.value.trim() || '';
  const dataAto = document.getElementById('ocr-data-ato')?.value || '';
  const dataReg = document.getElementById('ocr-data-reg')?.value || new Date().toISOString().slice(0,10);

  const ocr = {
    id: Date.now(),
    alunoId,
    alunoNome: aluno?.nome_completo || '—',
    motivos: sm,
    outroMotivo,
    consequencias: sc,
    outraCons,
    obs,
    dataAto,
    dataReg
  };

  const btnSalvar = document.querySelector('[onclick="ocrSalvar()"]');
  if (btnSalvar) { btnSalvar.disabled = true; btnSalvar.textContent = 'Salvando...'; }
  try {
    const novoId = await _ocrSalvarSupabase(ocr);
    if (novoId) {
      ocr.id = novoId;
      mostrarToast('Ocorrência registrada com sucesso!');
    } else {
      mostrarToast('⚠️ Salvo mas sem ID retornado. Verifique o console.');
    }
  } catch(e) {
    mostrarToast('❌ Erro ao salvar: ' + e.message);
    console.error('[OCR] Falha completa ao salvar:', e);
  } finally {
    if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.textContent = 'Registrar Ocorrência'; }
  }
  _ocrResetForm();
  ocrRenderHistoricoAluno(alunoId);
  // Voltar ao feed após salvar
  if (document.getElementById('ocr-form-view')?.style.display !== 'none') {
    fecharFormOcorrencia();
  }
}

function ocrRenderHistorico() {
  const sel = document.getElementById('ocr-select-aluno');
  const alunoId = sel?.value;
  ocrRenderHistoricoAluno(alunoId);
}

async function ocrRenderHistoricoAluno(alunoId) {
  const el = document.getElementById('ocr-historico-list');
  const lbl = document.getElementById('ocr-hist-aluno-label');
  if (!el) return;

  el.innerHTML = `<div style="font-size:13px;color:var(--text-muted);text-align:center;padding:20px;">Carregando...</div>`;

  let lista = [];
  try {
    lista = await _ocrCarregarSupabase(alunoId || null);
  } catch(e) {
    el.innerHTML = `<div style="font-size:13px;color:#DC2626;text-align:center;padding:20px;">Erro ao carregar: ${e.message}</div>`;
    return;
  }

  if (lbl) lbl.textContent = alunoId ? `${lista.length} registro${lista.length !== 1 ? 's' : ''}` : '';

  if (!lista.length) {
    el.innerHTML = `<div style="font-size:13px;color:var(--text-muted);text-align:center;padding:20px;">${alunoId ? 'Nenhuma ocorrência registrada para este(a) aluno(a).' : 'Selecione um aluno para ver o histórico.'}</div>`;
    return;
  }

  const _ocrMotMap = Object.fromEntries(_ocrMotivos.map(([c,l]) => [String(c).padStart(2,'0'), l]));
  const _ocrConsMap = Object.fromEntries(_ocrCons.map(([c,l]) => [String(c).padStart(2,'0'), l]));

  el.innerHTML = lista.map(o => {
    const dataAtoFmt = o.dataAto ? o.dataAto.split('-').reverse().join('/') : '—';
    const dataRegFmt = o.dataReg ? o.dataReg.split('-').reverse().join('/') : '—';
    const motivosDesc = o.motivos.map(c => c === '00' ? `00 — ${o.outroMotivo || 'outro'}` : `${c} — ${_ocrMotMap[c] || ''}`).join('<br>');
    const consDesc = o.consequencias.map(c => c === '00' ? `00 — ${o.outraCons || 'outra'}` : `${c} — ${_ocrConsMap[c] || ''}`).join('<br>');
    return `
    <div style="border:1.5px solid #FBBFBF;border-radius:10px;padding:14px 16px;margin-bottom:10px;background:#FFF8F8;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px;">
        <span style="font-size:13px;font-weight:700;color:#B91C1C;">${o.alunoNome}</span>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <span style="font-size:11px;color:var(--text-muted);">Ato: <strong>${dataAtoFmt}</strong></span>
          <span style="font-size:11px;color:var(--text-muted);">Registro: <strong>${dataRegFmt}</strong></span>
          <button onclick="ocrExcluir(${JSON.stringify(o.id)},'${o.alunoId}')" style="padding:3px 8px;border-radius:6px;border:1px solid #FBBFBF;background:none;color:#DC2626;font-family:'Sora',sans-serif;font-size:11px;font-weight:600;cursor:pointer;" onmouseover="this.style.background='#FEE2E2'" onmouseout="this.style.background='none'">Excluir</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Motivo(s)</div>
          <div style="font-size:12px;color:var(--text);line-height:1.6;">${motivosDesc}</div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">Consequência(s)</div>
          <div style="font-size:12px;color:var(--text);line-height:1.6;">${consDesc}</div>
        </div>
      </div>
      ${o.obs ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #FBBFBF;"><span style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;">Obs: </span><span style="font-size:12px;color:var(--text);">${o.obs}</span></div>` : ''}
    </div>`;
  }).join('');
}

async function ocrExcluir(id, alunoId) {
  if (!confirm('Excluir esta ocorrência? Esta ação não pode ser desfeita.')) return;
  try {
    await _ocrExcluirSupabase(id);
    mostrarToast('Ocorrência excluída.');
  } catch(e) {
    mostrarToast('❌ Erro ao excluir: ' + e.message);
    console.error('[OCR] Erro ao excluir:', e);
  }
  // Se estiver no feed, recarrega o feed; senão, atualiza o histórico do aluno
  if (document.getElementById('ocr-feed-view')?.style.display !== 'none') {
    ocrRenderFeed();
  } else {
    ocrRenderHistoricoAluno(alunoId);
  }
}

async function iniciarOcorrencias() {
  if (!await garantirContextoCompleto()) { mostrarToast('Selecione uma turma para continuar.'); return; }
  await garantirAlunosTurma();
  _ocrBuildGrid(_ocrMotivos, 'ocr-motivos-grid', 'm');
  _ocrBuildGrid(_ocrCons, 'ocr-cons-grid', 'c');
  _ocrPopularAlunos();
  const dr = document.getElementById('ocr-data-reg');
  if (dr && !dr.value) dr.value = new Date().toISOString().slice(0,10);
  ocrAtualizarResumo();
  // Mostrar feed view ao entrar na página
  document.getElementById('ocr-feed-view').style.display = 'block';
  document.getElementById('ocr-form-view').style.display = 'none';
  ocrRenderFeed();
  _ocrInicializado = true;
}

async function abrirFormOcorrencia(alunoId, nomeAluno) {
  if (!alunoId) { mostrarToast('Selecione um aluno.'); return; }

  try {
    if (!await garantirContextoCompleto()) { mostrarToast('Selecione uma turma para continuar.'); return; }
    await garantirAlunosTurma();
    const aluno = await garantirAlunoNoContexto(alunoId);
    if (!aluno) return;

    const estavaVisivel = _paginaEstaVisivel('pagina-ocorrencias');
    if (!estavaVisivel) {
      await abrirPagina('ocorrencias');
    }

    const gridM = document.getElementById('ocr-motivos-grid');
    if (!gridM?.innerHTML.trim()) {
      _ocrBuildGrid(_ocrMotivos, 'ocr-motivos-grid', 'm');
      _ocrBuildGrid(_ocrCons, 'ocr-cons-grid', 'c');
    }

    _ocrPopularAlunos();
    const sel = document.getElementById('ocr-select-aluno');
    if (sel) sel.value = aluno.id ? _idAluno(aluno.id) : '';
    const nomeEl = document.getElementById('ocr-form-aluno-nome');
    if (nomeEl) nomeEl.textContent = aluno.nome_completo || nomeAluno || '';

    if (estavaVisivel) {
      _ocrResetForm();
    }
    if (!_ocrInicializado) {
      _ocrResetForm();
      _ocrInicializado = true;
    }

    document.getElementById('ocr-feed-view').style.display = 'none';
    document.getElementById('ocr-form-view').style.display = 'block';
  } catch(e) {
    console.error('[OCR] Erro ao abrir formulário:', e);
    mostrarToast('Erro ao abrir formulário de ocorrência.');
  }
}

function fecharFormOcorrencia() {
  document.getElementById('ocr-form-view').style.display = 'none';
  document.getElementById('ocr-feed-view').style.display = 'block';
  ocrRenderFeed();
}

async function ocrRenderFeed() {
  const el = document.getElementById('ocr-feed-list');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:13px;">Carregando ocorrências...</div>';
  try {
    const lista = await _ocrCarregarSupabase(null);
    if (!lista.length) {
      el.innerHTML = `<div style="text-align:center;padding:48px 20px;">
        <div style="font-size:32px;margin-bottom:12px;">📋</div>
        <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px;">Nenhuma ocorrência registrada</div>
        <div style="font-size:12px;color:var(--text-muted);">Clique em <strong>+ Nova ocorrência</strong> para registrar.</div>
      </div>`;
      return;
    }
    const _ocrMotMap = Object.fromEntries((_ocrMotivos||[]).map(([c,l]) => [String(c).padStart(2,'0'), l]));
    const _ocrConsMap = Object.fromEntries((_ocrCons||[]).map(([c,l]) => [String(c).padStart(2,'0'), l]));
    el.innerHTML = lista.map(o => {
      const dataAtoFmt = o.dataAto ? o.dataAto.split('-').reverse().join('/') : '—';
      const motivoLabel = (o.motivos||[]).map(c => c === '00' ? (o.outroMotivo || 'Outro') : (_ocrMotMap[c] || c)).join(', ');
      const consLabel = (o.consequencias||[]).map(c => c === '00' ? (o.outraCons || 'Outra') : (_ocrConsMap[c] || c)).join(', ');
      const obsPreview = o.obs ? o.obs.substring(0,80) + (o.obs.length > 80 ? '…' : '') : '';
      return `
      <div style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-radius:12px;border:1.5px solid #FBBFBF;background:#FFF8F8;margin-bottom:8px;transition:all 0.15s;" onmouseover="this.style.background='#FEE2E2'" onmouseout="this.style.background='#FFF8F8'">
        <div style="width:36px;height:36px;border-radius:50%;background:#FEE2E2;color:#B91C1C;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${o.alunoNome ? o.alunoNome.charAt(0) : '?'}</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px;">
            <span style="font-size:13px;font-weight:700;color:#B91C1C;">${o.alunoNome || '—'}</span>
            <span style="font-size:11px;color:var(--text-muted);">${dataAtoFmt}</span>
            ${motivoLabel ? `<span style="font-size:10px;font-weight:700;color:#B91C1C;background:#FEE2E2;padding:2px 7px;border-radius:20px;">${motivoLabel.substring(0,40)}${motivoLabel.length>40?'…':''}</span>` : ''}
          </div>
          ${consLabel ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:2px;">→ ${consLabel.substring(0,60)}${consLabel.length>60?'…':''}</div>` : ''}
          ${obsPreview ? `<div style="font-size:12px;color:var(--text-muted);line-height:1.5;">${obsPreview}</div>` : ''}
        </div>
        <button onclick="event.stopPropagation();ocrExcluir(${JSON.stringify(o.id)},'${o.alunoId}')" title="Excluir" style="padding:6px 8px;border-radius:7px;border:1.5px solid #FBBFBF;background:#fff;cursor:pointer;color:#DC2626;display:flex;align-items:center;flex-shrink:0;" onmouseover="this.style.background='#FEE2E2'" onmouseout="this.style.background='#fff'">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6m4-6v6"/></svg>
        </button>
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = `<div style="font-size:13px;color:#DC2626;text-align:center;padding:32px;">Erro ao carregar ocorrências.</div>`;
  }
}
