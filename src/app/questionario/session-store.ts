import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { PlayerProfile } from '@/domain/player-profile';
import type { RecommendationResult } from '@/domain/recommendation';

/**
 * Store de sessão — STUB DE DESENVOLVIMENTO.
 *
 * ⚠️ Isto NÃO é a persistência de produção. O schema real está em docs/DATA_MODEL.md
 * (`anonymous_sessions`, `player_profiles`, `recommendation_sessions`, `racket_rankings`) e a
 * substituição é local: apenas `save` e `load` mudam para chamadas aos repositórios Drizzle.
 * Nenhuma outra parte do sistema conhece este módulo.
 *
 * POR QUE ARQUIVO E NÃO MEMÓRIA: um `Map` de módulo não sobrevive à fronteira entre o bundle da
 * Server Action e o bundle da página no Next.js — a action grava numa instância e a página lê de
 * outra, produzindo 404. Um store externo ao processo elimina a classe inteira de bug, que é
 * exatamente o que o Postgres fará em produção.
 */

export type StoredSession = {
  readonly profile: PlayerProfile;
  readonly result: RecommendationResult;
  readonly createdAt: number;
};

const DIR = join(tmpdir(), 'tennis-engineer-sessions');

function pathFor(id: string): string {
  // Só aceitamos UUID — impede path traversal via id manipulado.
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('id de sessão inválido');
  return join(DIR, `${id}.json`);
}

export function saveSession(id: string, session: StoredSession): void {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(pathFor(id), JSON.stringify(session), 'utf8');
}

export function loadSession(id: string): StoredSession | null {
  try {
    const file = pathFor(id);
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, 'utf8')) as StoredSession;
  } catch {
    return null;
  }
}
