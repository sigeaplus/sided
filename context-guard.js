// ============================================================
// CONTEXT-GUARD.JS — Garante turmaAtiva antes de qualquer módulo
// Inclua este script APÓS state.js e ANTES dos módulos (ocorrencias.js, relatorios.js, etc.)
// ============================================================

// ── Chave de sessão ──────────────────────────────────────────
const _CTX_SESSAO_KEY = 'sided_turma_ativa_id';

// ── Flag para evitar inicialização dupla ────────────────────
let _ctxInicializando = false;
let _ctxProntoCallbacks = [];

// ── Notifica quando o contexto estiver pronto ───────────────
function _ctxOnPronto(cb) {
  if (turmaAtiva) { cb(); return; }
  _ctxProntoCallbacks.push(cb);
}

function _ctxDispararProntos() {
  _ctxProntoCallbacks.forEach(cb => { try { cb(); } catch(e) {} });
  _ctxProntoCallbacks = [];
}

// ── Restaurar turmaAtiva da sessão ou do primeiro resultado da API ──
async function _ctxRestaurarTurmaAtiva() {
  if (turmaAtiva) return turmaAtiva;
  if (_ctxInicializando) {
    // Aguardar a inicialização em andamento
    return new Promise(res => _ctxOnPronto(() => res(turmaAtiva)));
  }

  _ctxInicializando = true;

  try {
    // 1. Tentar restaurar o ID salvo na sessão
    const idSalvo = sessionStorage.getItem(_CTX_SESSAO_KEY);

    // 2. Buscar todas as turmas do professor
    const profData = JSON.parse(sessionStorage.getItem('prof_data') || '{}');
    if (!profData.id) {
      console.warn('[CTX] prof_data não encontrado na sessão. Aguardando login.');
      _ctxInicializando = false;
      return null;
    }

    let turmas = todasTurmas;
    if (!turmas.length) {
      try {
        turmas = await api(
          `turmas?professor_id=eq.${profData.id}&select=*,escolas(nome)&order=nome`
        ) || [];
        todasTurmas = turmas;
      } catch(e) {
        console.error('[CTX] Erro ao buscar turmas:', e.message);
        _ctxInicializando = false;
        return null;
      }
    }

    if (!turmas.length) {
      console.warn('[CTX] Nenhuma turma encontrada para este professor.');
      _ctxInicializando = false;
      return null;
    }

    // 3. Priorizar a turma salva na sessão; fallback para a primeira
    let turmaEscolhida = idSalvo
      ? turmas.find(t => String(t.id) === String(idSalvo))
      : null;

    if (!turmaEscolhida) turmaEscolhida = turmas[0];

    turmaAtiva = turmaEscolhida;
    sessionStorage.setItem(_CTX_SESSAO_KEY, String(turmaAtiva.id));

    console.info('[CTX] turmaAtiva restaurada:', turmaAtiva.nome);

    // 4. Carregar alunos imediatamente
    await _ctxCarregarAlunosSeTiver();

    _ctxDispararProntos();
    return turmaAtiva;

  } catch(e) {
    console.error('[CTX] Falha ao restaurar contexto:', e.message);
    _ctxInicializando = false;
    return null;
  } finally {
    _ctxInicializando = false;
  }
}

async function _ctxCarregarAlunosSeTiver() {
  if (!turmaAtiva || alunosTurma.length) return;
  try {
    const res = await api(
      `alunos?turma_id=eq.${turmaAtiva.id}&order=nome_completo&select=*`
    ) || [];
    alunosTurma = res;
  } catch(e) {
    console.warn('[CTX] Não foi possível pré-carregar alunos:', e.message);
  }
}

// ── Patch em garantirAlunosTurma ─────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  setTimeout(() => {
    if (typeof garantirAlunosTurma === 'function') {
      const _garantirOriginal = garantirAlunosTurma;

      garantirAlunosTurma = async function () {
        if (!turmaAtiva) {
          const ok = await _ctxRestaurarTurmaAtiva();
          if (!ok) {
            console.warn('[CTX] garantirAlunosTurma: turmaAtiva indisponível após restauração.');
            return;
          }
        }
        return _garantirOriginal();
      };

      console.info('[CTX] garantirAlunosTurma patcheada com sucesso.');
    } else {
      console.warn('[CTX] garantirAlunosTurma não encontrada. Certifique-se de que api.js/dashboard.js foi carregado antes.');
    }

    // REMOVIDO: _ctxRestaurarTurmaAtiva() antecipado que causava race condition.
    //
    // Quando a URL é uma rota de turma (ex: /turma/.../relatorio), o roteador
    // precisa carregar a turma ESPECÍFICA da URL. Disparar _ctxRestaurarTurmaAtiva
    // aqui em paralelo fazia todasTurmas ser preenchido pela turma errada (a da
    // sessão anterior) antes do roteador terminar, ou deixava _carregarContextoTurma
    // retornar cedo demais por encontrar todasTurmas vazio num momento intermediário.
    // O roteador agora busca as turmas por conta própria quando necessário.

  }, 0);
});

// ── Salvar turmaAtiva na sessão sempre que ela mudar ─────────
function _ctxSalvarTurma(turma) {
  turmaAtiva = turma;
  if (turma?.id) {
    sessionStorage.setItem(_CTX_SESSAO_KEY, String(turma.id));
  }
}

// ── API pública ──────────────────────────────────────────────
async function garantirContextoCompleto() {
  if (!turmaAtiva) await _ctxRestaurarTurmaAtiva();
  if (!turmaAtiva) return false;
  if (typeof garantirAlunosTurma === 'function') await garantirAlunosTurma();
  return !!turmaAtiva;
}
