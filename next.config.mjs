/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * Os arquivos `.sql` de migração precisam existir no servidor em runtime.
   *
   * `/admin/setup` executa as migrações a partir do painel, e o rastreador de arquivos do Next só
   * inclui o que consegue enxergar em `import`. Uma pasta lida por caminho, em tempo de execução,
   * é invisível para ele — sem esta declaração o botão funciona em desenvolvimento e falha em
   * produção com "arquivo não encontrado", que é o pior momento possível para descobrir isso.
   */
  outputFileTracingIncludes: {
    '/admin/setup': ['./src/database/migrations/**/*'],
  },
};

export default nextConfig;
