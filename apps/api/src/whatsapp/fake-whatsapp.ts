import type { GrupoWhatsapp } from '@talhio/shared';
import type { AnexoWhatsapp, EstadoDaConexao, ProvedorWhatsapp } from './whatsapp.tokens.js';

export const GRUPOS_DE_EXEMPLO: GrupoWhatsapp[] = [
  { id: '120363000000000001@g.us', nome: 'Equipe da lavoura', participantes: 14 },
  { id: '120363000000000002@g.us', nome: 'Mecânica e oficina', participantes: 6 },
  { id: '120363000000000003@g.us', nome: 'Família', participantes: 9 },
];

/** Para desenvolvimento e testes: não fala com o WhatsApp. O código "digitado" vale depois de `confirmar`. */
export class FakeWhatsapp implements ProvedorWhatsapp {
  private readonly fazendas = new Map<string, { telefone: string; conectado: boolean; conectadoEm: Date | null }>();
  readonly enviadas: { orgId: string; telefone: string; texto: string }[] = [];
  readonly enviadasNoGrupo: { orgId: string; grupoId: string; texto: string; anexo?: string }[] = [];

  /** `autoConectarMs`: em desenvolvimento, conecta sozinho depois de um tempo (simula a pessoa digitando o código). */
  constructor(private readonly autoConectarMs: number | null = null) {}

  async pedirCodigo(orgId: string, telefone: string): Promise<string> {
    this.fazendas.set(orgId, { telefone, conectado: false, conectadoEm: null });
    if (this.autoConectarMs !== null) setTimeout(() => this.confirmar(orgId), this.autoConectarMs).unref();
    return 'TALH1234';
  }

  /** Simula a pessoa digitando o código no WhatsApp. */
  confirmar(orgId: string): void {
    const f = this.fazendas.get(orgId);
    if (f) this.fazendas.set(orgId, { ...f, conectado: true, conectadoEm: new Date() });
  }

  async estado(orgId: string): Promise<EstadoDaConexao> {
    const f = this.fazendas.get(orgId);
    if (!f) return { estado: 'desconectado', numero: null, conectadoEm: null };
    return f.conectado ? { estado: 'conectado', numero: f.telefone, conectadoEm: f.conectadoEm?.toISOString() ?? null } : { estado: 'aguardando-codigo', numero: null, conectadoEm: null };
  }

  async enviarTexto(orgId: string, telefone: string, texto: string): Promise<void> {
    if (!this.fazendas.get(orgId)?.conectado) throw new Error('WhatsApp não conectado');
    this.enviadas.push({ orgId, telefone, texto });
  }

  async listarGrupos(orgId: string): Promise<GrupoWhatsapp[]> {
    if (!this.fazendas.get(orgId)?.conectado) throw new Error('WhatsApp não conectado');
    return GRUPOS_DE_EXEMPLO;
  }

  async enviarNoGrupo(orgId: string, grupoId: string, texto: string, anexo?: AnexoWhatsapp): Promise<void> {
    if (!this.fazendas.get(orgId)?.conectado) throw new Error('WhatsApp não conectado');
    this.enviadasNoGrupo.push(anexo ? { orgId, grupoId, texto, anexo: anexo.nome } : { orgId, grupoId, texto });
  }

  async desconectar(orgId: string): Promise<void> {
    this.fazendas.delete(orgId);
  }
}

/** Provedor usado quando o servidor não está com o WhatsApp ligado. */
export class WhatsappIndisponivel implements ProvedorWhatsapp {
  async pedirCodigo(): Promise<string> {
    throw new Error('WhatsApp indisponível neste servidor');
  }
  async estado(): Promise<EstadoDaConexao> {
    return { estado: 'indisponivel', numero: null, conectadoEm: null };
  }
  async enviarTexto(): Promise<void> {
    throw new Error('WhatsApp indisponível neste servidor');
  }
  async listarGrupos(): Promise<GrupoWhatsapp[]> {
    throw new Error('WhatsApp indisponível neste servidor');
  }
  async enviarNoGrupo(): Promise<void> {
    throw new Error('WhatsApp indisponível neste servidor');
  }
  async desconectar(): Promise<void> {}
}
