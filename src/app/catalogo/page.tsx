import Link from 'next/link';
import { DATASET_VERSION, loadRacketCatalog, loadStringCatalog } from '@/data/load';
import { RACKET_BRANDS } from '@/domain/racket';
import { STRING_BRANDS, STRING_TYPE_PT } from '@/domain/string';
import { BrandSignature } from '@/components/marketing/wordmark';
import { SiteHeader } from '@/components/marketing/site-header';
import { Seal } from '@/components/marketing/seal';

export const metadata = {
  title: 'Catálogo considerado — Tennis Engineer',
  description:
    'Todas as raquetes e cordas que o motor avalia, com as especificações usadas na análise.',
};

/**
 * O catálogo inteiro, aberto — §48, §62.
 *
 * ─── POR QUE ISTO É PÚBLICO E GRATUITO ───────────────────────────────────────────────────────
 *
 * O produto afirma que avalia N raquetes e M cordas contra o perfil de quem responde. Essa é a
 * afirmação central da venda, e uma afirmação que o visitante não pode conferir é indistinguível
 * de marketing. Publicar a lista completa, com as MESMAS especificações que alimentam o motor, é o
 * que transforma "avaliamos 46 raquetes" de promessa em fato verificável.
 *
 * Não há risco comercial nisso: o valor do relatório não está em saber QUAIS raquetes existem —
 * qualquer loja mostra isso — e sim em saber qual delas serve para você e por quê. O que fica de
 * fora desta página é exatamente o produto: fit score, ranking, pódio, corda, espessura e tensão.
 *
 * ─── O QUE APARECE E O QUE NÃO ───────────────────────────────────────────────────────────────
 *
 * Aparecem apenas ESPECIFICAÇÕES PUBLICADAS pelo fabricante — as mesmas que qualquer varejista
 * reproduz. Nenhum índice derivado (potência, controle, exigência) é exibido: eles são o cálculo
 * do motor, e mostrá-los aqui, fora do contexto de um perfil, convidaria à leitura errada de que
 * existe raquete "melhor" em abstrato. Não existe — é a premissa do produto inteiro.
 */
export default function CatalogoPage() {
  const rackets = loadRacketCatalog();
  const { models, variants } = loadStringCatalog();

  const byBrand = RACKET_BRANDS.map((brand) => ({
    brand,
    items: rackets
      .filter((r) => r.brand === brand)
      .sort((a, b) => a.product_name.localeCompare(b.product_name, 'pt-BR')),
  })).filter((g) => g.items.length > 0);

  const stringsByBrand = STRING_BRANDS.map((brand) => ({
    brand,
    items: models
      .filter((m) => m.brand === brand)
      .map((model) => ({
        model,
        gauges: variants
          .filter((v) => v.string_id === model.id)
          .map((v) => v.gauge_mm)
          .sort((a, b) => a - b),
      }))
      .sort((a, b) => a.model.model.localeCompare(b.model.model, 'pt-BR')),
  })).filter((g) => g.items.length > 0);

  const pattern = (m: number | null, c: number | null): string =>
    m === null || c === null ? '—' : `${m}×${c}`;

  const tension = (min: number | null, max: number | null): string =>
    min === null || max === null ? '—' : `${min}–${max} lbs`;

  const SHAPE_PT: Record<string, string> = {
    round: 'Lisa',
    pentagonal: 'Pentagonal',
    hexagonal: 'Hexagonal',
    textured: 'Texturizada',
    square: 'Quadrada',
  };

  /* Os rótulos vêm do domínio: o relatório pago usa os mesmos. Ver `STRING_TYPE_PT`. */
  const TYPE_PT = STRING_TYPE_PT;

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader tone="court" withTagline={false} />

      <div className="mx-auto max-w-5xl px-6 py-10 sm:py-14">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">O que entra na análise</h1>
        <p className="mt-4 max-w-prose text-[15px] text-graphite">
          Estas são todas as raquetes e cordas que o motor avalia contra o seu perfil. As
          especificações abaixo são as publicadas pelos fabricantes — as mesmas que alimentam o
          cálculo. Nada aqui é opinião nossa.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <div className="rounded border border-line bg-white px-5 py-4">
            <p className="display-number text-3xl">{rackets.length}</p>
            <p className="mt-1 text-xs uppercase tracking-wider text-graphite">
              variantes de raquete
            </p>
          </div>
          <div className="rounded border border-line bg-white px-5 py-4">
            <p className="display-number text-3xl">{variants.length}</p>
            <p className="mt-1 text-xs uppercase tracking-wider text-graphite">
              variantes de corda
            </p>
          </div>
          <div className="rounded border border-line bg-white px-5 py-4">
            <p className="display-number text-3xl">{byBrand.length + stringsByBrand.length}</p>
            <p className="mt-1 text-xs uppercase tracking-wider text-graphite">marcas</p>
          </div>
        </div>

        <p className="mt-6 max-w-prose text-sm text-graphite">
          Não trabalhamos com todas as marcas do mercado. Trabalhamos com as que publicam
          especificação consistente e têm distribuição real no Brasil — porque recomendar o que
          você não consegue comprar, ou o que não sabemos medir, não ajuda ninguém.
        </p>

        {/* ── Raquetes ───────────────────────────────────────────────────────────────────── */}
        <h2 className="mt-14 font-display text-2xl font-semibold">Raquetes</h2>

        {byBrand.map((group) => (
          <section key={group.brand} className="mt-8">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-clay">
              {group.brand} · {group.items.length}
            </h3>

            {/*
              CARTÕES no celular, TABELA a partir de sm.

              Uma tabela de 7 colunas num telefone de 390 px espremia a coluna do modelo a ponto de
              "Wilson Blade 98 18×20 v9 (2024)" ocupar seis linhas, e cada célula numérica quebrava
              o valor da unidade ("315" numa linha, "g" na outra). Rolar na horizontal também não
              resolve: ninguém compara raquetes arrastando a tabela de lado.
            */}
            <ul className="mt-3 space-y-3 sm:hidden">
              {group.items.map((r) => (
                <li key={r.id} className="rounded border border-line bg-white p-4">
                  <p className="font-medium">{r.product_name}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {[
                      ['Cabeça', `${r.specs.head_size_sq_in ?? '—'} in²`],
                      ['Peso', `${r.specs.unstrung_weight_g ?? '—'} g`],
                      ['Balanço', `${r.specs.balance_mm ?? '—'} mm`],
                      ['Quadro', r.specs.beam_width_mm ?? '—'],
                      [
                        'Padrão',
                        pattern(r.specs.string_pattern_mains, r.specs.string_pattern_crosses),
                      ],
                      [
                        'Tensão',
                        tension(
                          r.specs.recommended_tension_min_lbs,
                          r.specs.recommended_tension_max_lbs,
                        ),
                      ],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-[11px] uppercase tracking-wider text-graphite">
                          {label}
                        </dt>
                        <dd className="tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>

            <div className="mt-3 hidden overflow-x-auto rounded border border-line bg-white sm:block">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-graphite">
                    <th className="px-4 py-3 font-medium">Modelo</th>
                    <th className="px-4 py-3 font-medium">Cabeça</th>
                    <th className="px-4 py-3 font-medium">Peso</th>
                    <th className="px-4 py-3 font-medium">Balanço</th>
                    <th className="px-4 py-3 font-medium">Quadro</th>
                    <th className="px-4 py-3 font-medium">Padrão</th>
                    <th className="px-4 py-3 font-medium">Tensão</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((r) => (
                    <tr key={r.id} className="border-b border-line/60 last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 font-medium">{r.product_name}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-graphite">
                        {r.specs.head_size_sq_in ?? '—'} in²
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-graphite">
                        {r.specs.unstrung_weight_g ?? '—'} g
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-graphite">
                        {r.specs.balance_mm ?? '—'} mm
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-graphite">
                        {r.specs.beam_width_mm ?? '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-graphite">
                        {pattern(r.specs.string_pattern_mains, r.specs.string_pattern_crosses)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-graphite">
                        {tension(
                          r.specs.recommended_tension_min_lbs,
                          r.specs.recommended_tension_max_lbs,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <p className="mt-6 max-w-prose text-xs text-graphite">
          Peso e balanço são sem cordas, como o fabricante publica. O peso encordoado que aparece no
          relatório é uma derivação nossa (+16 g de jogo de cordas), sempre declarada como tal.
        </p>

        {/* ── Cordas ─────────────────────────────────────────────────────────────────────── */}
        <h2 className="mt-14 font-display text-2xl font-semibold">Cordas</h2>

        {stringsByBrand.map((group) => (
          <section key={group.brand} className="mt-8">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-clay">
              {group.brand} · {group.items.length}
            </h3>

            <ul className="mt-3 space-y-3 sm:hidden">
              {group.items.map(({ model, gauges }) => (
                <li key={model.id} className="rounded border border-line bg-white p-4">
                  <p className="font-medium">{model.model}</p>
                  <p className="mt-1 text-sm text-graphite">
                    {TYPE_PT[model.string_type] ?? model.string_type}
                    {model.shape !== null && ` · ${SHAPE_PT[model.shape] ?? model.shape}`}
                  </p>
                  <p className="mt-2 text-sm tabular-nums text-graphite">
                    {gauges.length === 0
                      ? 'Espessura não informada'
                      : gauges.map((g) => `${g.toFixed(2)} mm`).join(' · ')}
                  </p>
                </li>
              ))}
            </ul>

            <div className="mt-3 hidden overflow-x-auto rounded border border-line bg-white sm:block">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-graphite">
                    <th className="px-4 py-3 font-medium">Modelo</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Perfil</th>
                    <th className="px-4 py-3 font-medium">Espessuras</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map(({ model, gauges }) => (
                    <tr key={model.id} className="border-b border-line/60 last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 font-medium">{model.model}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-graphite">
                        {TYPE_PT[model.string_type] ?? model.string_type}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-graphite">
                        {model.shape === null ? '—' : (SHAPE_PT[model.shape] ?? model.shape)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-graphite">
                        {gauges.length === 0
                          ? '—'
                          : gauges.map((g) => `${g.toFixed(2)} mm`).join(' · ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        {/* ── O que NÃO está aqui ────────────────────────────────────────────────────────── */}
        <div className="mt-14 rounded border-2 border-court bg-white p-6">
          <Seal label="MATCH ENGINE" subtitle="o que esta página não mostra" />
          <p className="mt-4 max-w-prose text-[15px]">
            Você não vai encontrar aqui nenhuma raquete marcada como “melhor”. Não existe melhor
            raquete — existe a melhor raquete <strong>para um jogador</strong>, e é isso que o motor
            calcula.
          </p>
          <p className="mt-3 max-w-prose text-sm text-graphite">
            Os índices de potência, controle, spin, conforto e exigência são derivados destas mesmas
            especificações e só fazem sentido comparados ao seu perfil. Por isso eles aparecem no
            relatório, e não nesta tabela.
          </p>
          <Link
            href="/questionario"
            className="mt-6 inline-flex min-h-[56px] items-center justify-center rounded bg-court
                       px-8 font-semibold text-white transition-opacity hover:opacity-90"
          >
            Descobrir a minha
          </Link>
        </div>

        <p className="mt-10 text-xs text-graphite">
          Catálogo {DATASET_VERSION}. Especificações conforme publicadas pelos fabricantes; sempre
          confirme peso e balanço na etiqueta da raquete que você comprar — há tolerância de
          fabricação.
        </p>

        <BrandSignature className="mt-10" />
      </div>
    </main>
  );
}
