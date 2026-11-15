import { memo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Painel } from '@talhio/shared';
import { MenuDaConta } from '@/features/config';
import { useNaoLidas } from '@/features/notificacoes';
import { Icone } from '@/shared/components/Icone';
import { Marca } from '@/shared/components/Marca';
import { dataPorExtenso } from '@/shared/lib/format';
import { useSessao } from '@/shared/lib/sessao';
import { cores, fontes, MARGEM_TELA } from '@/shared/theme/tokens';

import { usePainelParte } from '../hooks/usePainelParte';
import { ResumoStatus } from './ResumoStatus';

const fazendaDe = (p: Painel) => p.fazendaNome;

/** Primeiro nome, para caber ao lado do símbolo: "Alisson Blaas" -> "Alisson". */
const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] || 'Conta';

/** Topo verde: quem está logado (toque abre o menu da conta), notificações, data, nome da fazenda e os contadores. */
export const CabecalhoInicio = memo(function CabecalhoInicio() {
  const fazenda = usePainelParte(fazendaDe);
  const naoLidas = useNaoLidas();
  const router = useRouter();
  const sessao = useSessao();
  const nome = sessao.status === 'logado' ? primeiroNome(sessao.usuario.nome) : 'Conta';
  const [menuAberto, setMenuAberto] = useState(false);
  const { top } = useSafeAreaInsets();
  return (
    <View style={[styles.topo, { paddingTop: top + 10 }]}>
      <View style={styles.marcaLinha}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Abrir o menu da conta de ${nome}`} onPress={() => setMenuAberto(true)} style={styles.marca}>
          <Marca tamanho={30} />
          <Text style={styles.marcaNome} numberOfLines={1}>
            {nome}
          </Text>
          <Icone nome="menu" cor={cores.suaveSobreEscuro} tamanho={18} espessura={2.2} />
        </Pressable>
        <View style={styles.botoes}>
          <Pressable accessibilityRole="button" accessibilityLabel={naoLidas > 0 ? `Notificações, ${naoLidas} não lidas` : 'Notificações'} onPress={() => router.push('/notificacoes')} style={styles.redondo}>
            <Icone nome="sino" cor={cores.textoSobreEscuro} tamanho={20} />
            {naoLidas > 0 ? <View style={styles.sinoPonto} /> : null}
          </Pressable>
        </View>
      </View>
      <Text style={styles.data}>{dataPorExtenso()}</Text>
      <Text style={styles.fazenda} numberOfLines={1}>
        {fazenda}
      </Text>
      <ResumoStatus />
      <MenuDaConta aberto={menuAberto} aoFechar={() => setMenuAberto(false)} />
    </View>
  );
});

const styles = StyleSheet.create({
  topo: { backgroundColor: cores.mata, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, paddingHorizontal: MARGEM_TELA, paddingBottom: 22, gap: 4 },
  marcaLinha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  // Área de toque de 44 px: o nome é o botão que abre o menu da conta.
  marca: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, marginRight: 12 },
  marcaNome: { flexShrink: 1, fontFamily: fontes.titulo, fontSize: 22, lineHeight: 26, color: cores.textoSobreEscuro },
  botoes: { flexDirection: 'row', gap: 8 },
  redondo: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(241,242,236,0.35)', alignItems: 'center', justifyContent: 'center' },
  sinoPonto: { position: 'absolute', top: 9, right: 10, width: 9, height: 9, borderRadius: 5, backgroundColor: cores.milho },
  data: { fontFamily: fontes.italico, fontSize: 15, lineHeight: 20, color: cores.suaveSobreEscuro },
  fazenda: { fontFamily: fontes.titulo, fontSize: 35, lineHeight: 38, color: cores.textoSobreEscuro, marginBottom: 14 },
});
