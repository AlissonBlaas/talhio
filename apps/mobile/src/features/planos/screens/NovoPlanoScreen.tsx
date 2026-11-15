import { router } from 'expo-router';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotoesDeZoom, CamadaPassadas, CamadaTalhoes, MapaBase, type MapaControle } from '@/mapa-motor';
import { Carregando, ErroComTentarDeNovo } from '@/shared/components/estado-tela';
import { Icone } from '@/shared/components/Icone';
import { hectares } from '@/shared/lib/format';
import { cores, fontes } from '@/shared/theme/tokens';

import { useEscolhaDoTalhao } from '../hooks/useEscolhaDoTalhao';

const criarTalhao = () => router.navigate('/novo-talhao');

/**
 * Passo 1 do plano: escolher o talhão. Os talhões que já existem (importados ou desenhados)
 * aparecem no mapa para tocar; também dá para criar um novo, que segue direto para o plano.
 */
export function NovoPlanoScreen() {
  const { top, bottom } = useSafeAreaInsets();
  const escolha = useEscolhaDoTalhao();
  const controle = useRef<MapaControle>(null);
  const talhao = escolha.escolhido;

  if (escolha.carregando) return <View style={styles.espera}><Carregando /></View>;
  if (escolha.erro) return <View style={styles.espera}><ErroComTentarDeNovo mensagem={escolha.erro.message} aoTentar={escolha.atualizar} /></View>;

  const continuar = () => {
    if (!talhao) return;
    // Sem linha de trator, o passo seguinte é criá-la; a tela da linha leva ao plano depois.
    router.navigate({ pathname: escolha.temLinha ? '/planejar' : '/linha-ab', params: { talhaoId: talhao.id } });
  };

  return (
    <View style={styles.tela}>
      {escolha.limites ? (
        <MapaBase ref={controle} limites={escolha.limites} margem={{ top: top + 150, right: 40, bottom: 250, left: 40 }} permitirGirar aoTocar={escolha.limpar}>
          <CamadaTalhoes geo={escolha.geo} selecionadoId={talhao?.id ?? null} rotulos={escolha.rotulos} aoTocar={escolha.escolher} />
          <CamadaPassadas geo={escolha.linhasGeo} />
        </MapaBase>
      ) : null}

      <View style={[styles.topo, { top: top + 6 }]} pointerEvents="box-none">
        <View style={styles.linhaDoTopo}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.voltar}>
            <Icone nome="voltar" cor={cores.texto} tamanho={20} espessura={2} />
          </Pressable>
          <View style={styles.faixa}>
            <Text style={styles.faixaTexto}>Novo plano</Text>
          </View>
        </View>
        <View style={styles.passos} accessibilityRole="progressbar" accessibilityLabel="Passo 1 de 4">
          {[true, false, false, false].map((feito, i) => (
            <View key={i} style={[styles.passo, feito && styles.passoFeito]} />
          ))}
        </View>
        {escolha.limites && !talhao ? (
          <View style={styles.dica}>
            <View style={styles.dicaNumero}>
              <Text style={styles.dicaNumeroTexto}>1</Text>
            </View>
            <Text style={styles.dicaTexto}>Toque no talhão que vai receber o plano</Text>
          </View>
        ) : null}
      </View>

      {escolha.limites ? (
        <View style={[styles.zoom, { top: top + 190 }]}>
          <BotoesDeZoom controle={controle} />
        </View>
      ) : null}

      <View style={[styles.painel, { paddingBottom: Math.max(bottom, 16) + 12 }]}>
        <View style={styles.alca} />
        <Text style={styles.passoTexto}>Passo 1 de 4 · Talhão</Text>
        {talhao ? (
          <>
            <View style={styles.escolhido}>
              <View style={styles.titulos}>
                <Text style={styles.titulo} numberOfLines={1}>
                  {talhao.nome}
                </Text>
                <Text style={styles.detalhe} numberOfLines={1}>
                  {hectares(talhao.areaHa)}
                  {talhao.cultura ? ` · ${talhao.cultura}` : ''} · {escolha.resumoDaLinha}
                </Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" onPress={continuar} style={styles.botao}>
              <Text style={styles.botaoTexto}>{escolha.temLinha ? 'Planejar neste talhão' : 'Próximo: definir a linha AB'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={criarTalhao} style={styles.secundario}>
              <Text style={styles.secundarioTexto}>ou criar um talhão novo</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.titulo}>{escolha.quantidade > 0 ? 'Para qual talhão é o plano?' : 'A fazenda ainda não tem talhões'}</Text>
            <Text style={styles.detalheLongo}>
              {escolha.quantidade > 0
                ? 'Toque em um talhão no mapa. Se ele ainda não existe, crie agora: ele já entra no mapa e segue para o plano.'
                : 'Crie o primeiro talhão desenhando no mapa, ou importe os talhões do monitor da máquina.'}
            </Text>
            <Pressable accessibilityRole="button" onPress={criarTalhao} style={[styles.botao, styles.botaoClaro]}>
              <Icone nome="mais" cor={cores.texto} tamanho={16} espessura={2.4} />
              <Text style={[styles.botaoTexto, styles.botaoClaroTexto]}>Criar um talhão novo</Text>
            </Pressable>
            {escolha.quantidade === 0 ? (
              <Pressable accessibilityRole="button" onPress={() => router.navigate('/importar')} style={styles.secundario}>
                <Text style={styles.secundarioTexto}>Importar talhões do monitor</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.mapaFundo },
  espera: { flex: 1, backgroundColor: cores.fundo, justifyContent: 'center' },
  topo: { position: 'absolute', left: 16, right: 16, gap: 10 },
  linhaDoTopo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  voltar: { width: 44, height: 44, borderRadius: 22, backgroundColor: cores.cartao, alignItems: 'center', justifyContent: 'center' },
  faixa: { flex: 1, height: 44, borderRadius: 22, backgroundColor: cores.controleMapa, justifyContent: 'center', paddingHorizontal: 16 },
  faixaTexto: { fontFamily: fontes.semi, fontSize: 14, color: cores.sobreEscuro },
  passos: { flexDirection: 'row', gap: 6, backgroundColor: cores.controleMapa, paddingVertical: 7, paddingHorizontal: 8, borderRadius: 8 },
  passo: { flex: 1, height: 4, borderRadius: 2, backgroundColor: cores.passoSobreMapa },
  passoFeito: { backgroundColor: cores.desenho },
  dica: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: cores.cartao, borderRadius: 22, paddingVertical: 10, paddingHorizontal: 14 },
  dicaNumero: { width: 28, height: 28, borderRadius: 14, backgroundColor: cores.desenho, alignItems: 'center', justifyContent: 'center' },
  dicaNumeroTexto: { fontFamily: fontes.semi, fontSize: 13, color: cores.desenhoTexto },
  dicaTexto: { flex: 1, fontFamily: fontes.regular, fontSize: 13, lineHeight: 18, color: cores.dicaTexto },
  zoom: { position: 'absolute', right: 16 },
  painel: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: cores.cartao, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10, paddingHorizontal: 20, gap: 10 },
  alca: { width: 40, height: 5, borderRadius: 3, backgroundColor: cores.alca, alignSelf: 'center', marginBottom: 4 },
  passoTexto: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 15, color: cores.textoSuave },
  escolhido: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titulos: { flex: 1, gap: 2 },
  titulo: { fontFamily: fontes.titulo, fontSize: 18, lineHeight: 19, color: cores.texto },
  detalhe: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 17, color: cores.textoSuave },
  detalheLongo: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 19, color: cores.textoSuave },
  botao: { height: 50, borderRadius: 999, backgroundColor: cores.milho, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  botaoTexto: { fontFamily: fontes.rotulo, fontSize: 16, color: cores.sobreMilho },
  botaoClaro: { backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.bordaForte },
  botaoClaroTexto: { color: cores.texto },
  secundario: { height: 44, alignItems: 'center', justifyContent: 'center' },
  secundarioTexto: { fontFamily: fontes.semi, fontSize: 14, color: cores.primario },
});
