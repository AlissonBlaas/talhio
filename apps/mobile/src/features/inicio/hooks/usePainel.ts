import { useQuery } from '@tanstack/react-query';

import { intervaloDeAtualizacao } from '@/shared/lib/canalAoVivo';

import { painelApi } from '../api/painelApi';
import { inicioKeys } from '../inicio.keys';

/** Só o estado da primeira carga (carregando/erro): não renderiza quando os dados mudam. */
export function usePainelEstado() {
  const query = useQuery({
    queryKey: inicioKeys.painel(),
    queryFn: painelApi.buscar,
    refetchInterval: intervaloDeAtualizacao,
    refetchIntervalInBackground: false,
    select: () => true,
    notifyOnChangeProps: ['isPending', 'error'],
  });
  return { carregando: query.isPending, erro: query.error, atualizar: () => void query.refetch() };
}
