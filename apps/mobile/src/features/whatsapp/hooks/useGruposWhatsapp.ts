import { useQuery } from '@tanstack/react-query';

import { whatsappApi } from '../api/whatsappApi';
import { whatsappKeys } from '../whatsapp.keys';

/** Grupos do WhatsApp conectado. Só busca quando a tela precisa (`ativo`), porque o WhatsApp limita essa leitura. */
export function useGruposWhatsapp(ativo: boolean) {
  const query = useQuery({ queryKey: whatsappKeys.grupos(), queryFn: whatsappApi.grupos, enabled: ativo, staleTime: 60_000 });
  return { grupos: query.data ?? [], carregando: query.isPending && ativo, erro: query.error, atualizar: () => void query.refetch() };
}
