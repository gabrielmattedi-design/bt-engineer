/**
 * A connection string do provedor precisa funcionar COMO ELE A ENTREGA.
 *
 * ═══ O DEPLOY QUE ISTO SALVA ═════════════════════════════════════════════════════════════════
 *
 * O Neon entrega a string terminando em `?sslmode=require&channel_binding=require`. O postgres-js
 * traduz `sslmode`, mas não conhece `channel_binding` — e o que ele faz com um parâmetro
 * desconhecido é REPASSÁ-LO AO SERVIDOR como parâmetro de sessão. O Postgres derruba a conexão:
 *
 *     unrecognized configuration parameter "channel_binding"
 *
 * Medido contra um Postgres 16 real: com o parâmetro a conexão falha, sem ele conecta.
 *
 * O estrago não é o erro em si, é ONDE ele aparece. Quem cola a string é uma pessoa num painel da
 * Vercel, no meio de um deploy, e recebe de volta uma falha de banco que não menciona a causa nem
 * o culpado. Pior: ela vai colar essa string de novo — a cada rotação de senha, a cada ambiente
 * novo. Instrução de "lembre-se de apagar o final" é armadilha de gatilho retardado.
 *
 * ═══ O QUE ESTE TESTE TRANCA ═════════════════════════════════════════════════════════════════
 *
 * Que a limpeza continue removendo o que quebra e PRESERVANDO tudo o mais — inclusive a senha, que
 * vive antes do `?` e pode conter caracteres que uma volta por `new URL()` re-codificaria.
 */

import { describe, expect, it } from 'vitest';

import { sanitizeDatabaseUrl } from '@/database/client';

const NEON = 'postgresql://neondb_owner:senha@ep-fancy-pond-ackw87wv-pooler.sa-east-1.aws.neon.tech/neondb';

describe('limpeza da DATABASE_URL', () => {
  it('remove channel_binding, que derruba a conexão', () => {
    expect(sanitizeDatabaseUrl(`${NEON}?sslmode=require&channel_binding=require`)).toBe(
      `${NEON}?sslmode=require`,
    );
  });

  /** `sslmode` o postgres-js entende e traduz para a opção `ssl`. Removê-lo abriria a conexão sem TLS. */
  it('preserva sslmode', () => {
    expect(sanitizeDatabaseUrl(`${NEON}?sslmode=require`)).toBe(`${NEON}?sslmode=require`);
  });

  it('preserva parâmetros legítimos de sessão', () => {
    const url = `${NEON}?options=-c%20search_path%3Dpublic&application_name=tennis-engineer`;
    expect(sanitizeDatabaseUrl(url)).toBe(url);
  });

  it('deixa intacta uma string sem query', () => {
    expect(sanitizeDatabaseUrl(NEON)).toBe(NEON);
  });

  /** Sobrando zero parâmetros, o `?` também sai — `postgres://host/db?` é malformado. */
  it('remove o ponto de interrogação quando nada sobra', () => {
    expect(sanitizeDatabaseUrl(`${NEON}?channel_binding=require`)).toBe(NEON);
  });

  /**
   * A senha vive ANTES do `?`. Uma implementação que passasse por `new URL()` e re-serializasse
   * re-codificaria `@`, `/`, `+` e `%` — trocando a senha por outra, silenciosamente, e produzindo
   * um "autenticação falhou" que ninguém liga à limpeza da URL.
   */
  it('não toca na senha, por mais estranha que ela seja', () => {
    const bruta = 'postgresql://user:p%40ss%2Fw0rd%2Bx@host.neon.tech/db?channel_binding=require';
    expect(sanitizeDatabaseUrl(bruta)).toBe('postgresql://user:p%40ss%2Fw0rd%2Bx@host.neon.tech/db');
  });

  it('não se importa com a caixa do nome do parâmetro', () => {
    expect(sanitizeDatabaseUrl(`${NEON}?Channel_Binding=require`)).toBe(NEON);
  });

  /**
   * Os outros nomes da lista são opções de cliente do libpq pelo mesmo motivo: não existem como
   * parâmetro de servidor, então chegar lá é sempre erro.
   */
  it.each(['gssencmode', 'krbsrvname', 'passfile', 'requirepeer', 'service', 'sslcompression', 'sslcrl', 'sslcrldir'])(
    'remove %s',
    (param) => {
      expect(sanitizeDatabaseUrl(`${NEON}?sslmode=require&${param}=x`)).toBe(
        `${NEON}?sslmode=require`,
      );
    },
  );
});
