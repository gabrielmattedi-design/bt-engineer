import {
  inviteOnlyEnabledInDatabase,
  simulatedPaymentsEnabledInDatabase,
} from '@/database/repositories/settings-repo';

/**
 * Modo de pagamento simulado — o único caminho pelo qual o adapter "fake" roda em produção.
 *
 * ─── POR QUE ISTO EXISTE ─────────────────────────────────────────────────────────────────────
 *
 * O adapter simulado concede acesso sem cobrar. Por isso ele era bloqueado por `NODE_ENV`, o que
 * é a proteção certa contra o acidente que importa: subir para produção e continuar entregando
 * relatórios pagos de graça sem ninguém perceber.
 *
 * Mas a Vercel define `NODE_ENV=production` em qualquer deploy, inclusive no que existe só para o
 * dono percorrer o próprio funil antes de haver gateway contratado. Com o bloqueio amarrado
 * apenas a `NODE_ENV`, clicar em "continuar para o pagamento" no site publicado devolvia uma
 * exceção de servidor.
 *
 * ─── DUAS CHAVES, MESMA FECHADURA ────────────────────────────────────────────────────────────
 *
 * O modo liga por qualquer uma das duas:
 *
 *   1. `ALLOW_FAKE_PAYMENTS=true` na hospedagem — para quem administra por infraestrutura;
 *   2. o interruptor em `/admin/setup` — para o dono do produto.
 *
 * A segunda existe porque a primeira falhou na prática. Trocar uma variável de ambiente exige
 * achar a tela certa no painel, marcar o ambiente certo e refazer o deploy: três passos
 * invisíveis, cada um com uma forma silenciosa de falhar, e o mesmo sintoma observável para todas
 * — nada muda. Uma trava que o dono legítimo não consegue destravar não está protegendo o
 * produto, está impedindo o produto.
 *
 * As duas exigem ação deliberada e as duas são igualmente VISÍVEIS: enquanto qualquer uma estiver
 * ativa, toda página exibe o aviso de que nada está sendo cobrado, e `/admin/setup` mostra o
 * estado real. Não existe configuração em que o dono ache que está simulando e o site cobre, nem
 * o inverso.
 *
 * ─── O QUE NÃO MUDOU ─────────────────────────────────────────────────────────────────────────
 *
 * Nada disso alcança um gateway real: se `PAYMENT_PROVIDER` apontar para um provedor de verdade,
 * o adapter simulado sequer é construído. O interruptor não consegue ressuscitá-lo.
 */

/** Parte da decisão que não depende do banco. Pura, e por isso testável sem infraestrutura. */
export function simulatedPaymentsAllowedByEnv(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.ALLOW_FAKE_PAYMENTS === 'true';
}

export async function simulatedPaymentsAllowed(): Promise<boolean> {
  if (simulatedPaymentsAllowedByEnv()) return true;
  return simulatedPaymentsEnabledInDatabase();
}

/** true quando o site publicado está aceitando "pagamentos" que não cobram nada. */
export async function inSimulatedPaymentMode(): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') return false;
  if ((process.env.PAYMENT_PROVIDER ?? 'fake') !== 'fake') return false;
  return simulatedPaymentsAllowed();
}

/** Mensagem única para quando o simulado é recusado — diz o que fazer, não só o que falhou. */
export const SIMULATED_PAYMENTS_BLOCKED =
  'O provedor de pagamento "fake" não pode ser usado em produção: ele concede acesso sem cobrar. ' +
  'Configure PAYMENT_PROVIDER com um gateway real, ou ligue o modo demonstração em /admin/setup ' +
  '(ou defina ALLOW_FAKE_PAYMENTS=true) para rodar o funil com aviso visível ao visitante.';

/**
 * ═══ ACESSO SÓ POR CONVITE ═══════════════════════════════════════════════════════════════════
 *
 * Fecha o checkout inteiro. Nenhum pedido é criado, o checkout simulado deixa de existir e o
 * relatório passa a nascer de UMA origem só: um código de convite resgatado.
 *
 * ─── POR QUE UM MODO NOVO, E NÃO SÓ DESLIGAR O SIMULADO ──────────────────────────────────────
 *
 * Desligar o simulado produz o estado certo por acidente e a tela errada de propósito: a página de
 * planos continua oferecendo "continuar para pagamento", o clique falha, e o convidado conclui que
 * o site está quebrado. O modo de convite não é a ausência de pagamento — é uma decisão de produto,
 * e ela precisa aparecer como decisão: os planos ficam visíveis, marcados como indisponíveis, e o
 * campo de código vira a ação principal.
 *
 * ─── PRECEDÊNCIA ═════════════════════════════════════════════════════════════════════════════
 *
 * Este modo VENCE de tudo. Se estiver ligado, nem `ALLOW_FAKE_PAYMENTS=true` nem o interruptor de
 * demonstração reabrem o checkout — e essa ordem é o ponto: a trava precisa ser mais forte que a
 * configuração que ela corrige, senão o dono liga o convite e continua distribuindo acesso grátis
 * por uma chave que esqueceu ligada em outro lugar.
 */
export function inviteOnlyByEnv(): boolean {
  return process.env.INVITE_ONLY === 'true';
}

export async function inviteOnlyAccess(): Promise<boolean> {
  if (inviteOnlyByEnv()) return true;
  return inviteOnlyEnabledInDatabase();
}

/** O visitante consegue COMPRAR? Falso no convite, e falso quando não há provedor utilizável. */
export async function checkoutOpen(): Promise<boolean> {
  if (await inviteOnlyAccess()) return false;
  if ((process.env.PAYMENT_PROVIDER ?? 'fake') !== 'fake') return true;
  return simulatedPaymentsAllowed();
}

/** Recusa única do checkout fechado — dita ao visitante, não ao administrador. */
export const INVITE_ONLY_MESSAGE =
  'O Tennis Engineer está em fase de testes com convidados. Nesta etapa o acesso ao relatório é ' +
  'liberado por código de convite, e não pela compra.';
