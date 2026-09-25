/**
 * TRAVA DE CONFIGURAÇÃO — roda antes do build de produção (`npm run build`), antes até da trava do
 * catálogo: não adianta conferir o dado de um produto que ainda se apresenta com o nome de outro.
 *
 * Falha se faltar uma variável sem padrão, ou se QUALQUER variável do ambiente apontar para o
 * Tennis Engineer. O porquê está em `src/lib/ambiente.ts`; o resumo é que este repositório é uma
 * cópia daquele produto, e um padrão que caía no domínio dele fazia o sistema funcionar
 * normalmente com a identidade errada — sem erro nenhum.
 *
 * Não tem saída de emergência como o `ALLOW_UNVERIFIED_DATASET` da trava do catálogo, de propósito.
 * Aquela libera um ambiente de TESTES com aviso na tela; aqui não existe versão aceitável do
 * defeito: um preview com o remetente errado manda e-mail errado de verdade.
 *
 * Lista TODOS os problemas de uma vez. Um por tentativa transforma cinco minutos de configuração
 * em cinco deploys.
 */

import { conferirAmbiente } from '../src/lib/ambiente';

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';

const problemas = conferirAmbiente(process.env);

if (problemas.length > 0) {
  console.error(`\n${RED}═══ Configuração recusada (${problemas.length}) ═══${RESET}\n`);
  for (const p of problemas) console.error(`  ${RED}✗${RESET} ${p}`);
  console.error(
    '\nNenhuma dessas variáveis tem valor padrão, e nenhuma pode vir do projeto antigo.\n' +
      'Ver docs/DEPLOY.md §2 e src/lib/ambiente.ts.\n',
  );
  process.exit(1);
}

console.log(`${GREEN}✓ Configuração: variáveis obrigatórias presentes, nada aponta para o projeto antigo.${RESET}`);
