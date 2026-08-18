import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { RACKET_BRANDS } from '@/domain/racket';
import { STRING_BRANDS } from '@/domain/string';

/**
 * Marcas presentes no ecossistema analisado.
 *
 * ─── COMO A UNIFORMIDADE É GARANTIDA ─────────────────────────────────────────────────────────
 *
 * O pedido é "mesmo destaque, cor e tamanho". Isso NÃO se obtém colocando sete arquivos lado a
 * lado: cada logotipo vem na sua própria cor, com proporções e margens internas diferentes, e o
 * resultado seria um mural onde a marca de vermelho salta e a de cinza some.
 *
 * Duas medidas resolvem, e as duas são estruturais:
 *
 * 1. COR — o arquivo entra como `mask-image`, não como `<img>`. A máscara usa só o formato do
 *    logotipo; a cor vem do CSS. Todas as marcas saem exatamente na mesma cor, sempre, mesmo que
 *    alguém troque o arquivo por uma versão colorida amanhã.
 *
 * 2. TAMANHO — altura fixa por caixa e `contain`, então proporções diferentes não viram tamanhos
 *    aparentes diferentes.
 *
 * Isso também protege a promessa comercial: um dos seis pilares é INDEPENDENTE, sem comissão. Um
 * mural onde uma marca aparece maior ou mais colorida contradiz essa promessa em silêncio.
 *
 * ─── QUANDO O ARQUIVO NÃO EXISTE ─────────────────────────────────────────────────────────────
 *
 * Cai para o nome em tipografia. Deliberado: logotipo aproximado é logotipo ERRADO, e desenhar
 * imitações de marcas registradas de terceiros seria pior do que não exibir. Ver README em
 * `public/marcas/`.
 *
 * A ordem é ALFABÉTICA e não a de cadastro: qualquer outra ordenação sugeriria ranking.
 */

const LOGO_DIR = join(process.cwd(), 'public', 'marcas');

function slug(brand: string): string {
  return brand
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-');
}

function BrandItem({ brand }: { brand: string }) {
  const file = `${slug(brand)}.svg`;
  const hasLogo = existsSync(join(LOGO_DIR, file));

  if (!hasLogo) {
    return (
      <span className="flex h-7 items-center font-display text-sm font-semibold text-ink/80">
        {brand}
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={brand}
      title={brand}
      className="block h-7 w-24 bg-ink/80"
      style={{
        WebkitMaskImage: `url(/marcas/${file})`,
        maskImage: `url(/marcas/${file})`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
      }}
    />
  );
}

/**
 * Uma faixa por categoria.
 *
 * ═══ POR QUE O RÓTULO SOBE NO CELULAR ════════════════════════════════════════════════════════
 *
 * No desktop o rótulo fica à esquerda e as marcas correm ao lado dele — a coluna do rótulo já
 * separa as duas faixas. No celular não cabe: os logos quebram em duas linhas e passam POR BAIXO
 * do rótulo, então "Wilson" e "Yonex" de raquete acabavam alinhados com "Cordas" logo abaixo. As
 * duas listas viravam uma massa só de nove logos, e a pergunta que a seção responde — quais marcas
 * de raquete, quais de corda — deixava de ter resposta visível.
 *
 * Abaixo de `sm` o rótulo passa a ser um cabeçalho sobre a própria faixa, e cada faixa ganha um
 * filete e um fundo levíssimo que a fecham como bloco. Não é ornamento: é a fronteira que a
 * quebra de linha apagou.
 */
function Row({ label, brands }: { label: string; brands: readonly string[] }) {
  return (
    <div
      className="rounded border border-line bg-white/60 p-4
                 sm:flex sm:items-center sm:gap-x-8 sm:border-0 sm:bg-transparent sm:p-0"
    >
      <span
        className="block text-xs font-semibold uppercase tracking-[0.16em] text-graphite
                   sm:w-20 sm:shrink-0"
      >
        {label}
      </span>
      <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-4 sm:mt-0">
        {[...brands]
          .sort((a, b) => a.localeCompare(b))
          .map((brand) => (
            <BrandItem key={brand} brand={brand} />
          ))}
      </div>
    </div>
  );
}

export function BrandWall() {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="h-px w-8 bg-court" aria-hidden />
        <h2 className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-court">
          Ecossistema analisado
        </h2>
      </div>

      <div className="mt-6 space-y-3 sm:space-y-6">
        <Row label="Raquetes" brands={RACKET_BRANDS} />
        <Row label="Cordas" brands={STRING_BRANDS} />
      </div>

      {/* O aviso não é rodapé jurídico: é o pilar da independência dito de novo, onde importa. */}
      <p className="mt-6 max-w-prose text-xs text-graphite">
        Marcas analisadas pelo Tennis Engineer. Não temos vínculo comercial, patrocínio ou comissão
        com nenhuma delas — todas aparecem no mesmo tamanho e na mesma cor porque nenhuma tem
        vantagem no cálculo.
      </p>

      {/*
        O link fecha a afirmação: dizer "analisamos estas marcas" e não deixar ver a lista é pedir
        confiança sem oferecer verificação — exatamente o oposto do que o pilar promete.
      */}
      <a
        href="/catalogo"
        className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-clay underline
                   underline-offset-4"
      >
        Ver todas as raquetes e cordas consideradas
      </a>
    </div>
  );
}
