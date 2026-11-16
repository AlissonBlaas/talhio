import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Periodo } from '@talhio/shared';
import { Alert } from 'react-native';

import { useSessao } from '@/shared/lib/sessao';

import { whatsappApi } from '../api/whatsappApi';
import { whatsappKeys } from '../whatsapp.keys';
import { useWhatsapp } from './useWhatsapp';

type Pedido = {
  /** O texto que a tela mostrou. Vai ao grupo como está. */
  texto: string;
  /** Quando é um relatório: o servidor monta e manda o PDF com o resumo, em vez do texto. */
  relatorio?: { periodo: Periodo; data: string | null; maquinaIds?: string[] };
};

/**
 * Botão "enviar" das telas (relatório, escala, plano). O envio é SEMPRE pelo WhatsApp da fazenda, direto no grupo
 * escolhido. Sem isso o botão fica desligado e diz o que falta (`falta`); não abre mais o WhatsApp do aparelho.
 */
export function useEnviarAoGrupo() {
  const queryClient = useQueryClient();
  const sessao = useSessao();
  const { whatsapp } = useWhatsapp();
  const admin = sessao.status === 'logado' && sessao.usuario.papel === 'admin';
  const grupo = admin && whatsapp?.estado === 'conectado' ? whatsapp.grupo : null;
  // O que impede o envio, nas palavras do botão. Nulo = pode enviar. Enquanto o estado não chegou, não acusa nada.
  const falta = grupo || !whatsapp ? null : !admin ? 'Só o administrador envia' : whatsapp.estado === 'indisponivel' ? 'WhatsApp indisponível' : whatsapp.estado === 'conectado' ? 'Escolha o grupo do WhatsApp' : 'Conecte o WhatsApp';

  const envio = useMutation({
    mutationFn: ({ texto, relatorio }: Pedido) => (relatorio ? whatsappApi.enviarRelatorio(relatorio.periodo, relatorio.data, relatorio.maquinaIds) : whatsappApi.enviarMensagem(texto)),
    onError: (erro) => {
      Alert.alert('Não foi possível enviar ao grupo', erro instanceof Error ? erro.message : 'Tente de novo.');
      // Pode ter caído ou perdido o grupo: refaz o estado para a tela e o alerta do Início mostrarem o certo.
      void queryClient.invalidateQueries({ queryKey: whatsappKeys.estado() });
    },
  });

  return {
    /** Devolve true se a mensagem saiu no grupo. Sem WhatsApp conectado e grupo escolhido, não envia (false). */
    enviar: async (pedido: Pedido): Promise<boolean> => {
      if (!grupo) return false;
      return envio.mutateAsync(pedido).then(
        () => true,
        () => false,
      );
    },
    enviando: envio.isPending,
    /** true quando dá para enviar: WhatsApp da fazenda conectado, grupo escolhido e quem está logado é administrador. */
    paraOGrupo: !!grupo,
    /** Por que o botão está desligado ("Conecte o WhatsApp", "Escolha o grupo do WhatsApp"...). Nulo = pode enviar. */
    falta,
    /** Dá para resolver na Config (conectar ou escolher o grupo)? Para a tela oferecer o caminho. */
    resolveNaConfig: falta !== null && admin && whatsapp?.estado !== 'indisponivel',
    /** Texto do botão: o que falta, quando não dá para enviar; senão o do envio ao grupo. */
    rotulo: (comGrupo = 'Enviar ao grupo do WhatsApp') => (falta ?? (envio.isPending ? 'Enviando ao grupo…' : envio.isSuccess ? `Enviado ao grupo ${envio.data.grupoNome}` : comGrupo)),
  };
}
