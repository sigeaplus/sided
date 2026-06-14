// SIDED+ — Aula listagem, filtros, layout e seleção

// Filtros ativos nas aulas
let aulasTriFiltro = 'todos';
let aulasTipoFiltro = 'todos'; // pendente | lecionada | futura | todos
let aulasDiscFiltro = null; // disciplina ativa no filtro de aulas (Fundamental I)
let _disciplinasAulasFundI = []; // disciplinas encontradas nas avaliações da turma (Fund I)
let aulasDiaSemFiltro = null; // 0=dom, 1=seg, ..., 6=sab | null = todos

async function _inicializarFiltroDiscAulas() {
  const box = document.getElementById('aulas-disciplina-filtro');
  const chips = document.getElementById('aulas-disciplina-chips');
  if (!box || !chips) return;

  if (!isFundamentalI()) {
    box.style.display = 'none';
    aulasDiscFiltro = null;
    _disciplinasAulasFundI = [];
    return;
  }

  const avais = await api(`avaliacoes?turma_id=eq.${turmaAtiva.id}&tipo=eq.normal&select=disciplina`) || [];
  const discs = [...new Set(avais.map(a => a.disciplina).filter(Boolean))].sort();
  _disciplinasAulasFundI = discs;

  if (discs.length === 0) { box.style.display = 'none'; return; }

  box.style.display = 'block';
  chips.innerHTML = [
    `<button onclick="filtrarAulasDisc(null,this)" style="padding:6px 14px;border-radius:20px;border:1.5px solid var(--purple);background:${!aulasDiscFiltro?'var(--purple)':'transparent'};color:${!aulasDiscFiltro?'#fff':'var(--purple)'};font-family:'Sora',sans-serif;font-size:12px;font-weight:600;cursor:pointer;" id="chip-disc-todas">Todas</button>`,
    ...discs.map(d => `<button onclick="filtrarAulasDisc('${d}',this)" style="padding:6px 14px;border-radius:20px;border:1.5px solid var(--border);background:${aulasDiscFiltro===d?'var(--purple)':'transparent'};color:${aulasDiscFiltro===d?'#fff':'var(--text)'};font-family:'Sora',sans-serif;font-size:12px;font-weight:600;cursor:pointer;" id="chip-disc-${d.replace(/\s+/g,'-')}">${d}</button>`)
  ].join('');
}

function filtrarAulasDisc(disc, btn) {
  aulasDiscFiltro = disc;
  document.querySelectorAll('[id^="chip-disc-"]').forEach(c => {
    const ativo = (disc === null && c.id === 'chip-disc-todas') || c.textContent === disc;
    c.style.background = ativo ? 'var(--purple)' : 'transparent';
    c.style.color = ativo ? '#fff' : (c.id === 'chip-disc-todas' ? 'var(--purple)' : 'var(--text)');
    c.style.borderColor = ativo ? 'var(--purple)' : 'var(--border)';
  });
  renderListaAulas();
}

function filtrarAulasDiaSem(dia, btn) {
  aulasDiaSemFiltro = dia;
  document.querySelectorAll('[id^="chip-diasem-"]').forEach(c => {
    const ativo = (dia === null && c.id === 'chip-diasem-todos') || (dia !== null && c.dataset.dia === String(dia));
    c.style.background = ativo ? 'var(--purple)' : 'transparent';
    c.style.color = ativo ? '#fff' : 'var(--text)';
    c.style.borderColor = ativo ? 'var(--purple)' : 'var(--border)';
  });
  renderListaAulas();
}
window.filtrarAulasDiaSem = filtrarAulasDiaSem;

function _inicializarFiltroDiaSemAulas() {
  const box = document.getElementById('aulas-diasem-filtro');
  if (!box) return;

  const diasLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const diasPresentes = new Set(
    (aulasTurma || []).map(a => {
      const iso = dataAulaOnly(a.data);
      if (!iso) return null;
      const d = new Date(iso + 'T12:00:00');
      return d.getDay();
    }).filter(d => d !== null)
  );

  if (diasPresentes.size === 0) { box.style.display = 'none'; return; }

  box.style.display = 'block';
  const chips = box.querySelector('#aulas-diasem-chips');
  if (!chips) return;
  chips.innerHTML = [
    `<button id="chip-diasem-todos" onclick="filtrarAulasDiaSem(null,this)"
      style="padding:6px 14px;border-radius:20px;border:1.5px solid ${aulasDiaSemFiltro===null?'var(--purple)':'var(--border)'};background:${aulasDiaSemFiltro===null?'var(--purple)':'transparent'};color:${aulasDiaSemFiltro===null?'#fff':'var(--text)'};font-family:'Sora',sans-serif;font-size:12px;font-weight:600;cursor:pointer;">Todos</button>`,
    ...[1,2,3,4,5,6,0].filter(d => diasPresentes.has(d)).map(d =>
      `<button id="chip-diasem-${d}" data-dia="${d}" onclick="filtrarAulasDiaSem(${d},this)"
        style="padding:6px 14px;border-radius:20px;border:1.5px solid ${aulasDiaSemFiltro===d?'var(--purple)':'var(--border)'};background:${aulasDiaSemFiltro===d?'var(--purple)':'transparent'};color:${aulasDiaSemFiltro===d?'#fff':'var(--text)'};font-family:'Sora',sans-serif;font-size:12px;font-weight:600;cursor:pointer;">${diasLabels[d]}</button>`
    )
  ].join('');
}
window._inicializarFiltroDiaSemAulas = _inicializarFiltroDiaSemAulas;

let aulasOrdemDesc = true;

function filtrarAulasTipo(el) {
  if (!el) return;
  aulasTipoFiltro = el.dataset.tipo || 'todos';
  ['todos','pendentes','lecionadas','futuras'].forEach(v => {
    const chip = document.getElementById('aulas-chip-' + v);
    if (chip) chip.classList.remove('active');
  });
  el.classList.add('active');
  renderListaAulas();
}

const TRI_DATAS = {
  1: { ini: '-02-04', fim: '-05-20' },
  2: { ini: '-05-21', fim: '-09-09' },
  3: { ini: '-09-10', fim: '-12-18' },
};

function dataAulaOnly(raw) {
  if (raw == null || raw === '') return '';
  const s = String(raw).trim();
  if (s.includes('T')) return s.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return s.slice(0, 10);
}

function trimestreDeAula(dataISO) {
  if (!dataISO) return 0;
  dataISO = dataAulaOnly(dataISO);
  const ano = dataISO.split('-')[0];
  for (let tri = 1; tri <= 3; tri++) {
    const ini = `${ano}${TRI_DATAS[tri].ini}`;
    const fim = `${ano}${TRI_DATAS[tri].fim}`;
    if (dataISO >= ini && dataISO <= fim) return tri;
  }
  return 0;
}

function toggleOrdemAulas() {
  aulasOrdemDesc = !aulasOrdemDesc;
  const ico = document.getElementById('ico-ordem-aulas');
  const label = document.getElementById('label-ordem-aulas');
  const btn = document.getElementById('btn-ordem-aulas');
  if (aulasOrdemDesc) {
    ico.innerHTML = '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="5 12 12 19 19 12"/>';
    label.textContent = 'Mais recente';
    btn.style.borderColor = 'var(--border)';
    btn.style.color = 'var(--text)';
  } else {
    ico.innerHTML = '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>';
    label.textContent = 'Mais antigo';
    btn.style.borderColor = 'var(--purple)';
    btn.style.color = 'var(--purple)';
  }
  renderListaAulas();
}

function filtrarAulasTri(el) {
  if (el) {
    aulasTriFiltro = el.dataset.tri;
    ['tri-todos','1','2','3'].forEach(v => {
      const chip = document.getElementById('aulas-chip-' + v);
      if (chip) chip.classList.remove('active');
    });
    el.classList.add('active');
  }
  renderListaAulas();
  atualizarContadorAulas();
}

function renderListaAulas() {
  let lista = [...aulasTurma];

  if (aulasTriFiltro && aulasTriFiltro !== 'todos') {
    lista = lista.filter(a => trimestreDeAula(a.data) === parseInt(aulasTriFiltro));
  }
  if (aulasTipoFiltro && aulasTipoFiltro !== 'todos') {
    lista = lista.filter(a => {
      const tc = chamadaCacheGet(a.id);
      const se = a.status === 'futura' ? 'futura'
        : tc === true ? 'lecionada'
        : tc === false ? 'pendente'
        : a.status;
      return se === aulasTipoFiltro;
    });
  }
  if (aulasDiscFiltro) {
    lista = lista.filter(a => a.disciplina === aulasDiscFiltro);
  }
  if (aulasDiaSemFiltro !== null) {
    lista = lista.filter(a => {
      const iso = dataAulaOnly(a.data);
      if (!iso) return false;
      const d = new Date(iso + 'T12:00:00');
      return d.getDay() === aulasDiaSemFiltro;
    });
  }

  lista.sort((a, b) => {
    const da = dataAulaOnly(a.data), db = dataAulaOnly(b.data);
    if (da < db) return aulasOrdemDesc ? 1 : -1;
    if (da > db) return aulasOrdemDesc ? -1 : 1;
    return 0;
  });

  const nomesTri = {1:'1º Tri', 2:'2º Tri', 3:'3º Tri'};
  const diasSem = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];

  function _card(a) {
    const tri = trimestreDeAula(a.data);
    const triBadge = tri ? `<span style="font-size:10px;font-weight:700;color:var(--orange);background:#FFF0E6;padding:2px 7px;border-radius:20px;">${nomesTri[tri]}</span>` : '';
    const temChamada = chamadaCacheGet(a.id);
    const temChamadaEfetivo = temChamada === true;
    const chamadaTag = a.status === 'futura'
      ? ''
      : temChamadaEfetivo
      ? `<span style="font-size:10px;font-weight:700;color:#166534;background:#DCFCE7;padding:2px 8px;border-radius:20px;display:inline-flex;align-items:center;gap:3px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>Chamada lançada</span>`
      : `<span style="font-size:10px;font-weight:700;color:#92400E;background:#FEF3C7;padding:2px 8px;border-radius:20px;display:inline-flex;align-items:center;gap:3px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Chamada pendente</span>`;

    const iso = dataAulaOnly(a.data);
    let diaSem = '', dataFmt = formatarData(a.data);
    if (iso) {
      const d = new Date(iso + 'T12:00:00');
      diaSem = diasSem[d.getDay()] || '';
    }

    const badgeCfg = {
      pendente:  { bg:'#FF8C38', label:'Chamada pendente' },
      lecionada: { bg:'#22C55E', label:'Frequência registrada' },
      futura:    { bg:'#3B82F6', label:'Aula futura' },
    };
    const statusEfetivo = a.status === 'futura' ? 'futura'
      : temChamada === true ? 'lecionada'
      : temChamada === false ? 'pendente'
      : a.status;
    const bc = badgeCfg[statusEfetivo] || { bg:'#9A8FC0', label: statusEfetivo };

    const selecionada = aulasSelecionadas.has(a.id);
    const checkboxHtml = modoSelecaoAulas ? `
      <div onclick="event.stopPropagation();toggleSelecaoAula('${a.id}')"
        style="width:22px;height:22px;border-radius:6px;border:2px solid ${selecionada ? 'var(--purple)' : 'var(--border)'};background:${selecionada ? 'var(--purple)' : 'var(--white)'};flex-shrink:0;display:flex;align-items:center;justify-content:center;cursor:pointer;">
        ${selecionada ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
      </div>` : '';

    const acoesBtns = modoSelecaoAulas ? '' : `
      <div class="aula-actions" onclick="event.stopPropagation()" style="display:flex;gap:5px;align-items:center;flex-shrink:0;">
        <button class="btn-icon" onclick="event.stopPropagation();editarAula('${a.id}')" title="Editar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon" onclick="event.stopPropagation();duplicarAula('${a.id}')" title="Copiar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        </button>
        <button class="btn-icon danger" onclick="event.stopPropagation();excluirAula('${a.id}')" title="Excluir">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
        </button>
      </div>`;

    const cardClick = modoSelecaoAulas ? `onclick="toggleSelecaoAula('${a.id}')"` : `onclick="abrirChamadaDeAula('${a.id}')"`;

    return `<div class="aula-card${selecionada ? ' selecionada' : ''}" ${cardClick}
      style="background:var(--white);border:1.5px solid var(--border);border-radius:12px;padding:14px 18px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:all 0.15s;margin-bottom:8px;${selecionada ? 'border-color:var(--purple);background:#F8F6FF;' : ''}">
      ${checkboxHtml}
      <div style="flex:1;min-width:0;">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px;">${diaSem}</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:14px;font-weight:700;color:var(--text);">${dataFmt}</span>
          <span style="font-size:13px;color:var(--purple);font-weight:600;">${a.nome}</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;">
          ${triBadge}${chamadaTag}
        </div>
      </div>
      <span style="background:${bc.bg};color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;white-space:nowrap;flex-shrink:0;">${bc.label}</span>
      ${acoesBtns}
    </div>`;
  }

  const grupos = { pendente: [], lecionada: [], futura: [] };
  lista.forEach(a => {
    const temChamada = chamadaCacheGet(a.id);
    const statusEfetivo = a.status === 'futura' ? 'futura'
      : temChamada === true ? 'lecionada'
      : temChamada === false ? 'pendente'
      : a.status;
    if (grupos[statusEfetivo]) grupos[statusEfetivo].push(a);
    else grupos['futura'].push(a);
  });

  const titulosGrupo = { pendente: 'Aulas pendentes', lecionada: 'Aulas lecionadas', futura: 'Aulas futuras' };
  const coresGrupo = { pendente: '#F59E0B', lecionada: '#22C55E', futura: '#3B82F6' };

  let html = '';
  const tiposFiltrados = (aulasTipoFiltro !== 'todos') ? [aulasTipoFiltro] : ['pendente','lecionada','futura'];

  tiposFiltrados.forEach(tipo => {
    const grupo = grupos[tipo] || [];
    if (grupo.length === 0) return;
    html += `<div style="margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <div style="width:10px;height:10px;border-radius:50%;background:${coresGrupo[tipo]};flex-shrink:0;"></div>
        <span style="font-size:13px;font-weight:700;color:var(--text);">${titulosGrupo[tipo]}</span>
        <span style="font-size:11px;color:var(--text-muted);font-weight:600;">(${grupo.length})</span>
        <div style="flex:1;height:1px;background:var(--border);"></div>
      </div>
      ${grupo.map(a => _card(a)).join('')}
    </div>`;
  });

  if (!html) {
    html = `<div style="text-align:center;padding:40px 20px;color:var(--text-muted);font-size:13px;">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="margin-bottom:12px;opacity:0.4;display:block;margin-inline:auto;"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      Nenhuma aula encontrada com esse filtro.
    </div>`;
  }

  document.getElementById('aulas-list').innerHTML = html;
}

function toggleModoSelecao() {
  modoSelecaoAulas = !modoSelecaoAulas;
  aulasSelecionadas.clear();
  const btn = document.getElementById('btn-modo-selecao');
  const barra = document.getElementById('barra-selecao');
  if (modoSelecaoAulas) {
    btn.style.background = 'var(--purple)';
    btn.style.color = '#fff';
    btn.style.borderColor = 'var(--purple)';
    barra.style.display = 'flex';
  } else {
    btn.style.background = 'var(--white)';
    btn.style.color = 'var(--text-muted)';
    btn.style.borderColor = 'var(--border)';
    barra.style.display = 'none';
  }
  atualizarContadorSelecao();
  renderListaAulas();
}

function toggleSelecaoAula(id) {
  if (aulasSelecionadas.has(id)) aulasSelecionadas.delete(id);
  else aulasSelecionadas.add(id);
  atualizarContadorSelecao();
  const card = document.querySelector(`.aula-card[onclick*="${id}"]`);
  if (card) {
    const sel = aulasSelecionadas.has(id);
    card.style.borderColor = sel ? 'var(--purple)' : '';
    card.style.background = sel ? '#F8F6FF' : '';
    const checkbox = card.querySelector('div[onclick]');
    if (checkbox) {
      checkbox.style.borderColor = sel ? 'var(--purple)' : 'var(--border)';
      checkbox.style.background = sel ? 'var(--purple)' : 'var(--white)';
      checkbox.innerHTML = sel ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : '';
    }
  }
}

function selecionarTodasAulas() {
  let lista = [...aulasTurma];
  if (aulasTriFiltro && aulasTriFiltro !== 'todos') {
    lista = lista.filter(a => trimestreDeAula(a.data) === parseInt(aulasTriFiltro));
  }
  const todasSelecionadas = lista.every(a => aulasSelecionadas.has(a.id));
  if (todasSelecionadas) {
    lista.forEach(a => aulasSelecionadas.delete(a.id));
  } else {
    lista.forEach(a => aulasSelecionadas.add(a.id));
  }
  atualizarContadorSelecao();
  renderListaAulas();
}

function atualizarContadorSelecao() {
  const n = aulasSelecionadas.size;
  const el = document.getElementById('selecao-count');
  if (el) el.textContent = `${n} selecionada${n !== 1 ? 's' : ''}`;
}

function limparSelecaoAulas() {
  aulasSelecionadas.clear();
  if (modoSelecaoAulas) toggleModoSelecao();
  else renderListaAulas();
}

function toggleMenuStatusSelecao() {
  const menu = document.getElementById('menu-status-selecao');
  if (!menu) return;
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', function(e) {
  const menu = document.getElementById('menu-status-selecao');
  const btn = document.getElementById('btn-mudar-status-sel');
  if (menu && btn && !btn.contains(e.target) && !menu.contains(e.target)) {
    menu.style.display = 'none';
  }
});

async function alterarStatusSelecionadas(novoStatus) {
  const menu = document.getElementById('menu-status-selecao');
  if (menu) menu.style.display = 'none';
  const n = aulasSelecionadas.size;
  if (n === 0) return;
  const labels = { lecionada: 'Lecionada', pendente: 'Pendente', futura: 'Futura' };
  if (!confirm(`Alterar status de ${n} aula${n > 1 ? 's' : ''} para "${labels[novoStatus]}"?`)) return;
  const ids = Array.from(aulasSelecionadas);
  await Promise.all(ids.map(id =>
    api(`aulas?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status: novoStatus }) })
  ));
  ids.forEach(id => {
    const aula = aulasTurma.find(a => String(a.id) === String(id));
    if (aula) aula.status = novoStatus;
  });
  cacheSalvar(turmaAtiva.id, 'aulas', aulasTurma);
  mostrarToast(`✓ ${n} aula${n > 1 ? 's' : ''} marcada${n > 1 ? 's' : ''} como ${labels[novoStatus]}!`);
  limparSelecaoAulas();
  renderListaAulas();
  atualizarContadorAulas();
  atualizarCalendario('cal-aula');
}

async function excluirAulasSelecionadas() {
  const n = aulasSelecionadas.size;
  if (n === 0) return;
  if (!confirm(`Excluir ${n} aula${n > 1 ? 's' : ''} selecionada${n > 1 ? 's' : ''}? Esta ação não pode ser desfeita.`)) return;
  const ids = Array.from(aulasSelecionadas);
  await Promise.all(ids.map(id => api(`aulas?id=eq.${id}`, { method: 'DELETE' })));
  const idSet = new Set(ids.map(String));
  window.aulasTurma = aulasTurma = aulasTurma.filter(a => !idSet.has(String(a.id)));
  ids.forEach(id => delete _chamadaCache[id]);
  cacheSalvar(turmaAtiva.id, 'aulas', aulasTurma);
  mostrarToast(`✓ ${n} aula${n > 1 ? 's' : ''} excluída${n > 1 ? 's' : ''}!`);
  limparSelecaoAulas();
  renderListaAulas();
  atualizarContadorAulas();
  atualizarCalendario('cal-aula');
}

async function duplicarAulasSelecionadas() {
  if (aulasSelecionadas.size === 0) return;
  const aulasIds = Array.from(aulasSelecionadas);
  window.aulasParaCopiar = aulasIds;
  await garantirTodasTurmas();
  if (!todasTurmas || todasTurmas.length === 0) {
    alert('Erro: Não foi possível carregar as turmas. Tente recarregar a página.');
    return;
  }
  const lista = document.getElementById('copiar-turmas-lista');

  // Inclui a turma atual como primeira opção
  const turmaAtualLabel = turmaAtiva ? `
    <label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1.5px solid var(--purple);border-radius:8px;background:#F8F6FF;cursor:pointer;margin-bottom:6px;">
        <input type="checkbox" value="_self" style="margin:0;">
        <div>
            <div style="font-size:13px;font-weight:600;color:var(--purple);">↩ Mesma turma (${turmaAtiva.nome})</div>
            <div style="font-size:11px;color:var(--text-muted);">Duplicar dentro desta turma</div>
        </div>
    </label>` : '';

  const turmasOutras = todasTurmas.filter(t => String(t.id) !== String(turmaAtiva.id));
  lista.innerHTML = turmaAtualLabel + turmasOutras.map(t => `
    <label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--white);cursor:pointer;margin-bottom:6px;">
        <input type="checkbox" value="${t.id}" style="margin:0;">
        <div>
            <div style="font-size:13px;font-weight:600;color:var(--text);">${t.nome}</div>
            <div style="font-size:11px;color:var(--text-muted);">${t.disciplina} - ${t.ano}º ano</div>
        </div>
    </label>
  `).join('');
  document.getElementById('copiar-aula-nome').textContent = `${aulasSelecionadas.size} aula${aulasSelecionadas.size > 1 ? 's' : ''} selecionada${aulasSelecionadas.size > 1 ? 's' : ''}`;
  const modalElSel = document.getElementById('modal-copiar-aula');
  if (modalElSel) {
    if (modalElSel.parentElement !== document.body) document.body.appendChild(modalElSel);
    modalElSel.classList.add('open');
  }
}

const _metaAulasCache = {};

async function _getMetaAulas(turmaId, tri) {
  const key = `${turmaId}::${tri}`;
  if (_metaAulasCache[key] !== undefined) return _metaAulasCache[key];
  const padrao = { 1: 67, 2: 67, 3: 66 };
  let v = padrao[tri];
  try {
    const meta = await api(`metas_aulas?turma_id=eq.${turmaId}&trimestre=eq.${tri}&select=total_aulas&limit=1`);
    if (meta && meta[0]) v = meta[0].total_aulas;
  } catch(e) { }
  _metaAulasCache[key] = v;
  return v;
}

async function atualizarContadorAulas() {
  let lista = [...aulasTurma];
  if (aulasTriFiltro && aulasTriFiltro !== 'todos') {
    lista = lista.filter(a => trimestreDeAula(a.data) === parseInt(aulasTriFiltro));
  }
  if (aulasDiscFiltro) {
    lista = lista.filter(a => a.disciplina === aulasDiscFiltro);
  }
  const lecionadas = lista.filter(a => {
    const temChamada = chamadaCacheGet(a.id);
    if (temChamada === true) return true;
    if (temChamada === false) return false;
    return a.status === 'lecionada';
  }).length;
  const totalCriadas = lista.length;
  const el = document.getElementById('counter-aulas');
  if (el) el.textContent = `${lecionadas} de ${totalCriadas}`;
}

function calcularStatusAuto(dataISO, aulaId) {
  if (!dataISO) return 'futura';
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const dataAula = new Date(dataAulaOnly(dataISO) + 'T00:00:00');
  if (dataAula > hoje) return 'futura';
  if (aulaId && chamadaCacheGet(aulaId) === true) return 'lecionada';
  if (aulaId && chamadaCacheGet(aulaId) === false) return 'pendente';
  if (aulaId) {
    const aulaLocal = aulasTurma.find(a => a.id === aulaId);
    if (aulaLocal && (aulaLocal.status === 'lecionada' || aulaLocal.status === 'pendente')) return aulaLocal.status;
  }
  return 'pendente';
}

function recalcularStatusLocal() {
  let mudou = false;
  aulasTurma.forEach(a => {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const dataAula = new Date(dataAulaOnly(a.data) + 'T00:00:00');
    let s;
    if (dataAula > hoje) {
      s = 'futura';
    } else if (chamadaCacheGet(a.id) === true) {
      s = 'lecionada';
    } else if (chamadaCacheGet(a.id) === false) {
      s = 'pendente';
    } else {
      s = (a.status === 'lecionada' || a.status === 'pendente') ? a.status : 'pendente';
    }
    if (a.status !== s) { a.status = s; mudou = true; }
  });
  if (mudou && turmaAtiva) cacheSalvar(turmaAtiva.id, 'aulas', aulasTurma);
}

// ═══════════════════════════════════════════════════════
// TOGGLE LAYOUT AULAS (lista ↔ grade)
// ═══════════════════════════════════════════════════════
let _layoutAulas = 'lista'; // 'lista' | 'grade'

function setLayoutAulas(modo) {
  _layoutAulas = modo;
  const btnLista = document.getElementById('btn-layout-lista-aulas');
  const btnGrade = document.getElementById('btn-layout-grade-aulas');
  if (btnLista) {
    btnLista.style.background = modo === 'lista' ? 'var(--purple)' : 'none';
    btnLista.style.color = modo === 'lista' ? '#fff' : 'var(--text-muted)';
  }
  if (btnGrade) {
    btnGrade.style.background = modo === 'grade' ? 'var(--purple)' : 'none';
    btnGrade.style.color = modo === 'grade' ? '#fff' : 'var(--text-muted)';
  }
  renderListaAulas();
}

const _renderListaAulasOriginal = renderListaAulas;
renderListaAulas = function() {
  _renderListaAulasOriginal();
  if (_layoutAulas === 'grade') _aplicarLayoutGradeAulas();
};

function _aplicarLayoutGradeAulas() {
  const el = document.getElementById('aulas-list');
  if (!el) return;
  el.querySelectorAll('.aula-card').forEach(card => {
    const parent = card.parentElement;
    if (parent && !parent.dataset.gradeAplicada) {
      parent.style.display = 'grid';
      parent.style.gridTemplateColumns = 'repeat(auto-fill, minmax(220px, 1fr))';
      parent.style.gap = '10px';
      parent.dataset.gradeAplicada = '1';
    }
    card.style.flexDirection = 'column';
    card.style.alignItems = 'flex-start';
    card.style.minHeight = '110px';
  });
}

// ══════════════════════════════════════════
// RESTAURADO DO professor_dashboard.html
// ══════════════════════════════════════════

function _atualizarInfoStatusModal() {
  const infoEl = document.getElementById('aula-status-info');
  const statusEl = document.getElementById('aula-status');
  const dataStr = document.getElementById('aula-data')?.value || '';
  const dataISO = parseDateBR(dataStr);
  const status = calcularStatusAuto(dataISO, editandoAulaId);

  if (statusEl) statusEl.value = status;
  if (!infoEl) return;

  const configs = {
    futura:   { bg: '#EFF6FF', border: '#BFDBFE', color: '#1E40AF', icone: '📅', texto: 'Aula <b>futura</b> — a data ainda não chegou.' },
    pendente: { bg: '#FFFBEB', border: '#FDE68A', color: '#92400E', icone: '⏳', texto: 'Aula <b>pendente</b> — data passada sem chamada lançada.' },
    lecionada:{ bg: '#F0FDF4', border: '#BBF7D0', color: '#166534', icone: '✅', texto: 'Aula <b>lecionada</b> — chamada já registrada.' },
  };

  if (!dataISO) {
    infoEl.style.cssText = 'background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:10px 14px;font-size:12px;color:#166534;line-height:1.6;margin-bottom:4px;';
    infoEl.innerHTML = '<strong>Classificação automática:</strong><br>• <b>Futura</b> — data após hoje<br>• <b>Pendente</b> — já passou, sem chamada lançada<br>• <b>Lecionada</b> — chamada lançada';
    return;
  }

  const c = configs[status] || configs.futura;
  infoEl.style.cssText = `background:${c.bg};border:1px solid ${c.border};border-radius:8px;padding:10px 14px;font-size:12px;color:${c.color};line-height:1.6;margin-bottom:4px;`;
  infoEl.innerHTML = `${c.icone} ${c.texto}`;
}

async function criarAulaParaData() {
  const dataISO = dataChamadaAtiva;
  if (!dataISO) return;
  const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  const [ano, mes, dia] = dataISO.split('-');
  const body = {
    data: dataISO,
    nome: `Aula de ${dia}/${mes}/${ano}`,
    descricao: '',
    status: 'lecionada',
    turma_id: turmaAtiva.id,
    turma_disciplina_id: turmaDisciplinaAtiva?.id || null,
    professor_id: profData.id
  };
  const res = await api('aulas', { method: 'POST', body: JSON.stringify(body) });
  const nova = (res && res[0]) ? res[0] : { ...body, id: Date.now() };
  aulasTurma.push(nova);
  chamadaCacheSet(nova.id, false);
  cacheSalvar(turmaAtiva.id, 'aulas', aulasTurma);
  await carregarChamadaPorData(dataISO);
}

// Alias para compatibilidade com onclick gerado no HTML
window.editarAula = function(aulaId) {
  const aula = aulasTurma.find(a => String(a.id) === String(aulaId));
  if (aula) {
    abrirModalAula(aula);
  } else {
    api(`aulas?id=eq.${aulaId}&select=*`).then(res => {
      if (res && res[0]) abrirModalAula(res[0]);
    });
  }
};

// Garante que todasTurmas está preenchido (recarrega se vazio)
async function garantirTodasTurmas() {
  if (todasTurmas && todasTurmas.length > 0) return;
  const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  if (!profData.id) return;
  if (typeof carregarTurmas === 'function') {
    await carregarTurmas(profData.id);
  }
}

let aulaParaCopiar = null;

window.duplicarAula = async function(aulaId) {
    try {
        if (typeof api !== 'function') {
            alert('Erro: Sistema ainda carregando. Aguarde e tente novamente.');
            return;
        }
        const aula = await api(`aulas?id=eq.${aulaId}&select=*`);
        if (!aula || !aula.length) throw new Error("Aula original não encontrada");
        const aulaOriginal = aula[0];
        await garantirTodasTurmas();
        if (!todasTurmas || todasTurmas.length === 0) {
            alert('Erro: Não foi possível carregar as turmas. Verifique sua conexão e tente recarregar a página.');
            return;
        }
        window.aulaParaCopiar = aulaOriginal;
        const lista = document.getElementById('copiar-turmas-lista');

        // Inclui a turma atual (mesma turma de origem) como primeira opção
        const turmaAtualLabel = turmaAtiva ? `
            <label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1.5px solid var(--purple);border-radius:8px;background:#F8F6FF;cursor:pointer;margin-bottom:6px;">
                <input type="checkbox" value="_self" style="margin:0;">
                <div>
                    <div style="font-size:13px;font-weight:600;color:var(--purple);">↩ Mesma turma (${turmaAtiva.nome})</div>
                    <div style="font-size:11px;color:var(--text-muted);">Duplicar dentro desta turma</div>
                </div>
            </label>` : '';

        const turmasOutras = todasTurmas.filter(t => String(t.id) !== String(aulaOriginal.turma_id));
        lista.innerHTML = turmaAtualLabel + turmasOutras.map(t => `
            <label style="display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--white);cursor:pointer;margin-bottom:6px;">
                <input type="checkbox" value="${t.id}" style="margin:0;">
                <div>
                    <div style="font-size:13px;font-weight:600;color:var(--text);">${t.nome}</div>
                    <div style="font-size:11px;color:var(--text-muted);">${t.disciplina} - ${t.ano}º ano</div>
                </div>
            </label>
        `).join('');
        document.getElementById('copiar-aula-nome').textContent = aulaOriginal.nome;
        const modalEl = document.getElementById('modal-copiar-aula');
        if (modalEl) {
            if (modalEl.parentElement !== document.body) document.body.appendChild(modalEl);
            modalEl.classList.add('open');
        }
    } catch (error) {
        alert('Erro ao preparar duplicação: ' + error.message);
    }
};

window.aulaParaCopiar = null;

window.confirmarCopiarAula = async function() {
    const checkboxes = document.querySelectorAll('#copiar-turmas-lista input[type="checkbox"]:checked');
    if (!checkboxes.length) {
        if (typeof mostrarToast === 'function') mostrarToast('Selecione pelo menos uma turma.');
        return;
    }
    const aulasParaCopiar = window.aulasParaCopiar || (window.aulaParaCopiar ? [window.aulaParaCopiar.id] : []);
    if (!aulasParaCopiar.length) {
        if (typeof mostrarToast === 'function') mostrarToast('Erro: Nenhuma aula selecionada.');
        return;
    }
    const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
    const btn = document.getElementById('btn-confirmar-copia');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span style="display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:spin 0.6s linear infinite;margin-right:6px;"></span>Copiando...';
    }
    try {
        const copias = [];
        let copiaNaMesmaTurma = false;
        for (const aulaId of aulasParaCopiar) {
            let aulaOriginal = window.aulaParaCopiar;
            if (!aulaOriginal || String(aulaOriginal.id) !== String(aulaId)) {
                const aulaData = await api(`aulas?id=eq.${aulaId}&select=*`);
                if (aulaData && aulaData.length) aulaOriginal = aulaData[0];
                else continue;
            }
            for (const cb of Array.from(checkboxes)) {
                const isSelf = cb.value === '_self';
                const turmaDestinoId = isSelf ? (typeof turmaAtiva !== 'undefined' ? turmaAtiva.id : null) : cb.value;
                if (!turmaDestinoId) continue;
                if (isSelf) copiaNaMesmaTurma = true;
                copias.push({
                    data: typeof dataAulaOnly === 'function' ? dataAulaOnly(aulaOriginal.data) : aulaOriginal.data,
                    nome: aulaOriginal.nome,
                    descricao: aulaOriginal.descricao || '',
                    status: 'futura',
                    turma_id: turmaDestinoId,
                    turma_disciplina_id: isSelf ? (turmaDisciplinaAtiva?.id || null) : null,
                    professor_id: profData.id,
                    ...(aulaOriginal.habilidade_bncc ? { habilidade_bncc: aulaOriginal.habilidade_bncc } : {}),
                    ...(isSelf && aulaOriginal.disciplina ? { disciplina: aulaOriginal.disciplina } : {}),
                });
            }
        }
        const res = await api('aulas', { method: 'POST', body: JSON.stringify(copias) });
        // Se copiou na mesma turma, atualizar cache local imediatamente
        if (copiaNaMesmaTurma && res && Array.isArray(res)) {
            res.filter(a => String(a.turma_id) === String(turmaAtiva?.id)).forEach(a => {
                aulasTurma.push(a);
                if (typeof chamadaCacheSet === 'function') chamadaCacheSet(a.id, false);
            });
            if (typeof cacheSalvar === 'function') cacheSalvar(turmaAtiva.id, 'aulas', aulasTurma);
        }
        const modal = document.getElementById('modal-copiar-aula');
        if (modal) modal.classList.remove('open');
        if (typeof mostrarToast === 'function') {
            mostrarToast(`✓ ${copias.length} aula${copias.length > 1 ? 's' : ''} copiada${copias.length > 1 ? 's' : ''}!`);
        }
        window.aulaParaCopiar = null;
        window.aulasParaCopiar = null;
        if (modoSelecaoAulas) { modoSelecaoAulas = false; limparSelecaoAulas(); }
        if (typeof carregarAulas === 'function') await carregarAulas();
    } catch(e) {
        console.error("Erro ao copiar no SIDED+:", e);
        if (typeof mostrarToast === 'function') mostrarToast('Erro ao copiar: ' + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copiar';
        }
    }
};

// ── carregarAulas ────────────────────────────────────────────────────────────
async function carregarAulas(forcarReload = false) {
  if (forcarReload) cacheInvalidar(turmaAtiva.id);
  const _tdIdAulas = turmaDisciplinaAtiva?.id;
  window.aulasTurma = aulasTurma = await apiCached(
    _tdIdAulas
      ? `aulas?turma_disciplina_id=eq.${_tdIdAulas}&select=*&order=data`
      : `aulas?turma_id=eq.${turmaAtiva.id}&professor_id=eq.${JSON.parse(sessionStorage.getItem('prof_data')||'{}').id}&select=*&order=data`,
    turmaAtiva.id, 'aulas', 30000
  );
  await sincronizarCachesChamada();
  recalcularStatusLocal();
  _inicializarFiltroDiaSemAulas();
  renderListaAulas();
  atualizarContadorAulas();
  atualizarCalendario('cal-aula');
}

// ── sincronizarCachesChamada ─────────────────────────────────────────────────
let _syncChamadaPromise = null;
async function sincronizarCachesChamada() {
  if (_syncChamadaPromise) return _syncChamadaPromise;
  _syncChamadaPromise = _sincronizarCachesChamadaExec().finally(() => { _syncChamadaPromise = null; });
  return _syncChamadaPromise;
}
async function _sincronizarCachesChamadaExec() {
  if (!aulasTurma.length) return;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const aulasPassadas = aulasTurma.filter(a => {
    const d = new Date(dataAulaOnly(a.data) + 'T00:00:00');
    return d <= hoje;
  });
  if (!aulasPassadas.length) return;
  const ids = aulasPassadas.map(a => a.id);
  const LOTE = 25;
  try {
    for (let i = 0; i < ids.length; i += LOTE) {
      const loteIds = ids.slice(i, i + LOTE);
      const registros = await api(`chamadas?aula_id=in.(${loteIds.join(',')})&select=aula_id&limit=5000`) || [];
      const comChamada = new Set(registros.map(r => r.aula_id));
      loteIds.forEach(id => { chamadaCacheSet(id, comChamada.has(id) ? true : false); });
    }
  } catch(e) { /* sem cache, não bloqueia */ }
}
// ═══════════════════════════════════════════════════════════════════════════
// PATCH aulas.js  — Multi Aulas + Renomear campos (TEMA / DESCRIÇÃO / BNCC)
// Aplique este bloco ao final do seu aulas.js (ou substitua as funções indicadas)
// ═══════════════════════════════════════════════════════════════════════════

// ─── 1. PATCH: abrirModalAula — renomeia labels e adiciona campo BNCC ───────
//  Substitua a função abrirModalAula original por esta:
window.abrirModalAula = function(data) {
  editandoAulaId = data?.id || null;
  document.getElementById('modal-aula-title').textContent = editandoAulaId ? 'Editar aula' : 'Nova aula';
  document.getElementById('aula-data').value = data ? formatarData(data.data) : '';
  document.getElementById('aula-nome').value = data?.nome || '';
  document.getElementById('aula-desc').value = data?.descricao || '';
  document.getElementById('aula-status').value = data ? calcularStatusAuto(data.data, data.id) : 'futura';
  document.getElementById('aula-alert').style.display = 'none';

  // Campo BNCC
  const bnccInput = document.getElementById('aula-bncc');
  if (bnccInput) bnccInput.value = data?.habilidade_bncc || '';
  _limparBnccResultado();

  const campoDisc = document.getElementById('aula-campo-disciplina');
  const selDisc = document.getElementById('aula-disciplina');
  if (isFundamentalI() && campoDisc && selDisc) {
    campoDisc.style.display = 'block';
    const discs = _disciplinasAulasFundI || [];
    selDisc.innerHTML = '<option value="">Selecione a disciplina...</option>' +
      discs.map(d => `<option value="${d}"${data?.disciplina === d ? ' selected' : ''}>${d}</option>`).join('');
    if (!data && aulasDiscFiltro) selDisc.value = aulasDiscFiltro;
  } else if (campoDisc) {
    campoDisc.style.display = 'none';
  }

  _atualizarInfoStatusModal();
  const inp = document.getElementById('aula-data');
  if (inp) inp.oninput = function() {
    _atualizarInfoStatusModal();
    if (typeof onDateInput === 'function') onDateInput(this, 'cal-aula');
  };
  document.getElementById('modal-aula').classList.add('open');
  atualizarCalendario('cal-aula');
};

// ─── 2. PATCH: salvarAula — inclui habilidade_bncc no body ─────────────────
//  Substitua a função salvarAula original por esta:
window.salvarAula = async function() {
  const tri = detectarTrimestreAtual().tri;
  if (await verificarBloqueio(tri)) return;
  const btn = document.getElementById('btn-salvar-aula');
  btn.disabled = true;
  const alEl = document.getElementById('aula-alert');
  alEl.style.display = 'none';

  const dataStr = document.getElementById('aula-data').value;
  const nome = document.getElementById('aula-nome').value.trim(); // TEMA → salvo como nome
  if (!dataStr || !nome) {
    alEl.textContent = 'Data e tema são obrigatórios.';
    alEl.style.display = 'block';
    btn.disabled = false;
    return;
  }
  const descricao = document.getElementById('aula-desc').value.trim(); // DESCRIÇÃO → salvo como descricao
  if (!descricao) {
    alEl.textContent = 'A descrição é obrigatória.';
    alEl.style.display = 'block';
    btn.disabled = false;
    return;
  }
  const dataISO = parseDateBR(dataStr);
  if (!dataISO) {
    alEl.textContent = 'Data inválida. Use DD/MM/AAAA.';
    alEl.style.display = 'block';
    btn.disabled = false;
    return;
  }
  const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  const statusAuto = calcularStatusAuto(dataISO, editandoAulaId);
  const discVal = isFundamentalI() ? (document.getElementById('aula-disciplina')?.value || null) : null;
  const bnccVal = document.getElementById('aula-bncc')?.value.trim() || null;

  const body = {
    data: dataISO,
    nome,
    descricao,
    status: statusAuto,
    turma_id: turmaAtiva.id,
    turma_disciplina_id: turmaDisciplinaAtiva?.id || null,
    professor_id: profData.id,
    ...(discVal ? { disciplina: discVal } : {}),
    ...(bnccVal ? { habilidade_bncc: bnccVal } : { habilidade_bncc: null }),
  };

  try {
    if (editandoAulaId) {
      await api(`aulas?id=eq.${editandoAulaId}`, { method: 'PATCH', body: JSON.stringify(body) });
      const idx = aulasTurma.findIndex(a => a.id === editandoAulaId);
      if (idx !== -1) aulasTurma[idx] = { ...aulasTurma[idx], ...body };
    } else {
      const res = await api('aulas', { method: 'POST', body: JSON.stringify(body) });
      const nova = (res && res[0]) ? res[0] : { ...body, id: Date.now() };
      aulasTurma.push(nova);
      chamadaCacheSet(nova.id, false);
    }
    cacheSalvar(turmaAtiva.id, 'aulas', aulasTurma);
    fecharModal('modal-aula');
    renderListaAulas();
    atualizarContadorAulas();
    atualizarCalendario('cal-aula');
  } catch (e) {
    alEl.textContent = 'Erro ao salvar.';
    alEl.style.display = 'block';
  }
  btn.disabled = false;
};

// ─── 3. BNCC helpers ────────────────────────────────────────────────────────
function _limparBnccResultado() {
  const el = document.getElementById('bncc-resultado');
  if (el) el.style.display = 'none';
  _bnccFecharDropdown();
}

// ── Cache local das habilidades do plano ──────────────────────────────────────
let _bnccCache = null;
let _bnccCacheTurma = null;

async function _bnccCarregarCache() {
  if (_bnccCache && _bnccCacheTurma === turmaAtiva?.id) return _bnccCache;
  try {
    const rows = await api(`plano_bncc?turma_id=eq.${turmaAtiva?.id}&order=codigo.asc&limit=100`);
    _bnccCache = rows || [];
    _bnccCacheTurma = turmaAtiva?.id;
  } catch (_) {
    _bnccCache = [];
  }
  return _bnccCache;
}

window._bnccInvalidarCache = function() {
  _bnccCache = null;
  _bnccCacheTurma = null;
};

// ── Autocomplete dropdown ─────────────────────────────────────────────────────
let _bnccDropdownEl = null;

function _bnccCriarDropdown() {
  if (_bnccDropdownEl) return _bnccDropdownEl;
  const inp = document.getElementById('aula-bncc');
  if (!inp) return null;
  const d = document.createElement('div');
  d.id = 'bncc-autocomplete-dropdown';
  d.style.cssText = `
    position:absolute;z-index:9999;background:var(--white);
    border:1.5px solid var(--border);border-radius:10px;
    box-shadow:0 8px 24px rgba(0,0,0,0.12);
    max-height:220px;overflow-y:auto;min-width:100%;
    top:calc(100% + 4px);left:0;
  `;
  const wrap = inp.parentElement;
  if (wrap && getComputedStyle(wrap).position === 'static') {
    wrap.style.position = 'relative';
  }
  wrap?.appendChild(d);
  _bnccDropdownEl = d;
  return d;
}

window._bnccFecharDropdown = function() {
  if (_bnccDropdownEl) {
    _bnccDropdownEl.remove();
    _bnccDropdownEl = null;
  }
};

function _bnccRenderDropdown(itens) {
  const d = _bnccCriarDropdown();
  if (!d) return;
  if (!itens.length) { _bnccFecharDropdown(); return; }
  d.innerHTML = itens.map(h => `
    <div style="padding:9px 12px;cursor:pointer;border-bottom:1px solid var(--border);transition:background 0.1s;"
      onmouseenter="this.style.background='#F0F4FF'"
      onmouseleave="this.style.background=''"
      onclick="(function(){
        var inp=document.getElementById('aula-bncc');
        if(inp){inp.value='${(h.codigo||'').replace(/'/g,"\'")}';inp.dispatchEvent(new Event('input'));}
        _bnccFecharDropdown();
        buscarBNCC();
      })()">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="padding:2px 8px;border-radius:20px;background:#EEF2FF;color:#3B4FE4;font-size:11px;font-weight:700;font-family:'Space Mono',monospace;flex-shrink:0;">${h.codigo||'—'}</span>
        <span style="font-size:12px;color:var(--text);line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${(h.descricao||'').replace(/</g,'&lt;')}</span>
      </div>
    </div>`).join('');
}

function _bnccFiltrarLocal(habs, query) {
  const q = query.toLowerCase();
  return habs.filter(h =>
    (h.codigo||'').toLowerCase().includes(q) ||
    (h.descricao||'').toLowerCase().includes(q)
  ).slice(0, 8);
}

// ── Debounce autocomplete ─────────────────────────────────────────────────────
let _bnccDebounce = null;

window.onBnccInput = async function() {
  clearTimeout(_bnccDebounce);
  const query = (document.getElementById('aula-bncc')?.value || '').trim();
  if (query.length < 2) { _bnccFecharDropdown(); return; }
  _bnccDebounce = setTimeout(async () => {
    const habs = await _bnccCarregarCache();
    const filtrados = _bnccFiltrarLocal(habs, query);
    _bnccRenderDropdown(filtrados);
  }, 300);
};

// ── buscarBNCC principal ──────────────────────────────────────────────────────
window.buscarBNCC = async function() {
  const query = (document.getElementById('aula-bncc')?.value || '').trim();
  if (!query) return;

  _bnccFecharDropdown();
  const resultEl = document.getElementById('bncc-resultado');
  const loadEl   = document.getElementById('bncc-loading');
  const loadMsg  = document.getElementById('bncc-loading-msg');
  if (resultEl) resultEl.style.display = 'none';
  if (loadEl)   loadEl.style.display = 'flex';
  if (loadMsg)  loadMsg.textContent = 'Buscando no plano...';

  let encontrado = null;

  // 1º — busca por código OU descrição (texto livre)
  try {
    const q = encodeURIComponent(query);
    const rows = await api(
      `plano_bncc?turma_id=eq.${turmaAtiva?.id}&or=(codigo.ilike.*${q}*,descricao.ilike.*${q}*)&limit=3`
    );
    if (rows?.length) {
      encontrado = rows.map(r => ({ codigo: r.codigo, descricao: r.descricao, contexto: r.contexto, fonte: 'plano' }));
    }
  } catch (_) {}

  // 2º — busca semântica via IA
  if (!encontrado) {
    try {
      const habs = await _bnccCarregarCache();
      if (habs.length) {
        if (loadMsg) loadMsg.textContent = 'Buscando com IA...';
        const resultado = await _bnccBuscarComIA(query, habs);
        if (resultado?.length) {
          encontrado = resultado.map(r => ({ ...r, fonte: 'ia' }));
        }
      }
    } catch (_) {}
  }

  if (loadEl) loadEl.style.display = 'none';
  if (!resultEl) return;
  resultEl.style.display = 'block';

  if (encontrado?.length) {
    const isIA = encontrado[0].fonte === 'ia';
    resultEl.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:${isIA ? '#5B21B6' : '#166534'};margin-bottom:8px;">
        ${isIA ? '✨ Sugestão da IA a partir do plano de curso' : '📄 Encontrado no plano de curso'}
      </div>
      ${encontrado.map(h => `
        <div style="padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--white);margin-bottom:6px;">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
            <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;">
              <span style="padding:2px 8px;border-radius:20px;background:#EEF2FF;color:#3B4FE4;font-size:11px;font-weight:700;font-family:'Space Mono',monospace;flex-shrink:0;">${h.codigo||'—'}</span>
              <span style="font-size:12px;color:var(--text);line-height:1.4;">${(h.descricao||'—').replace(/</g,'&lt;')}</span>
            </div>
            <button onclick="document.getElementById('aula-bncc').value='${(h.codigo||'').replace(/'/g,"\'")}';document.getElementById('bncc-resultado').style.display='none';"
              style="padding:4px 11px;border-radius:6px;border:1.5px solid #22C55E;background:#F0FDF4;color:#166534;font-family:'Sora',sans-serif;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;"
              onmouseover="this.style.background='#22C55E';this.style.color='#fff'"
              onmouseout="this.style.background='#F0FDF4';this.style.color='#166534'">
              Usar
            </button>
          </div>
          ${h.contexto ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;border-left:2px solid var(--border);padding-left:8px;line-height:1.5;font-style:italic;">${String(h.contexto).replace(/</g,'&lt;')}</div>` : ''}
        </div>`).join('')}`;
  } else {
    resultEl.innerHTML = `
      <div style="font-size:11px;font-weight:700;color:#92400E;margin-bottom:4px;">🔎 Não encontrado no plano</div>
      <a href="https://www.google.com/search?q=BNCC+habilidade+${encodeURIComponent(query)}" target="_blank"
        style="font-size:12px;color:var(--purple);font-weight:600;text-decoration:underline;">
        Pesquisar "${query}" na BNCC via Google →
      </a>`;
  }
};

// ── Busca semântica via Gemini ────────────────────────────────────────────────
async function _bnccBuscarComIA(query, habilidades) {
  const key = typeof GEMINI_KEY !== 'undefined' ? GEMINI_KEY : '';
  if (!key) return null;

  const lista = habilidades.map(h => `${h.codigo}: ${h.descricao}`).join('\n');
  const prompt = `Você é um assistente de busca de habilidades BNCC.
Dado um termo de busca e uma lista de habilidades, retorne as 1-2 habilidades mais relevantes.
Retorne SOMENTE JSON válido, sem markdown:
[{"codigo":"EFxxMAxx","descricao":"...","contexto":"por que é relevante em 1 frase"}]
Se nenhuma for relevante, retorne [].

Termo buscado: "${query}"

Habilidades disponíveis no plano:
${lista}

Retorne as mais relevantes.`;

  const MODELOS = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
  ];

  let data = null;
  for (const modelo of MODELOS) {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 300 }
        })
      }
    );
    if (resp.ok) { data = await resp.json(); break; }
    console.warn('[BNCC IA] Modelo', modelo, 'falhou:', resp.status);
  }
  if (!data) return null;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const clean = _geminiExtrairJSON(text, true);
  if (!clean) return null;
  const parsed = JSON.parse(clean);
  return Array.isArray(parsed) && parsed.length ? parsed : null;
}

// ── Fechar dropdown ao clicar fora ────────────────────────────────────────────
document.addEventListener('click', function(e) {
  if (!e.target.closest('#aula-bncc') && !e.target.closest('#bncc-autocomplete-dropdown')) {
    _bnccFecharDropdown();
  }
}, true);

// ── Hook: invalida cache ao reprocessar plano ─────────────────────────────────
(function() {
  const origReprocessar = window.reprocessarPlanoIA;
  window.reprocessarPlanoIA = async function(...args) {
    window._bnccInvalidarCache();
    if (origReprocessar) return origReprocessar.apply(this, args);
  };
})();

// ─── 4. MULTI AULAS ─────────────────────────────────────────────────────────
window.abrirMultiAulas = async function() {
  try {
    if (typeof window._fecharMenuPontinhos === 'function') window._fecharMenuPontinhos('aulas');
    if (!turmaAtiva) {
      if (typeof mostrarToast === 'function') mostrarToast('Selecione uma turma primeiro.');
      return;
    }
    // Garantir que aulasTurma está populado (pode estar vazio se veio direto pelo menu ⋮)
    if (!aulasTurma || aulasTurma.length === 0) {
      if (typeof mostrarToast === 'function') mostrarToast('Carregando aulas...');
      await carregarAulas();
    }
    const modal = document.getElementById('modal-multi-aulas');
    if (!modal) return;
    document.getElementById('multi-aulas-tema').value = '';
    document.getElementById('multi-aulas-desc').value = '';
    document.getElementById('multi-aulas-bncc').value = '';
    document.getElementById('multi-aulas-datas').innerHTML = '';
    document.getElementById('multi-aulas-alert').style.display = 'none';
    window._adicionarLinhaDataMulti();
    modal.classList.add('open');
  } catch(e) {
    console.error('[MultiAulas] abrirMultiAulas:', e);
    if (typeof mostrarToast === 'function') mostrarToast('Erro ao abrir multi aulas: ' + e.message);
  }
};

window._adicionarLinhaDataMulti = function() {
  const container = document.getElementById('multi-aulas-datas');
  if (!container) return;

  // Verificar limite fixo de datas
  const linhas = container.querySelectorAll('.multi-data-row');
  const LIMITE_MAXIMO = 100;
  if (linhas.length >= LIMITE_MAXIMO) {
    if (typeof mostrarToast === 'function') mostrarToast(`Limite de ${LIMITE_MAXIMO} datas atingido.`);
    return;
  }

  const idx = Date.now();
  const row = document.createElement('div');
  row.className = 'multi-data-row';
  row.dataset.id = idx;
  row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';
  row.innerHTML = `
    <input type="text" placeholder="DD/MM/AAAA" maxlength="10"
      oninput="this.value=this.value.replace(/[^0-9\/]/g,'');if(this.value.length===2&&!this.value.includes('/'))this.value+='/';if(this.value.length===5&&this.value.split('/').length<3)this.value+='/';"
      style="flex:1;padding:9px 12px;background:#F8F6FF;border:1.5px solid var(--border);border-radius:8px;font-family:'Sora',sans-serif;font-size:13px;color:var(--text);outline:none;transition:border-color 0.2s;"
      onfocus="this.style.borderColor='var(--purple)'" onblur="this.style.borderColor='var(--border)'"/>
    <button onclick="this.closest('.multi-data-row').remove()"
      style="width:30px;height:30px;border-radius:7px;border:1px solid var(--border);background:none;color:var(--danger);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;"
      title="Remover">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;
  container.appendChild(row);
};

window.salvarMultiAulas = async function() {
  const alEl = document.getElementById('multi-aulas-alert');
  if (!alEl) return;
  alEl.style.display = 'none';

  try {
    // Validações de campos
    const tema = document.getElementById('multi-aulas-tema').value.trim();
    const desc = document.getElementById('multi-aulas-desc').value.trim();
    const bncc = document.getElementById('multi-aulas-bncc').value.trim() || null;

    if (!tema) { alEl.textContent = 'O tema é obrigatório.'; alEl.style.display = 'block'; return; }
    if (!desc) { alEl.textContent = 'A descrição é obrigatória.'; alEl.style.display = 'block'; return; }
    if (!turmaAtiva) { alEl.textContent = 'Nenhuma turma selecionada.'; alEl.style.display = 'block'; return; }

    const inputs = document.querySelectorAll('#multi-aulas-datas .multi-data-row input');
    const datasISO = [];
    for (const inp of inputs) {
      const iso = parseDateBR(inp.value.trim());
      if (!iso) { alEl.textContent = `Data inválida: "${inp.value}". Use DD/MM/AAAA.`; alEl.style.display = 'block'; return; }
      datasISO.push(iso);
    }
    if (datasISO.length === 0) { alEl.textContent = 'Adicione pelo menos uma data.'; alEl.style.display = 'block'; return; }

    const btn = document.getElementById('btn-salvar-multi-aulas');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
    const aulasPayload = datasISO.map(dataISO => ({
      data: dataISO,
      nome: tema,
      descricao: desc,
      status: calcularStatusAuto(dataISO, null),
      turma_id: turmaAtiva.id,
      turma_disciplina_id: turmaDisciplinaAtiva?.id || null,
      professor_id: profData.id,
      ...(bncc ? { habilidade_bncc: bncc } : {}),
    }));

    const res = await api('aulas', { method: 'POST', body: JSON.stringify(aulasPayload) });
    const criadas = Array.isArray(res) ? res : aulasPayload.map((a, i) => ({ ...a, id: Date.now() + i }));
    criadas.forEach(a => {
      aulasTurma.push(a);
      if (typeof chamadaCacheSet === 'function') chamadaCacheSet(a.id, false);
    });
    if (typeof cacheSalvar === 'function') cacheSalvar(turmaAtiva.id, 'aulas', aulasTurma);
    fecharModal('modal-multi-aulas');
    if (typeof renderListaAulas === 'function') renderListaAulas();
    if (typeof atualizarContadorAulas === 'function') atualizarContadorAulas();
    if (typeof atualizarCalendario === 'function') atualizarCalendario('cal-aula');
    if (typeof mostrarToast === 'function') mostrarToast(`✓ ${criadas.length} aula${criadas.length > 1 ? 's' : ''} criada${criadas.length > 1 ? 's' : ''}!`);

    btn.disabled = false;
    btn.textContent = 'Criar aulas';
  } catch(e) {
    console.error('[MultiAulas] salvarMultiAulas:', e);
    alEl.textContent = 'Erro ao salvar as aulas: ' + e.message;
    alEl.style.display = 'block';
    const btn = document.getElementById('btn-salvar-multi-aulas');
    if (btn) { btn.disabled = false; btn.textContent = 'Criar aulas'; }
  }
};

// ─── 5. MENU ⋯ (três pontinhos) ─────────────────────────────────────────────
window.toggleMenuPontinhos = function(secao, btn) {
  const menuId = `menu-pontinhos-${secao}`;
  let menu = document.getElementById(menuId);
  if (!menu) return;
  const aberto = menu.style.display === 'block';
  // Fechar todos
  document.querySelectorAll('[id^="menu-pontinhos-"]').forEach(m => m.style.display = 'none');
  if (!aberto) {
    menu.style.display = 'block';
    // posicionar abaixo do botão
    const rect = btn.getBoundingClientRect();
    menu.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    menu.style.left = (rect.left + window.scrollX - menu.offsetWidth + btn.offsetWidth) + 'px';
  }
};

window._fecharMenuPontinhos = function(secao) {
  const menu = document.getElementById(`menu-pontinhos-${secao}`);
  if (menu) menu.style.display = 'none';
};

// Fechar menus ao clicar fora
document.addEventListener('click', function(e) {
  document.querySelectorAll('[id^="menu-pontinhos-"]').forEach(menu => {
    const btnId = menu.dataset.btnId;
    const btn = btnId ? document.getElementById(btnId) : null;
    if (!menu.contains(e.target) && (!btn || !btn.contains(e.target))) {
      menu.style.display = 'none';
    }
  });
});
