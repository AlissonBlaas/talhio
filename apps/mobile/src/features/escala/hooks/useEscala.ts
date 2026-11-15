import { useQuery } from '@tanstack/react-query';

import { escalaApi } from '../api/escalaApi';
import { escalaKeys } from '../escala.keys';

/** A escala de um dia (AAAA-MM-DD). Sem `dia`, a de hoje. */
export function useEscala(dia?: string) {
  const query = useQuery({
    queryKey: escalaKeys.doDia(dia),
    queryFn: () => escalaApi.buscar(dia),
    // A escala só muda quando alguém edita: fresca por 5 min, e as mudanças feitas aqui já atualizam o cache.
    staleTime: 5 * 60 * 1000,
  });
  return {
    escala: query.data ?? null,
    carregando: query.isPending,
    erro: query.error,
    atualizando: query.isRefetching,
    atualizar: () => void query.refetch(),
  };
}
