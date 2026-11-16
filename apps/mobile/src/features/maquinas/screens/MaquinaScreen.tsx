import type { Maquina } from '@talhio/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Carregando, ErroComTentarDeNovo } from '@/shared/components/estado-tela';
import { CabecalhoTela } from '@/shared/components/CabecalhoTela';
import { Icone } from '@/shared/components/Icone';
import { duracaoDesde, hectares, horaDoDia, horasMinutos } from '@/shared/lib/format';
import { cores, fontes, MARGEM_TELA } from '@/shared/theme/tokens';

import { MapaDaMaquina } from '../components/MapaDaMaquina';
import { AnaliseDaMaquina } from '../components/AnaliseDaMaquina';
import { LarguraDoImplemento } from '../components/LarguraDoImplemento';
import { BarraNivel, LinhaDado, SecaoDados } from '../components/SecaoDados';
import { StatusPill } from '../components/StatusPill';
import { useMaquina } from '../hooks/useMaquina';

const TIPO: Record<Maquina['tipo'], string> = { trator: 'Trator', pulverizador: 'Pulverizador', colheitadeira: 'Colheitadeira' };
/** Abaixo disso o combustível aparece em cor de alerta. */
const COMBUSTIVEL_BAIXO = 20;

const numero = (valor: number, casas = 1) => valor.toLocaleString('pt-BR', { maximumFractionDigits: casas });

/** Frase de atenção no topo, quando a máquina pede uma olhada. */
function aviso(maquina: Maquina): string | null {
  if (!maquina.telemetriaAtiva) return 'Esta máquina está sem telemetria ativa. Os dados dela não chegam ao app.';
  if (maquina.status === 'sem-sinal') return `Sem sinal desde ${horaDoDia(maquina.ultimoSinal)}. Os dados voltam quando a máquina pegar internet de novo.`;
  if (maquina.status === 'parada' && maquina.paradaDesde) return `Parada há ${duracaoDesde(maquina.paradaDesde)}, desde ${horaDoDia(maquina.paradaDesde)}.`;
  return null;
}

export function MaquinaScreen() {
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { maquina, carregando, erro, atualizando, atualizar } = useMaquina(id);

  return (
    <View style={styles.tela}>
      <CabecalhoTela titulo="Máquina" voltar />

      {carregando ? (
        <Carregando />
      ) : !maquina ? (
        <ErroComTentarDeNovo mensagem={erro?.message ?? 'Máquina não encontrada.'} aoTentar={atualizar} />
      ) : (
        <ScrollView
          style={styles.rolagem}
          contentContainerStyle={[styles.conteudo, { paddingBottom: Math.max(bottom, 16) + 16 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={atualizando} onRefresh={atualizar} tintColor={cores.primario} />}>
          <View style={styles.identidade}>
            <View style={styles.icone}>
              <Icone nome="trator" cor={cores.primario} tamanho={26} />
            </View>
            <View style={styles.titulos}>
              <Text style={styles.nome} numberOfLines={1}>
                {maquina.nome}
              </Text>
              <Text style={styles.detalhe} numberOfLines={1}>
                {maquina.operador ? `Operador: ${maquina.operador}` : 'Sem operador escalado'}
              </Text>
            </View>
            <StatusPill maquina={maquina} />
          </View>

          {aviso(maquina) ? (
            <View style={styles.aviso}>
              <Icone nome="atencao" cor={cores.sobreMilho} tamanho={22} espessura={2.4} />
              <Text style={styles.avisoTexto}>{aviso(maquina)}</Text>
            </View>
          ) : null}

          <MapaDaMaquina maquina={maquina} />

          <View style={styles.resumo}>
            <Resumo rotulo="Horas hoje" valor={horasMinutos(maquina.horasHoje)} />
            <Resumo rotulo="Área hoje" valor={hectares(maquina.areaHojeHa)} />
            <Resumo rotulo="Rendimento" valor={maquina.horasHoje > 0 ? `${numero(maquina.areaHojeHa / maquina.horasHoje)} ha/h` : '—'} />
          </View>

          <SecaoDados titulo="Agora">
            <LinhaDado rotulo="Talhão" valor={maquina.talhaoNome ?? 'Fora dos talhões'} />
            <LinhaDado rotulo="Velocidade" valor={maquina.status === 'sem-sinal' || maquina.velocidadeKmH === null ? '—' : `${numero(maquina.velocidadeKmH)} km/h`} />
            <LinhaDado rotulo="Motor" valor={maquina.status === 'sem-sinal' ? '—' : maquina.motorLigado ? 'Ligado' : 'Desligado'} />
            <LinhaDado rotulo="Último sinal" valor={maquina.status === 'sem-sinal' ? `Hoje às ${horaDoDia(maquina.ultimoSinal)}` : 'Agora'} />
          </SecaoDados>

          {maquina.usoHoje ? (
            <SecaoDados titulo="Uso de hoje">
              <LinhaDado rotulo="Trabalhando" valor={horasMinutos(maquina.usoHoje.trabalhandoH)} />
              <LinhaDado rotulo="Ocioso" valor={horasMinutos(maquina.usoHoje.ociosoH)} />
              <LinhaDado rotulo="Transporte" valor={horasMinutos(maquina.usoHoje.transporteH)} />
              {maquina.usoHoje.semPosicaoH > 0 ? <LinhaDado rotulo={maquina.usoHoje.semPosicaoH >= 1 ? 'Ligado sem posição (conferir com o operador)' : 'Ligado sem posição'} valor={horasMinutos(maquina.usoHoje.semPosicaoH)} /> : null}
              <LinhaDado rotulo="Área dentro dos talhões" valor={hectares(maquina.usoHoje.areaDentroHa)} />
              <LinhaDado rotulo="Área fora dos talhões" valor={hectares(maquina.usoHoje.areaForaHa)} />
              <LinhaDado rotulo="Combustível gasto" valor={maquina.usoHoje.combustivelL === null ? '—' : `${numero(maquina.usoHoje.combustivelL)} L`} />
            </SecaoDados>
          ) : null}

          {maquina.usoHoje && maquina.usoHoje.porTalhao.length > 0 ? (
            <SecaoDados titulo="Onde trabalhou hoje">
              {maquina.usoHoje.porTalhao.map((t) => (
                <LinhaDado key={t.talhaoId ?? 'fora'} rotulo={t.nome} valor={`${horasMinutos(t.andandoH)} andando · ${horasMinutos(t.paradoH)} parado`} />
              ))}
            </SecaoDados>
          ) : null}

          <SecaoDados titulo="Equipamento">
            <LinhaDado
              rotulo="Combustível"
              valor={maquina.combustivelPct === null ? '—' : `${Math.round(maquina.combustivelPct)}%`}
              aviso={maquina.combustivelSuspeito ? 'Sem leitura confiável: marca cheio há horas de trabalho' : undefined}>
              {maquina.combustivelPct === null ? null : <BarraNivel percentual={maquina.combustivelPct} baixo={maquina.combustivelPct < COMBUSTIVEL_BAIXO} suspeito={maquina.combustivelSuspeito} />}
            </LinhaDado>
            <LinhaDado rotulo="Horímetro" valor={maquina.horimetro === null ? '—' : `${numero(maquina.horimetro, 0)} h`} />
            <LinhaDado rotulo="Implemento" valor={maquina.implemento ?? 'Sem implemento'} />
            <LarguraDoImplemento key={`${maquina.id}-${maquina.larguraImplementoM ?? ''}`} maquina={maquina} />
            <LinhaDado rotulo="Tipo" valor={TIPO[maquina.tipo]} />
            <LinhaDado rotulo="Modelo" valor={[maquina.modelo, maquina.ano].filter(Boolean).join(' · ') || '—'} />
            <LinhaDado rotulo="Número de série" valor={maquina.numeroSerie ?? '—'} />
            <LinhaDado rotulo="Telemetria" valor={maquina.telemetriaAtiva ? 'Ativa' : 'Inativa'} />
          </SecaoDados>

          <AnaliseDaMaquina key={maquina.id} maquinaId={maquina.id} telemetriaAtiva={maquina.telemetriaAtiva} />
        </ScrollView>
      )}
    </View>
  );
}

function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={styles.resumoItem}>
      <Text style={styles.resumoRotulo}>{rotulo}</Text>
      <Text style={styles.resumoValor} numberOfLines={1}>
        {valor}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  redondo: { width: 44, height: 44, borderRadius: 22, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, alignItems: 'center', justifyContent: 'center' },
  topoTitulo: { fontFamily: fontes.semi, fontSize: 16, color: cores.texto },
  rolagem: { flex: 1 },
  conteudo: { paddingHorizontal: MARGEM_TELA, paddingTop: 16, gap: 16 },
  identidade: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icone: { width: 50, height: 50, borderRadius: 15, backgroundColor: cores.primarioSuave, alignItems: 'center', justifyContent: 'center' },
  titulos: { flex: 1, gap: 2 },
  nome: { fontFamily: fontes.titulo, fontSize: 22, lineHeight: 25, color: cores.texto },
  detalhe: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 16, color: cores.textoSuave },
  aviso: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: cores.milho, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 16 },
  avisoTexto: { flex: 1, fontFamily: fontes.semi, fontSize: 15, lineHeight: 20, color: cores.sobreMilho },
  resumo: { flexDirection: 'row', gap: 8 },
  resumoItem: { flex: 1, backgroundColor: cores.cartao, borderWidth: 1, borderColor: cores.borda, borderRadius: 22, paddingVertical: 12, paddingHorizontal: 12, gap: 3 },
  resumoRotulo: { fontFamily: fontes.regular, fontSize: 11, lineHeight: 14, color: cores.textoSuave },
  resumoValor: { fontFamily: fontes.semi, fontSize: 16, lineHeight: 20, color: cores.texto },
});
