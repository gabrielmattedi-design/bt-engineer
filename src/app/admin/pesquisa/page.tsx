import { redirect } from 'next/navigation';
import { isAuthenticated } from '../auth';
import { AdminNav } from '../nav';
import { withAutoBootstrap } from '@/database/setup';
import { lerPesquisas } from '@/database/repositories/pesquisa-repo';
import { resumirPesquisa, seguiu, USOU, EFEITO, IMPEDIMENTO } from '@/lib/pesquisa';
import { dataCurta } from '@/lib/datas';
import { satisfactionSurveyEmail } from '@/email/templates';
import { emailEnabled } from '@/email/send';
import { SITE_URL } from '@/lib/site';
import { DIAS_DEPOIS_DA_COMPRA } from '@/database/repositories/pesquisa-repo';
import { EnsaioDaPesquisa } from './ensaio';

export const dynamic = 'force-dynamic';

const rotuloDe = (lista: readonly { valor: string; label: string }[], v: string | null) =>
  lista.find((o) => o.valor === v)?.label ?? null;

/**
 * As respostas da pesquisa de satisfação.
 *
 * ═══ O NÚMERO NO TOPO É A TAXA DE ATIVAÇÃO, E NÃO A NOTA ═════════════════════════════════════
 *
 * A tentação seria abrir com a nota média do laudo — é o número que parece medir satisfação. Ele é
 * o menos acionável dos três: uma nota 4,2 não diz o que fazer na segunda-feira.
 *
 * **Quantos de fato mexeram no equipamento** diz. Se a maioria seguiu e melhorou, o produto
 * funciona e o próximo passo é derivado. Se a maioria seguiu e não sentiu, o problema é o motor. Se
 * a maioria NÃO seguiu, o problema é ativação — o laudo não está levando à ação —, e esse é o caso
 * mais provável, o menos considerado, e o que nenhuma outra métrica do sistema enxerga.
 */
export default async function PesquisaPage() {
  if (!(await isAuthenticated())) redirect('/admin');

  const { enviadas, respostas } = await withAutoBootstrap(() => lerPesquisas());
  const r = resumirPesquisa(enviadas, respostas);

  /*
    O estado do disparo, dito na tela em vez de deduzido.

    São duas chaves independentes e a ausência de qualquer uma para tudo: sem `CRON_SECRET` a rota
    do agendamento RECUSA (ver o comentário dela — recusar é a escolha, não liberar), e sem
    `RESEND_API_KEY` não sai e-mail nenhum. O modo de falha aqui é silencioso por natureza: o
    sintoma de um disparo desligado é a ausência de mensagens, e ausência não gera alerta.

    Só o SE existe é lido. O valor nunca chega à tela.
  */
  const agendamentoArmado = Boolean(process.env.CRON_SECRET);
  const envioArmado = emailEnabled();
  const ligado = agendamentoArmado && envioArmado;

  const modelo = satisfactionSurveyEmail({ url: `${SITE_URL}/avaliacao/previa` });

  const barra = (linhas: readonly { valor: string; label: string; n: number; porcento: number }[]) => (
    <ol className="mt-3 space-y-2">
      {linhas.map((l) => (
        <li key={l.valor} className="flex items-center gap-3 text-sm">
          <span className="w-56 shrink-0 text-graphite">{l.label}</span>
          <span className="relative h-5 flex-1 overflow-hidden rounded-sm bg-paper">
            <span
              className="absolute inset-y-0 left-0 rounded-sm bg-court"
              style={{ width: `${l.porcento}%` }}
            />
          </span>
          <span className="w-16 shrink-0 text-right tabular-nums text-ink">
            {l.n} · {l.porcento.toFixed(0)}%
          </span>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      <AdminNav current="pesquisa" />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-display text-2xl font-semibold">Pesquisa de satisfação</h1>
        <p className="mt-2 max-w-prose text-sm text-graphite">
          Enviada automaticamente {DIAS_DEPOIS_DA_COMPRA} dias depois de cada compra.
        </p>

        {/*
          O estado do disparo fica acima de tudo porque muda o significado de todo o resto: uma tela
          de zeros com o disparo ligado é "ninguém respondeu"; com o disparo desligado é "ninguém
          recebeu". São diagnósticos opostos e o número na tela é o mesmo.
        */}
        <p
          className={`mt-4 max-w-prose rounded border p-3 text-sm ${
            ligado ? 'border-court/30 bg-court/5 text-ink' : 'border-warn/40 bg-warn/5 text-warn'
          }`}
        >
          {ligado ? (
            <>
              <strong>Disparo automático ligado.</strong> Todo dia, às 9h de Brasília, a fila do dia
              é enviada.
            </>
          ) : (
            <>
              <strong>Disparo automático desligado — nenhum cliente recebe nada.</strong>{' '}
              {!agendamentoArmado && 'Falta CRON_SECRET na Vercel (sem ela o agendamento recusa). '}
              {!envioArmado && 'Falta RESEND_API_KEY. '}
              O ensaio abaixo continua funcionando{envioArmado ? '' : ' menos o envio de teste'}.
            </>
          )}
        </p>

        <EnsaioDaPesquisa assunto={modelo.subject} texto={modelo.text} html={modelo.html} />

        {enviadas === 0 ? (
          <p className="mt-8 rounded border border-line bg-white p-5 text-sm text-graphite">
            Nenhuma pesquisa enviada ainda. A primeira sai quando existir uma compra com 15 dias.
          </p>
        ) : (
          <>
            <dl className="mt-8 grid gap-4 sm:grid-cols-4">
              <div className="rounded border border-line bg-white p-4">
                <dt className="text-xs text-graphite">Enviadas</dt>
                <dd className="mt-1 font-display text-xl font-semibold tabular-nums text-ink">
                  {r.enviadas}
                </dd>
              </div>
              <div className="rounded border border-line bg-white p-4">
                <dt className="text-xs text-graphite">Responderam</dt>
                <dd className="mt-1 font-display text-xl font-semibold tabular-nums text-ink">
                  {r.respondidas}{' '}
                  <span className="text-sm font-normal text-graphite">
                    ({r.taxaDeResposta.toFixed(0)}%)
                  </span>
                </dd>
              </div>
              <div className="rounded border border-line bg-white p-4">
                <dt className="text-xs text-graphite">Usaram a recomendação</dt>
                <dd className="mt-1 font-display text-xl font-semibold tabular-nums text-ink">
                  {r.taxaDeAtivacao === null ? '—' : `${r.taxaDeAtivacao.toFixed(0)}%`}
                </dd>
              </div>
              <div className="rounded border border-line bg-white p-4">
                <dt className="text-xs text-graphite">Nota do laudo</dt>
                <dd className="mt-1 font-display text-xl font-semibold tabular-nums text-ink">
                  {r.notaMedia === null ? '—' : r.notaMedia.toFixed(1)}
                </dd>
              </div>
            </dl>

            {/*
              O aviso de amostra não é modéstia: com dez respostas, uma mudar de ideia move 10
              pontos percentuais. Sem essa linha, a primeira leitura vira decisão de produto.
            */}
            {r.respondidas < 20 && r.respondidas > 0 && (
              <p className="mt-3 max-w-prose text-xs text-clay">
                Só {r.respondidas} {r.respondidas === 1 ? 'resposta' : 'respostas'}. Cada uma vale{' '}
                {(100 / r.respondidas).toFixed(0)} pontos percentuais — isto ainda é leitura
                qualitativa, não estatística. Lê o que escreveram, não as barras.
              </p>
            )}

            <section className="mt-10">
              <h2 className="font-display text-lg font-semibold">Usaram a recomendação?</h2>
              <p className="mt-1 max-w-prose text-sm text-graphite">
                A pergunta que separa três problemas diferentes: se seguiram e melhorou, o produto
                funciona; se seguiram e não sentiram, o problema é o motor; se não seguiram, o
                problema é ativação.
              </p>
              {barra(r.usou)}
            </section>

            <section className="mt-10">
              <h2 className="font-display text-lg font-semibold">Quem seguiu — o que mudou</h2>
              {barra(r.efeito)}
            </section>

            <section className="mt-10">
              <h2 className="font-display text-lg font-semibold">Quem não seguiu — o que impediu</h2>
              {barra(r.impedimento)}
            </section>

            {respostas.length > 0 && (
              <section className="mt-10">
                <h2 className="font-display text-lg font-semibold">As respostas, uma a uma</h2>
                <ol className="mt-4 space-y-4">
                  {respostas.map((resp, i) => (
                    <li key={i} className="rounded border border-line bg-white p-4 text-sm">
                      <p className="flex flex-wrap items-baseline gap-x-3 text-graphite">
                        <span className="text-ink">{resp.email ?? 'sem e-mail'}</span>
                        <span className="text-xs">{dataCurta(resp.dia)}</span>
                        {resp.notaLaudo !== null && (
                          <span className="text-xs">laudo {resp.notaLaudo}/5</span>
                        )}
                        {resp.podeContatar === true && (
                          <span className="text-xs font-semibold text-court">pode contatar</span>
                        )}
                      </p>

                      <p className="mt-2 text-ink">
                        {rotuloDe(USOU, resp.usou) ?? '—'}
                        {seguiu(resp.usou) && resp.efeito !== null && (
                          <> · {rotuloDe(EFEITO, resp.efeito)}</>
                        )}
                        {!seguiu(resp.usou) && resp.impedimento !== null && (
                          <> · {rotuloDe(IMPEDIMENTO, resp.impedimento)}</>
                        )}
                      </p>

                      {resp.impedimentoOutro !== null && (
                        <p className="mt-2 text-graphite">“{resp.impedimentoOutro}”</p>
                      )}
                      {resp.sugestao !== null && (
                        <p className="mt-2 border-l-2 border-line pl-3 text-ink">
                          {resp.sugestao}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
