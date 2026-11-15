import type { EstadoWhatsapp, GrupoWhatsapp } from '@talhio/shared';

/** O que o provedor sabe: o grupo escolhido fica guardado no banco, não na conexão. */
export type EstadoDaConexao = Omit<EstadoWhatsapp, 'grupo'>;

/** Arquivo que vai junto da mensagem (o PDF do relatório). O texto vira a legenda. */
export interface AnexoWhatsapp {
  arquivo: Uint8Array;
  nome: string;
  tipo: string;
}

export const PROVEDOR_WHATSAPP = Symbol('PROVEDOR_WHATSAPP');

/** O que o resto da API conhece do WhatsApp. Só `baileys-whatsapp.ts` fala com a biblioteca. */
export interface ProvedorWhatsapp {
  /** Gera o código de pareamento para o número. A pessoa digita no WhatsApp; a conexão abre sozinha. */
  pedirCodigo(orgId: string, telefone: string): Promise<string>;
  estado(orgId: string): Promise<EstadoDaConexao>;
  /** Grupos em que o número conectado está. */
  listarGrupos(orgId: string): Promise<GrupoWhatsapp[]>;
  /** Manda texto para um grupo (`grupoId` termina em @g.us), com um arquivo anexo se houver. */
  enviarNoGrupo(orgId: string, grupoId: string, texto: string, anexo?: AnexoWhatsapp): Promise<void>;
  /** Manda uma mensagem de texto. `telefone` só com dígitos e código do país. */
  enviarTexto(orgId: string, telefone: string, texto: string): Promise<void>;
  /** Sai do aparelho conectado e apaga as credenciais. */
  desconectar(orgId: string): Promise<void>;
}
