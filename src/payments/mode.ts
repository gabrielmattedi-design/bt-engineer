import { simulatedPaymentsEnabledInDatabase } from '@/database/repositories/settings-repo';

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
