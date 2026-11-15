import { useRouter } from 'expo-router';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { Surgir } from '@/shared/components/animacoes';
import { useAlturaDaBarra } from '@/shared/components/BarraDeAbas';
import { CabecalhoTela } from '@/shared/components/CabecalhoTela';
import { Carregando, ErroComTentarDeNovo, Vazio } from '@/shared/components/estado-tela';
import { cores, MARGEM_TELA } from '@/shared/theme/tokens';

import { FiltroStatus } from '../components/FiltroStatus';
import { MaquinaCard } from '../components/MaquinaCard';
import { useMaquinas } from '../hooks/useMaquinas';

// Camada de apresentação: só desenha. Busca, filtro e contagem vêm do hook.
export function MaquinasScreen() {
  const { maquinas, filtro, setFiltro, carregando, erro, atualizando, atualizar } = useMaquinas();
  const router = useRouter();
  const alturaBarra = useAlturaDaBarra();

  return (
    <View style={styles.tela}>
      <CabecalhoTela titulo="Máquinas" subtitulo="Toque numa máquina para ver o detalhe">
        <FiltroStatus valor={filtro} aoMudar={setFiltro} />
      </CabecalhoTela>
      {carregando ? (
        <Carregando />
      ) : erro ? (
        <ErroComTentarDeNovo mensagem={erro.message} aoTentar={atualizar} />
      ) : (
        <>
          <FlatList
            data={maquinas}
            keyExtractor={(m) => m.id}
            renderItem={({ item, index }) => (
          <Surgir ordem={index}>
            <MaquinaCard maquina={item} aoTocar={() => router.navigate({ pathname: '/maquina/[id]', params: { id: item.id } })} />
          </Surgir>
        )}
            style={styles.lista}
            contentContainerStyle={[styles.listaConteudo, { paddingBottom: alturaBarra + 16 }]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={atualizando} onRefresh={atualizar} tintColor={cores.milho} />}
            ListEmptyComponent={<Vazio>Nenhuma máquina neste filtro.</Vazio>}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  lista: { flex: 1 },
  listaConteudo: { paddingHorizontal: MARGEM_TELA, paddingTop: 16, gap: 12, flexGrow: 1 },
});
