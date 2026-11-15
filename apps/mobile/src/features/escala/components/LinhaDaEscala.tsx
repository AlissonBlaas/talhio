import type { EscalaItem } from '@talhio/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icone } from '@/shared/components/Icone';
import { siglaTalhao } from '@/shared/lib/format';
import { cores, fontes } from '@/shared/theme/tokens';

import { detalheDoItem } from '../textos';

/** Uma máquina na escala: quem opera, o que faz e onde. Tocar abre a edição. */
export function LinhaDaEscala({ item, aoTocar }: { item: EscalaItem; aoTocar: () => void }) {
  const semOperador = !item.operador;
  const estado = item.enviadaEm ? 'Enviada' : semOperador ? null : item.definida ? null : 'A confirmar';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.maquinaNome}, ${item.operador ?? 'sem operador'}. Toque para mudar.`}
      onPress={aoTocar}
      style={({ pressed }) => [styles.cartao, pressed && styles.apertado]}>
      <View style={[styles.avatar, semOperador && styles.avatarVazio]}>
        <Icone nome="trator" cor={semOperador ? cores.neutro : cores.sobreMilho} tamanho={22} espessura={2} />
      </View>
      <View style={styles.meio}>
        <Text style={styles.nome} numberOfLines={1}>
          {item.maquinaNome}
        </Text>
        <Text style={styles.detalhe} numberOfLines={1}>
          {semOperador ? 'Toque para escolher o operador' : detalheDoItem(item)}
        </Text>
      </View>
      <View style={styles.direita}>
        {item.talhaoNome ? (
          <Text style={styles.talhao} numberOfLines={1}>
            {siglaTalhao(item.talhaoNome)}
          </Text>
        ) : null}
        {estado ? <Text style={[styles.estado, estado === 'A confirmar' && styles.estadoPendente]}>{estado}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cartao: { backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 68 },
  apertado: { opacity: 0.7 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: cores.milho, alignItems: 'center', justifyContent: 'center' },
  avatarVazio: { backgroundColor: cores.neutroFundo },
  meio: { flex: 1, gap: 3, minWidth: 0 },
  nome: { fontFamily: fontes.rotulo, fontSize: 17, lineHeight: 21, color: cores.texto },
  detalhe: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 17, color: cores.textoSuave },
  direita: { alignItems: 'flex-end', gap: 4, maxWidth: 124 },
  talhao: { fontFamily: fontes.rotulo, fontSize: 14, lineHeight: 17, color: cores.texto, backgroundColor: cores.fundo, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, overflow: 'hidden' },
  estado: { fontFamily: fontes.rotuloLeve, fontSize: 12, lineHeight: 15, color: cores.folha },
  estadoPendente: { color: cores.alerta },
});
