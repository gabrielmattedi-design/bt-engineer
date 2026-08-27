'use server';

import { revalidatePath } from 'next/cache';
import { isAuthenticated } from '../auth';
import { runMigrations, seedProducts, withAutoBootstrap } from '@/database/setup';
import { writeSetting } from '@/database/repositories/settings-repo';
import { SETTING_KEYS } from '@/database/schema';
import { seedInviteCoupons } from '@/database/repositories/coupon-repo';
import { sendEmail } from '@/email/send';

export type SetupResult = { ok: string } | { error: string };

export async function prepareDatabase(_prev: unknown): Promise<SetupResult> {
  if (!(await isAuthenticated())) return { error: 'Sessão expirada. Entre novamente.' };

  try {
    await runMigrations();
    revalidatePath('/admin/setup');
    return { ok: 'Tabelas criadas com sucesso.' };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Falha ao criar as tabelas.',
    };
  }
}

export async function createProducts(_prev: unknown): Promise<SetupResult> {
  if (!(await isAuthenticated())) return { error: 'Sessão expirada. Entre novamente.' };

  try {
    const count = await seedProducts();
    revalidatePath('/admin/setup');
    return { ok: `${count} produtos disponíveis.` };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Falha ao criar os produtos.',
    };
  }
}

/**
 * Liga ou desliga o modo de pagamento simulado.
 *
 * ─── POR QUE ESTA AÇÃO PODE EXISTIR ──────────────────────────────────────────────────────────
 *
 * Ela habilita um provedor que concede acesso sem cobrar, então merece ser olhada de perto. Três
 * coisas a mantêm segura:
 *
 *   1. exige sessão de admin — mesma barreira que já protege a curadoria do catálogo;
 *   2. não alcança gateway real: se `PAYMENT_PROVIDER` apontar para um provedor de verdade, o
 *      adapter simulado sequer é construído, e este interruptor não o traz de volta;
 *   3. é ruidosa — enquanto ligada, TODA página do site exibe o aviso de que nada está sendo
 *      cobrado, sem opção de fechar.
 *
 * O risco que ela remove é maior que o que adiciona: a alternativa era o dono do produto sem
 * conseguir percorrer o próprio funil, e uma trava que o dono legítimo não destrava não protege o
 * produto — impede o produto.
 */
export async function setSimulatedPayments(formData: FormData): Promise<void> {
  if (!(await isAuthenticated())) return;

  // Só "true" liga. Qualquer outra coisa desliga — inclusive um campo ausente ou adulterado.
  const enabled = String(formData.get('enabled') ?? '') === 'true';

  await withAutoBootstrap(() =>
    writeSetting(SETTING_KEYS.simulatedPayments, enabled ? 'true' : 'false'),
  );

  // A home e o aviso do topo leem esta configuração; sem invalidar, o botão mudaria e o site não.
  revalidatePath('/', 'layout');
  revalidatePath('/admin/setup');
}

/**
 * Liga ou desliga o acesso só por convite.
 *
 * Ao LIGAR, semeia os códigos de convite se ainda não existirem: sem eles o modo fecharia o
 * checkout sem abrir nada no lugar, e o dono descobriria isso pelo primeiro convidado avisando que
 * não consegue entrar. A semente não toca em código já existente — recarga é operação à parte, em
 * `/admin/codigos`.
 */
export async function setInviteOnly(formData: FormData): Promise<void> {
  if (!(await isAuthenticated())) return;

  const enabled = String(formData.get('enabled') ?? '') === 'true';

  await withAutoBootstrap(async () => {
    if (enabled) await seedInviteCoupons();
    await writeSetting(SETTING_KEYS.inviteOnly, enabled ? 'true' : 'false');
  });

  revalidatePath('/', 'layout');
  revalidatePath('/admin/setup');
  revalidatePath('/admin/codigos');
}

/**
 * Manda um e-mail de teste e devolve o que o provedor respondeu.
 *
 * ═══ POR QUE ISTO EXISTE, SE JÁ HÁ UM DIAGNÓSTICO ════════════════════════════════════════════
 *
 * Porque o diagnóstico INFERE e este VERIFICA — e a inferência já errou. Ele consulta a lista de
 * domínios do Resend, e uma chave do tipo "Sending access" não tem permissão para essa consulta:
 * responde 401 e envia e-mail normalmente. O painel concluiu "a chave não vale" num momento em que
 * o domínio estava verificado e o envio provavelmente funcionava.
 *
 * Nenhuma consulta indireta resolve isso. A única pergunta que importa — "sai e-mail deste site?" —
 * só tem uma resposta confiável, que é mandar um.
 *
 * O destinatário é digitado a cada vez, e não fixado: o e-mail precisa chegar numa caixa que a
 * pessoa consiga abrir agora, e ela é a única que sabe qual é.
 */
export async function sendTestEmail(_prev: unknown, formData: FormData): Promise<SetupResult> {
  if (!(await isAuthenticated())) return { error: 'Sessão expirada. Entre novamente.' };

  const to = String(formData.get('para') ?? '').trim();
  if (!to.includes('@')) return { error: 'Digite um endereço de e-mail válido.' };

  const result = await sendEmail({
    to,
    subject: 'Teste de envio — Tennis Engineer',
    html: '<p>Se você está lendo isto, o envio de e-mail do Tennis Engineer está funcionando.</p>',
    text: 'Se você está lendo isto, o envio de e-mail do Tennis Engineer está funcionando.',
  });

  if (result.ok) {
    /*
      O sucesso fica REGISTRADO, e não só exibido.

      É o que permite o painel parar de avisar sobre um e-mail que funciona: sem isto, uma chave de
      envio (que não pode consultar domínios) mantém o alerta para sempre — e um alerta permanente
      sobre um sistema saudável treina quem o lê a ignorá-lo, inclusive no dia em que for verdade.
    */
    await writeSetting(SETTING_KEYS.lastEmailOk, new Date().toISOString());
    revalidatePath('/admin/setup');
    return { ok: `Enviado para ${to}. Confira a caixa de entrada e o spam.` };
  }

  /*
    O motivo vai INTEIRO para a tela — ao contrário de toda mensagem voltada ao visitante.

    Quem está nesta página já se autenticou como administrador e é exatamente quem precisa do
    detalhe técnico para consertar. Esconder o código HTTP aqui reproduziria o problema que este
    botão veio resolver: uma falha sem causa nomeada.
  */
  if (result.reason === 'not_configured') {
    return { error: 'RESEND_API_KEY não chegou ao servidor. Configure na Vercel e refaça o deploy.' };
  }
  return {
    error:
      `O Resend recusou o envio (${result.detail ?? 'sem detalhe'}). ` +
      '401 significa chave inválida; 403 costuma ser domínio do remetente não verificado ou ' +
      'diferente do configurado em EMAIL_FROM.',
  };
}
