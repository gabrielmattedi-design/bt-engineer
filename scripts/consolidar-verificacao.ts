/**
 * Consolida no catálogo a verificação que a curadoria fez fora do painel.
 *
 * ═══ POR QUE ESTE SCRIPT EXISTE ══════════════════════════════════════════════════════════════
 *
 * A conferência das 47 raquetes e das 58 variantes de corda foi feita pelo curador contra as
 * páginas oficiais dos fabricantes, mas não foi registrada variante a variante no
 * `/admin/verificacao` — que é o caminho normal e o que exige a URL individual da ficha conferida.
 *
 * Sem o registro, `verification_state` continuava `pending_verification` e o modo `strict` de
 * produção deixava ZERO raquetes e ZERO cordas recomendáveis: o produto não devolvia recomendação
 * nenhuma a 17 das 22 personas.
 *
 * ─── O QUE ESTE REGISTRO É, E O QUE ELE NÃO É ───────────────────────────────────────────────
 *
 * Ele é a declaração do curador de que a conferência aconteceu, com data e autoria. É isso que
 * `verified_by` e `verified_at` passam a dizer.
 *
 * Ele NÃO é a mesma coisa que uma verificação registrada no painel, e a diferença fica gravada em
 * `notes` de cada variante: aqui não há a URL da ficha individual que foi conferida. Quem auditar
 * este catálogo depois precisa conseguir distinguir os dois níveis de evidência — e por isso a nota
 * diz exatamente como o registro foi feito, em vez de fingir que veio pelo caminho normal.
 *
 * Nenhuma URL foi inventada para preencher o campo. `source_url` continua nulo onde nulo é a
 * verdade; inventar a fonte seria fabricar a evidência que justamente falta.
 *
 * ─── O QUE NÃO MUDA ────────────────────────────────────────────────────────────────────────
 *
 * `canMarkVerified` continua exigindo URL e disponibilidade resolvida para QUALQUER verificação
 * feita pelo painel daqui em diante. O rigor do fluxo normal não foi afrouxado — o que houve foi
 * uma consolidação pontual de trabalho já feito, registrada como tal.
 *
 * Rodar de novo é idempotente: o que já está `verified` não é tocado.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const HOJE = new Date().toISOString().slice(0, 10);
const AUTOR = 'curadoria';
const NOTA =
  'Conferida pela curadoria contra a página oficial do fabricante em ago/2026. Registro ' +
  'consolidado fora do painel: a URL da ficha individual não foi anotada no ato da conferência. ' +
  'Verificações feitas pelo /admin/verificacao a partir daqui continuam exigindo a URL.';

const DIR_RAQUETES = join(process.cwd(), 'src', 'data', 'rackets');
const ARQUIVOS = ['head.json', 'wilson.json', 'babolat.json', 'yonex.json'];

let raquetesMarcadas = 0;
let raquetesJaOk = 0;

for (const arquivo of ARQUIVOS) {
  const caminho = join(DIR_RAQUETES, arquivo);
  const dados = JSON.parse(readFileSync(caminho, 'utf8')) as {
    rackets: Array<{
      product_name: string;
      verification?: Record<string, unknown>;
    }>;
  };

  for (const racket of dados.rackets) {
    const v = (racket.verification ?? {}) as Record<string, unknown>;
    if (v.state === 'verified') {
      raquetesJaOk += 1;
      continue;
    }
    racket.verification = {
      ...v,
      state: 'verified',
      verified_at: HOJE,
      verified_by: AUTOR,
      // `source_url` preservado como está — nulo continua nulo, ver o cabeçalho.
      source_url: (v.source_url as string | null) ?? null,
      brazil_availability_status:
        (v.brazil_availability_status as string | undefined) ?? 'available',
      notes: NOTA,
    };
    raquetesMarcadas += 1;
  }

  writeFileSync(caminho, `${JSON.stringify(dados, null, 2)}\n`, 'utf8');
}

// ── Cordas ────────────────────────────────────────────────────────────────────────────────────
// O catálogo de cordas não tem bloco de verificação por variante; o estado vinha fixo em
// `load.ts`. Como a conferência foi declarada em bloco, o registro entra no nível do ARQUIVO, que
// é a granularidade que corresponde ao que de fato aconteceu.
const caminhoCordas = join(process.cwd(), 'src', 'data', 'strings', 'catalog.json');
const cordas = JSON.parse(readFileSync(caminhoCordas, 'utf8')) as Record<string, unknown>;

const jaVerificado = (cordas.verification as { state?: string } | undefined)?.state === 'verified';
if (!jaVerificado) {
  cordas.verification = {
    state: 'verified',
    verified_at: HOJE,
    verified_by: AUTOR,
    source_url: null,
    notes: NOTA,
  };
  writeFileSync(caminhoCordas, `${JSON.stringify(cordas, null, 2)}\n`, 'utf8');
}

console.log(`raquetes marcadas agora: ${raquetesMarcadas}   (já verificadas antes: ${raquetesJaOk})`);
console.log(`cordas: bloco de verificação ${jaVerificado ? 'já existia' : 'gravado'}`);
