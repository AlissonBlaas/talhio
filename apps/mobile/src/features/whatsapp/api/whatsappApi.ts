import { CodigoWhatsappSchema, EnvioAoGrupoSchema, EstadoWhatsappSchema, ListaGruposWhatsappSchema, type CodigoWhatsapp, type EnvioAoGrupo, type EstadoWhatsapp, type GrupoWhatsapp, type Periodo } from '@talhio/shared';

import { apiClient } from '@/shared/lib/apiClient';

export const whatsappApi = {
  estado: async (): Promise<EstadoWhatsapp> => EstadoWhatsappSchema.parse(await apiClient.get('/whatsapp')),
  pedirCodigo: async (telefone: string): Promise<CodigoWhatsapp> => CodigoWhatsappSchema.parse(await apiClient.post('/whatsapp/codigo', { telefone })),
  grupos: async (): Promise<GrupoWhatsapp[]> => ListaGruposWhatsappSchema.parse(await apiClient.get('/whatsapp/grupos')).grupos,
  escolherGrupo: async (grupoId: string): Promise<EstadoWhatsapp> => EstadoWhatsappSchema.parse(await apiClient.post('/whatsapp/grupo', { grupoId })),
  tirarGrupo: async (): Promise<EstadoWhatsapp> => EstadoWhatsappSchema.parse(await apiClient.apagar('/whatsapp/grupo')),
  /** Manda ao grupo o texto que a tela mostrou (escala do dia, escala de um plano). */
  enviarMensagem: async (texto: string): Promise<EnvioAoGrupo> => EnvioAoGrupoSchema.parse(await apiClient.post('/whatsapp/mensagem', { texto })),
  /** O servidor monta o relatório (PDF + resumo) e manda ao grupo. `data` nulo = período corrente; `maquinaIds` vazio = todas as máquinas. */
  enviarRelatorio: async (periodo: Periodo, data: string | null, maquinaIds: string[] = []): Promise<EnvioAoGrupo> => {
    const consulta = [data ? `data=${data}` : null, maquinaIds.length ? `maquinas=${maquinaIds.map(encodeURIComponent).join(',')}` : null].filter(Boolean).join('&');
    return EnvioAoGrupoSchema.parse(await apiClient.post(`/relatorios/${periodo}/envio${consulta ? `?${consulta}` : ''}`, {}));
  },
  teste: async (): Promise<void> => void (await apiClient.post('/whatsapp/teste', {})),
  desconectar: async (): Promise<EstadoWhatsapp> => EstadoWhatsappSchema.parse(await apiClient.apagar('/whatsapp')),
};
