import { z } from 'zod';

export const EntrarSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Digite um e-mail válido').max(254)),
  senha: z.string().min(6, 'Digite a senha (mínimo 6 caracteres)').max(200),
});
export type Entrar = z.input<typeof EntrarSchema>;

export const RenovarSchema = z.object({ tokenRenovacao: z.string().min(20).max(500) });
export type Renovar = z.infer<typeof RenovarSchema>;

export const UsuarioSchema = z.object({
  id: z.string(),
  nome: z.string(),
  email: z.string(),
  /** Organização (fazenda) a que o usuário pertence. Tudo que ele vê é filtrado por ela. */
  orgId: z.string(),
  /** admin = pode tudo na fazenda; leitura = só consulta. */
  papel: z.enum(['admin', 'leitura']),
});
export type Usuario = z.infer<typeof UsuarioSchema>;

export const SessaoSchema = z.object({
  /** Vai no cabeçalho Authorization de cada chamada. Dura poucos minutos. */
  tokenAcesso: z.string(),
  /** Troca por um token de acesso novo. Uso único: cada renovação devolve outro. */
  tokenRenovacao: z.string(),
  expiraEmSegundos: z.number().int().positive(),
  usuario: UsuarioSchema,
});
export type Sessao = z.infer<typeof SessaoSchema>;

/**
 * Resposta do cadastro quando a conta precisa da nossa aprovação: ela foi criada, mas ainda não entra.
 * (Sem aprovação ligada, o cadastro devolve uma `Sessao` e a pessoa já está dentro.)
 */
export const CadastroEmAnaliseSchema = z.object({ aguardandoAprovacao: z.literal(true) });
export const ResultadoDoCadastroSchema = z.union([SessaoSchema, CadastroEmAnaliseSchema]);
export type ResultadoDoCadastro = z.infer<typeof ResultadoDoCadastroSchema>;

/** Um cadastro esperando aprovação, para quem aprova. */
export const PedidoDeCadastroSchema = z.object({ nome: z.string(), email: z.string(), fazenda: z.string(), pedidoEm: z.string() });
export type PedidoDeCadastro = z.infer<typeof PedidoDeCadastroSchema>;
export const AprovarCadastroSchema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email('E-mail inválido').max(254)) });

/** Conta nova: cria a fazenda (organização) e o primeiro usuário, que é o administrador dela. */
export const CadastrarSchema = z.object({
  nome: z.string().trim().min(2, 'Digite seu nome').max(80),
  fazenda: z.string().trim().min(2, 'Digite o nome da fazenda').max(80),
  email: z.string().trim().toLowerCase().pipe(z.email('Digite um e-mail válido').max(254)),
  senha: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres').max(200),
});
export type Cadastrar = z.input<typeof CadastrarSchema>;
