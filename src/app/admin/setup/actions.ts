'use server';

import { revalidatePath } from 'next/cache';
import { isAuthenticated } from '../auth';
import { runMigrations, seedProducts, withAutoBootstrap } from '@/database/setup';
import { atualizarPrecos } from '@/database/repositories/commerce-repo';
import { conferirEscada, PRODUCT_SEED } from '@/payments/catalogo';
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
 * Salva os preços dos cinco produtos, de uma vez.
 *
 * ═══ POR QUE TUDO JUNTO, E NÃO UM CAMPO POR VEZ ══════════════════════════════════════════════
 *
 * Porque a coerência da escada é uma propriedade do CONJUNTO, não de cada preço. Subir a raquete
 * avulsa sozinha pode deixá-la mais cara que o pacote; salvar campo a campo obrigaria o dono a
 * passar por um estado inválido para chegar ao válido, e a validação teria de recusar exatamente o
 * caminho que ele precisa percorrer.
 *
 * Com um envio só, ele descreve a tabela inteira que quer, e ela é aceita ou recusada como um todo.
 *
 * ═══ E POR QUE NADA É GRAVADO ANTES DE TUDO SER CONFERIDO ════════════════════════════════════
 *
 * Gravar enquanto valida deixaria a loja num estado misto se a quarta linha fosse recusada: dois
 * preços novos, três antigos, e uma escada que ninguém desenhou. A conferência acontece inteira
 * sobre os números lidos, e só depois a transação escreve.
 */
export async function salvarPrecos(_prev: unknown, formData: FormData): Promise<SetupResult> {
  if (!(await isAuthenticated())) return { error: 'Sessão expirada. Entre novamente.' };

  const lidos: Record<string, number> = {};
  for (const produto of PRODUCT_SEED) {
    const bruto = String(formData.get(produto.sku) ?? '').trim();
    const cents = emCentavos(bruto);
    if (cents === null) {
      return { error: `${produto.name}: "${bruto}" não é um valor em reais válido.` };
    }
    lidos[produto.sku] = cents;
  }

  const incoerencia = conferirEscada(lidos as never);
  if (incoerencia) return { error: incoerencia };

  try {
    await withAutoBootstrap(() => atualizarPrecos(lidos));
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Falha ao salvar os preços.' };
  }

  /*
    Toda tela que exibe preço precisa ser invalidada, não só esta.

    A home é estática: sem isto, ela continuaria servindo o valor antigo do cache até a próxima
    revalidação — o site anunciando um preço e a loja já cobrando outro, que é precisamente o
    estado que ler tudo do banco existe para tornar impossível.
  */
  revalidatePath('/', 'layout');
  revalidatePath('/admin/setup');
  return { ok: 'Preços atualizados. O site já está mostrando os novos valores.' };
}

/**
 * "29,99", "29.99", "R$ 29,99" e "30" viram centavos. Qualquer outra coisa vira `null`.
 *
 * A tolerância é deliberada: quem digita preço escreve do jeito que fala, e recusar "R$ 29,99" por
 * causa do prefixo seria transformar um acerto em erro. O que NÃO é tolerado é ambiguidade — texto
 * que não descreve um valor sai como recusa, nunca como um número inventado.
 */
function emCentavos(bruto: string): number | null {
  const limpo = bruto.replace(/^R\$\s*/i, '').replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null;

  // `Math.round` e não `Math.floor`: 29.99 * 100 dá 2998.9999… em ponto flutuante.
  return Math.round(Number(limpo) * 100);
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
