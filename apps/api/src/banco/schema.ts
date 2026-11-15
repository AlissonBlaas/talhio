import type { FazendaImportada } from '@talhio/deere';
import { boolean, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * Tabelas do Talhio. Toda tabela de dados tem `org_id`: é por ele que cada fazenda só enxerga o que é dela.
 * Depois de mudar este arquivo, gere a migração: `pnpm --filter @talhio/api banco:gerar`.
 */

const criadoEm = () => timestamp('criado_em', { withTimezone: true }).notNull().defaultNow();

export const organizacoes = pgTable('organizacoes', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  criadoEm: criadoEm(),
});

export const usuarios = pgTable(
  'usuarios',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => organizacoes.id),
    nome: text('nome').notNull(),
    /** Sempre em minúsculas. */
    email: text('email').notNull().unique(),
    /** `scrypt$sal$hash`. A senha em texto nunca é guardada. */
    senhaHash: text('senha_hash').notNull(),
    /** admin = pode tudo na fazenda; leitura = só consulta. */
    papel: text('papel', { enum: ['admin', 'leitura'] }).notNull().default('admin'),
    criadoEm: criadoEm(),
  },
  (t) => [index('usuarios_org_idx').on(t.orgId)],
);

export const sessoes = pgTable(
  'sessoes',
  {
    /** SHA-256 do token de renovação. O token em si não fica no banco. */
    tokenHash: text('token_hash').primaryKey(),
    usuarioId: text('usuario_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
    expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [index('sessoes_usuario_idx').on(t.usuarioId), index('sessoes_expira_idx').on(t.expiraEm)],
);

/** Conversas com o assistente. São de quem perguntou: outro usuário da mesma fazenda não as vê. */
export const conversas = pgTable(
  'conversas',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => organizacoes.id),
    usuarioId: text('usuario_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
    titulo: text('titulo').notNull(),
    criadoEm: criadoEm(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('conversas_usuario_idx').on(t.usuarioId, t.atualizadoEm)],
);

export const mensagens = pgTable(
  'mensagens',
  {
    id: text('id').primaryKey(),
    conversaId: text('conversa_id').notNull().references(() => conversas.id, { onDelete: 'cascade' }),
    papel: text('papel', { enum: ['usuario', 'assistente'] }).notNull(),
    texto: text('texto').notNull(),
    /** Ordem dentro da conversa (o relógio sozinho empata quando pergunta e resposta são gravadas juntas). */
    ordem: integer('ordem').notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [index('mensagens_conversa_idx').on(t.conversaId, t.ordem)],
);

type Contorno = { type: 'Polygon'; coordinates: [number, number][][] };
type Ponto = { lat: number; lng: number };

/** Talhões criados no app. (Os que vêm da John Deere são lidos do provedor, não ficam aqui.) */
export const talhoes = pgTable(
  'talhoes',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => organizacoes.id),
    nome: text('nome').notNull(),
    cultura: text('cultura'),
    areaHa: doublePrecision('area_ha').notNull(),
    /** GeoJSON Polygon. Vira coluna PostGIS quando precisarmos de consulta espacial no banco. */
    contorno: jsonb('contorno').$type<Contorno>().notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [index('talhoes_org_idx').on(t.orgId)],
);

/** Linhas AB criadas no app. */
export const linhas = pgTable(
  'linhas',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => organizacoes.id),
    /** Pode apontar para um talhão do provedor, por isso não é chave estrangeira. */
    talhaoId: text('talhao_id'),
    nome: text('nome').notNull(),
    a: jsonb('a').$type<Ponto>().notNull(),
    b: jsonb('b').$type<Ponto>().notNull(),
    direcaoGraus: doublePrecision('direcao_graus').notNull(),
    padraoDaFazenda: boolean('padrao_da_fazenda').notNull().default(false),
    criadoEm: criadoEm(),
  },
  (t) => [index('linhas_org_idx').on(t.orgId)],
);

/** Escala do dia: quem opera cada máquina, em que talhão e fazendo o quê. Uma linha por máquina e dia. */
export const escalas = pgTable(
  'escalas',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => organizacoes.id),
    /** AAAA-MM-DD no fuso da fazenda. */
    dia: text('dia').notNull(),
    /** Máquina do provedor (John Deere), por isso não é chave estrangeira. */
    maquinaId: text('maquina_id').notNull(),
    operador: text('operador').notNull(),
    tarefa: text('tarefa'),
    talhaoId: text('talhao_id'),
    turno: text('turno', { enum: ['dia-todo', 'manha', 'tarde', 'noite'] }).notNull().default('dia-todo'),
    enviadaEm: timestamp('enviada_em', { withTimezone: true }),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex('escalas_org_dia_maquina_idx').on(t.orgId, t.dia, t.maquinaId)],
);

/** Planos de trabalho montados no app. O envio ao monitor depende da John Deere (Work Plans). */
export const planos = pgTable(
  'planos',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => organizacoes.id),
    /** Talhões e máquinas podem vir do provedor, por isso são listas de ids e não chaves estrangeiras. */
    talhaoIds: jsonb('talhao_ids').$type<string[]>().notNull(),
    maquinaIds: jsonb('maquina_ids').$type<string[]>().notNull(),
    operacao: text('operacao', { enum: ['plantio', 'pulverizacao', 'adubacao', 'colheita'] }).notNull(),
    cultura: text('cultura'),
    variedade: text('variedade'),
    sementesPorHa: doublePrecision('sementes_por_ha'),
    espacamentoCm: doublePrecision('espacamento_cm'),
    produto: text('produto'),
    doseProduto: doublePrecision('dose_produto'),
    /** AAAA-MM-DD no fuso da fazenda. */
    dataInicio: text('data_inicio').notNull(),
    recado: text('recado'),
    criadoEm: criadoEm(),
  },
  (t) => [index('planos_org_idx').on(t.orgId, t.criadoEm)],
);

/**
 * A fazenda importada dos arquivos do monitor (talhões e linhas), já lida. Uma por organização:
 * cada importação substitui a anterior. Fica no banco para sobreviver a reinício e a troca de servidor.
 */
export const fazendasImportadas = pgTable('fazendas_importadas', {
  orgId: text('org_id').primaryKey().references(() => organizacoes.id),
  dados: jsonb('dados').$type<FazendaImportada>().notNull(),
  importadaEm: timestamp('importada_em', { withTimezone: true }).notNull().defaultNow(),
});

/** Ligação da fazenda com a John Deere. Os tokens ficam cifrados (AES-256-GCM); nunca em texto. */
export const conexoesDeere = pgTable('conexoes_deere', {
  orgId: text('org_id').primaryKey().references(() => organizacoes.id, { onDelete: 'cascade' }),
  acessoCifrado: text('acesso_cifrado').notNull(),
  renovacaoCifrada: text('renovacao_cifrada').notNull(),
  /** Quando o token de acesso vence (a Deere dá 12 h). */
  expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
  escopos: text('escopos').notNull(),
  /** Organização do Operations Center escolhida para esta fazenda. */
  deereOrgId: text('deere_org_id'),
  deereOrgNome: text('deere_org_nome'),
  /** Outras organizações usadas junto com a principal (ids separados por vírgula). */
  deereOrgExtras: text('deere_org_extras').notNull().default(''),
  /** true enquanto a organização ainda precisa liberar o app no site da Deere. */
  precisaLiberar: boolean('precisa_liberar').notNull().default(false),
  conectadoEm: criadoEm(),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
});

/** Quais operações da John Deere já foram lidas (export ponto a ponto) e com que versão, para não pedir de novo. */
export const exportacoesDeere = pgTable(
  'exportacoes_deere',
  {
    orgId: text('org_id').notNull().references(() => organizacoes.id, { onDelete: 'cascade' }),
    operacaoId: text('operacao_id').notNull(),
    versao: text('versao').notNull(),
    lidoEm: timestamp('lido_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.operacaoId] })],
);

/** Largura do implemento que o administrador informou para cada máquina, em metros. Entra na conta dos hectares. */
export const largurasDeImplemento = pgTable(
  'larguras_de_implemento',
  {
    orgId: text('org_id').notNull().references(() => organizacoes.id, { onDelete: 'cascade' }),
    maquinaId: text('maquina_id').notNull(),
    larguraM: doublePrecision('largura_m').notNull(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.maquinaId] })],
);

/** Fechamento do dia de cada máquina, calculado do caminho que ela fez (busca do passado). Um por máquina e dia. */
export const usoDiario = pgTable(
  'uso_diario',
  {
    orgId: text('org_id').notNull().references(() => organizacoes.id, { onDelete: 'cascade' }),
    maquinaId: text('maquina_id').notNull(),
    dia: text('dia').notNull(),
    trabalhandoH: doublePrecision('trabalhando_h').notNull(),
    ociosoH: doublePrecision('ocioso_h').notNull(),
    transporteH: doublePrecision('transporte_h').notNull(),
    areaHa: doublePrecision('area_ha').notNull(),
    /** Da área do dia, quanto foi fora de todos os talhões. */
    areaForaHa: doublePrecision('area_fora_ha').notNull().default(0),
    paradas: integer('paradas').notNull(),
    porTalhao: jsonb('por_talhao').$type<{ talhaoId: string | null; nome: string; andandoH: number; paradoH: number }[]>().notNull(),
    pontos: integer('pontos').notNull(),
    /** Litros gastos no dia, pela queda do nível do tanque. Nulo sem leitura confiável. */
    combustivelL: doublePrecision('combustivel_l'),
    fechadoEm: timestamp('fechado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.maquinaId, t.dia] })],
);

/** Totais por operação, máquina e dia, tirados do export. O app lê daqui: já está pronto quando o usuário entra. */
export const atividadeDeere = pgTable(
  'atividade_deere',
  {
    orgId: text('org_id').notNull().references(() => organizacoes.id, { onDelete: 'cascade' }),
    operacaoId: text('operacao_id').notNull(),
    maquinaId: text('maquina_id').notNull(),
    dia: text('dia').notNull(),
    horas: doublePrecision('horas').notNull(),
    areaHa: doublePrecision('area_ha').notNull(),
    combustivelL: doublePrecision('combustivel_l').notNull(),
    paradoMin: doublePrecision('parado_min').notNull(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.operacaoId, t.maquinaId, t.dia] }), index('atividade_deere_busca').on(t.orgId, t.maquinaId, t.dia)],
);

/**
 * Ligação da fazenda com o WhatsApp (Baileys): só o estado, uma linha pequena por fazenda. Credenciais e chaves de
 * sessão ficam no Redis (cifradas): mudam o tempo todo e crescem, não cabem no Postgres.
 */
export const conexoesWhatsapp = pgTable('conexoes_whatsapp', {
  orgId: text('org_id').primaryKey().references(() => organizacoes.id, { onDelete: 'cascade' }),
  /** true depois que o código foi digitado no WhatsApp e a conexão abriu. Só estas voltam sozinhas quando a API sobe. */
  pareado: boolean('pareado').notNull().default(false),
  numero: text('numero'),
  conectadoEm: timestamp('conectado_em', { withTimezone: true }),
  /** Grupo que recebe as notificações da fazenda (escolhido pelo administrador). */
  grupoId: text('grupo_id'),
  grupoNome: text('grupo_nome'),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Combustível ACUMULADO do motor (ISO 15143-3), a última leitura vista em cada dia por máquina. Os litros de um dia
 * são a leitura dele menos a do dia anterior: o mesmo número do monitor, sem estimativa.
 */
export const combustivelAcumulado = pgTable(
  'combustivel_acumulado',
  {
    orgId: text('org_id').notNull().references(() => organizacoes.id, { onDelete: 'cascade' }),
    serie: text('serie').notNull(),
    dia: text('dia').notNull(),
    litros: doublePrecision('litros').notNull(),
    lidoEm: timestamp('lido_em', { withTimezone: true }).notNull().defaultNow(),
    /** Primeira leitura do dia: base do consumo de hoje quando não existe a última de ontem. Nunca é trocada depois. */
    primeiraLitros: doublePrecision('primeira_litros'),
    primeiraEm: timestamp('primeira_em', { withTimezone: true }),
    /** Horas de motor acumuladas (ISO) lidas junto: da última leitura do dia e da primeira. O L/h sai só delas. */
    horasMotor: doublePrecision('horas_motor'),
    primeiraHorasMotor: doublePrecision('primeira_horas_motor'),
    /** Hora (da Deere) em que a máquina reportou cada contador. Combustível e horas chegam em momentos diferentes. */
    litrosEm: timestamp('litros_em', { withTimezone: true }),
    horasEm: timestamp('horas_em', { withTimezone: true }),
    primeiraLitrosEm: timestamp('primeira_litros_em', { withTimezone: true }),
    primeiraHorasEm: timestamp('primeira_horas_em', { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.serie, t.dia] })],
);

/**
 * Consumo de combustível por máquina e dia importado do Operations Center (Analisador da Máquina, export em CSV): o
 * número do monitor, com as horas de motor do mesmo dia. Serve para os dias em que ainda não havia leitura do
 * contador da ISO. Dia sem linha aqui = sem dado importado (não é zero litro).
 */
export const combustivelImportado = pgTable(
  'combustivel_importado',
  {
    orgId: text('org_id').notNull().references(() => organizacoes.id, { onDelete: 'cascade' }),
    /** Id da máquina na John Deere (o mesmo de `uso_diario.maquina_id`). */
    maquinaId: text('maquina_id').notNull(),
    dia: text('dia').notNull(),
    litros: doublePrecision('litros').notNull(),
    /** Horas de motor do mesmo dia (operação + ocioso + transporte), do mesmo arquivo. */
    horasMotor: doublePrecision('horas_motor'),
    /** Litros e horas por estado da máquina (só quando vêm da API Machine Measurements). */
    litrosTrabalhando: doublePrecision('litros_trabalhando'),
    litrosOcioso: doublePrecision('litros_ocioso'),
    litrosTransporte: doublePrecision('litros_transporte'),
    horasTrabalhando: doublePrecision('horas_trabalhando'),
    horasOcioso: doublePrecision('horas_ocioso'),
    horasTransporte: doublePrecision('horas_transporte'),
    /** De onde veio o dia: "csv" (export do Operations Center) ou "api" (Machine Measurements). */
    fonte: text('fonte').notNull().default('csv'),
    importadoEm: timestamp('importado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.maquinaId, t.dia] })],
);

/** Aparelhos que recebem push (token do Expo). Um aparelho pertence a um usuário; sair da conta apaga o token. */
export const dispositivosPush = pgTable(
  'dispositivos_push',
  {
    id: text('id').primaryKey(),
    usuarioId: text('usuario_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
    orgId: text('org_id').notNull().references(() => organizacoes.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    plataforma: text('plataforma', { enum: ['ios', 'android'] }).notNull(),
    criadoEm: timestamp('criado_em', { withTimezone: true }).notNull().defaultNow(),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('dispositivos_push_org_idx').on(t.orgId)],
);

/**
 * Notificações da fazenda (alertas das máquinas): o que aparece na aba do app e o que já virou push. `chave` agrupa
 * os episódios do mesmo problema (ex.: "maquina-parada:741710"): enquanto um episódio está aberto não se avisa de novo,
 * e quando o problema acaba (`resolvidaEm`) um novo episódio pode avisar outra vez.
 */
export const notificacoes = pgTable(
  'notificacoes',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id').notNull().references(() => organizacoes.id, { onDelete: 'cascade' }),
    chave: text('chave').notNull(),
    tipo: text('tipo', { enum: ['maquina-parada', 'sem-sinal', 'combustivel-baixo', 'falha-maquina'] }).notNull(),
    severidade: text('severidade', { enum: ['alta', 'media', 'baixa'] }).notNull(),
    maquinaId: text('maquina_id'),
    maquinaNome: text('maquina_nome'),
    titulo: text('titulo').notNull(),
    texto: text('texto').notNull(),
    criadaEm: timestamp('criada_em', { withTimezone: true }).notNull().defaultNow(),
    resolvidaEm: timestamp('resolvida_em', { withTimezone: true }),
  },
  (t) => [index('notificacoes_org_criada_idx').on(t.orgId, t.criadaEm), index('notificacoes_org_chave_idx').on(t.orgId, t.chave)],
);

/** Até quando cada usuário já viu a aba de notificações (o que veio depois conta como não lido). */
export const notificacoesLidas = pgTable('notificacoes_lidas', {
  usuarioId: text('usuario_id').primaryKey().references(() => usuarios.id, { onDelete: 'cascade' }),
  lidoAte: timestamp('lido_ate', { withTimezone: true }).notNull().defaultNow(),
});
