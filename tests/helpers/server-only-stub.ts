/**
 * Substituto de `server-only` sob o Vitest.
 *
 * O pacote real é um arquivo que LANÇA ao ser importado — é assim que ele transforma "importei
 * código de servidor num componente cliente" em erro de build. Fora do empacotador do Next, o
 * resolvedor cai na entrada de cliente e o teste morre no import, antes de rodar.
 *
 * O guard continua valendo onde ele importa (no `next build`, que é onde o vazamento aconteceria).
 * Aqui ele só precisa não atrapalhar.
 */
export {};
