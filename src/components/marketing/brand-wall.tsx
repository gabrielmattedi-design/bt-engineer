import { RACKET_BRANDS } from '@/domain/racket';
import { STRING_BRANDS } from '@/domain/string';

/**
 * Marcas presentes no ecossistema analisado.
 *
 * ─── POR QUE NOMES TIPOGRÁFICOS E NÃO OS LOGOTIPOS ───────────────────────────────────────────
 *
 * Duas razões, e a segunda é de produto.
 *
 * 1. São marcas registradas de terceiros. Não temos os arquivos oficiais, e desenhar imitações
 *    seria pior que não exibir: logotipo aproximado é logotipo errado.
 *
 * 2. Um mural de logotipos coloridos na home é lido como "parceiros" ou "patrocinadores". Um dos
 *    seis pilares do produto é INDEPENDENTE — sem preferência de marca, sem comissão. Exibir os
 *    logos como se houvesse relação comercial contradiria exatamente a promessa que está três
 *    seções acima.
 *
 * O tratamento tipográfico uniforme resolve os dois: mesma fonte, mesmo peso, mesmo tamanho, mesma
 * cor para todas — que é literalmente o "mesmo destaque, cor e tamanho" que o mural precisa ter, e
 * torna visualmente impossível uma marca parecer favorecida.
 *
 * A ordem é ALFABÉTICA e não a de cadastro: qualquer outra ordenação sugeriria ranking.
 */
export function BrandWall() {
  const rackets = [...RACKET_BRANDS].sort((a, b) => a.localeCompare(b));
  const strings = [...STRING_BRANDS].sort((a, b) => a.localeCompare(b));

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-2 text-xs uppercase tracking-[0.16em] text-graphite">
        <span className="font-semibold text-ink">Raquetes</span>
        <span aria-hidden className="h-px w-6 bg-line" />
        {rackets.map((brand) => (
          <span key={brand} className="font-display text-sm normal-case tracking-normal text-ink">
            {brand}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-2 text-xs uppercase tracking-[0.16em] text-graphite">
        <span className="font-semibold text-ink">Cordas</span>
        <span aria-hidden className="h-px w-6 bg-line" />
        {strings.map((brand) => (
          <span key={brand} className="font-display text-sm normal-case tracking-normal text-ink">
            {brand}
          </span>
        ))}
      </div>

      {/* O aviso não é rodapé jurídico: é o pilar da independência dito de novo, onde importa. */}
      <p className="mt-5 text-xs text-graphite">
        Marcas analisadas pelo Tennis Engineer. Não temos vínculo comercial, patrocínio ou comissão
        com nenhuma delas — os nomes aparecem com o mesmo peso porque nenhuma tem vantagem no
        cálculo.
      </p>
    </div>
  );
}
