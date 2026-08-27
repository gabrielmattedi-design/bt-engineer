import { FROM, emailEnabled } from '@/email/send';
import { SITE_DOMAIN } from '@/lib/site';

/**
 * Diagnóstico do envio de e-mail — §9/§10 da lista de lançamento.
 *
 * ═══ POR QUE ESTA SEÇÃO EXISTE ═══════════════════════════════════════════════════════════════
 *
 * O e-mail falha de um jeito que não se investiga de fora. A tela de login diz "não conseguimos
 * enviar agora" — que é o certo a dizer a um visitante, e inútil para quem precisa consertar. A
 * causa real fica só no log do servidor, e o dono deste produto não lê log.
 *
 * Pior: as duas causas mais comuns produzem a MESMA frase na tela e exigem ações opostas. Sem a
 * chave, falta configurar uma variável. Com a chave e o domínio não verificado, falta mexer no DNS
 * do registrador — e essa espera é de horas, não de minutos.
 *
 * Aconteceu de verdade (ago/2026): login recusado com "tente novamente em alguns minutos", numa
 * situação em que tentar de novo nunca ia funcionar.
 *
 * ═══ POR QUE ELE PERGUNTA AO RESEND, EM VEZ DE SÓ OLHAR A VARIÁVEL ═══════════════════════════
 *
 * Ver que a chave existe não diz nada sobre o que importa: se o domínio do remetente está
 * verificado. A API de domínios responde isso em uma chamada, e é a diferença entre "está
 * configurado" e "funciona".
 */

type EstadoDominio =
  | { readonly tipo: 'sem-chave' }
  | { readonly tipo: 'chave-invalida'; readonly detalhe: string }
  | { readonly tipo: 'sem-dominio'; readonly esperado: string }
  | { readonly tipo: 'nao-verificado'; readonly nome: string; readonly situacao: string }
  | { readonly tipo: 'verificado'; readonly nome: string }
  | { readonly tipo: 'indisponivel'; readonly detalhe: string };

/** O domínio do remetente, extraído de `EMAIL_FROM` — é ele que precisa estar verificado. */
function dominioDoRemetente(): string {
  const match = /<([^>]+)>/.exec(FROM);
  const endereco = match?.[1] ?? FROM;
  return endereco.split('@')[1]?.trim().toLowerCase() ?? SITE_DOMAIN;
}

async function checarDominio(): Promise<EstadoDominio> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { tipo: 'sem-chave' };

  const esperado = dominioDoRemetente();

  try {
    const resposta = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });

    if (resposta.status === 401 || resposta.status === 403) {
      return { tipo: 'chave-invalida', detalhe: `HTTP ${resposta.status}` };
    }
    if (!resposta.ok) {
      return { tipo: 'indisponivel', detalhe: `HTTP ${resposta.status}` };
    }

    const corpo = (await resposta.json()) as {
      data?: { name?: string; status?: string }[];
    };

    const dominio = corpo.data?.find((d) => d.name?.toLowerCase() === esperado);
    if (!dominio) return { tipo: 'sem-dominio', esperado };

    // O Resend chama de `verified` o domínio pronto para enviar. Qualquer outro estado — `pending`,
    // `failed`, `temporary_failure` — significa que o envio vai ser recusado.
    return dominio.status === 'verified'
      ? { tipo: 'verificado', nome: dominio.name ?? esperado }
      : { tipo: 'nao-verificado', nome: dominio.name ?? esperado, situacao: dominio.status ?? '?' };
  } catch (erro) {
    return { tipo: 'indisponivel', detalhe: erro instanceof Error ? erro.message : String(erro) };
  }
}

export async function EmailStatus() {
  const estado = await checarDominio();

  /*
    Cada estado carrega a AÇÃO, não o sintoma.

    "Domínio não verificado" é diagnóstico; "abra o Resend, copie os três registros e cole na zona
    DNS do registro.br" é conserto. A diferença entre os dois é uma tarde de procura.
  */
  const { titulo, cor, acao } = (() => {
    switch (estado.tipo) {
      case 'verificado':
        return {
          titulo: `Envio de e-mail funcionando — domínio ${estado.nome} verificado.`,
          cor: 'border-court/30 bg-court/5',
          acao: null,
        };
      case 'sem-chave':
        return {
          titulo: 'A chave do Resend não chegou ao servidor.',
          cor: 'border-warn/40 bg-warn/5',
          acao: 'Adicione RESEND_API_KEY nas configurações do projeto na Vercel, marque o ambiente Production e refaça o deploy.',
        };
      case 'chave-invalida':
        return {
          titulo: `O Resend recusou a chave (${estado.detalhe}).`,
          cor: 'border-warn/40 bg-warn/5',
          acao: 'A chave existe mas não vale. Gere uma nova em resend.com → API Keys, substitua na Vercel e refaça o deploy.',
        };
      case 'sem-dominio':
        return {
          titulo: `O domínio ${estado.esperado} não está cadastrado no Resend.`,
          cor: 'border-warn/40 bg-warn/5',
          acao: `Em resend.com → Domains → Add Domain, cadastre ${estado.esperado}. Ele vai gerar três registros DNS para você colar no registro.br.`,
        };
      case 'nao-verificado':
        return {
          titulo: `O domínio ${estado.nome} está cadastrado mas ainda não verificado (${estado.situacao}).`,
          cor: 'border-warn/40 bg-warn/5',
          acao: 'Os três registros DNS ainda não chegaram, ou não estão idênticos. Confira no registro.br e espere a propagação — ela leva de minutos a algumas horas. Nenhum e-mail sai até isso ficar verde.',
        };
      case 'indisponivel':
        return {
          titulo: 'Não foi possível falar com o Resend agora.',
          cor: 'border-line bg-white',
          acao: `Pode ser instabilidade do provedor. Detalhe: ${estado.detalhe}`,
        };
    }
  })();

  return (
    <section className="mt-10">
      <h2 className="font-display text-lg font-semibold">E-mail</h2>
      <p className="mt-1 max-w-prose text-sm text-graphite">
        É por aqui que sai o link de acesso e o link do relatório depois da compra. Sem ele, quem
        fecha a aba depois de pagar não tem como voltar.
      </p>

      <div className={`mt-4 rounded border p-5 text-sm ${cor}`}>
        <p className="font-semibold text-ink">{titulo}</p>
        {acao && <p className="mt-2 max-w-prose leading-relaxed text-graphite">{acao}</p>}
        <p className="mt-3 text-xs text-graphite">
          Remetente configurado: <code>{FROM}</code>
          {!emailEnabled() && ' · nenhuma chave configurada'}
        </p>
      </div>
    </section>
  );
}
