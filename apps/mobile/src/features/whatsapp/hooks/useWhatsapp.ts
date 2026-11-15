import { useQuery } from '@tanstack/react-query';

import { whatsappApi } from '../api/whatsappApi';
import { whatsappKeys } from '../whatsapp.keys';

/** Como está a ligação da fazenda com o WhatsApp. Enquanto espera o código ser digitado, confere a cada 3 s. */
export function useWhatsapp() {
  const query = useQuery({
    queryKey: whatsappKeys.estado(),
    queryFn: whatsappApi.estado,
    staleTime: 30_000,
    refetchInterval: (q) => (q.state.data?.estado === 'aguardando-codigo' || q.state.data?.estado === 'reconectando' ? 3_000 : false),
  });
  return { whatsapp: query.data ?? null, carregando: query.isPending, erro: query.error, atualizar: () => void query.refetch() };
}
