import type { Maquina } from '@talhio/shared';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icone } from '@/shared/components/Icone';
import { hectares, horaDoDia, horasMinutos, minusculaInicial, siglaTalhao } from '@/shared/lib/format';
import { cores, fontes } from '@/shared/theme/tokens';

import { StatusPill } from './StatusPill';

// Recebe o objeto de domínio inteiro: uma prop, em vez de nome, status, talhão... separados.
export function MaquinaCard({ maquina, aoTocar }: { maquina: Maquina; aoTocar: () => void }) {
  const detalhes = [maquina.operador, maquina.implemento ? minusculaInicial(maquina.implemento) : null].filter(Boolean).join(' · ');
  const semSinal = maquina.status === 'sem-sinal';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Ver ${maquina.nome}`} onPress={aoTocar} style={styles.cartao}>
      <View style={styles.topo}>
        <View style={styles.identidade}>
          <View style={styles.icone}>
            <Icone nome="trator" cor={cores.sobreMilho} tamanho={22} espessura={2} />
          </View>
          <View style={styles.titulos}>
            <Text style={styles.nome} numberOfLines={1}>
              {maquina.nome}
            </Text>
            <Text style={styles.detalhes} numberOfLines={1}>
              {detalhes || 'Sem operador escalado'}
            </Text>
          </View>
        </View>
        <StatusPill maquina={maquina} />
      </View>
      <View style={styles.dados}>
        <Dado rotulo="Talhão">{maquina.talhaoNome ? siglaTalhao(maquina.talhaoNome) : '—'}</Dado>
        <Dado rotulo="Horas">{horasMinutos(maquina.horasHoje)}</Dado>
        <Dado rotulo="Área">{hectares(maquina.areaHojeHa)}</Dado>
        <Dado rotulo="Sinal">
          <View style={[styles.ponto, semSinal ? styles.pontoVazado : { backgroundColor: cores.online }]} />
          {semSinal ? horaDoDia(maquina.ultimoSinal) : 'Agora'}
        </Dado>
      </View>
    </Pressable>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <View style={styles.dado}>
      <Text style={styles.rotulo}>{rotulo}</Text>
      <View style={styles.valorLinha}>
        {Array.isArray(children) ? (
          <>
            {children[0]}
            <Text style={styles.valor}>{children[1]}</Text>
          </>
        ) : (
          <Text style={styles.valor}>{children}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cartao: {
    backgroundColor: cores.cartao,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 12,
  },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  identidade: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icone: { width: 44, height: 44, borderRadius: 15, backgroundColor: cores.milho, alignItems: 'center', justifyContent: 'center' },
  titulos: { flex: 1, gap: 2 },
  nome: { fontFamily: fontes.titulo, fontSize: 19, lineHeight: 22, color: cores.texto },
  detalhes: { fontFamily: fontes.regular, fontSize: 13, lineHeight: 17, color: cores.textoSuave },
  dados: { flexDirection: 'row', gap: 8, borderTopWidth: 1, borderTopColor: cores.divisor, paddingTop: 10 },
  dado: { flex: 1, gap: 2 },
  rotulo: { fontFamily: fontes.regular, fontSize: 12, lineHeight: 15, color: cores.textoSuave },
  valorLinha: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  valor: { fontFamily: fontes.rotulo, fontSize: 16, lineHeight: 20, color: cores.texto },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  pontoVazado: { borderWidth: 2, borderColor: cores.semSinal },
});
