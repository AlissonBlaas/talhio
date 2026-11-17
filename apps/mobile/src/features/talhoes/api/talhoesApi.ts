import { ListaTalhoesSchema, TalhaoApagadoSchema, TalhaoSchema, type EditarTalhao, type NovoTalhao, type Talhao, type TalhaoApagado } from '@talhio/shared';

import { apiClient } from '@/shared/lib/apiClient';

export const talhoesApi = {
  // Um talhão com dado estranho (área zero, contorno incompleto) fica de fora sozinho: antes, um só inválido
  // derrubava a lista inteira e o mapa abria sem nenhum talhão.
  listar: async (): Promise<Talhao[]> => {
    const bruto = await apiClient.get('/talhoes');
    if (!Array.isArray(bruto)) return ListaTalhoesSchema.parse(bruto);
    return bruto.flatMap((item) => {
      const lido = TalhaoSchema.safeParse(item);
      return lido.success ? [lido.data] : [];
    });
  },
  criar: async (dados: NovoTalhao): Promise<Talhao> => TalhaoSchema.parse(await apiClient.post('/talhoes', dados)),
  editar: async ({ id, ...dados }: EditarTalhao & { id: string }): Promise<Talhao> => TalhaoSchema.parse(await apiClient.put(`/talhoes/${encodeURIComponent(id)}`, dados)),
  apagar: async ({ id, naDeere }: { id: string; naDeere: boolean }): Promise<TalhaoApagado> =>
    TalhaoApagadoSchema.parse(await apiClient.apagar(`/talhoes/${encodeURIComponent(id)}${naDeere ? '?naDeere=1' : ''}`)),
};
