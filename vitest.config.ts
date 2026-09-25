import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // Ver tests/helpers/server-only-stub.ts.
      'server-only': resolve(__dirname, './tests/helpers/server-only-stub.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    /*
      As variáveis sem padrão (src/lib/ambiente.ts), com valores de mentira num domínio reservado.
      `.test` é reservado pela RFC 2606 e nunca resolve: se um teste vazar uma chamada de rede com
      estes valores, ela falha em vez de chegar num endereço de alguém. E nenhum teste passa por
      depender do endereço de verdade do produto.
    */
    env: {
      NEXT_PUBLIC_SITE_URL: 'https://produto.test',
      EMAIL_FROM: 'Produto <nao-responda@produto.test>',
      CONTACT_EMAIL: 'contato@produto.test',
    },
    coverage: { reporter: ['text', 'lcov'], include: ['src/recommendation/**', 'src/domain/**'] },
  },
});
