// init.js — Ponto de entrada da aplicação
document.addEventListener('DOMContentLoaded', function () {
  if (typeof init === 'function') init();

  // Pré-aquecer contexto logo ao carregar a página.
  // Garante que turmaAtiva e alunosTurma estejam prontos
  // ANTES do usuário clicar em qualquer funcionalidade.
  setTimeout(async () => {
    try {
      await _ctxRestaurarTurmaAtiva();
    } catch(e) {
      // Falha silenciosa — o guard vai tentar novamente quando o usuário agir
    }
  }, 100); // 100ms: suficiente para api.js e dashboard.js terminarem de carregar
});
