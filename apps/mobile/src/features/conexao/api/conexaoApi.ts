import { AvisoDeereSchema, ConexaoDeereSchema, InicioDaConexaoSchema, ListaOrganizacoesDeereSchema, type AvisoDeere, type ConexaoDeere, type InicioDaConexao, type OrganizacaoDeere } from '@talhio/shared';

import { apiClient } from '@/shared/lib/apiClient';

export interface PassoDeDiagnostico {
  passo: string;
  status: number | string;
  total: number | null;
  nota?: string;
}

export const conexaoApi = {
  estado: async (): Promise<ConexaoDeere> => ConexaoDeereSchema.parse(await apiClient.get('/deere/conexao')),
  iniciar: async (): Promise<InicioDaConexao> => InicioDaConexaoSchema.parse(await apiClient.post('/deere/conexao/iniciar', {})),
  concluir: async (codigo: string, estado: string): Promise<ConexaoDeere> => ConexaoDeereSchema.parse(await apiClient.post('/deere/conexao/concluir', { codigo, estado })),
  organizacoes: async (): Promise<OrganizacaoDeere[]> => ListaOrganizacoesDeereSchema.parse(await apiClient.get('/deere/organizacoes')).organizacoes,
  escolher: async (organizacaoIds: string[]): Promise<ConexaoDeere> => ConexaoDeereSchema.parse(await apiClient.post('/deere/organizacao', { organizacaoIds })),
  conferir: async (): Promise<ConexaoDeere> => ConexaoDeereSchema.parse(await apiClient.post('/deere/conexao/conferir', {})),
  diagnostico: async (): Promise<PassoDeDiagnostico[]> => (await apiClient.get('/deere/diagnostico')) as PassoDeDiagnostico[],
  ativarAviso: async (): Promise<AvisoDeere> => AvisoDeereSchema.parse(await apiClient.post('/deere/aviso', {})),
  desconectar: () => apiClient.apagar('/deere/conexao'),
};
