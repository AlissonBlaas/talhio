import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSair } from '@/features/auth';
import { Icone, type NomeIcone } from '@/shared/components/Icone';
import { useSessao } from '@/shared/lib/sessao';
import { cores, fontes } from '@/shared/theme/tokens';

const PAPEL = { admin: 'Administrador', leitura: 'Só consulta' } as const;
const LARGURA = 304;

/** Iniciais para o círculo da conta: "Alisson Blaas" -> "AB". */
const iniciaisDe = (nome: string) =>
  nome
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('') || '?';

/**
 * Menu lateral da conta: abre pela esquerda, por cima da tela. Mostra quem está logado e leva às configurações
 * (que saíram da barra de baixo) e à saída da conta. Sem props de dados: lê a sessão sozinho.
 */
export function MenuDaConta({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const { top, bottom } = useSafeAreaInsets();
  const router = useRouter();
  const sessao = useSessao();
  const sair = useSair();
  const usuario = sessao.status === 'logado' ? sessao.usuario : null;
  // O Modal continua montado até a animação de saída terminar.
  const [montado, setMontado] = useState(aberto);
  const andamento = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (aberto) setMontado(true);
    Animated.timing(andamento, { toValue: aberto ? 1 : 0, duration: aberto ? 220 : 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (finished && !aberto) setMontado(false);
    });
  }, [aberto, andamento]);

  /** Fecha o menu e só então segue, para a tela nova não abrir por baixo dele. */
  const ir = (acao: () => void) => () => {
    aoFechar();
    acao();
  };
  const confirmarSaida = () =>
    Alert.alert('Sair da conta?', 'Você vai precisar entrar de novo com e-mail e senha.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Sair', style: 'destructive', onPress: sair }]);

  if (!montado) return null;
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={aoFechar}>
      <Animated.View style={[styles.veu, { opacity: andamento }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar o menu" onPress={aoFechar} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[styles.painel, { paddingTop: top + 18, paddingBottom: Math.max(bottom, 18), transform: [{ translateX: andamento.interpolate({ inputRange: [0, 1], outputRange: [-LARGURA, 0] }) }] }]}>
        <View style={styles.conta}>
          <View style={styles.iniciais}>
            <Text style={styles.iniciaisTexto}>{iniciaisDe(usuario?.nome ?? '')}</Text>
          </View>
          <View style={styles.contaTextos}>
            <Text style={styles.nome} numberOfLines={1}>
              {usuario?.nome ?? 'Conta'}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {usuario?.email ?? ''}
            </Text>
            {usuario ? <Text style={styles.papel}>{PAPEL[usuario.papel]}</Text> : null}
          </View>
        </View>

        <View style={styles.itens}>
          <Item icone="ajustes" rotulo="Configurações" apoio="Conta e conexão com a John Deere" aoTocar={ir(() => router.navigate('/config'))} />
        </View>

        <Pressable accessibilityRole="button" onPress={ir(confirmarSaida)} style={styles.sair}>
          <Icone nome="sair" cor={cores.textoSobreEscuro} tamanho={20} />
          <Text style={styles.sairTexto}>Sair da conta</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

function Item({ icone, rotulo, apoio, aoTocar }: { icone: NomeIcone; rotulo: string; apoio: string; aoTocar: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={aoTocar} style={({ pressed }) => [styles.item, pressed && styles.itemTocado]}>
      <View style={styles.itemIcone}>
        <Icone nome={icone} cor={cores.textoSobreEscuro} tamanho={20} />
      </View>
      <View style={styles.contaTextos}>
        <Text style={styles.itemRotulo}>{rotulo}</Text>
        <Text style={styles.itemApoio} numberOfLines={1}>
          {apoio}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  veu: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(8,18,11,0.55)' },
  painel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: LARGURA,
    maxWidth: '86%',
    backgroundColor: cores.mata,
    borderTopRightRadius: 30,
    borderBottomRightRadius: 30,
    paddingHorizontal: 20,
    gap: 22,
  },
  conta: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(241,242,236,0.18)' },
  iniciais: { width: 54, height: 54, borderRadius: 27, backgroundColor: cores.milho, alignItems: 'center', justifyContent: 'center' },
  iniciaisTexto: { fontFamily: fontes.titulo, fontSize: 20, color: cores.sobreMilho },
  contaTextos: { flex: 1, gap: 2 },
  nome: { fontFamily: fontes.titulo, fontSize: 21, lineHeight: 25, color: cores.textoSobreEscuro },
  email: { fontFamily: fontes.regular, fontSize: 14, lineHeight: 18, color: cores.suaveSobreEscuro },
  papel: { fontFamily: fontes.italico, fontSize: 13, lineHeight: 17, color: cores.suaveSobreEscuro },
  itens: { flex: 1, gap: 6 },
  item: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 22, paddingHorizontal: 10 },
  itemTocado: { backgroundColor: 'rgba(241,242,236,0.10)' },
  itemIcone: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(241,242,236,0.35)', alignItems: 'center', justifyContent: 'center' },
  itemRotulo: { fontFamily: fontes.rotulo, fontSize: 17, lineHeight: 21, color: cores.textoSobreEscuro },
  itemApoio: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 17, color: cores.suaveSobreEscuro },
  sair: { minHeight: 54, borderRadius: 27, borderWidth: 1.5, borderColor: 'rgba(241,242,236,0.45)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  sairTexto: { fontFamily: fontes.rotulo, fontSize: 16, color: cores.textoSobreEscuro },
});
