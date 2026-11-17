import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CodigoWhatsapp, EstadoWhatsapp } from '@talhio/shared';

import { whatsappApi } from '../api/whatsappApi';
import { whatsappKeys } from '../whatsapp.keys';

/** Gerar código, escolher o grupo, testar e desconectar. Cada uma refaz o estado que a tela mostra. */
export function useMudarWhatsapp() {
  const queryClient = useQueryClient();
  const guardar = (estado: EstadoWhatsapp) => queryClient.setQueryData(whatsappKeys.estado(), estado);

  // O código fica no cache, não na mutação: quem pede (tela do número) e quem mostra (tela do código) são componentes
  // diferentes, e a mutação some junto com a primeira assim que o servidor passa a "aguardando-codigo".
  const codigoGerado = useQuery<CodigoWhatsapp | null>({ queryKey: whatsappKeys.codigo(), queryFn: () => null, enabled: false, staleTime: Infinity, gcTime: Infinity });
  const codigo = useMutation({
    mutationFn: whatsappApi.pedirCodigo,
    onSuccess: (novo) => {
      queryClient.setQueryData(whatsappKeys.codigo(), novo);
      void queryClient.invalidateQueries({ queryKey: whatsappKeys.estado() });
    },
  });
  const escolherGrupo = useMutation({ mutationFn: whatsappApi.escolherGrupo, onSuccess: guardar });
  const tirarGrupo = useMutation({ mutationFn: whatsappApi.tirarGrupo, onSuccess: guardar });
  const teste = useMutation({ mutationFn: whatsappApi.teste });
  const desconectar = useMutation({
    mutationFn: whatsappApi.desconectar,
    onSuccess: (estado) => {
      guardar(estado);
      codigo.reset();
      queryClient.setQueryData(whatsappKeys.codigo(), null);
      queryClient.removeQueries({ queryKey: whatsappKeys.grupos() });
    },
  });

  return {
    pedirCodigo: codigo.mutate,
    pedindoCodigo: codigo.isPending,
    /** Último código gerado nesta tela (some ao desconectar). */
    codigo: codigoGerado.data?.codigo ?? null,
    escolherGrupo: escolherGrupo.mutate,
    escolhendoGrupo: escolherGrupo.isPending,
    tirarGrupo: tirarGrupo.mutate,
    testar: () => teste.mutate(),
    testando: teste.isPending,
    testeEnviado: teste.isSuccess,
    desconectar: () => desconectar.mutate(),
    desconectando: desconectar.isPending,
    erro: codigo.error ?? escolherGrupo.error ?? tirarGrupo.error ?? teste.error ?? desconectar.error,
  };
}
