/**
 * Variáveis de ambiente que NÃO têm valor padrão — e a trava contra a identidade do projeto antigo.
 *
 * ═══ POR QUE ISTO EXISTE ═════════════════════════════════════════════════════════════════════
 *
 * Este repositório nasceu como cópia integral do Tennis Engineer, um produto no ar e faturando. Três
 * módulos, quando a variável faltava, caíam em silêncio no endereço DELE:
 *
 *   src/lib/site.ts                     → https://tennisengineer.com.br
 *   src/email/send.ts                   → nao-responda@tennisengineer.com.br
 *   src/app/api/cron/pesquisa/route.ts  → contato@tennisengineer.com.br
 *
 * e um quarto, `src/lib/contato.ts`, caía na caixa de Gmail dele.
 *
 * Lá o padrão era conveniência: rodar local sem configurar nada e ver o card igual ao do cliente.
 * Num segundo produto, o mesmo padrão é o sistema funcionando NORMALMENTE com a identidade de outro:
 * link de acesso mandando o cliente para o site antigo, recibo saindo de um remetente que não é
 * nosso, pedido de descadastro caindo na caixa de outra operação, prévia do WhatsApp divulgando o
 * outro domínio. Nada disso gera erro — tudo parece funcionar, e é por isso que é o pior modo de
 * falha. Erro de configuração visível no deploy custa um minuto; e-mail enviado com o endereço
 * errado para cliente pagante não se desfaz.
 *
 * Faltou a variável → o build falha (`scripts/config-gate.ts`) e o módulo recusa carregar. São duas
 * camadas porque falham diferente: o portão cobre o deploy; o módulo cobre quem roda `next build`
 * direto, sobe local, ou apaga a variável depois do deploy.
 *
 * ═══ POR QUE O VALOR É PASSADO, E NÃO LIDO PELO NOME ═════════════════════════════════════════
 *
 * O Next só embute `NEXT_PUBLIC_*` no código do navegador quando o fonte escreve
 * `process.env.NEXT_PUBLIC_X` LITERALMENTE. Um `process.env[nome]` dentro desta função viraria
 * `undefined` no cliente — e o card de compartilhamento, que é renderizado lá, quebraria com a
 * variável configurada. Por isso quem chama lê a variável e entrega o valor; o nome vai junto só
 * para a mensagem de erro.
 */

/**
 * Tudo o que identifica o Tennis Engineer e nunca pode aparecer na configuração deste projeto.
 *
 * A borda da esquerda não aceita letra nem dígito antes do nome: `beachtennisengineer.com.br`
 * contém `tennisengineer.com.br` como sufixo e é um candidato legítimo a domínio DESTE produto —
 * uma trava que o recusasse seria desligada no primeiro dia, e levaria junto a proteção.
 * Subdomínio (`www.`, `mail.`) casa de propósito: é o mesmo domínio.
 */
const IDENTIDADE_DO_PROJETO_ANTIGO: readonly RegExp[] = [
  /(^|[^a-z0-9-])tennisengineer\.com\.br\b/i,
  /(^|[^a-z0-9-])tennis-engineer\.vercel\.app\b/i,
  /(^|[^a-z0-9.+-])tennisengineer\.br@gmail\.com\b/i,
];

export function apontaParaOProjetoAntigo(valor: string): boolean {
  return IDENTIDADE_DO_PROJETO_ANTIGO.some((re) => re.test(valor));
}

export class ConfiguracaoInvalida extends Error {
  constructor(
    readonly variavel: string,
    motivo: string,
  ) {
    super(
      `${variavel}: ${motivo}. Esta variável não tem valor padrão de propósito — ` +
        'um padrão aqui fazia o sistema funcionar com a identidade do Tennis Engineer. ' +
        'Ver src/lib/ambiente.ts e docs/DEPLOY.md §2.',
    );
    this.name = 'ConfiguracaoInvalida';
  }
}

type Validador = (valor: string) => string | null;

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

/** `https://host`, sem caminho e sem barra no fim — o formato que as URLs do produto concatenam. */
export const urlDoSite: Validador = (v) =>
  /^https:\/\/[^/\s]+$/.test(v)
    ? null
    : 'precisa ser https://dominio, sem caminho e sem barra no fim (recebido: ' + JSON.stringify(v) + ')';

export const email: Validador = (v) =>
  EMAIL.test(v) ? null : 'precisa ser um endereço de e-mail (recebido: ' + JSON.stringify(v) + ')';

/** `Nome <endereco@dominio>` ou só o endereço — as duas formas que o Resend aceita em `from`. */
export const remetente: Validador = (v) => {
  const endereco = /<([^>]+)>\s*$/.exec(v)?.[1] ?? v;
  return EMAIL.test(endereco.trim())
    ? null
    : 'precisa ser "Nome <endereco@dominio>" ou um endereço (recebido: ' + JSON.stringify(v) + ')';
};

/** As obrigatórias, com o validador de cada uma. O portão de build lê esta mesma lista. */
export const OBRIGATORIAS = {
  NEXT_PUBLIC_SITE_URL: urlDoSite,
  EMAIL_FROM: remetente,
  CONTACT_EMAIL: email,
} as const satisfies Record<string, Validador>;

export type Obrigatoria = keyof typeof OBRIGATORIAS;

/** O motivo pelo qual o valor não serve, ou `null` se serve. */
export function problemaCom(nome: string, valor: string | undefined): string | null {
  const v = valor?.trim();
  if (!v) return 'não está definida';
  if (apontaParaOProjetoAntigo(v)) {
    return 'aponta para o Tennis Engineer — este projeto não usa nenhum recurso dele';
  }
  const validar = (OBRIGATORIAS as Record<string, Validador>)[nome];
  return validar ? validar(v) : null;
}

/** Devolve o valor, ou lança. Ver o cabeçalho para o porquê de receber o valor e não o nome. */
export function exigir(nome: Obrigatoria, valor: string | undefined): string {
  const problema = problemaCom(nome, valor);
  if (problema) throw new ConfiguracaoInvalida(nome, problema);
  return valor!.trim();
}

/**
 * Tudo o que o portão de build recusa, numa lista — para o deploy mostrar todos os problemas de
 * uma vez, em vez de um por tentativa.
 *
 * Além das obrigatórias, varre TODO o ambiente atrás da identidade antiga. Nenhuma variável deste
 * projeto tem motivo para citá-la, e a varredura larga pega também as que a hospedagem injeta: se
 * alguém adicionar `tennisengineer.com.br` como domínio deste projeto na Vercel, ela passa a aparecer
 * em `VERCEL_PROJECT_PRODUCTION_URL` — e o deploy para ali.
 */
export function conferirAmbiente(env: Readonly<Record<string, string | undefined>>): string[] {
  const problemas: string[] = [];
  for (const nome of Object.keys(OBRIGATORIAS)) {
    const problema = problemaCom(nome, env[nome]);
    if (problema) problemas.push(`${nome}: ${problema}`);
  }
  for (const [nome, valor] of Object.entries(env)) {
    if (nome in OBRIGATORIAS || !valor) continue;
    if (apontaParaOProjetoAntigo(valor)) {
      problemas.push(`${nome}: aponta para o Tennis Engineer — este projeto não usa nenhum recurso dele`);
    }
  }
  return problemas;
}

/**
 * Todas as variáveis que o código lê. `tests/integrity/configuracao-obrigatoria.test.ts` confere
 * esta lista contra o fonte nos dois sentidos — nenhuma lida fora dela, nenhuma nela sem uso.
 *
 * Existe para a conferência antes do primeiro deploy: a pergunta "a lista está completa?" tem
 * resposta verificável, em vez de depender de alguém lembrar de cada `process.env` espalhado.
 * `NODE_ENV` fica fora porque é da plataforma; `CHROMIUM_PATH` fica fora porque só o gerador de
 * criativos, que roda na máquina de quem faz arte, a lê.
 */
export const VARIAVEIS_DO_PROJETO = [
  // identidade — sem elas o build falha (OBRIGATORIAS, acima)
  'NEXT_PUBLIC_SITE_URL',
  'EMAIL_FROM',
  'CONTACT_EMAIL',
  // banco, painel e sessão — sem padrão, mas cada módulo trata a ausência do seu jeito
  'DATABASE_URL',
  'ADMIN_PASSWORD',
  'AUTH_SECRET',
  // e-mail
  'RESEND_API_KEY',
  // pesquisa de satisfação
  'CRON_SECRET',
  'PESQUISA_LIMITE_DIARIO',
  // pagamento
  'PAYMENT_PROVIDER',
  'MERCADOPAGO_ACCESS_TOKEN',
  'MERCADOPAGO_WEBHOOK_SECRET',
  'ALLOW_FAKE_PAYMENTS',
  'INVITE_ONLY',
  // Meta
  'NEXT_PUBLIC_META_PIXEL_ID',
  'META_CAPI_ACCESS_TOKEN',
  // catálogo
  'ALLOW_UNVERIFIED_DATASET',
  'DATASET_MODE',
  // opcional
  'ANTHROPIC_API_KEY',
] as const;
