import type { Mensagem } from '@talhio/shared';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PontosPensando, Surgir } from '@/shared/components/animacoes';
import { cores, fontes } from '@/shared/theme/tokens';

import { TextoFormatado, temTabela } from './TextoFormatado';

/**
 * Uma fala da conversa. `variant`: nova = entra animada (acabou de chegar); antiga = aparece direto
 * (veio do histórico, ou voltou à tela ao rolar a lista).
 */
export const Balao = memo(function Balao({ mensagem, variant = 'nova' }: { mensagem: Mensagem; variant?: 'nova' | 'antiga' }) {
  const doUsuario = mensagem.papel === 'usuario';
  const Caixa = variant === 'nova' ? Surgir : View;
  return (
    <Caixa style={[styles.balao, doUsuario ? styles.usuario : styles.assistente, !doUsuario && temTabela(mensagem.texto) && styles.comTabela]}>
      {doUsuario ? (
        <Text selectable style={[styles.texto, { color: cores.sobreMilho }]}>
          {mensagem.texto}
        </Text>
      ) : (
        <TextoFormatado texto={mensagem.texto} />
      )}
    </Caixa>
  );
});

/** Três pontos enquanto a resposta não chega. */
export function Pensando() {
  return (
    <Surgir modo="leve" style={styles.pensando}>
      <View accessible accessibilityLabel="O assistente está respondendo" style={styles.pontos}>
        <PontosPensando cor={cores.textoSuave} />
      </View>
    </Surgir>
  );
}

const styles = StyleSheet.create({
  balao: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 22 },
  usuario: { alignSelf: 'flex-end', maxWidth: 280, backgroundColor: cores.milho, borderBottomRightRadius: 6 },
  assistente: { alignSelf: 'flex-start', maxWidth: 320, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderBottomLeftRadius: 6, paddingVertical: 12 },
  // Com tabela, o balão ocupa a largura da conversa: os números precisam de espaço.
  comTabela: { alignSelf: 'stretch', maxWidth: undefined },
  texto: { fontFamily: fontes.regular, fontSize: 16, lineHeight: 23 },
  pensando: { alignSelf: 'flex-start', backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 22, paddingVertical: 14, paddingHorizontal: 16 },
  pontos: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 10 },
});
