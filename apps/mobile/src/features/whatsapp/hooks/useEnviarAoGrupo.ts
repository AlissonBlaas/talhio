import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Periodo } from '@talhio/shared';
import { Alert } from 'react-native';

import { useSessao } from '@/shared/lib/sessao';
import { enviarPorWhatsApp } from '@/shared/lib/whatsapp';

import { whatsappApi } from '../api/whatsappApi';
import { whatsappKeys } from '../whatsapp.keys';
import { useWhatsapp } from './useWhatsapp';

type Pedido = {
  /** O texto que a tela mostrou. Vai ao grupo como está; sem grupo, abre o WhatsApp do aparelho com ele. */
  texto: string;
  /** Quando é um relatório: o servidor monta e manda o PDF com o resumo, em vez do texto. */
  relatorio?: { periodo: Periodo; data: string | null; maquinaIds?: string[] };
};

/**
 * Botão "enviar" das telas (relatório, escala, plano). Com o WhatsApp da fazenda conectado e o grupo escolhido,
 * o servidor dispara direto no grupo. Sem isso (ou para quem não é administrador), abre o WhatsApp do aparelho
 * com o texto pronto, como sempre foi.
 */
export function useEnviarAoGrupo() {
  const queryClient = useQueryClient();
  const sessao = useSessao();
  const { whatsapp } = useWhatsapp();
  const admin = sessao.status === 'logado' && sessao.usuario.papel === 'admin';
  const grupo = admin && whatsapp?.estado === 'conectado' ? whatsapp.grupo : null;

  const envio = useMutation({
    mutationFn: ({ texto, relatorio }: Pedido) => (relatorio ? whatsappApi.enviarRelatorio(relatorio.periodo, relatorio.data, relatorio.maquinaIds) : whatsappApi.enviarMensagem(texto)),
    onError: (erro) => {
      Alert.alert('Não foi possível enviar ao grupo', erro instanceof Error ? erro.message : 'Tente de novo.');
      // Pode ter caído ou perdido o grupo: refaz o estado para a tela e o alerta do Início mostrarem o certo.
      void queryClient.invalidateQueries({ queryKey: whatsappKeys.estado() });
    },
  });

  return {
    /** Devolve true se a mensagem saiu (ou se o WhatsApp do aparelho foi aberto). */
    enviar: async (pedido: Pedido): Promise<boolean> => {
      if (!grupo) {
        await enviarPorWhatsApp(pedido.texto);
        return true;
      }
      return envio.mutateAsync(pedido).then(
        () => true,
        () => false,
      );
    },
    enviando: envio.isPending,
    /** true quando o botão dispara direto no grupo da fazenda. */
    paraOGrupo: !!grupo,
    /** Texto do botão: o da tela quando abre o WhatsApp do aparelho; o do grupo quando dispara direto. */
    rotulo: (semGrupo: string, comGrupo = 'Enviar ao grupo do WhatsApp') => (envio.isPending ? 'Enviando ao grupo…' : !grupo ? semGrupo : envio.isSuccess ? `Enviado ao grupo ${envio.data.grupoNome}` : comGrupo),
  };
}
