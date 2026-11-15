import { useQuery } from '@tanstack/react-query';

import { intervaloDeAtualizacao } from '@/shared/lib/canalAoVivo';

import { talhoesApi } from '../api/talhoesApi';
import { talhoesKeys } from '../talhoes.keys';

/** `aoVivo`: atualiza a cada 15 s (o andamento do talhão muda enquanto a máquina trabalha). */
export function useTalhoes({ aoVivo = false }: { aoVivo?: boolean } = {}) {
  const query = useQuery({
    queryKey: talhoesKeys.lista(),
    queryFn: talhoesApi.listar,
    // Talhão muda pouco, mas pode chegar por fora do app (importação pelo computador, desenho no Operations Center):
    // fresco por 1 min; depois disso, abrir uma tela que usa talhões busca de novo (a resposta é leve e quase sempre "não mudou").
    staleTime: 60 * 1000,
    refetchInterval: aoVivo ? intervaloDeAtualizacao : false,
  });
  const talhoes = query.data ?? [];
  return {
    talhoes,
    areaTotalHa: talhoes.reduce((soma, t) => soma + t.areaHa, 0),
    carregando: query.isPending,
    erro: query.error,
    atualizando: query.isRefetching,
    atualizar: () => void query.refetch(),
  };
}
