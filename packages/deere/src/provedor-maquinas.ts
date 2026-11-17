import type { FazendaImportada } from './gen4';
import type {
  AtividadeDiariaExterna,
  AtividadeExterna,
  LinhaExterna,
  MaquinaExterna,
  MedicoesExternas,
  PlanoExterno,
  PosicaoExterna,
  UsoDoDiaExterno,
  ResultadoSincronizacao,
  ResumoFazendaExterno,
  TalhaoExterno,
} from './tipos';

/**
 * Porta única para qualquer fonte de dados de máquinas.
 * Implementações: FakeProvedor (dados falsos) e DeereProvedor (API real).
 * Outras marcas entram como novas implementações desta mesma interface.
 */
export interface ProvedorMaquinas {
  listarMaquinas(orgId: string): Promise<MaquinaExterna[]>;
  ultimaPosicao(orgId: string, maquinaId: string): Promise<PosicaoExterna | null>;
  listarTalhoes(orgId: string): Promise<TalhaoExterno[]>;
  medicoes(orgId: string, maquinaId: string): Promise<MedicoesExternas>;
  /** Caminho feito hoje pela máquina, em trechos de [lng, lat]. Devolve o que já tem e completa por trás. */
  /** Horas trabalhando, ocioso e em transporte hoje, e litros gastos. Nulo se a fonte não informa. */
  usoDeHoje?(orgId: string, maquinaId: string): Promise<UsoDoDiaExterno | null>;
  /** Consumo de combustível e horas de motor por dia (Machine Measurements), de `desde` a `ate` (AAAA-MM-DD). Até 30 dias por chamada. */
  /** Todas as medições do Analisador da Máquina no período (de a ate, AAAA-MM-DD, até 30 dias). */
  analiseDaMaquina?(orgId: string, maquinaId: string, de: string, ate: string): Promise<import('./medicoes-analise').AnaliseDaMaquina>;
  /** Alertas (falhas, cerca eletrônica, manutenção) que a máquina registrou no período, do mais antigo para o mais novo. */
  alertasDaMaquina?(orgId: string, maquinaId: string, desde: Date, ate?: Date): Promise<import('./alertas').AlertaDaMaquina[]>;
  consumoDiario?(orgId: string, maquinaId: string, desde: string, ate: string): Promise<import('./medicoes').ConsumoDoDia[]>;
  /** Área e horas por máquina e dia, de `de` a `ate` (AAAA-MM-DD), pelas operações de campo. Espera a John Deere. */
  areaDasOperacoes?(orgId: string, de: string, ate: string): Promise<import('./deere-provedor').AreaDoDia[]>;
  rastroDeHoje?(orgId: string, maquinaId: string): Promise<[number, number][][]>;
  /** Pontos do caminho de hoje, em ordem de hora (o que `rastroDeHoje` já guardou). Não consulta o fornecedor. */
  caminhoDeHoje?(orgId: string, maquinaId: string): { t: number; lng: number; lat: number; kmh: number }[];
  /** Paradas de hoje ao longo do caminho (2 min ou mais). Lê do que `rastroDeHoje` já guardou. */
  paradasDeHoje?(orgId: string, maquinaId: string): Promise<{ lng: number; lat: number; inicio: string; minutos: number }[]>;
  atividadeDoDia(orgId: string, maquinaId: string): Promise<AtividadeExterna>;
  /** Totais da máquina no dia informado (AAAA-MM-DD, no fuso da fazenda). */
  atividadeNoDia(orgId: string, maquinaId: string, dia: string): Promise<AtividadeDiariaExterna>;
  resumoDaFazenda(orgId: string): Promise<ResumoFazendaExterno>;
  /** Só o nome da fazenda, sem o andamento por talhão (barato; o relatório usa este). */
  nomeDaFazenda?(orgId: string): Promise<string>;
  listarLinhas(orgId: string): Promise<LinhaExterna[]>;
  enviarLinha(orgId: string, linha: LinhaExterna, chaveIdempotencia: string): Promise<void>;
  /**
   * Cria UM talhão (com o contorno) na conta do fabricante e devolve o id dele lá. Talhão com o mesmo nome que já
   * exista é reaproveitado, sem contorno novo. ESCREVE na conta do cliente: só a pedido explícito de quem salva.
   */
  enviarTalhao?(orgId: string, talhao: { nome: string; contorno: [number, number][] }): Promise<string>;
  /**
   * Leva para um talhão que o Talhio criou na conta (`deereId`) o nome e o contorno como ficaram depois de editado:
   * o contorno novo passa a ser o ativo. ESCREVE na conta do cliente: só a pedido explícito de quem salva.
   */
  atualizarTalhao?(orgId: string, deereId: string, talhao: { nome: string; contorno: [number, number][] }): Promise<void>;
  /**
   * Arquiva na conta um talhão que o Talhio criou lá. Não apaga: dá para desarquivar no Operations Center.
   * ESCREVE na conta do cliente: só a pedido explícito, e nunca num talhão que não foi o Talhio que criou.
   */
  arquivarTalhao?(orgId: string, deereId: string): Promise<void>;
  /**
   * Recebe talhões e linhas lidos de arquivo (ver `lerArquivosGen4`).
   * No provedor real: cria talhões, contornos e linhas de guia no Operations Center.
   */
  importarFazenda(orgId: string, fazenda: FazendaImportada, opcoes?: { aoSubir?: boolean }): Promise<void>;
  /** Traz para o banco do Talhio o que demora para chegar (exports da Deere). Só o provedor real tem. */
  sincronizar?(orgId: string): Promise<ResultadoSincronizacao>;
  /** Lê, aos poucos, o caminho dos dias passados e guarda o fechamento de cada dia. Só o provedor real tem. */
  recuperarPassado?(orgId: string, limite?: number, diasAtras?: number): Promise<{ fechados: number; faltam: number }>;
  /** A largura do implemento de uma máquina mudou: refaz os hectares calculados pelo caminho. */
  larguraMudou?(orgId: string): Promise<void>;
  /** Deixa em memória o que as telas pedem ao abrir, para o primeiro acesso não esperar o fornecedor. */
  aquecer?(orgId: string): Promise<void>;
  /** Joga fora o que estava guardado da fazenda (ex.: trocou de organização). */
  esquecer?(orgId: string): void;
  enviarPlano(orgId: string, plano: PlanoExterno, chaveIdempotencia: string): Promise<void>;
}
