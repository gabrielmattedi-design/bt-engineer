'use server';

import { revalidatePath } from 'next/cache';
import { isAuthenticated } from '../auth';
import {
  addCouponUses,
  definirUsosRestantes,
  DESCONTO_MAX_PERCENT,
  removerCupom,
  setCouponActive,
  upsertCoupon,
} from '@/database/repositories/coupon-repo';
import { withAutoBootstrap } from '@/database/setup';
import { ACCESS_PRESETS, type AccessPresetKey } from './presets';

export type CodeResult = { ok: string } | { error: string };

export async function createCode(_prev: unknown, formData: FormData): Promise<CodeResult> {
  if (!(await isAuthenticated())) return { error: 'Sessão expirada. Entre novamente.' };

  const code = String(formData.get('code') ?? '').trim();
  if (!/^[A-Za-z0-9_-]{3,32}$/.test(code)) {
    return { error: 'Use de 3 a 32 caracteres: letras, números, hífen ou sublinhado.' };
  }

  const preset = ACCESS_PRESETS[String(formData.get('preset') ?? '') as AccessPresetKey];
  if (!preset) return { error: 'Escolha o que o código libera.' };

  /**
   * Campo vazio significa ILIMITADO, e isso é deliberado.
   *
   * O contrário — vazio virar zero — criaria um código nascido morto, e o dono só descobriria ao
   * ver alguém reclamar que não funciona. Entre os dois erros possíveis, "ilimitado por engano" é
   * visível na listagem e reversível num clique.
   */
  const rawLimit = String(formData.get('max_uses') ?? '').trim();
  const maxUses = rawLimit === '' ? null : Number.parseInt(rawLimit, 10);
  if (maxUses !== null && (!Number.isFinite(maxUses) || maxUses < 1)) {
    return { error: 'O limite precisa ser um número maior que zero, ou ficar em branco.' };
  }

  const note = String(formData.get('note') ?? '').trim() || null;

  /*
    A porcentagem só é lida quando o código É de desconto.

    Ler sempre transformaria um número esquecido no campo — de uma criação anterior, que o navegador
    reapresenta — em desconto silencioso num código de acesso. O `preset` é a única coisa que decide
    qual dos dois tipos está sendo criado.
  */
  let discountPercent: number | null = null;
  if ('percentual' in preset && preset.percentual) {
    const bruto = String(formData.get('discount_percent') ?? '').trim();
    const n = Number.parseInt(bruto, 10);
    if (!Number.isFinite(n) || n < 1 || n > DESCONTO_MAX_PERCENT) {
      return {
        error:
          `A porcentagem precisa ser um número de 1 a ${DESCONTO_MAX_PERCENT}. ` +
          'Acima disso o valor final ficaria abaixo do mínimo que o Mercado Pago aceita cobrar.',
      };
    }
    discountPercent = n;
  }

  try {
    await withAutoBootstrap(() =>
      upsertCoupon({ code, grants: preset.grants, maxUses, note, discountPercent }),
    );
    revalidatePath('/admin/codigos');
    return {
      ok: `Código ${code.toUpperCase()} salvo — ${
        discountPercent === null ? preset.label.toLowerCase() : `${discountPercent}% de desconto`
      }, ${maxUses === null ? 'usos ilimitados' : `${maxUses} usos`}.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Falha ao salvar o código.' };
  }
}

export async function toggleCode(formData: FormData): Promise<void> {
  if (!(await isAuthenticated())) return;

  const code = String(formData.get('code') ?? '');
  const active = String(formData.get('active') ?? '') === 'true';

  await withAutoBootstrap(() => setCouponActive(code, active));
  revalidatePath('/admin/codigos');
}

/**
 * Recarrega um código: soma usos ao teto, sem apagar o histórico.
 *
 * O valor vem do formulário e não de uma constante porque "recarregar" não tem tamanho natural —
 * 20 hoje, 5 amanhã. O que é fixo é o comportamento: soma ao teto, reativa o código, e o contador
 * de usos permanece como está.
 */
export async function rechargeCode(_prev: unknown, formData: FormData): Promise<CodeResult> {
  if (!(await isAuthenticated())) return { error: 'Sessão expirada. Entre novamente.' };

  const code = String(formData.get('code') ?? '').trim();
  const amount = Number.parseInt(String(formData.get('amount') ?? ''), 10);

  if (!Number.isFinite(amount) || amount < 1) {
    return { error: 'Informe quantos usos acrescentar (número maior que zero).' };
  }

  try {
    const updated = await withAutoBootstrap(() => addCouponUses(code, amount));
    if (!updated) return { error: `Não encontramos o código ${code.toUpperCase()}.` };

    revalidatePath('/admin/codigos');
    const restam = updated.maxUses === null ? '∞' : updated.maxUses - updated.usedCount;
    return {
      ok: `${updated.code} recarregado: +${amount} usos. Agora ${updated.usedCount} de ${
        updated.maxUses ?? '∞'
      } · restam ${restam}.`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Falha ao recarregar o código.' };
  }
}

/**
 * Apaga um código que nunca foi usado.
 *
 * A recusa de apagar código COM histórico é decidida no repositório — ver `removerCupom`. Aqui a
 * recusa vira frase, e ela diz o que fazer em vez de só barrar: desativar é a ação certa para um
 * código que já entregou produto, e ela está ao lado, na mesma linha.
 */
export async function excluirCodigo(_prev: unknown, formData: FormData): Promise<CodeResult> {
  if (!(await isAuthenticated())) return { error: 'Sessão expirada. Entre novamente.' };

  const code = String(formData.get('code') ?? '').trim();
  if (code === '') return { error: 'Código não informado.' };

  /*
    A confirmação é do FORMULÁRIO, não um `confirm()` do navegador: a ação de servidor precisa
    receber a intenção junto do pedido, senão um POST repetido (F5, botão de voltar) apagaria sem
    ninguém ter confirmado de novo.
  */
  if (String(formData.get('confirmar') ?? '') !== 'sim') {
    return { error: 'Marque a confirmação para apagar.' };
  }

  try {
    const r = await withAutoBootstrap(() => removerCupom(code));
    revalidatePath('/admin/codigos');

    switch (r.kind) {
      case 'removido':
        return { ok: `${code.toUpperCase()} apagado.` };
      case 'inexistente':
        return { error: `Não encontramos o código ${code.toUpperCase()}.` };
      case 'tem_historico':
        return {
          error:
            `${code.toUpperCase()} já foi usado ${r.usos} ${r.usos === 1 ? 'vez' : 'vezes'} e não ` +
            'pode ser apagado — os resgates e os pedidos apontam para ele. Use Desativar: ele para ' +
            'de funcionar e o histórico continua explicável.',
        };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Falha ao apagar o código.' };
  }
}

/**
 * Define quantos usos ainda cabem — inclusive para DIMINUIR, que era o que faltava.
 *
 * Recarregar soma; isto fixa. São operações diferentes de propósito: somar é o gesto de "quero mais
 * vinte", e fixar é o de "quero que sobrem dois". Um campo só, servindo aos dois, obrigaria a fazer
 * a conta de cabeça toda vez.
 */
export async function ajustarUsos(_prev: unknown, formData: FormData): Promise<CodeResult> {
  if (!(await isAuthenticated())) return { error: 'Sessão expirada. Entre novamente.' };

  const code = String(formData.get('code') ?? '').trim();
  const restantes = Number.parseInt(String(formData.get('restantes') ?? ''), 10);

  if (!Number.isInteger(restantes) || restantes < 0) {
    return { error: 'Informe quantos usos ainda podem acontecer (zero ou mais).' };
  }

  try {
    const atualizado = await withAutoBootstrap(() => definirUsosRestantes(code, restantes));
    if (!atualizado) return { error: `Não encontramos o código ${code.toUpperCase()}.` };

    revalidatePath('/admin/codigos');
    return {
      ok:
        restantes === 0
          ? `${atualizado.code} esgotado: ninguém mais consegue usar. O código continua na lista e ` +
            'o histórico está intacto.'
          : `${atualizado.code}: restam ${restantes} usos (${atualizado.usedCount} já usados, ` +
            `teto agora em ${atualizado.maxUses}).`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Falha ao ajustar o código.' };
  }
}
