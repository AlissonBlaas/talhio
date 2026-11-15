import type { DefinirEscala, Escala } from '@talhio/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { escalaApi } from '../api/escalaApi';
import { escalaKeys } from '../escala.keys';

export type ItemParaGravar = { maquinaId: string; dados: DefinirEscala };

/**
 * Grava, tira e marca como enviada a escala de um dia (hoje, sem `dia`). Cada resposta já traz a
 * escala nova, que vai direto para o cache.
 */
export function useMudarEscala(dia?: string) {
  const queryClient = useQueryClient();
  const guardar = (escala: Escala) => {
    // A escala de hoje é guardada como "hoje" e pelo próprio dia: as duas ficam vencidas.
    void queryClient.invalidateQueries({ queryKey: escalaKeys.todas });
    queryClient.setQueryData(escalaKeys.doDia(dia), escala);
  };
  const aoMudar = (escala: Escala) => {
    guardar(escala);
    // O operador escalado aparece nos cartões das máquinas, no painel e no assistente.
    void queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== escalaKeys.todas[0] });
  };
  const definir = useMutation({ mutationFn: (item: ItemParaGravar) => escalaApi.definir({ ...item, dia }), onSuccess: aoMudar });
  const tirar = useMutation({ mutationFn: (maquinaId: string) => escalaApi.tirar({ maquinaId, dia }), onSuccess: aoMudar });
  const confirmar = useMutation({ mutationFn: () => escalaApi.confirmar(dia), onSuccess: aoMudar });
  const marcarEnviada = useMutation({ mutationFn: (maquinaIds?: string[]) => escalaApi.marcarEnviada({ dia, maquinaIds }), onSuccess: guardar });
  // Várias máquinas de uma vez (a escala de um plano): uma por uma, na ordem; a última resposta é a escala final.
  const definirVarias = useMutation({
    mutationFn: async (itens: ItemParaGravar[]) => {
      let escala: Escala | null = null;
      for (const item of itens) escala = await escalaApi.definir({ ...item, dia });
      return escala;
    },
    onSuccess: (escala) => {
      if (escala) aoMudar(escala);
    },
  });
  return {
    definir: definir.mutate,
    definirVarias: definirVarias.mutateAsync,
    tirar: tirar.mutate,
    confirmar: confirmar.mutate,
    confirmando: confirmar.isPending,
    erroAoConfirmar: confirmar.error,
    marcarEnviada: marcarEnviada.mutate,
    salvando: definir.isPending || tirar.isPending || definirVarias.isPending,
    erro: definir.error ?? tirar.error ?? definirVarias.error,
    limparErro: () => {
      definir.reset();
      tirar.reset();
      definirVarias.reset();
    },
  };
}
