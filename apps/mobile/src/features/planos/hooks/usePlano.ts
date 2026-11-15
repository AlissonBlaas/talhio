import { useQuery } from '@tanstack/react-query';

import { planosApi } from '../api/planosApi';
import { planosKeys } from '../planos.keys';

export function usePlano(id: string) {
  const query = useQuery({ queryKey: planosKeys.plano(id), queryFn: () => planosApi.buscar(id), staleTime: 5 * 60 * 1000 });
  return { plano: query.data ?? null, carregando: query.isPending, erro: query.error, atualizar: () => void query.refetch() };
}

/** O plano mais recente que inclui o talhão, se houver. */
export function usePlanoDoTalhao(talhaoId: string) {
  const query = useQuery({ queryKey: planosKeys.lista(), queryFn: planosApi.listar, staleTime: 5 * 60 * 1000 });
  return (query.data ?? []).find((plano) => plano.talhoes.some((t) => t.id === talhaoId)) ?? null;
}
