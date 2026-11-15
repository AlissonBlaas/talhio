import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { assistenteApi } from '../api/assistenteApi';
import { assistenteKeys } from '../assistente.keys';

/** As conversas anteriores de quem está logado, em páginas. Só busca quando o histórico está aberto. */
export function useHistorico(aberto: boolean) {
  const queryClient = useQueryClient();
  const lista = useInfiniteQuery({
    queryKey: assistenteKeys.conversas(),
    queryFn: ({ pageParam }) => assistenteApi.listarConversas(pageParam),
    initialPageParam: 0,
    getNextPageParam: (pagina) => pagina.proximo,
    enabled: aberto,
    staleTime: 60_000,
    // Ao reabrir depois de muito tempo, volta a buscar só a primeira página, não todas as já vistas.
    maxPages: 10,
  });
  const apagar = useMutation({
    mutationFn: assistenteApi.apagarConversa,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: assistenteKeys.conversas() }),
  });
  // Uma conversa pode aparecer em duas páginas se a lista mudou entre uma busca e outra.
  const vistas = new Set<string>();
  const conversas = (lista.data?.pages ?? []).flatMap((p) => p.conversas).filter((c) => !vistas.has(c.id) && vistas.add(c.id));
  return {
    conversas,
    carregando: lista.isPending && aberto,
    erro: lista.error ?? apagar.error,
    atualizar: () => void lista.refetch(),
    carregandoMais: lista.isFetchingNextPage,
    carregarMais: () => {
      if (lista.hasNextPage && !lista.isFetchingNextPage) void lista.fetchNextPage();
    },
    apagar: apagar.mutateAsync,
  };
}
