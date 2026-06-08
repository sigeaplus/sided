// SIDED+ — Chamada de Presença

// ── ESTADO LOCAL ─────────────────────────────────────────────────────────────
let dataChamadaAtiva = null;
let _modoInversoChamada = false;
let _faltasPorAlunoAtual = {};

function mudarDataChamada(delta) {
  const inp = document.getElementById('chamada-date-input');
  // parse DD/MM/AAAA or fallback to today
  let d;
  const m = (inp.value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    d = new Date(`${m[3]}-${m[2]}-${m[1]}T12:00:00`);
  } else {
    d = new Date();
  }
  d.setDate(d.getDate() + delta);
  const iso = d.toISOString().split('T')[0];
  const [y, mo, dy] = iso.split('-');
  inp.value = `${dy}/${mo}/${y}`;
  // sync calendar state
  calState['cal-chamada'] = { ano: parseInt(y), mes: parseInt(mo) - 1 };
  atualizarCalendario('cal-chamada');
  // limpar seleção de aula ao trocar de data
  const btnWrap = document.getElementById('btn-salvar-chamada-wrap');
  if (btnWrap) btnWrap._aulaId = null;
  carregarChamadaPorData(iso);
}

function selecionarDataChamada(iso) {
  const [y, mo, dy] = iso.split('-');
  document.getElementById('chamada-date-input').value = `${dy}/${mo}/${y}`;
  calState['cal-chamada'] = { ano: parseInt(y), mes: parseInt(mo) - 1 };
  atualizarCalendario('cal-chamada');
  // limpar seleção de aula ao trocar de data
  const btnWrap = document.getElementById('btn-salvar-chamada-wrap');
  if (btnWrap) btnWrap._aulaId = null;
  carregarChamadaPorData(iso);
}

async function carregarChamadaHoje() {
  const hoje = new Date().toISOString().split('T')[0];
  const [y, mo, dy] = hoje.split('-');
  const inp = document.getElementById('chamada-date-input');
  inp.value = `${dy}/${mo}/${y}`;
  calState['cal-chamada'] = { ano: parseInt(y), mes: parseInt(mo) - 1 };
  await atualizarCalendario('cal-chamada');
  await carregarChamadaPorData(hoje);
}

function irParaHojeChamada() {
  const hoje = new Date().toISOString().split('T')[0];
  selecionarDataChamada(hoje);
}

async function carregarChamadaPorData(dataISO) {
  dataChamadaAtiva = dataISO;
  chamadaTemp = {};
  const aviso = document.getElementById('chamada-aviso');
  const secao = document.getElementById('chamada-secao');
  const btnWrap = document.getElementById('btn-salvar-chamada-wrap');

  document.getElementById('chamada-status-label').textContent = '';

  // verificar calendário da escola — reutiliza feriadosCache (preenchido pelo calendário)
  const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  const escolaId = profData.escolas?.id || profData.escola_id;
  let eventosDia = [];
  if (escolaId) {
    // Usa feriadosCache se já preenchido, senão busca uma única vez
    if (!feriadosCache.length) {
      feriadosCache = await api(`calendario_escolar?escola_id=eq.${escolaId}&select=*`) || [];
    }
    eventosDia = feriadosCache.filter(e => {
      const fim = e.data_fim || e.data;
      return dataISO >= e.data && dataISO <= fim;
    });
  }

  const semAula = eventosDia.find(e => ['feriado_municipal','feriado_estadual','recesso'].includes(e.tipo));
  const sabadoLetivo = eventosDia.find(e => e.tipo === 'sabado_letivo');
  const reposicao = eventosDia.find(e => e.tipo === 'reposicao');

  // se é feriado ou recesso — mostrar aviso e bloquear
  if (semAula) {
    aviso.style.display = 'block';
    const tipos = { feriado_municipal: 'Feriado Municipal', feriado_estadual: 'Feriado Estadual', recesso: 'Recesso' };
    document.getElementById('chamada-aviso').innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400E" stroke-width="2" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <strong>${tipos[semAula.tipo] || semAula.tipo}</strong>
      </div>
      <div>${semAula.descricao} — Não há aula neste dia.</div>`;
    secao.style.display = 'none';
    btnWrap.style.display = 'none';
    document.getElementById('chamada-list').innerHTML = '';
    document.getElementById('chamada-faltosos-wrap').innerHTML = '';
    return;
  }

  // avisar se é sábado letivo ou reposição
  const avisoExtra = sabadoLetivo
    ? `<div style="background:#DCFCE7;border:1px solid #86EFAC;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#166534;"><strong>Sábado Letivo</strong> — ${sabadoLetivo.descricao}</div>`
    : reposicao
    ? `<div style="background:#EDE8FF;border:1px solid #C8A8E8;border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:var(--purple);"><strong>Reposição</strong> — ${reposicao.descricao}</div>`
    : '';
  aviso.style.display = 'none';

  // mostrar aviso de sábado letivo/reposição acima da seção
  const secaoEl = document.getElementById('chamada-secao');
  let avisoExtraEl = document.getElementById('chamada-aviso-extra');
  if (!avisoExtraEl) {
    avisoExtraEl = document.createElement('div');
    avisoExtraEl.id = 'chamada-aviso-extra';
    secaoEl.parentNode.insertBefore(avisoExtraEl, secaoEl);
  }
  avisoExtraEl.innerHTML = avisoExtra;

  // Buscar TODAS as aulas do dia (pode haver mais de uma)
  const aulasDoDia = aulasTurma
    .filter(a => dataAulaOnly(a.data) === dataISO)
    .sort((a, b) => (a.data > b.data ? 1 : -1)); // ordenar por hora/criação

  if (!aulasDoDia.length) {
    aviso.style.display = 'block';
    secao.style.display = 'none';
    btnWrap.style.display = 'none';
    document.getElementById('chamada-list').innerHTML = '';
    document.getElementById('chamada-faltosos-wrap').innerHTML = '';
    document.getElementById('chamada-seletor-aula-wrap').style.display = 'none';
    return;
  }

  aviso.style.display = 'none';

  // Seletor de aula — só exibir quando há 2+ aulas no mesmo dia
  const seletorWrap = document.getElementById('chamada-seletor-aula-wrap');
  const aulasDiaEl = document.getElementById('chamada-aulas-dia');
  const aulasOrdenadas = [...aulasTurma].sort((a,b) => dataAulaOnly(a.data).localeCompare(dataAulaOnly(b.data)));

  if (aulasDoDia.length > 1) {
    seletorWrap.style.display = 'block';
    // Determinar qual aula está selecionada (manter seleção ou pegar a 1ª)
    const aulaAtualId = btnWrap._aulaId && aulasDoDia.find(a => a.id === btnWrap._aulaId) ? btnWrap._aulaId : aulasDoDia[0].id;
    aulasDiaEl.innerHTML = aulasDoDia.map(aula => {
      const numAula = aulasOrdenadas.findIndex(a => a.id === aula.id) + 1;
      const ativa = aula.id === aulaAtualId;
      return `<button onclick="selecionarAulaChamada('${aula.id}')" id="btn-sel-aula-${aula.id}"
        style="padding:7px 16px;border-radius:20px;border:1.5px solid ${ativa ? 'var(--purple)' : 'var(--border)'};
        background:${ativa ? 'var(--purple)' : 'var(--white)'};color:${ativa ? '#fff' : 'var(--text-muted)'};
        font-family:'Sora',sans-serif;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;gap:6px;">
        <span>Aula ${numAula}</span>
        ${aula.nome ? `<span style="font-weight:400;opacity:0.8;">— ${aula.nome}</span>` : ''}
      </button>`;
    }).join('');
    // Carregar a aula ativa
    await carregarChamadaDeAulaEspecifica(aulaAtualId, aulasOrdenadas);
  } else {
    seletorWrap.style.display = 'none';
    await carregarChamadaDeAulaEspecifica(aulasDoDia[0].id, aulasOrdenadas);
  }
}

async function selecionarAulaChamada(aulaId) {
  const aulasOrdenadas = [...aulasTurma].sort((a,b) => dataAulaOnly(a.data).localeCompare(dataAulaOnly(b.data)));
  // Atualizar visual dos botões
  document.querySelectorAll('[id^="btn-sel-aula-"]').forEach(btn => {
    const isAtivo = btn.id === `btn-sel-aula-${aulaId}`;
    btn.style.background = isAtivo ? 'var(--purple)' : 'var(--white)';
    btn.style.borderColor = isAtivo ? 'var(--purple)' : 'var(--border)';
    btn.style.color = isAtivo ? '#fff' : 'var(--text-muted)';
  });
  await carregarChamadaDeAulaEspecifica(aulaId, aulasOrdenadas);
}

async function carregarChamadaDeAulaEspecifica(aulaId, aulasOrdenadas) {
  const aulaData = aulasTurma.find(a => a.id === aulaId);
  if (!aulaData) return;

  const secao = document.getElementById('chamada-secao');
  const btnWrap = document.getElementById('btn-salvar-chamada-wrap');

  chamadaTemp = {};
  secao.style.display = 'block';

  // preencher descrição da aula
  document.getElementById('chamada-desc-aula').value = aulaData.descricao || '';

  // número da aula
  const numAula = aulasOrdenadas.findIndex(a => a.id === aulaData.id) + 1;
  document.getElementById('col-aula-label').textContent = `Aula ${numAula}`;
  document.getElementById('chamada-total-alunos').textContent = alunosTurma.length;

  const [chamadaSalva, todasFaltas] = await Promise.all([
    api(`chamadas?aula_id=eq.${aulaData.id}&select=*`),
    alunosTurma.length ? api(`chamadas?aluno_id=in.(${alunosTurma.map(a=>a.id).join(',')})&presente=eq.false&select=aluno_id`) : Promise.resolve([])
  ]);

  const mapSalvo = {};
  (chamadaSalva || []).forEach(c => { mapSalvo[c.aluno_id] = c.presente; });

  const faltasPorAluno = {};
  (todasFaltas || []).forEach(f => { faltasPorAluno[f.aluno_id] = (faltasPorAluno[f.aluno_id] || 0) + 1; });
  _faltasPorAlunoAtual = faltasPorAluno;

  alunosTurma.forEach(a => { chamadaTemp[a.id] = mapSalvo[a.id] !== undefined ? mapSalvo[a.id] : true; });

  const jaSalva = (chamadaSalva || []).length > 0;
  chamadaCacheSet(aulaData.id, jaSalva);
  document.getElementById('chamada-status-label').textContent = jaSalva ? '✓ Chamada já registrada anteriormente.' : 'Chamada ainda não foi salva.';

  renderListaChamada(faltasPorAluno);
  renderizarFaltosos();

  btnWrap.style.display = 'block';
  btnWrap._aulaId = aulaData.id;

  // atualizar toggle
  const todosPresentes = alunosTurma.every(a => chamadaTemp[a.id]);
  const toggle = document.getElementById('toggle-todos');
  toggle.checked = todosPresentes;
  atualizarToggleVisual(todosPresentes);
}

function renderListaChamada(faltasPorAluno) {
  document.getElementById('chamada-list').innerHTML = alunosTurma.map((a, i) => {
    const presente = chamadaTemp[a.id];
    const faltas = faltasPorAluno ? (faltasPorAluno[a.id] || 0) : 0;
    return `
    <div class="chamada-aluno-row ${presente ? '' : 'faltou'}" id="row-${a.id}" style="display:grid;grid-template-columns:1fr 90px 60px;align-items:center;padding:12px 18px;border-bottom:1px solid var(--border);background:${presente ? '#fff' : '#FEE2E2'};">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:50%;background:#5A3480;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:13px;font-weight:400;color:var(--text);">${a.codigo_simade || ''}</span>
          <span onclick="abrirHistoricoPresenca('${a.id}','${a.nome_completo.replace(/'/g,"\\'")}');event.stopPropagation();" style="font-size:14px;font-weight:700;color:var(--purple);text-decoration:underline;cursor:pointer;">${a.nome_completo}${tagRemanejado(a)}</span>
        </div>
      </div>
      <div style="text-align:center;font-size:13px;font-weight:700;color:${faltas > 0 ? '#E24B4A' : 'var(--text-muted)'};">${faltas}</div>
      <div style="text-align:center;">
        <button onclick="togglePresenca('${a.id}')" id="btn-p-${a.id}" style="width:34px;height:34px;border-radius:50%;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;margin:0 auto;background:${presente ? '#DCFCE7' : '#FEE2E2'};">
          ${presente
            ? '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'}
        </button>
      </div>
    </div>`;
  }).join('');
}

function renderizarFaltosos() {
  const faltosos = alunosTurma.filter(a => !chamadaTemp[a.id]);
  const wrap = document.getElementById('chamada-faltosos-wrap');
  
  if (faltosos.length === 0) {
    wrap.innerHTML = '';
    return;
  }

  wrap.innerHTML = faltosos.map(a => `
    <div id="chip-${a.id}" style="display:inline-flex;align-items:center;gap:8px;padding:6px 12px;background:#FEE2E2;border-radius:20px;border:1px solid #FBBFBF;margin:4px;">
      <span style="font-size:12px;font-weight:600;color:#991B1B;">${a.nome_completo.split(' ')[0]} ${a.nome_completo.split(' ').slice(-1)[0]}</span>
      <button onclick="togglePresenca('${a.id}')" style="width:24px;height:24px;border-radius:50%;border:none;background:#DCFCE7;cursor:pointer;display:flex;align-items:center;justify-content:center;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
    </div>
  `).join('');
}

function toggleTodosPresentes(checked) {
  alunosTurma.forEach(a => { chamadaTemp[a.id] = checked; });
  atualizarToggleVisual(checked);
  // re-renderizar sem buscar faltas novamente
  renderListaChamada(null);
  renderizarFaltosos();
  // rebuscar faltas para exibir correto
  if (alunosTurma.length) {
    api(`chamadas?aluno_id=in.(${alunosTurma.map(a=>a.id).join(',')})&presente=eq.false&select=aluno_id`).then(faltas => {
      const faltasPorAluno = {};
      (faltas||[]).forEach(f => { faltasPorAluno[f.aluno_id] = (faltasPorAluno[f.aluno_id]||0)+1; });
      _faltasPorAlunoAtual = faltasPorAluno;
      renderListaChamada(faltasPorAluno);
      renderizarFaltosos();
    });
  }
}

// Modo inverso: todos faltaram, professor marca só os presentes

function toggleModoInversoChamada() {
  _modoInversoChamada = !_modoInversoChamada;
  const btn = document.getElementById('btn-modo-inverso');
  if (btn) {
    btn.style.background = _modoInversoChamada ? '#FEF3C7' : 'var(--white)';
    btn.style.borderColor = _modoInversoChamada ? '#F59E0B' : 'var(--border)';
    btn.style.color = _modoInversoChamada ? '#92400E' : 'var(--text-muted)';
    btn.title = _modoInversoChamada
      ? 'Modo inverso ATIVO — todos faltaram. Clique para desativar.'
      : 'Modo inverso: todos faltaram, marcar só os presentes';
  }
  // Marcar todos como falta (inverso) ou todos presentes (normal)
  alunosTurma.forEach(a => { chamadaTemp[a.id] = !_modoInversoChamada; });
  atualizarToggleVisual(!_modoInversoChamada);
  renderListaChamada(null);
  renderizarFaltosos();
  if (alunosTurma.length) {
    api(`chamadas?aluno_id=in.(${alunosTurma.map(a=>a.id).join(',')})&presente=eq.false&select=aluno_id`).then(faltas => {
      const faltasPorAluno = {};
      (faltas||[]).forEach(f => { faltasPorAluno[f.aluno_id] = (faltasPorAluno[f.aluno_id]||0)+1; });
      _faltasPorAlunoAtual = faltasPorAluno;
      renderListaChamada(faltasPorAluno);
      renderizarFaltosos();
    });
  }
}

function atualizarToggleVisual(checked) {
  const track = document.getElementById('toggle-track');
  const thumb = document.getElementById('toggle-thumb');
  if (!track || !thumb) return;
  track.style.background = checked ? '#6C4FD4' : '#ccc';
  thumb.style.transform = checked ? 'translateX(18px)' : 'translateX(0)';
}

async function salvarChamada() {
  const tri = detectarTrimestreAtual().tri;
  if (await verificarBloqueio(tri)) return;
  const aulaId = document.getElementById('btn-salvar-chamada-wrap')._aulaId;
  const aulaAtual = aulasTurma.find(a => a.id === aulaId);
  const rows = alunosTurma.map(a => ({ aula_id: aulaId, aluno_id: a.id, presente: chamadaTemp[a.id] !== false }));

  // Salvar chamada da aula atual
  await api(`chamadas?aula_id=eq.${aulaId}`, { method: 'DELETE' });
  await api('chamadas', { method: 'POST', body: JSON.stringify(rows) });
  await api(`aulas?id=eq.${aulaId}`, { method: 'PATCH', body: JSON.stringify({ status: 'lecionada' }) });
  chamadaCacheSet(aulaId, true);
  const idx = aulasTurma.findIndex(a => a.id === aulaId);
  if (idx !== -1) aulasTurma[idx] = { ...aulasTurma[idx], status: 'lecionada' };

  // Copiar automaticamente para outras aulas do mesmo dia
  if (aulaAtual) {
    const dataAtual = dataAulaOnly(aulaAtual.data);
    const outrasMesmoDia = aulasTurma.filter(a => a.id !== aulaId && dataAulaOnly(a.data) === dataAtual);
    for (const outra of outrasMesmoDia) {
      const rowsOutra = alunosTurma.map(a => ({ aula_id: outra.id, aluno_id: a.id, presente: chamadaTemp[a.id] !== false }));
      await api(`chamadas?aula_id=eq.${outra.id}`, { method: 'DELETE' });
      await api('chamadas', { method: 'POST', body: JSON.stringify(rowsOutra) });
      await api(`aulas?id=eq.${outra.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'lecionada' }) });
      chamadaCacheSet(outra.id, true);
      const idxOutra = aulasTurma.findIndex(a => a.id === outra.id);
      if (idxOutra !== -1) aulasTurma[idxOutra] = { ...aulasTurma[idxOutra], status: 'lecionada' };
    }
    mostrarToastChamada(outrasMesmoDia.length);
  } else {
    mostrarToastChamada(0);
  }

  cacheSalvar(turmaAtiva.id, 'aulas', aulasTurma);
  setTimeout(() => voltarTurma(), 1800);
}

function mostrarToastNotas() {
  const isMobile = window.innerWidth < 768;
  let t = document.getElementById('toast-notas');
  if (!t) { t = document.createElement('div'); t.id = 'toast-notas'; document.body.appendChild(t); }
  t.style.cssText = isMobile ? 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(30px);z-index:9999;opacity:0;transition:all 0.4s cubic-bezier(.34,1.56,.64,1);pointer-events:none;' : 'position:fixed;bottom:0;right:32px;transform:translateY(110%);z-index:9999;opacity:0;transition:all 0.4s cubic-bezier(.34,1.56,.64,1);pointer-events:none;';
  t.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAEAAElEQVR4nOz9ebwk2VXfi373EBE5nXNq6FHqrq4epW6JwcwgJgmDbUBMxgbPz1z8nu/1dMEDXBs/Jl9ssMGAzTV+xs/YeLqAmTwKGZDAgLDBCISQ1N1qdbeGVnd1V50hp4jYe6/7x46IjMxzaugauqq79u/ziZMnMyMjdwwZa+21fuu3FAkJCdcdp06dEq01Sqm1RWsNgIh0j+0C4FzF009/SF23gSckJLxskW4cCQnXEA8+eL/0nyu1/pMLYf211vBvYtMBaNH4B0euC/DYY+9Pv/GEhIQjkW4OCQlXgPtO3yubs/bWgG8a875hvhjadTedgc1tbK63uX77PISA9566rnnqg0+n331CQkJyABISXgxOnTotWZbRhuvNeX5BqxC9AzjkIPQN81Gfa6GPmuKfB/0oQf9Ra00/vSAihBAIIVC5mieffDLdBxISbkKkH35CwgVw7733itYaY0xjRM2aASV44PAMvH08nwFfGemjZ+6b67U4HBHwa+9tphOqqjrS8WihrVmLDiRnICHh5kH6sSckbOD06VOS54PO6LcGP+bf1ZpRLjK7RszbJOldHNFB2DTcLS62nRDc2vNDBr4Z/1HbUkoREFoHRymF956yLPnABz6Q7g0JCa9wpB95QgJw7733SFEUaK0JIeBcnOEflVNvQ+paa8rFsnv9qMX7wxGC/jbb98+H80UGWlhrz1shICIXTCEopahcfWi/2u8UEd773veme0RCwisU6cedcNPi/vvvF62PnnErFWfEbY6+b0j7hja32aHX+kZ400D31wUwxhwaV3+mfqGKAFhxCC4WQTgfmVAZfd4oQwiB4XDIYrHg8ccfT/eKhIRXGNKPOuGmwwP33S9ZlqGUwvlq7b3NmfomSW8TEi78EzrfDLz9Hh/qC37+YhEA5MIkwYtVERz1ej9KUdc1eZ5jjKEsSx57f3IEEhJeKUg/5oSbBq958CFpZ+Tee7z3GHt5ZXqHyu5EI/hokFXonktQ3XOlBYUBFVaPFzHwF0sRdEJBzff0v0/wh76vP74+zkc2bKsGRKRziJITkJDwykD6ISe8onH61D1iraUt3evY+6yM2xpUWAvVr0L0R5frqbBKGcR19Nqj1halBNAoJU1qQbr1L1bmd7H3WwchkhP92iME4q7G8cSKgdVj/ILDKYruUCiFtZa6rgkh0B5H7z2z2SzpCSQkvMyRfsAJr1g8eP8Dkud5N+N3znUz2SzLMMZQ1/W6eI+WQ+Hw+HzlAKy9H+SQdG9fwrdl17fb6j+uNiIg6shHCRd4H9akgjcJgLByENoqhtYB6mb1NjtvGmNTN+Cosb/vsUfTPSQh4WWK9ONNeMXhtQ+9RrTWh8LnrWHuG8LWgHaGTUVD1xrQtszucC19NPy5tWvb7j+2IfMLpRZWzoU+8rGdyR/9/jqJ8EL5/U3jH0IAUdRBYrrgCOJha/z7okVtZYQxBmstLvh[... 158431 chars omitted ...]`;
  t.style.opacity = '1';
  t.style.transform = isMobile ? 'translateX(-50%) translateY(0)' : 'translateY(0)';
  clearTimeout(t._hide);
  t._hide = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = isMobile ? 'translateX(-50%) translateY(30px)' : 'translateY(110%)';
  }, 3000);
}

function mostrarToastChamada(copiadas) {
  const isMobile = window.innerWidth < 768;
  let t = document.getElementById('toast-chamada');
  if (!t) { t = document.createElement('div'); t.id = 'toast-chamada'; document.body.appendChild(t); }
  const extra = copiadas > 0
    ? `<div style="font-size:11px;color:#A78BFA;margin-top:4px;font-weight:500;">+${copiadas} aula${copiadas>1?'s':''} do mesmo dia preenchida${copiadas>1?'s':''} automaticamente</div>`
    : '';
  t.style.cssText = isMobile ? 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(30px);z-index:9999;opacity:0;transition:all 0.4s cubic-bezier(.34,1.56,.64,1);pointer-events:none;' : 'position:fixed;bottom:0;right:32px;transform:translateY(110%);z-index:9999;opacity:0;transition:all 0.4s cubic-bezier(.34,1.56,.64,1);pointer-events:none;';
  t.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;"><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAIACAYAAAD0eNT6AAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAEAAElEQVR4nOz9ebwk2VXfi373EBE5nXNq6FHqrq4epW6JwcwgJgmDbUBMxgbPz1z8nu/1dMEDXBs/Jl9ssMGAzTV+xs/YeLqAmTwKGZDAgLDBCISQ1N1qdbeGVnd1V50hp4jYe6/7x46IjMxzaugauqq79u/ziZMnMyMjdwwZa+21fuu3FAkJCdcdp06dEq01Sqm1RWsNgIh0j+0C4FzF009/SF23gSckJLxskW4cCQnXEA8+eL/0nyu1/pMLYf211vBvYtMBaNH4B0euC/DYY+9Pv/GEhIQjkW4OCQlXgPtO3yubs/bWgG8a875hvhjadTedgc1tbK63uX77PISA9566rnnqg0+n331CQkJyABISXgxOnTotWZbRhuvNeX5BqxC9AzjkIPQN81Gfa6GPmuKfB/0oQf9Ra00/vSAihBAIIVC5mieffDLdBxISbkKkH35CwgVw7733itYaY0xjRM2aASV44PAMvH08nwFfGemjZ+6b67U4HBHwa+9tphOqqjrS8WihrVmLDiRnICHh5kH6sSckbOD06VOS54PO6LcGP+bf1ZpRLjK7RszbJOldHNFB2DTcLS62nRDc2vNDBr4Z/1HbUkoREFoHRymF956yLPnABz6Q7g0JCa9wpB95QgJw7733SFEUaK0JIeBcnOEflVNvQ+paa8rFsnv9qMX7wxGC/jbb98+H80UGWlhrz1shICIXTCEopahcfWi/2u8UEd773veme0RCwisU6cedcNPi/vvvF62PnnErFWfEbY6+b0j7hja32aHX+kZ400D31wUwxhwaV3+mfqGKAFhxCC4WQTgfmVAZfd4oQwiB4XDIYrHg8ccfT/eKhIRXGNKPOuGmwwP33S9ZlqGUwvlq7b3NmfomSW8TEi78EzrfDLz9Hh/qC37+YhEA5MIkwYtVERz1ej9KUdc1eZ5jjKEsSx57f3IEEhJeKUg/5oSbBq958CFpZ+Tee7z3GHt5ZXqHyu5EI/hokFXonktQ3XOlBYUBFVaPFzHwF0sRdEJBzff0v0/wh76vP74+zkc2bKsGRKRziJITkJDwykD6ISe8onH61D1iraUt3evY+6yM2xpUWAvVr0L0R5frqbBKGcR19Nqj1halBNAoJU1qQbr1L1bmd7H3WwchkhP92iME4q7G8cSKgdVj/ILDKYruUCiFtZa6rgkh0B5H7z2z2SzpCSQkvMyRfsAJr1g8eP8Dkud5N+N3znUz2SzLMMZQ1/W6eI+WQ+Hw+HzlAKy9H+SQdG9fwrdl17fb6j+uNiIg6shHCRd4H9akgjcJgLByENoqhtYB6mb1NjtvGmNTN+Cosb/vsUfTPSQh4WWK9ONNeMXhtQ+9RrTWh8LnrWHuG8LWgHaGTUVD1xrQtszucC19NPy5tWvb7j+2IfMLpRZWzoU+8rGdyR/9/jqJ8EL5/U3jH0IAUdRBYrrgCOJha/z7okVtZYQxBmstLvh[... 158428 chars omitted ...]`;
  t.style.opacity = '1';
  t.style.transform = isMobile ? 'translateX(-50%) translateY(0)' : 'translateY(0)';
  clearTimeout(t._hide);
  t._hide = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = isMobile ? 'translateX(-50%) translateY(30px)' : 'translateY(110%)';
  }, 3000);
}

function togglePresenca(alunoId) {
  chamadaTemp[alunoId] = !chamadaTemp[alunoId];
  const presente = chamadaTemp[alunoId];
  const btn = document.getElementById('btn-p-' + alunoId);
  const row = document.getElementById('row-' + alunoId);
  if (btn) {
    btn.style.background = presente ? '#DCFCE7' : '#FEE2E2';
    btn.innerHTML = presente
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  }
  if (row) {
    row.style.background = presente ? '#fff' : '#F0FFF4';
    row.classList.toggle('faltou', !presente);
  }
  
  renderizarFaltosos();
  
  // Atualizar toggle todos
  const todosPresentes = alunosTurma.every(a => chamadaTemp[a.id]);
  const toggle = document.getElementById('toggle-todos');
  if (toggle) {
    toggle.checked = todosPresentes;
    atualizarToggleVisual(todosPresentes);
  }
}

async function abrirChamadaDeAula(aulaId) {
  // Resetar modo inverso ao abrir nova chamada
  _modoInversoChamada = false;
  const btnInv = document.getElementById('btn-modo-inverso');
  if (btnInv) { btnInv.style.background='var(--white)'; btnInv.style.borderColor='var(--border)'; btnInv.style.color='var(--text-muted)'; }
  await abrirPagina('chamada');
  const aula = aulasTurma.find(a => a.id === aulaId);
  if (!aula) return;
  const dataISO = dataAulaOnly(aula.data);
  // Setar a data no input e calendário
  const [y, mo, dy] = dataISO.split('-');
  document.getElementById('chamada-date-input').value = `${dy}/${mo}/${y}`;
  calState['cal-chamada'] = { ano: parseInt(y), mes: parseInt(mo) - 1 };
  atualizarCalendario('cal-chamada');
  // Verificar eventos do calendário escolar (reusa lógica do carregarChamadaPorData)
  // mas forçar que o seletor selecione a aula específica após carregar
  const btnWrap = document.getElementById('btn-salvar-chamada-wrap');
  btnWrap._aulaId = aulaId; // pré-seleciona esta aula antes de carregar
  await carregarChamadaPorData(dataISO);
  // Se o seletor estiver visível, garantir que esta aula está marcada
  const btnSel = document.getElementById(`btn-sel-aula-${aulaId}`);
  if (btnSel) selecionarAulaChamada(aulaId);
}
