import { DefinirEscalaSchema, type EscalaItem, type Turno } from '@talhio/shared';
import { useState } from 'react';

/** Os campos de quem vai em uma máquina, começando pelo que já está na escala (ou pela sugestão). */
export function useFormularioDaEscala(item: EscalaItem) {
  const [operador, setOperador] = useState(item.operador ?? '');
  const [tarefa, setTarefa] = useState(item.tarefa ?? '');
  const [talhaoId, setTalhaoId] = useState(item.talhaoId);
  const [turno, setTurno] = useState<Turno>(item.turno);
  const [tentou, setTentou] = useState(false);

  const validacao = DefinirEscalaSchema.safeParse({ operador, tarefa: tarefa.trim() || null, talhaoId, turno });
  return {
    operador,
    setOperador,
    tarefa,
    setTarefa,
    talhaoId,
    setTalhaoId,
    turno,
    setTurno,
    faltaOperador: tentou && operador.trim() === '',
    /** Devolve os dados prontos para gravar, ou nulo (e passa a mostrar o que falta). */
    conferir: () => {
      setTentou(true);
      return validacao.success ? validacao.data : null;
    },
  };
}
