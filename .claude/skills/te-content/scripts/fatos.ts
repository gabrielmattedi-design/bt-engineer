/**
 * Fatos publicáveis, DERIVADOS do catálogo no momento de gerar.
 *
 * ═══ POR QUE ISTO EXISTE ═════════════════════════════════════════════════════════════════════
 *
 * O projeto já aprendeu esta lição uma vez. A home dizia "Milhares de combinações possíveis" —
 * número redondo escrito à mão — e `src/data/combinations.ts` nasceu para consertar, com a nota:
 * "número redondo escrito à mão é a forma mais fácil de uma página institucional começar a mentir:
 * o catálogo cresce, o texto fica parado, e ninguém percebe porque nada quebra".
 *
 * Conteúdo de Instagram tem o mesmo risco, agravado: um post publicado não se corrige. Se a skill
 * guardasse "47 raquetes" num arquivo de referência, o dia em que entrasse a 48ª ela começaria a
 * publicar mentira sem nada quebrar.
 *
 * Então nenhum número técnico é digitado. Tudo aqui é lido do catálogo que está no ar.
 *
 * Uso:  npx tsx .claude/skills/te-content/scripts/fatos.ts
 */

import { loadRacketCatalog, loadStringCatalog } from '@/data/load';
import { lbsToKg } from '@/domain/units';
import { countSetupCombinations } from '@/data/combinations';
import { scoreRackets } from '@/recommendation/normalize/racket-attributes';
import { buildCatalogScale } from '@/recommendation';

const rackets = loadRacketCatalog();
const strings = loadStringCatalog();

function faixa(valores: readonly (number | null | undefined)[]): [number, number] | null {
  const n = valores.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (n.length === 0) return null;
  return [Math.min(...n), Math.max(...n)];
}

function contar<T>(itens: readonly T[], chave: (x: T) => string | null): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of itens) {
    const k = chave(item);
    if (k === null) continue;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

/**
 * ═══ A GUARDA DE PROVENIÊNCIA ════════════════════════════════════════════════════════════════
 *
 * Devolve `true` só quando aquele campo daquela raquete tem URL de fonte registrada.
 *
 * Hoje devolve `false` para TODOS os 470 campos: o catálogo inteiro está com `source_url: null` e a
 * nota "AGUARDANDO verificação humana contra a página oficial". Ver `references/limites.md` §2.
 *
 * A função existe assim, e não como uma constante `PODE_PUBLICAR_SPECS = false`, porque a restrição
 * precisa se destravar sozinha: no dia em que a curadoria preencher as fontes, a comparação por
 * número passa a ser permitida sem ninguém editar a skill. Uma constante escrita à mão teria o
 * mesmo defeito que este arquivo inteiro existe para evitar.
 */
export function temFonte(variantId: string, campo: string): boolean {
  const r = rackets.find((x) => x.id === variantId);
  const p = (r as unknown as { provenance?: Record<string, { source_url?: string | null }> })
    ?.provenance?.[campo];
  return typeof p?.source_url === 'string' && p.source_url.length > 0;
}

/**
 * Peso estático × inércia de swing — o fato mais publicado da skill, e o que mais deu problema.
 *
 * ═══ POR QUE ESTE BLOCO PRECISOU EXISTIR ═════════════════════════════════════════════════════
 *
 * A primeira pauta publicou "26 das 47 raquetes exigem mais esforço para acelerar do que outra
 * 10 g mais pesada". As duas metades da frase são verdadeiras, e JUNTAS são falsas: 26 é a
 * contagem com 15 g de diferença; com 10 g são 39.
 *
 * O erro não foi de conta, foi de processo. `fatos.ts` não devolvia este número, então ele foi
 * medido uma vez num script descartável e daí em diante carregado à mão entre a arte, a legenda e
 * o arquivo da pauta. É exatamente o defeito que o cabeçalho deste arquivo descreve — "nenhum
 * número técnico é digitado" —, cometido no único número que o arquivo não cobria.
 *
 * Agora o limiar vem junto com a contagem, no mesmo objeto. Não dá para citar um sem o outro sem
 * que a inconsistência fique visível na hora de escrever.
 *
 * ═══ AGORA É SWINGWEIGHT DE VERDADE ══════════════════════════════════════════════════════════
 *
 * Este bloco dizia: "NÃO é swingweight — essa é medição de laboratório que o catálogo não tem, e
 * `limites.md` §1 proíbe citar". Deixou de valer em 07/09/2026: as 47 raquetes ganharam
 * swingweight ENCORDOADO medido, de fonte única, com `source_url` por raquete. A copy pode citar o
 * número e dizer que é medido — ver `limites.md` §1, reescrito na mesma data.
 */
function pesoVersusInercia() {
  /*
    ═══ ERRATA DE 07/09/2026 — ESTA FUNÇÃO PRODUZIU UM POST FALSO ═════════════════════════════

    Ela lia `attributes.swing_index`, que até 07/09 era `massa × (balanço − 100)²` — um modelo de
    massa pontual, não uma medição. Com os 47 swingweights medidos em laboratório deu para conferir
    o que ela vinha afirmando, e o resultado é o pior possível para um post já publicado:

        publicado em 04/09  ·  r(peso, inércia) = 0,029, "praticamente zero"
        real                ·  r(peso, swingweight medido) = 0,844

        publicado em 04/09  ·  "26 das 47 exigem mais esforço que outra 15 g mais pesada"
        real                ·  8 das 47

    Não é um número impreciso: é a tese ao contrário. O post dizia que peso quase não prevê esforço
    de giro, e peso prevê 71% da variação dele.

    Agora a função lê `specs.swingweight_kgcm2`. Enquanto o campo era um proxy, ela não tinha como
    saber que estava errada — e é exatamente por isso que a regra da skill é ler do catálogo em vez
    de guardar número: no dia em que o catálogo melhorou, a função melhorou junto, sem ninguém
    lembrar de voltar aqui.
  */
  const medidas = rackets
    .map((r) => ({ g: r.specs.unstrung_weight_g, si: r.specs.swingweight_kgcm2 }))
    .filter((m): m is { g: number; si: number } => typeof m.g === 'number' && typeof m.si === 'number');

  const n = medidas.length;
  const mg = medidas.reduce((a, m) => a + m.g, 0) / n;
  const ms = medidas.reduce((a, m) => a + m.si, 0) / n;
  const cov = medidas.reduce((a, m) => a + (m.g - mg) * (m.si - ms), 0);
  const dg = Math.sqrt(medidas.reduce((a, m) => a + (m.g - mg) ** 2, 0));
  const ds = Math.sqrt(medidas.reduce((a, m) => a + (m.si - ms) ** 2, 0));

  /* Quantas raquetes têm MAIS inércia que alguma pelo menos `limiar` gramas mais pesada. */
  const invertidas = (limiar: number) =>
    medidas.filter((m) => medidas.some((o) => o.g >= m.g + limiar && o.si < m.si)).length;

  return {
    de: n,
    /** Correlação de Pearson entre peso na balança e inércia de swing. Perto de zero = não prevê. */
    correlacao: Number((cov / (dg * ds)).toFixed(3)),
    /*
      A contagem NUNCA sai sem o limiar ao lado. Publicar "26 das 47" sem dizer "15 g" é publicar
      um número que não se pode conferir — e foi assim que ele se descolou do limiar errado.
    */
    invertidas_por_limiar_g: { 5: invertidas(5), 10: invertidas(10), 15: invertidas(15), 20: invertidas(20) },
  };
}

/**
 * Quanto uma FAMÍLIA de raquetes discorda de si mesma.
 *
 * ═══ POR QUE ISTO VIROU FATO DE PRIMEIRA CLASSE ══════════════════════════════════════════════
 *
 * A caixa de pergunta trouxe "VCORE" sem versão, e a resposta honesta era outra pergunta: qual? A
 * medição mostrou por quê — no eixo de conforto, entre a VCORE mais confortável e a menos
 * confortável do catálogo cabem 26 raquetes de OUTRAS marcas. Mais da metade do catálogo, dentro
 * de uma linha só.
 *
 * Esse número é o argumento inteiro de uma pauta, e ele nasceu num script descartável — o mesmo
 * caminho que produziu o erro do "26 das 47 · 10 g", em que a contagem se descolou da condição que
 * a gerou. A regra da skill é explícita: se `fatos.ts` não devolve, não vai para a arte.
 *
 * Devolve, para cada eixo: a amplitude que a família ocupa em percentil e QUANTAS raquetes de fora
 * da família caem dentro dela. O segundo número é o que a copy publica, porque é o que se entende
 * sem explicar percentil — e ele nunca sai sem o eixo ao lado, pela mesma razão que a contagem de
 * inércia nunca sai sem o limiar.
 */
export function dispersaoDaFamilia(termo: string) {
  const marcadas = scoreRackets(rackets);
  const escala = buildCatalogScale(marcadas);
  const alvo = termo.toLowerCase();
  const familia = marcadas.filter((r) => r.variant.product_name.toLowerCase().includes(alvo));
  if (familia.length < 2) return null;

  const EIXOS = [
    'power_score',
    'control_score',
    'spin_score',
    'comfort_score',
    'maneuverability_score',
    'stability_score',
  ] as const;

  const eixos = EIXOS.map((eixo) => {
    const dentro = familia.map((r) => escala.position(eixo, r.attributes[eixo]));
    const min = Math.min(...dentro);
    const max = Math.max(...dentro);
    const outras = marcadas.filter((r) => {
      if (r.variant.product_name.toLowerCase().includes(alvo)) return false;
      const p = escala.position(eixo, r.attributes[eixo]);
      return p > min && p < max;
    }).length;
    return {
      eixo: eixo.replace('_score', ''),
      percentil_min: Math.round(min),
      percentil_max: Math.round(max),
      /* O número publicável: quantas raquetes de outras famílias cabem dentro desta. */
      outras_raquetes_no_meio: outras,
    };
  });

  return {
    termo,
    membros: familia.map((r) => r.variant.product_name),
    de: marcadas.length,
    eixos: eixos.sort((a, b) => b.outras_raquetes_no_meio - a.outras_raquetes_no_meio),
  };
}

/**
 * A faixa de tensão que o FABRICANTE recomenda — e quanta margem ela deixa em aberto.
 *
 * ═══ POR QUE ESTE NÚMERO INTERESSA ═══════════════════════════════════════════════════════════
 *
 * A etiqueta do quadro não traz uma tensão: traz um intervalo. Ninguém precisa acreditar no nosso
 * motor para verificar isso — está impresso na garganta da raquete de quem está lendo. É o raro
 * fato do produto que o leitor confere sozinho em cinco segundos, e por isso vale mais publicado
 * do que qualquer índice interno.
 *
 * Publicamos a MENOR largura do catálogo, não a média. A média é mais impressionante e mais frágil:
 * quem tiver em casa justamente o quadro de faixa estreita vai achar que o número foi inflado. O
 * mínimo é o número que nenhum leitor consegue desmentir com a própria raquete na mão.
 *
 * `limites.md` §5 autoriza: descreve a faixa que o CONJUNTO cobre, não a especificação de um modelo
 * nomeado — que continua travada enquanto `source_url` for nulo (§2).
 */
export function tensaoDoFabricante() {
  const faixas = rackets
    .map((r) => r.specs)
    .filter(
      (s): s is typeof s & { recommended_tension_min_lbs: number; recommended_tension_max_lbs: number } =>
        typeof s.recommended_tension_min_lbs === 'number' &&
        typeof s.recommended_tension_max_lbs === 'number',
    )
    .map((s) => ({
      min: s.recommended_tension_min_lbs,
      max: s.recommended_tension_max_lbs,
      largura: s.recommended_tension_max_lbs - s.recommended_tension_min_lbs,
    }));

  if (faixas.length === 0) return null;
  const larguras = faixas.map((f) => f.largura);

  /* Em kg porque é assim que se fala com encordoador no Brasil; em lbs porque é o que a etiqueta
     do quadro traz. Os dois juntos, sempre — publicar só um lado obriga o leitor a converter para
     conferir, e conferência que dá trabalho não acontece. */
  const emKg = (lbs: number) => Number(lbsToKg(lbs).toFixed(1));

  return {
    de: faixas.length,
    de_um_total_de: rackets.length,
    largura_minima_lbs: Math.min(...larguras),
    largura_minima_kg: emKg(Math.min(...larguras)),
    largura_maxima_lbs: Math.max(...larguras),
    largura_maxima_kg: emKg(Math.max(...larguras)),
    largura_media_lbs: Number((larguras.reduce((a, b) => a + b, 0) / larguras.length).toFixed(1)),
    extremos_do_catalogo_lbs: [
      Math.min(...faixas.map((f) => f.min)),
      Math.max(...faixas.map((f) => f.max)),
    ] as const,
  };
}

/**
 * Quantos fatores DIFERENTES o motor de tensão chega a usar, e onde as tensões que ele devolve caem.
 *
 * ═══ POR QUE VARRER PERFIS EM VEZ DE CONTAR AS LINHAS DE `tension.ts` ════════════════════════
 *
 * O cabeçalho de `tension.ts` diz "base do fabricante + 12 ajustes documentados". Copiar esse 12
 * para uma arte seria repetir exatamente o defeito do "26 das 47 · 10 g": um número escrito à mão
 * num comentário, carregado para fora sem ninguém remedir, que fica errado no dia em que o 13º
 * ajuste entrar — sem nada quebrar.
 *
 * Então o número não é lido, é observado: roda-se o motor sobre perfis sintéticos e recolhe-se a
 * UNIÃO dos `factor` que ele efetivamente emitiu. Se um ajuste for acrescentado, a varredura o
 * encontra sozinha; se um deixar de disparar para qualquer perfil, ele some da contagem — que é o
 * comportamento certo, porque um ajuste que nunca dispara não é um ajuste que o produto faz.
 *
 * O gerador de perfis é o MESMO de `tests/helpers/varredura.ts`, e não uma cópia local. Dois
 * geradores divergem, e o dia em que divergirem a skill vai publicar sobre um produto que os testes
 * não conferem. Ele é semeado, então a contagem é reproduzível.
 *
 * `amplitude_lbs` é o brinde da varredura: mostra que a faixa do fabricante não é decorativa —
 * jogadores reais caem nos dois extremos dela.
 */
export async function ajustesDeTensao(quantos = 300) {
  const { gerar } = await import('../../../../tests/helpers/varredura');
  const { recommend: rodar, enrichProfileWithCatalog } = await import('@/recommendation');
  const { buildPlayerProfile } = await import('@/recommendation/profile/build-profile');
  const { DATASET_VERSION } = await import('@/data/load');

  const marcadas = scoreRackets(rackets);
  const fatores = new Set<string>();
  const lbs: number[] = [];

  for (const sim of gerar(quantos)) {
    const profile = enrichProfileWithCatalog(buildPlayerProfile(sim.answers), marcadas, strings);
    const res = rodar({
      profile,
      rackets: marcadas,
      strings,
      datasetVersion: DATASET_VERSION,
      mode: 'permissive',
      includeSetup: true,
    });
    if (!res.tension) continue;
    for (const a of res.tension.adjustments) fatores.add(a.factor);
    lbs.push(res.tension.lbs);
  }

  return {
    perfis: quantos,
    /* A contagem NUNCA sai sem a lista ao lado, pela mesma razão que a inércia não sai sem o
       limiar: "12 ajustes" sem os nomes é um número que ninguém consegue conferir. */
    fatores: [...fatores].sort(),
    quantos_fatores: fatores.size,
    amplitude_lbs: lbs.length > 0 ? ([Math.min(...lbs), Math.max(...lbs)] as const) : null,
  };
}

export function fatos() {
  const specs = rackets.map((r) => r.specs);
  const peso = faixa(specs.map((s) => s.unstrung_weight_g));
  const area = faixa(specs.map((s) => s.head_size_sq_in));
  const gauges = [...new Set(strings.variants.map((v) => v.gauge_mm))].sort((a, b) => a - b);

  const padroes = contar(specs, (s) =>
    s.string_pattern_mains && s.string_pattern_crosses
      ? `${s.string_pattern_mains}x${s.string_pattern_crosses}`
      : null,
  );

  const comFonte = rackets.filter((r) => temFonte(r.id, 'unstrung_weight_g')).length;

  return {
    raquetes: rackets.length,
    marcas: [...new Set(rackets.map((r) => r.brand))].sort(),
    cordas_modelos: strings.models.length,
    cordas_variantes: strings.variants.length,
    setups: countSetupCombinations(rackets, strings),
    faixa_peso_g: peso,
    faixa_area_pol2: area,
    espessuras_mm: gauges,
    padroes,
    tipos_de_corda: contar(strings.models, (m) => m.string_type),
    peso_vs_inercia: pesoVersusInercia(),
    tensao_do_fabricante: tensaoDoFabricante(),
    /*
      O swingweight é hoje o ÚNICO campo do catálogo com fonte conferida por raquete, e por isso o
      único que a §2 de `limites.md` libera para modelo NOMEADO. `pode_publicar` não é escrito à
      mão: sai da mesma guarda `temFonte` que trava todo o resto, campo a campo.
    */
    swingweight: (() => {
      const v = rackets
        .map((r) => r.specs.swingweight_kgcm2)
        .filter((x): x is number => typeof x === 'number');
      if (v.length === 0) return null;
      return {
        medidas: v.length,
        de: rackets.length,
        faixa_kgcm2: [Math.min(...v), Math.max(...v)] as const,
        convencao: 'encordoada',
        pode_publicar_de_modelo_nomeado: rackets.every((r) => temFonte(r.id, 'swingweight_kgcm2')),
      };
    })(),
    /** Quantas raquetes já podem ter especificação numérica publicada. Ver `temFonte`. */
    raquetes_com_fonte: comFonte,
    pode_publicar_spec_de_modelo: comFonte > 0,
  };
}

if (require.main === module) {
  const familia = process.argv[2];

  /*
    Subcomando reservado ANTES da busca por família. `dispersaoDaFamilia('tensao')` devolveria null
    e imprimiria "menos de duas raquetes com tensao no nome" — uma mensagem que descreve outra
    pergunta, e que faria quem rodou achar que a medição não existe.
  */
  /*
    Um `await` de topo em vez do `process.exit(0)` que este bloco usava.

    `ajustesDeTensao` é assíncrona (carrega o gerador de perfis sob demanda, para que o uso comum —
    ler os fatos do catálogo — não pague uma varredura de 300 perfis). Encadeada num `.then` solto,
    a execução seguia SÍNCRONA para o bloco de baixo e o subcomando imprimia a varredura junto com
    o relatório inteiro, um depois do outro. Saída errada, sem erro nenhum.
  */
  void (async () => {
    if (familia === 'tensao') {
      console.log(JSON.stringify(await ajustesDeTensao(), null, 2));
      return;
    }

    if (familia) {
      const d = dispersaoDaFamilia(familia);
      console.log(
        d === null
          ? `Menos de duas raquetes com "${familia}" no nome — não há família para comparar.`
          : JSON.stringify(d, null, 2),
      );
      return;
    }

    const f = fatos();
    console.log(JSON.stringify(f, null, 2));
    if (!f.pode_publicar_spec_de_modelo) {
      console.log(
        '\n⚠️  Nenhuma raquete tem `source_url` para o peso. Especificação numérica de modelo\n' +
          '   NOMEADO não pode ser publicada — ver references/limites.md §2.\n' +
          '   Comparação entre modelos fica em caráter e tipo de jogador, sem número.',
      );
    }
  })();
}
