/**
 * O endereço do site mora em um lugar só.
 *
 * ═══ O QUE ACONTECEU ═════════════════════════════════════════════════════════════════════════
 *
 * O endereço estava escrito à mão dentro do card de compartilhamento — a imagem que a pessoa posta
 * no Instagram ou manda no grupo do clube. Enquanto o produto vivia em `tennis-engineer.vercel.app`
 * estava certo. No minuto em que o domínio próprio entrou no ar, aquela imagem passou a divulgar um
 * endereço errado para todo mundo que a compartilhasse — e como era o único lugar do código que
 * sabia o endereço, nada quebrou, nada avisou.
 *
 * Endereço que aparece para o cliente é configuração. Este teste impede que ele volte a ser
 * literal espalhado por componente.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { SITE_DOMAIN, SITE_URL } from '@/lib/site';

const SRC = join(__dirname, '..', '..', 'src');
const SITE_MODULE = join(SRC, 'lib', 'site.ts');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

describe('o endereço público', () => {
  it('tem protocolo e host, sem barra sobrando', () => {
    expect(SITE_URL).toMatch(/^https:\/\/[^/]+$/);
    expect(SITE_DOMAIN).not.toContain('/');
    expect(SITE_DOMAIN).not.toContain('http');
  });

  it('serve para construir uma URL absoluta — é o que o Open Graph exige', () => {
    expect(() => new URL(SITE_URL)).not.toThrow();
    expect(new URL(SITE_URL).host).toBe(SITE_DOMAIN);
  });

  /**
   * A trava principal. Escrita sobre o código-fonte porque o risco não é o card de hoje — é o
   * próximo componente que precisar do endereço e resolver digitá-lo.
   */
  it('nenhum arquivo escreve um endereço de hospedagem à mão', () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(SRC)) {
      if (file === SITE_MODULE) continue;
      const source = readFileSync(file, 'utf8');

      for (const [linha, texto] of source.split('\n').entries()) {
        // Comentários explicam a história desta correção e podem citar o endereço antigo.
        const codigo = texto.replace(/\/\/.*$|\*.*$/g, '');
        if (/\b[\w-]+\.vercel\.app\b/.test(codigo)) {
          offenders.push(`${file.slice(SRC.length + 1)}:${linha + 1}`);
        }
      }
    }

    expect(
      offenders,
      `endereço de hospedagem escrito à mão (use SITE_URL / SITE_DOMAIN):\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });

  /**
   * Sem `metadataBase`, o Next resolve as URLs de Open Graph contra `localhost`. O sintoma só
   * aparece FORA do site — o link colado no WhatsApp perde a prévia —, então não há como notar
   * navegando.
   */
  it('o layout declara metadataBase a partir do endereço configurado', () => {
    const layout = readFileSync(join(SRC, 'app', 'layout.tsx'), 'utf8');
    expect(layout).toContain('metadataBase: new URL(SITE_URL)');
  });
});
