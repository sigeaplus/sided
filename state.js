// ============================================
// STATE.JS - Estado Global do Sistema
// ============================================

// Turmas e dados da turma ativa
let todasTurmas = [];
let turmaAtiva = null;
let turmaDisciplinaAtiva = null; // <-- NOVA VARIAVEL: turma_disciplina ativa!
let alunosTurma = [];
let aulasTurma = [];
let avaliacoesTurma = [];

// Estado de disciplina no filtro de avaliações (Fundamental I)
let avalDiscFiltro = null;

// Avaliação e chamada ativa
let avaliacaoAtiva = null;
let chamadaTemp = {};

// Cache e relatórios
let relatorioCache = [];
let feriadosCache = [];

// Filtros de visualização
let filtrosAtivos = { ano: null, turno: null };

// Disciplinas do Fundamental I
const FUNDAMENTAL_I_DISCIPLINAS = ['PORTUGUES','MATEMATICA','CIENCIAS','GEOGRAFIA','HISTORIA','INGLES','ED FISICA','ENS RELIGIOSO','OUTRO'];

// Estado do calendário
let calState = { 
  'cal-aula': { ano: new Date().getFullYear(), mes: new Date().getMonth() }, 
  'cal-chamada': { ano: new Date().getFullYear(), mes: new Date().getMonth() } 
};

// Edição de aulas e avaliações
let editandoAulaId = null;
let editandoAvalId = null;

// Trimestre ativo
let triAtivo = '';

// Modo de seleção de aulas
let modoSelecaoAulas = false;
let aulasSelecionadas = new Set();

// Grupos e composição
let grupoComposicaoSelecionada = [];
let grupoEntrouId = null;
let gruposAvaliacaoConfig = JSON.parse(localStorage.getItem('sided_grupos_avaliacoes') || '{}');
let modoGrupoNotasAtivo = null; // { grupoId, tipo, subAvals }
