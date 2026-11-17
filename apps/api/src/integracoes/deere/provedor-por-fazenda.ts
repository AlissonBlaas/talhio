import type { ProvedorMaquinas } from '@talhio/deere';

/**
 * Escolhe a fonte dos dados pela fazenda: a de demonstração lê o `demo` (dados de exemplo), todas as outras o `real`
 * (John Deere). Os métodos opcionais da interface sempre existem aqui: se a fonte daquela fazenda não os tem, devolvem
 * vazio ou nulo, e quem testava `if (provedor.x)` continua funcionando.
 */
export class ProvedorPorFazenda implements ProvedorMaquinas {
  constructor(
    private readonly demo: ProvedorMaquinas,
    private readonly real: ProvedorMaquinas,
    private readonly ehDemo: (orgId: string) => boolean,
  ) {}

  private de(orgId: string): ProvedorMaquinas {
    return this.ehDemo(orgId) ? this.demo : this.real;
  }

  listarMaquinas(orgId: string) {
    return this.de(orgId).listarMaquinas(orgId);
  }
  ultimaPosicao(orgId: string, maquinaId: string) {
    return this.de(orgId).ultimaPosicao(orgId, maquinaId);
  }
  listarTalhoes(orgId: string) {
    return this.de(orgId).listarTalhoes(orgId);
  }
  medicoes(orgId: string, maquinaId: string) {
    return this.de(orgId).medicoes(orgId, maquinaId);
  }
  atividadeDoDia(orgId: string, maquinaId: string) {
    return this.de(orgId).atividadeDoDia(orgId, maquinaId);
  }
  atividadeNoDia(orgId: string, maquinaId: string, dia: string) {
    return this.de(orgId).atividadeNoDia(orgId, maquinaId, dia);
  }
  resumoDaFazenda(orgId: string) {
    return this.de(orgId).resumoDaFazenda(orgId);
  }
  listarLinhas(orgId: string) {
    return this.de(orgId).listarLinhas(orgId);
  }
  enviarLinha(orgId: string, linha: Parameters<ProvedorMaquinas['enviarLinha']>[1], chaveIdempotencia: string) {
    return this.de(orgId).enviarLinha(orgId, linha, chaveIdempotencia);
  }
  importarFazenda(orgId: string, fazenda: Parameters<ProvedorMaquinas['importarFazenda']>[1], opcoes?: { aoSubir?: boolean }) {
    return this.de(orgId).importarFazenda(orgId, fazenda, opcoes);
  }
  enviarPlano(orgId: string, plano: Parameters<ProvedorMaquinas['enviarPlano']>[1], chaveIdempotencia: string) {
    return this.de(orgId).enviarPlano(orgId, plano, chaveIdempotencia);
  }

  // ---- Opcionais: sem o método na fonte da fazenda, vazio ou nulo ----

  async usoDeHoje(orgId: string, maquinaId: string) {
    const p = this.de(orgId);
    return p.usoDeHoje ? p.usoDeHoje(orgId, maquinaId) : null;
  }
  async analiseDaMaquina(orgId: string, maquinaId: string, de: string, ate: string) {
    const p = this.de(orgId);
    return p.analiseDaMaquina ? p.analiseDaMaquina(orgId, maquinaId, de, ate) : { maquinaId, de, ate, grupos: [] };
  }
  async alertasDaMaquina(orgId: string, maquinaId: string, desde: Date, ate?: Date) {
    const p = this.de(orgId);
    return p.alertasDaMaquina ? p.alertasDaMaquina(orgId, maquinaId, desde, ate) : [];
  }
  async consumoDiario(orgId: string, maquinaId: string, desde: string, ate: string) {
    const p = this.de(orgId);
    return p.consumoDiario ? p.consumoDiario(orgId, maquinaId, desde, ate) : [];
  }
  async areaDasOperacoes(orgId: string, de: string, ate: string) {
    const p = this.de(orgId);
    return p.areaDasOperacoes ? p.areaDasOperacoes(orgId, de, ate) : [];
  }
  async rastroDeHoje(orgId: string, maquinaId: string) {
    const p = this.de(orgId);
    return p.rastroDeHoje ? p.rastroDeHoje(orgId, maquinaId) : [];
  }
  caminhoDeHoje(orgId: string, maquinaId: string) {
    const p = this.de(orgId);
    return p.caminhoDeHoje ? p.caminhoDeHoje(orgId, maquinaId) : [];
  }
  async paradasDeHoje(orgId: string, maquinaId: string) {
    const p = this.de(orgId);
    return p.paradasDeHoje ? p.paradasDeHoje(orgId, maquinaId) : [];
  }
  async nomeDaFazenda(orgId: string) {
    const p = this.de(orgId);
    return p.nomeDaFazenda ? p.nomeDaFazenda(orgId) : (await p.resumoDaFazenda(orgId)).nome;
  }
  async enviarTalhao(orgId: string, talhao: { nome: string; contorno: [number, number][] }) {
    const p = this.de(orgId);
    if (!p.enviarTalhao) throw new Error('esta fonte de dados não cria talhões');
    return p.enviarTalhao(orgId, talhao);
  }
  async sincronizar(orgId: string) {
    const p = this.de(orgId);
    return p.sincronizar ? p.sincronizar(orgId) : { lidas: 0, esperando: 0, falhas: 0 };
  }
  async recuperarPassado(orgId: string, limite?: number, diasAtras?: number) {
    const p = this.de(orgId);
    return p.recuperarPassado ? p.recuperarPassado(orgId, limite, diasAtras) : { fechados: 0, faltam: 0 };
  }
  async larguraMudou(orgId: string) {
    await this.de(orgId).larguraMudou?.(orgId);
  }
  async aquecer(orgId: string) {
    await this.de(orgId).aquecer?.(orgId);
  }
  esquecer(orgId: string) {
    this.de(orgId).esquecer?.(orgId);
  }
}
