import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notificacoesApi } from '../api/notificacoesApi';
import { notificacoesKeys } from '../notificacoes.keys';

/** As notificações da fazenda e quantas ainda não foram vistas. Atualiza a cada minuto com o app aberto. */
export function useNotificacoes() {
  const query = useQuery({
    queryKey: notificacoesKeys.lista(),
    queryFn: notificacoesApi.listar,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  return {
    itens: query.data?.itens ?? [],
    naoLidas: query.data?.naoLidas ?? 0,
    carregando: query.isPending,
    erro: query.error,
    atualizando: query.isRefetching,
    atualizar: () => void query.refetch(),
  };
}

/** Só o contador (o sino da tela inicial): usa a mesma consulta, sem pedir de novo. */
export function useNaoLidas(): number {
  return useNotificacoes().naoLidas;
}

/** O usuário abriu a aba: marca tudo como visto e zera o contador na hora. */
export function useMarcarLidas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificacoesApi.marcarLidas,
    onSuccess: () => {
      queryClient.setQueryData(notificacoesKeys.lista(), (atual: { itens: unknown[]; naoLidas: number } | undefined) => (atual ? { ...atual, naoLidas: 0 } : atual));
    },
  });
}
