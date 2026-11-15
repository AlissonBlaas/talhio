import type { Notificacao } from '@talhio/shared';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icone } from '@/shared/components/Icone';
import { cores, fontes } from '@/shared/theme/tokens';

/** "agora", "há 12 min", "há 3 h", "ontem 14:05" ou "12/11 14:05". */
export function quandoFoi(iso: string, agora: Date = new Date()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const min = Math.round((agora.getTime() - t) / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 24 * 60) return `há ${Math.floor(min / 60)} h`;
  const fuso = { timeZone: 'America/Sao_Paulo' } as const;
  const hora = new Date(t).toLocaleTimeString('pt-BR', { ...fuso, hour: '2-digit', minute: '2-digit', hour12: false });
  const dia = new Date(t).toLocaleDateString('pt-BR', { ...fuso, day: '2-digit', month: '2-digit' });
  return `${dia} ${hora}`;
}

const COR_DA_SEVERIDADE = { alta: cores.parada, media: cores.milho, baixa: cores.textoSuave } as const;

type Props = { notificacao: Notificacao; nova: boolean; aoAbrir: (n: Notificacao) => void };

/** Uma notificação: ícone na cor da gravidade, título, texto, quando e se o problema já passou. */
export const CartaoNotificacao = memo(function CartaoNotificacao({ notificacao: n, nova, aoAbrir }: Props) {
  const resolvida = n.resolvidaEm !== null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${n.titulo}. ${n.texto}`} onPress={() => aoAbrir(n)} style={[styles.cartao, nova && !resolvida ? styles.cartaoNovo : null]}>
      <View style={[styles.icone, { backgroundColor: resolvida ? cores.divisor : COR_DA_SEVERIDADE[n.severidade] }]}>
        <Icone nome="atencao" cor={resolvida ? cores.textoSuave : cores.sobreMilho} tamanho={22} espessura={2.2} />
      </View>
      <View style={styles.textos}>
        <View style={styles.topo}>
          <Text style={[styles.titulo, resolvida ? styles.suave : null]} numberOfLines={2}>
            {n.titulo}
          </Text>
          {nova ? <View style={styles.ponto} /> : null}
        </View>
        <Text style={[styles.texto, resolvida ? styles.suave : null]} numberOfLines={4}>
          {n.texto}
        </Text>
        <Text style={styles.quando}>{resolvida ? `${quandoFoi(n.criadaEm)} · já passou` : quandoFoi(n.criadaEm)}</Text>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  cartao: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 24, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda },
  cartaoNovo: { borderColor: cores.milho },
  icone: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  textos: { flex: 1, gap: 3 },
  topo: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  titulo: { flex: 1, fontFamily: fontes.semi, fontSize: 15, lineHeight: 19, color: cores.texto },
  texto: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 18, color: cores.textoMedio },
  quando: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 16, color: cores.textoSuave },
  suave: { color: cores.textoSuave },
  ponto: { width: 9, height: 9, borderRadius: 5, backgroundColor: cores.milho, marginTop: 5 },
});
