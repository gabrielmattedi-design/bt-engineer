/**
 * Histórico editorial — o que já foi pautado, para não repetir.
 *
 * ═══ POR QUE JSONL, E NÃO JSON ═══════════════════════════════════════════════════════════════
 *
 * Acrescentar uma linha nunca reescreve o arquivo. Isso importa por dois motivos concretos: duas
 * execuções no mesmo dia não se sobrescrevem, e um arquivo truncado no meio perde a última linha em
 * vez do histórico inteiro. Um JSON de array exigiria ler-modificar-gravar a cada pauta, que é o
 * padrão que corrompe arquivo quando algo falha no meio.
 *
 * ═══ POR QUE SÓ O PUBLICADO BLOQUEIA ═════════════════════════════════════════════════════════
 *
 * O campo `status` distingue pauta gerada de pauta publicada, e só a segunda bloqueia repetição.
 * Sem essa distinção a skill queimaria os melhores temas em rascunhos que o dono nunca aprovou —
 * cada geração recusada tornaria aquele assunto inalcançável por 60 dias.
 */

import { appendFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ARQUIVO = join(__dirname, '..', 'historico', 'publicado.jsonl');

export type Pauta = {
  readonly data: string;
  readonly pilar: string;
  readonly formato: 'unico' | 'carrossel' | 'story' | 'reels';
  /** Chave curta e estável do assunto, em kebab-case. É por ela que a repetição é detectada. */
  readonly tema: string;
  readonly hook: string;
  readonly cta: 'engajamento' | 'curiosidade' | 'conversao';
  readonly fatos_usados: readonly string[];
  readonly status: 'gerado' | 'aprovado' | 'publicado';
};

export function lerHistorico(): Pauta[] {
  if (!existsSync(ARQUIVO)) return [];
  return readFileSync(ARQUIVO, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as Pauta);
}

export function registrar(p: Pauta): void {
  mkdirSync(dirname(ARQUIVO), { recursive: true });
  appendFileSync(ARQUIVO, JSON.stringify(p) + '\n', 'utf8');
}

const DIA = 24 * 60 * 60 * 1000;
const diasAtras = (iso: string): number => (Date.now() - new Date(iso).getTime()) / DIA;

/** Palavras sem carga semântica, que fariam dois temas diferentes parecerem parentes. */
const VAZIAS = new Set(['de', 'do', 'da', 'e', 'ou', 'a', 'o', 'em', 'no', 'na', 'para', 'com']);
const raizes = (tema: string): Set<string> =>
  new Set(tema.split('-').filter((t) => t.length > 2 && !VAZIAS.has(t)));

/**
 * As quatro regras que decidem se uma pauta pode ir adiante.
 *
 * Devolve os avisos em ordem de severidade. `bloqueio: true` significa escolher outra pauta;
 * `bloqueio: false` é aviso para o dono decidir.
 */
export function conferir(
  tema: string,
  pilar: string,
  cta: Pauta['cta'],
): { bloqueio: boolean; avisos: string[] } {
  const hist = lerHistorico();
  const publicados = hist.filter((p) => p.status === 'publicado');
  const avisos: string[] = [];
  let bloqueio = false;

  // 1. Tema idêntico nos últimos 60 dias — bloqueia.
  const igual = publicados.find((p) => p.tema === tema && diasAtras(p.data) <= 60);
  if (igual) {
    avisos.push(`"${tema}" foi publicado em ${igual.data}, há ${Math.round(diasAtras(igual.data))} dias.`);
    bloqueio = true;
  }

  // 2. Tema aparentado nos últimos 21 dias — avisa.
  const minhas = raizes(tema);
  for (const p of publicados) {
    if (p.tema === tema || diasAtras(p.data) > 21) continue;
    const comuns = [...raizes(p.tema)].filter((r) => minhas.has(r));
    if (comuns.length >= 2) {
      avisos.push(`Parecido com "${p.tema}" (${p.data}) — em comum: ${comuns.join(', ')}.`);
    }
  }

  // 3. Mesmo pilar três dias seguidos — força alternância.
  const ultimos = publicados
    .slice()
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 3);
  if (ultimos.length === 3 && ultimos.every((p) => p.pilar === pilar)) {
    avisos.push(`Os três últimos posts foram do pilar ${pilar}. Alterne.`);
    bloqueio = true;
  }

  /*
    4. Teto comercial: no máximo 1 CTA de conversão a cada 8 posts do mês.

    É a regra editorial do dono — "não quero que todo post termine em acesse o Tennis Engineer" —
    virada em conta verificável. Sem número, ela vira intenção, e intenção não sobrevive a uma
    semana de conversão fraca.
  */
  if (cta === 'conversao') {
    const mes = publicados.filter((p) => diasAtras(p.data) <= 30);
    const conversoes = mes.filter((p) => p.cta === 'conversao').length;
    const teto = Math.max(1, Math.floor(mes.length / 8));
    if (conversoes >= teto) {
      avisos.push(
        `Já são ${conversoes} CTA de conversão em ${mes.length} posts no mês (teto: ${teto}). ` +
          `Proponha outra pauta ou baixe o CTA para curiosidade.`,
      );
      bloqueio = true;
    }
  }

  return { bloqueio, avisos };
}

if (require.main === module) {
  const [, , tema, pilar, cta] = process.argv;
  if (!tema) {
    const h = lerHistorico();
    console.log(`${h.length} pautas no histórico (${h.filter((p) => p.status === 'publicado').length} publicadas).`);
    for (const p of h.slice(-15)) console.log(`  ${p.data}  ${p.pilar}  ${p.formato.padEnd(9)} ${p.tema}`);
    process.exit(0);
  }
  const r = conferir(tema, pilar ?? 'P1', (cta as Pauta['cta']) ?? 'engajamento');
  console.log(r.bloqueio ? '❌ BLOQUEADO' : '✅ liberado');
  r.avisos.forEach((a) => console.log('  ·', a));
}
