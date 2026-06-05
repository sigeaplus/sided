// ── Helpers globais ──────────────────────────────────────────────────────────

function isFundamentalI() {
  return (turmaAtiva?.nivel || '').trim() === 'Fundamental I';
}

function sortearAlunoAleatorio() {
  if (!alunosTurma.length) {
    mostrarToast('Sem alunos carregados nesta turma.');
    return;
  }
  const idx = Math.floor(Math.random() * alunosTurma.length);
  const aluno = alunosTurma[idx];
  mostrarToast(`Aluno sorteado: ${aluno.nome_completo}`);
}

function _idAluno(v) { return v == null || v === '' ? '' : String(v); }

function _paginaEstaVisivel(id) {
  const el = document.getElementById(id);
  if (!el) return false;
  return el.style.display !== 'none' && window.getComputedStyle(el).display !== 'none';
}

function tagRemanejado(aluno) {
  if (!aluno || !aluno.remanejado) return '';
  return `<span style="margin-left:6px;background:#DCFCE7;color:#166534;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;vertical-align:middle;white-space:nowrap;">Remanejado</span>`;
}

// ── Alunos ───────────────────────────────────────────────────────────────────

async function carregarAlunos() {
  if (!turmaAtiva?.id) { alunosTurma = []; return alunosTurma; }
  alunosTurma = await apiCached(
    `alunos?turma_id=eq.${turmaAtiva.id}&select=*&order=nome_completo`,
    turmaAtiva.id, 'alunos', 120000
  );
  return alunosTurma;
}

async function garantirAlunosTurma() {
  if (!turmaAtiva?.id) { alunosTurma = []; return alunosTurma; }
  const tid = String(turmaAtiva.id);
  if (alunosTurma.length && String(alunosTurma[0].turma_id) !== tid) alunosTurma = [];
  if (alunosTurma.length) return alunosTurma;
  return await carregarAlunos();
}

async function garantirAlunoNoContexto(alunoId) {
  const id = _idAluno(alunoId);
  if (!id) { mostrarToast('Aluno inválido.'); return null; }
  if (!turmaAtiva?.id) { mostrarToast('Selecione uma turma.'); return null; }
  let a = alunosTurma.find(x => _idAluno(x.id) === id);
  if (a) return a;
  await garantirAlunosTurma();
  a = alunosTurma.find(x => _idAluno(x.id) === id);
  if (a) return a;
  try {
    const res = await api(`alunos?id=eq.${id}&turma_id=eq.${turmaAtiva.id}&select=*&limit=1`) || [];
    if (res[0]) {
      if (!alunosTurma.some(x => _idAluno(x.id) === id)) alunosTurma.push(res[0]);
      return res[0];
    }
  } catch (e) { /* fallback falhou */ }
  mostrarToast('Aluno não encontrado nesta turma.');
  return null;
}
