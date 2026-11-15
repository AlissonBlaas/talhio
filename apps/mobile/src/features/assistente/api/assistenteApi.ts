import { ConversaSchema, PaginaDeConversasSchema, RespostaSchema, type Conversa, type PaginaDeConversas, type Pergunta, type Resposta } from '@talhio/shared';

import { apiClient, ApiErro } from '@/shared/lib/apiClient';
import { canalAoVivo } from '@/shared/lib/canalAoVivo';

/** Quantas mensagens vêm por vez ao abrir uma conversa e ao subir para as anteriores. */
const MENSAGENS_POR_VEZ = 30;

/**
 * Pergunta pelo canal ao vivo: o texto chega aos poucos em `aoTrecho` e a promessa termina com a resposta inteira.
 * Devolve null se o canal não está aberto (quem chamou usa a rota normal).
 */
function perguntarPeloCanal(pergunta: Pergunta, aoTrecho: (texto: string) => void): Promise<Resposta> | null {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  let parar = () => undefined as void;
  const promessa = new Promise<Resposta>((ok, falhou) => {
    // Sem nenhum quadro por 45 s (servidor travou, rede caiu): desiste e deixa tentar de novo.
    let relogio = setTimeout(() => limpar(() => falhou(new ApiErro(0, 'SEM_RESPOSTA', 'O assistente demorou demais. Tente de novo.'))), 45_000);
    const limpar = (fim: () => void) => {
      clearTimeout(relogio);
      parar();
      fim();
    };
    parar = canalAoVivo.ouvir((q) => {
      if ('id' in q && q.id !== id) return;
      if (q.tipo === 'chat.trecho') {
        clearTimeout(relogio);
        relogio = setTimeout(() => limpar(() => falhou(new ApiErro(0, 'SEM_RESPOSTA', 'O assistente parou de responder. Tente de novo.'))), 45_000);
        aoTrecho(q.texto);
      } else if (q.tipo === 'chat.fim') limpar(() => ok(q.resposta));
      else if (q.tipo === 'chat.erro') limpar(() => falhou(new ApiErro(0, q.codigo, q.mensagem)));
    });
  });
  if (!canalAoVivo.enviar({ tipo: 'chat', id, pergunta })) {
    parar();
    return null;
  }
  return promessa;
}

export const assistenteApi = {
  /** Resposta aos poucos quando o canal ao vivo está aberto; senão, pela rota normal (de uma vez). */
  perguntarEmFluxo: (pergunta: Pergunta, aoTrecho: (texto: string) => void): Promise<Resposta> => perguntarPeloCanal(pergunta, aoTrecho) ?? assistenteApi.perguntar(pergunta),
  perguntar: async (pergunta: Pergunta): Promise<Resposta> => RespostaSchema.parse(await apiClient.post('/assistente/mensagens', pergunta)),
  listarConversas: async (pular: number): Promise<PaginaDeConversas> => PaginaDeConversasSchema.parse(await apiClient.get(`/assistente/conversas?pular=${pular}`)),
  /** O fim da conversa; com `antes`, o trecho imediatamente anterior à mensagem desse número. */
  abrirConversa: async ({ id, antes }: { id: string; antes?: number }): Promise<Conversa> =>
    ConversaSchema.parse(await apiClient.get(`/assistente/conversas/${id}?limite=${MENSAGENS_POR_VEZ}${antes === undefined ? '' : `&antes=${antes}`}`)),
  apagarConversa: (id: string) => apiClient.apagar(`/assistente/conversas/${id}`),
};
