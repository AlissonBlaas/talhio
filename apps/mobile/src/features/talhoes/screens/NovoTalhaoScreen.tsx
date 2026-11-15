import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BotoesDeZoom, CamadaContornos, CamadaDesenhoTalhao, MapaBase, type MapaControle } from '@/mapa-motor';
import { Carregando, ErroComTentarDeNovo } from '@/shared/components/estado-tela';
import { Icone } from '@/shared/components/Icone';
import { cantosDaImagemDemo } from '@/shared/lib/fazendaDemo';
import { hectares } from '@/shared/lib/format';
import { cores, fontes } from '@/shared/theme/tokens';

import { PainelDesenho } from '../components/PainelDesenho';
import { useCriarTalhao } from '../hooks/useCriarTalhao';
import { useDesenhoTalhao, type Canto } from '../hooks/useDesenhoTalhao';
import { useTalhoes } from '../hooks/useTalhoes';
import { limitesDosTalhoes } from '../limites';

const DICAS = ['Toque no primeiro canto do talhão', 'Agora toque no próximo canto', 'Mais um canto para fechar a área', 'Toque num canto para mover ou remover, ou salve'];

/** Distância máxima, em pontos de tela, para um toque contar como toque num canto. */
const RAIO_TOQUE = 30;

/** A mesma área, aumentada para os lados: mostra a vizinhança do talhão. */
function arredores(limites: [number, number, number, number] | null, fator = 1.2): [number, number, number, number] | null {
  if (!limites) return null;
  const [oeste, sul, leste, norte] = limites;
  const dLng = (leste - oeste) * fator;
  const dLat = (norte - sul) * fator;
  return [oeste - dLng, sul - dLat, leste + dLng, norte + dLat];
}

export function NovoTalhaoScreen() {
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const { talhoes, carregando, erro: erroLista, atualizar } = useTalhoes();
  const desenho = useDesenhoTalhao();
  const { criar, salvando, salvo, erro: erroSalvar, limparErro } = useCriarTalhao();
  const [nome, setNome] = useState('');
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const controle = useRef<MapaControle>(null);
  // Talhões que já existem, como referência (montado uma vez por lista).
  const referencia = useMemo<GeoJSON.FeatureCollection<GeoJSON.Polygon>>(
    () => ({ type: 'FeatureCollection', features: talhoes.map((t) => ({ type: 'Feature', properties: {}, geometry: t.contorno })) }),
    [talhoes],
  );

  // Um toque no mapa pode selecionar um canto, mover o canto selecionado ou criar um canto novo.
  const aoTocarMapa = async (lngLat: Canto, ponto: [number, number]) => {
    if (salvo || salvando) return;
    const naTela = await Promise.all(desenho.cantos.map((canto) => controle.current?.projetar(canto)));
    let maisPerto = -1;
    let menor = RAIO_TOQUE;
    naTela.forEach((p, indice) => {
      if (!p) return;
      const distancia = Math.hypot(p[0] - ponto[0], p[1] - ponto[1]);
      if (distancia < menor) {
        menor = distancia;
        maisPerto = indice;
      }
    });
    if (maisPerto >= 0) desenho.selecionar(maisPerto);
    else if (desenho.selecionado !== null) desenho.moverSelecionado(lngLat);
    else desenho.adicionar(lngLat);
  };

  if (carregando) return <View style={styles.espera}><Carregando /></View>;
  if (erroLista) return <View style={styles.espera}><ErroComTentarDeNovo mensagem={erroLista.message} aoTentar={atualizar} /></View>;

  // Sem talhões ainda, enquadra a área da fazenda de demonstração.
  const [oeste, norte] = cantosDaImagemDemo()[0];
  const [leste, sul] = cantosDaImagemDemo()[2];
  // Abre perto de um talhão que já existe (com folga em volta), e não com a fazenda inteira:
  // talhões distantes entre si deixariam tudo pequeno demais para desenhar.
  const limites = arredores(limitesDosTalhoes(talhoes.slice(0, 1))) ?? [oeste, sul, leste, norte];

  const nomeVazio = nome.trim() === '';
  const erro = tentouSalvar && nomeVazio ? 'Dê um nome ao talhão' : (erroSalvar?.message ?? null);

  const salvar = () => {
    setTentouSalvar(true);
    if (nomeVazio || !desenho.contorno) return;
    criar({ nome: nome.trim(), contorno: desenho.contorno });
  };

  return (
    <KeyboardAvoidingView style={styles.tela} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.mapaArea}>
        <MapaBase ref={controle} limites={limites} margem={{ top: top + 120, right: 40, bottom: 40, left: 40 }} aoTocar={(posicao, ponto) => void aoTocarMapa(posicao, ponto)}>
          <CamadaContornos geo={referencia} estilo="referencia" />
          <CamadaDesenhoTalhao geo={desenho.geo} salvo={!!salvo} />
        </MapaBase>
        <BotoesDeZoom controle={controle} style={styles.zoom} />

        <View style={[styles.topo, { top: top + 5 }]}>
          <View style={styles.linha}>
            <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()} style={styles.redondo}>
              <Icone nome="voltar" cor={cores.texto} tamanho={20} espessura={2} />
            </Pressable>
            <View style={styles.tituloPill}>
              <Text style={styles.titulo}>Novo talhão</Text>
            </View>
          </View>
          {salvo ? null : (
            <View style={styles.dica}>
              <View style={styles.contador}>
                <Text style={styles.contadorTexto}>{desenho.cantos.length}</Text>
              </View>
              <Text style={styles.dicaTexto}>
                {desenho.selecionado !== null
                  ? `Canto ${desenho.selecionado + 1} selecionado: toque no lugar certo para mover`
                  : DICAS[Math.min(desenho.cantos.length, 3)]}
              </Text>
            </View>
          )}
        </View>
      </View>

      <PainelDesenho
        quantidadeCantos={desenho.cantos.length}
        areaHa={salvo ? salvo.areaHa : desenho.areaHa}
        nome={nome}
        aoMudarNome={(texto) => {
          setNome(texto);
          if (erroSalvar) limparErro();
        }}
        erro={erro}
        salvando={salvando}
        confirmacao={salvo ? `Talhão salvo: ${salvo.nome} · ${hectares(salvo.areaHa)}. Já aparece no mapa e pode receber planos.` : null}
        cantoSelecionado={desenho.selecionado !== null}
        aoRemover={desenho.remover}
        aoLimpar={() => {
          desenho.limpar();
          setTentouSalvar(false);
          limparErro();
        }}
        aoSalvar={salvar}
        aoConcluir={() => router.back()}
        aoDefinirLinha={() => {
          if (salvo) router.replace({ pathname: '/linha-ab', params: { talhaoId: salvo.id } });
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.mapaFundo },
  espera: { flex: 1, backgroundColor: cores.fundo },
  mapaArea: { flex: 1 },
  zoom: { position: 'absolute', right: 16, bottom: 16 },
  topo: { position: 'absolute', left: 16, right: 16, gap: 10 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  redondo: { width: 44, height: 44, borderRadius: 22, backgroundColor: cores.cartao, alignItems: 'center', justifyContent: 'center' },
  tituloPill: { height: 44, borderRadius: 22, paddingHorizontal: 16, justifyContent: 'center', backgroundColor: cores.controleMapa },
  titulo: { fontFamily: fontes.semi, fontSize: 14, color: cores.sobreEscuro },
  dica: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contador: { width: 28, height: 28, borderRadius: 14, backgroundColor: cores.desenho, alignItems: 'center', justifyContent: 'center' },
  contadorTexto: { fontFamily: fontes.semi, fontSize: 13, color: cores.desenhoTexto },
  dicaTexto: { flex: 1, fontFamily: fontes.regular, fontSize: 13, lineHeight: 18, color: cores.dicaTexto },
});
