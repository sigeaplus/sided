// ═════════════════════════════════════════════════════════════════════════════
// SIDED+ — Utilitários Puros (utils.js)
// Funções sem DOM, sem estado global, sem chamadas API
// ═════════════════════════════════════════════════════════════════════════════

// Formata data ISO (YYYY-MM-DD ou ISO completo) para DD/MM/YYYY
function formatarData(iso) {
  if (!iso) return '';
  const only = dataAulaOnly(iso);
  const parts = only.split('-');
  if (parts.length < 3) return only;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

// Converte string DD/MM/YYYY para YYYY-MM-DD
function parseDateBR(str) { const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (!m) return null; return `${m[3]}-${m[2]}-${m[1]}`; }

// Detecta o trimestre atual com base na data de hoje
function detectarTrimestreAtual() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const tri1Inicio = new Date(`${ano}-02-04`);
  const tri1Fim    = new Date(`${ano}-05-20`);
  const tri2Inicio = new Date(`${ano}-05-21`);
  const tri2Fim    = new Date(`${ano}-09-09`);
  const tri3Inicio = new Date(`${ano}-09-10`);
  const tri3Fim    = new Date(`${ano}-12-18`);
  if (hoje >= tri1Inicio && hoje <= tri1Fim) return { tri: 1, label: `1º Trimestre — ${ano}`, inicio: tri1Inicio, fim: tri1Fim };
  if (hoje >= tri2Inicio && hoje <= tri2Fim) return { tri: 2, label: `2º Trimestre — ${ano}`, inicio: tri2Inicio, fim: tri2Fim };
  if (hoje >= tri3Inicio && hoje <= tri3Fim) return { tri: 3, label: `3º Trimestre — ${ano}`, inicio: tri3Inicio, fim: tri3Fim };
  // fora do período letivo — retorna o mais próximo
  if (hoje < tri1Inicio) return { tri: 1, label: `1º Trimestre — ${ano}`, inicio: tri1Inicio, fim: tri1Fim };
  return { tri: 3, label: `3º Trimestre — ${ano}`, inicio: tri3Inicio, fim: tri3Fim };
}
