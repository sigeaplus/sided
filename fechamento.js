let ftResultados = [];
let ftTriAtivo = 1;

async function abrirFecharTrimestre() {
  try {
    const el = document.getElementById('modal-fechar-tri');
    if (!el) { alert('Elemento modal-fechar-tri não encontrado!'); return; }

    if (el.parentElement !== document.body) {
      document.body.appendChild(el);
    }

    el.style.cssText = 'display:block;position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;z-index:99999;background:#F4F2FF;overflow-y:auto;';
    document.getElementById('ft-loading').style.display = 'block';
    document.getElementById('ft-secoes').style.display = 'none';

    const triInfo = detectarTrimestreAtual();
    ftTriAtivo = triInfo.tri;

    const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');

    if (!profData.id) {
      document.getElementById('ft-loading').innerHTML = '<div style="color:#E24B4A;text-align:center;padding:32px;">Sessão expirada. Faça login novamente.</div>';
      return;
    }

    document.getElementById('ft-escola-nome').textContent = `${profData.escolas?.codigo_escola || ''} — ${profData.escolas?.nome || '—'}`;
    document.getElementById('ft-prof-nome').textContent = profData.nome || '—';
    document.getElementById('ft-sidebar-nome').textContent = profData.nome || '—';
    document.getElementById('ft-sidebar-escola').textContent = profData.escolas?.nome || '—';
    document.getElementById('ft-sel-tri').value = triInfo.tri;

    await carregarDadosFechamento(profData, triInfo.tri);
  } catch(e) {
    console.error('[FT] Erro em abrirFecharTrimestre:', e);
    mostrarToast('Erro: ' + e.message);
  }
}

async function filtrarFechamentoTri(tri) {
  ftTriAtivo = parseInt(tri);
  const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
  document.getElementById('ft-loading').style.display = 'block';
  document.getElementById('ft-secoes').style.display = 'none';
  await carregarDadosFechamento(profData, ftTriAtivo);
}

async function carregarDadosFechamento(profData, tri) {
  try {
  // Usar todasTurmaDisciplinas já carregado no dashboard
  const tdList = (typeof todasTurmaDisciplinas !== 'undefined' && todasTurmaDisciplinas.length)
    ? todasTurmaDisciplinas
    : await api(`turma_disciplinas?professor_id=eq.${profData.id}&select=id,disciplinas(id,nome),turmas(id,nome,ano,turno,nivel,codigo,escola_id,escolas(nome,codigo_escola))`) || [];

  if (!tdList.length) {
    document.getElementById('ft-loading').innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted);">Nenhuma turma associada.</div>';
    return;
  }

  const tdIds = tdList.map(td => td.id).join(',');
  const fechados = tdIds
    ? await api(`trimestres_fechados?turma_disciplina_id=in.(${tdIds})&trimestre=eq.${tri}&aberto_em=is.null&select=turma_disciplina_id,fechado_em`) || []
    : [];
  const fechadosSet = new Set(fechados.map(f => f.turma_disciplina_id));
  const fechadosMap = {};
  fechados.forEach(f => { fechadosMap[f.turma_disciplina_id] = f; });

  const resultados = (await Promise.all(tdList.map(async td => {
    const t = td.turmas;
    if (!t) return [];
    const discNome = td.disciplinas?.nome || null;

    if (fechadosSet.has(td.id)) {
      return [{ turma: t, td, status: 'fechada', p: null, fechadoEm: fechadosMap[td.id]?.fechado_em, disciplina: discNome }];
    }

    const alunos = await api(`alunos?turma_id=eq.${t.id}&select=id`) || [];
    const totalAlunos = alunos.length;

    const padrao = { 1: 67, 2: 67, 3: 66 };
    let diasLetivos = padrao[tri];
    try {
      const metaRes = await api(`metas_aulas?turma_id=eq.${t.id}&trimestre=eq.${tri}&select=total_aulas&limit=1`);
      if (metaRes && metaRes[0]) diasLetivos = metaRes[0].total_aulas;
    } catch(e) { /* usa padrão */ }

    const _triDatas = { 1: { ini: '-02-04', fim: '-05-20' }, 2: { ini: '-05-21', fim: '-09-09' }, 3: { ini: '-09-10', fim: '-12-18' } };
    const _ano = new Date().getFullYear();
    const _triIni = `${_ano}${_triDatas[tri].ini}`;
    const _triFim = `${_ano}${_triDatas[tri].fim}`;
    const _aulasRaw = await api(`aulas?turma_disciplina_id=eq.${td.id}&data=gte.${_triIni}&data=lte.${_triFim}&select=id`)
      || await api(`aulas?turma_id=eq.${t.id}&professor_id=eq.${profData.id}&data=gte.${_triIni}&data=lte.${_triFim}&select=id`)
      || [];
    const aulas = Array.isArray(_aulasRaw) ? _aulasRaw : [];
    const totalAulasCriadas = aulas.length;
    let aulasComChamada = 0;
    for (const aula of aulas) {
      const ch = await api(`chamadas?aula_id=eq.${aula.id}&select=id&limit=1`);
      if (ch && ch.length) aulasComChamada++;
    }
    const temPendAulas = aulasComChamada < totalAulasCriadas;

    const maxPontosTri = tri === 3 ? 40 : 30;
    const avais = await api(`avaliacoes?turma_disciplina_id=eq.${td.id}&trimestre=eq.${tri}&tipo=eq.normal&select=id,nome,pontos`)
      || await api(`avaliacoes?turma_id=eq.${t.id}&professor_id=eq.${profData.id}&trimestre=eq.${tri}&tipo=eq.normal&select=id,nome,pontos`)
      || [];

    const avaisNormais = avais.filter(av => !av.nome?.startsWith('__NOTA_FINAL__'));
    let pontosLancados = 0;
    if (avaisNormais.length > 0 && totalAlunos > 0) {
      const ids = avaisNormais.map(a => a.id).join(',');
      const notas = await api(`notas?avaliacao_id=in.(${ids})&select=avaliacao_id,nota,nao_realizado`) || [];
      const contPorAval = {};
      notas.forEach(n => { if (n.nota !== null || n.nao_realizado) contPorAval[n.avaliacao_id] = (contPorAval[n.avaliacao_id]||0)+1; });
      avaisNormais.forEach(av => { if ((contPorAval[av.id]||0) >= totalAlunos) pontosLancados += Number(av.pontos); });
    }
    const temPendNotas = pontosLancados < maxPontosTri;
    const status = (temPendAulas || temPendNotas) ? 'pendencia' : 'apta';
    return [{ turma: t, td, status, disciplina: discNome, p: {
      totalAulasCriadas, aulasLecionadas: aulasComChamada, temPendAulas,
      pontosLancados, maxPontosTri, temPendNotas
    }}];
  }))).flat();

  ftResultados = resultados;

  document.getElementById('ft-loading').style.display = 'none';
  document.getElementById('ft-secoes').style.display = 'block';

  document.querySelectorAll('[data-ft]').forEach(c => resetChipFt(c));
  const defaultSection = ftResultados.some(r => r.status === 'pendencia')
    ? 'pendencias'
    : ftResultados.some(r => r.status === 'apta')
      ? 'aptas'
      : 'fechadas';
  const chipDefault = document.querySelector(`[data-ft="${defaultSection}"]`);
  if (chipDefault) ativarChipFt(chipDefault);
  renderFechamentoCategoria(defaultSection);
  } catch(e) {
    console.error('Erro em carregarDadosFechamento:', e);
    document.getElementById('ft-loading').innerHTML = `<div style="color:#E24B4A;text-align:center;padding:32px;">Erro ao carregar: ${e.message}</div>`;
  }
}

function resetChipFt(el) {
  el.style.background = 'var(--white)';
  el.style.borderColor = 'var(--border)';
  el.style.color = 'var(--text-muted)';
}

function ativarChipFt(el) {
  const cores = { pendencias: '#E24B4A', aptas: '#22C55E', fechadas: '#9A8FC0' };
  const cor = cores[el.dataset.ft] || 'var(--purple)';
  el.style.background = cor;
  el.style.borderColor = cor;
  el.style.color = '#fff';
}

function filtrarCategoria(el) {
  document.querySelectorAll('[data-ft]').forEach(c => resetChipFt(c));
  ativarChipFt(el);
  renderFechamentoCategoria(el.dataset.ft);
}

function renderFechamentoCategoria(categoria) {
  const aviso = document.getElementById('ft-aviso');
  const label = document.getElementById('ft-secao-label');
  const lista  = document.getElementById('ft-lista-turmas');

  aviso.style.display = 'none';
  lista.innerHTML = '';
  label.innerHTML = '';

  const cardBase = (r, extra) => {
    const discLabel = r.isFundI && r.disciplina
      ? `<div style="display:inline-block;margin-bottom:6px;background:var(--purple-light);color:var(--purple);font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;">${r.disciplina}</div>`
      : `<div style="font-size:12px;color:var(--text);margin-bottom:2px;">${r.turma.disciplina || '—'}</div>`;
    return `
    <div style="background:var(--white);border:1px solid var(--border);border-radius:14px;padding:16px 18px;margin-bottom:10px;">
      <div style="font-size:11px;font-weight:700;color:var(--purple);margin-bottom:4px;">${r.turma.ano}</div>
      <div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px;">${r.turma.codigo} — ${r.turma.nome}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">${r.turma.escolas?.nome || ''}</div>
      ${discLabel}
      <div style="font-size:12px;font-weight:700;color:var(--text);text-transform:uppercase;">${r.turma.turno || ''}</div>
      ${extra}
    </div>`;
  };

  if (categoria === 'pendencias') {
    const itens = ftResultados.filter(r => r.status === 'pendencia');
    label.innerHTML = `<strong>Turmas com pendências</strong>`;
    if (itens.length) {
      aviso.style.display = 'flex';
      document.getElementById('ft-aviso-txt').textContent = 'Para o fechamento de trimestre é necessário resolver as pendências de cada turma antes de prosseguir.';
    }
    lista.innerHTML = itens.length ? itens.map(r => cardBase(r, `
      <div style="margin-top:12px;">
        <div style="display:flex;gap:16px;font-size:12px;margin-bottom:10px;flex-wrap:wrap;justify-content:flex-end;">
          <span style="color:${r.p.temPendAulas?'#E24B4A':'var(--text-muted)'};">Aulas lecionadas: <strong>${r.p.aulasLecionadas}/${r.p.totalAulasCriadas}</strong></span>
          <span style="color:${r.p.temPendNotas?'#E24B4A':'var(--text-muted)'};">Notas registradas: <strong>${r.p.pontosLancados}/${r.p.maxPontosTri}</strong></span>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
          <button onclick="irParaTurma('${r.turma.id}','aulas')" style="padding:7px 14px;border-radius:8px;border:none;background:${r.p.temPendAulas?'#E24B4A':'#9CA3AF'};color:#fff;font-family:'Sora',sans-serif;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Ajustar Aulas
          </button>
          <button onclick="irParaTurma('${r.turma.id}','avaliacoes')" style="padding:7px 14px;border-radius:8px;border:none;background:${r.p.temPendNotas?'#E24B4A':'#9CA3AF'};color:#fff;font-family:'Sora',sans-serif;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Ajustar Avaliações
          </button>
        </div>
      </div>`)).join('')
    : '<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:13px;">Nenhuma turma com pendências 🎉</div>';

  } else if (categoria === 'aptas') {
    const itens = ftResultados.filter(r => r.status === 'apta');
    label.innerHTML = `<strong>Turmas aptas</strong>`;
    if (itens.length) {
      aviso.style.display = 'flex';
      document.getElementById('ft-aviso-txt').textContent = 'Todas as avaliações estão lançadas. Pronta para fechar!';
    }
    lista.innerHTML = itens.length ? itens.map(r => cardBase(r, `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-top:12px;">
        <div style="display:flex;gap:12px;font-size:12px;color:var(--text-muted);">
          <span>Aulas lecionadas: <strong>${r.p.aulasLecionadas}/${r.p.totalAulasCriadas}</strong></span>
          <span>Notas: <strong>${r.p.pontosLancados}/${r.p.maxPontosTri}</strong></span>
        </div>
        <button onclick="confirmarFecharTrimestre('${r.td.id}', ${r.disciplina ? `'${r.disciplina.replace(/'/g,"\\'")}'` : "''"}, this)"
          style="padding:9px 20px;border-radius:10px;border:none;background:#22C55E;color:#fff;font-family:'Sora',sans-serif;font-size:13px;font-weight:700;cursor:pointer;"
          onmouseover="this.style.opacity=0.85" onmouseout="this.style.opacity=1">
          Fechar divisão
        </button>
      </div>`)).join('')
    : '<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:13px;">Nenhuma turma apta no momento</div>';

  } else if (categoria === 'fechadas') {
    const itens = ftResultados.filter(r => r.status === 'fechada');
    label.innerHTML = `<strong>Turmas fechadas</strong>`;
    lista.innerHTML = itens.length ? itens.map(r => {
      const data = r.fechadoEm ? new Date(r.fechadoEm).toLocaleDateString('pt-BR') : '—';
      return cardBase(r, `
        <div style="display:flex;justify-content:flex-end;margin-top:10px;">
          <div style="display:flex;align-items:center;gap:6px;background:var(--purple-light);padding:5px 12px;border-radius:20px;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--purple)" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            <span style="font-size:11px;font-weight:700;color:var(--purple);">Fechado em ${data}</span>
          </div>
        </div>`);
    }).join('')
    : '<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:13px;">Nenhuma turma fechada ainda</div>';
  }
}

async function confirmarFecharTrimestre(tdId, disciplina, btn) {
  if (disciplina && typeof disciplina === 'object') { btn = disciplina; disciplina = ''; }
  const discMsg = disciplina ? ` (${disciplina})` : '';
  if (!confirm(`Tem certeza? Após fechar${discMsg}, nenhum dado poderá ser editado. Somente o Administrador poderá reabrir.`)) return;
  btn.disabled = true;
  btn.textContent = 'Fechando...';
  const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');

  // Buscar turma_id — comparação robusta por string
  const tdObj = ftResultados.find(r => String(r.td?.id) === String(tdId));
  const turmaId = tdObj?.turma?.id;

  if (!turmaId) {
    btn.disabled = false;
    btn.textContent = 'Fechar divisão';
    mostrarToast('Erro: turma não encontrada. Recarregue e tente novamente.');
    return;
  }

  try {
    // Verificar se já existe registro (evita erro de unicidade)
    const existente = await api(`trimestres_fechados?turma_disciplina_id=eq.${tdId}&trimestre=eq.${ftTriAtivo}&select=id&limit=1`);
    if (existente && existente.length) {
      mostrarToast('Este trimestre já estava fechado.');
      await carregarDadosFechamento(profData, ftTriAtivo);
      return;
    }

    const body = {
      turma_disciplina_id: tdId,
      turma_id: turmaId,
      professor_id: profData.id,
      trimestre: ftTriAtivo,
      fechado_em: new Date().toISOString()
    };
    // Nota: coluna 'disciplina' não existe na tabela — não enviar

    await api('trimestres_fechados', { method: 'POST', body: JSON.stringify(body) });
    mostrarToast('Trimestre fechado com sucesso!');
    Object.keys(_bloqueioCache).forEach(k => { if (k.endsWith(`::${ftTriAtivo}`)) delete _bloqueioCache[k]; });
    await carregarDadosFechamento(profData, ftTriAtivo);
  } catch(e) {
    console.error('[FT] Erro ao fechar trimestre:', e);
    btn.disabled = false;
    btn.textContent = 'Fechar divisão';
    mostrarToast('Erro ao fechar: ' + (e.message || 'tente novamente.'));
  }
}

async function irParaTurmaDisc(turmaId, pagina, disciplina) {
  await irParaTurma(turmaId, pagina);
  if (disciplina) {
    setTimeout(() => {
      const sel = document.querySelector('#modal-nova-aula select[name="disciplina"], #sel-disciplina-aula, select.disciplina-aula');
      if (sel) {
        for (let i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === disciplina || sel.options[i].text === disciplina) {
            sel.selectedIndex = i;
            sel.dispatchEvent(new Event('change'));
            break;
          }
        }
      }
    }, 800);
  }
}

async function irParaTurma(turmaId, pagina) {
  fecharModalFechamento();
  if (!todasTurmas.find(t => t.id === turmaId)) {
    const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
    await carregarTurmas(profData.id);
  }
  await abrirTurma(turmaId);
  await abrirPagina(pagina);
}

function fecharModalFechamento() {
  document.getElementById('modal-fechar-tri').style.display = 'none';
}
