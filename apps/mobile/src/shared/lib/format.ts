const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const doisDigitos = (n: number) => String(n).padStart(2, '0');

/** "Segunda, 9 de novembro" */
export function dataPorExtenso(data: Date = new Date()): string {
  return `${DIAS[data.getDay()]}, ${data.getDate()} de ${MESES[data.getMonth()]}`;
}

/** Horário local no formato do campo: "14h20". */
export function horaDoDia(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}h${doisDigitos(d.getMinutes())}`;
}

/** Horas decimais -> "5h12". */
export function horasMinutos(horas: number): string {
  const total = Math.round(horas * 60);
  return `${Math.floor(total / 60)}h${doisDigitos(total % 60)}`;
}

/** Tempo decorrido desde um instante: "45 min" ou "1h20". */
export function duracaoDesde(iso: string, agora: Date = new Date()): string {
  const minutos = Math.max(0, Math.round((agora.getTime() - new Date(iso).getTime()) / 60_000));
  return minutos < 60 ? `${minutos} min` : `${Math.floor(minutos / 60)}h${doisDigitos(minutos % 60)}`;
}

/** Litros inteiros: "226 L". */
export function litros(valor: number): string {
  return `${Math.round(valor).toLocaleString('pt-BR')} L`;
}

export function hectares(valor: number): string {
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ha`;
}

/** "Talhão 7" -> "T7". Nomes sem número ficam como estão. */
export function siglaTalhao(nome: string): string {
  const numero = /(\d+)/.exec(nome)?.[1];
  return numero && /^talh[aã]o/i.test(nome) ? `T${numero}` : nome;
}

/** Primeira letra minúscula, para compor frases: "Plantadeira DB60" -> "plantadeira DB60". */
export function minusculaInicial(texto: string): string {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}
