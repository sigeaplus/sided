// init.js — Ponto de entrada da aplicação
document.addEventListener('DOMContentLoaded', function () {
  if (typeof init === 'function') init();

  // ⚠️ _ctxRestaurarTurmaAtiva foi removido daqui.
  //
  // Motivo: quando a URL já contém uma rota de turma (ex: /turma/.../relatorio),
  // o roteadorRestaurar (chamado dentro de init via roteadorInicializar) já faz
  // toda a restauração de contexto aguardando a sessão de auth.
  // Chamar _ctxRestaurarTurmaAtiva em paralelo causava race condition: as duas
  // funções corriam ao mesmo tempo, a sessão ainda não estava pronta nos primeiros
  // 100ms, e a página ficava presa em "Carregando..." indefinidamente no F5.
});
