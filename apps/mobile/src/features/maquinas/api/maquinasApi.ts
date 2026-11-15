import { AnaliseDaMaquinaSchema, ListaMaquinasSchema, ListaRastrosSchema, MaquinaSchema, type AnaliseDaMaquina, type Maquina, type RastroDaMaquina } from '@talhio/shared';

import { apiClient } from '@/shared/lib/apiClient';

/** Camada de dados: só fala com o backend e devolve dados validados pelo contrato. */
export const maquinasApi = {
  listar: async (): Promise<Maquina[]> => ListaMaquinasSchema.parse(await apiClient.get('/maquinas')),
  rastros: async (): Promise<RastroDaMaquina[]> => ListaRastrosSchema.parse(await apiClient.get('/maquinas/rastros')),
  definirLargura: async (id: string, larguraM: number | null): Promise<Maquina> => MaquinaSchema.parse(await apiClient.post(`/maquinas/${id}/largura`, { larguraM })),
  /** Todas as medições do Analisador da Máquina da Deere no período (de a ate, AAAA-MM-DD). */
  analise: async (id: string, de: string, ate: string): Promise<AnaliseDaMaquina> => AnaliseDaMaquinaSchema.parse(await apiClient.get(`/maquinas/${id}/analise?de=${de}&ate=${ate}`)),
  buscar: async (id: string): Promise<Maquina> => MaquinaSchema.parse(await apiClient.get(`/maquinas/${id}`)),
};
