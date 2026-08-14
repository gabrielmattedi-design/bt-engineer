# Tennis Engineer

**Seu jogo. Seu setup. Sob medida.**

Plataforma de recomendação de equipamento de tênis: analisa o perfil de um jogador e recomenda
**raquete + corda + espessura + tensão** com metodologia documentada, algoritmo determinístico e IA
atuando apenas como camada interpretativa.

---

## Estado do projeto

| Camada | Estado |
|---|---|
| Documentação técnica (13 documentos) | ✅ completa |
| Domínio, motor de recomendação, motor de tensão | ✅ implementado e testado |
| Dataset semente (41 raquetes, 20 cordas / 40 variantes) | ⚠️ **carregado, não verificado** — ver abaixo |
| Camada de IA (extração + guard anti-alucinação) | ✅ implementada, opcional em runtime |
| Entitlements e serialização por acesso | ✅ implementado e testado |
| UI (landing, questionário, análise, resultado, pódio) | ✅ funcional ponta a ponta |
| Simulador do admin (CLI) | ✅ funcional |
| Persistência Postgres, pagamentos, painel admin web | 🚧 especificados, não implementados |

### ⚠️ O catálogo ainda não pode sustentar uma venda

`swingweight`, `stiffness_ra`, `twistweight` e `strung_weight` são **medições de laboratório** que o
fabricante não publica. Elas estão `null` no seed, por decisão explícita: `null` é melhor que um
número falso (§69). Os campos de catálogo do fabricante estão carregados, mas em
`pending_verification` — nenhum foi conferido por um humano contra a fonte oficial.

`npm run dataset:gate` **bloqueia o build de produção** enquanto isso não for resolvido. Isso é um
portão de CI, não uma boa intenção. Ver `docs/00_RISKS_AND_DECISIONS.md#r-01` e `docs/DATA_SOURCING.md`.

---

## Rodando

```bash
npm install
npm run dev                 # http://localhost:3000
```

O produto funciona **sem `ANTHROPIC_API_KEY`**: sem chave, o texto livre não gera sinais e as
explicações vêm do gerador determinístico. A IA nunca está no caminho crítico do ranking.

```bash
npm test                    # 116 testes
npm run typecheck
npm run dataset:gate        # relatório de verificação e cobertura do catálogo
npm run simulate            # matriz das 22 personas
npm run simulate -- p05 --breakdown 3   # auditoria completa de uma persona
```

> Em `next start` o `NODE_ENV=production` força o modo estrito do dataset, e nenhuma raquete
> não verificada é recomendável — a análise retorna "ainda não podemos recomendar com segurança".
> É o comportamento correto. Use `npm run dev` para percorrer o fluxo completo com o seed atual.

---

## Arquitetura

Cinco camadas, com a IA isolada na última (§4):

```
1  DATASET          src/data          raquetes, variantes, cordas, gauges reais + procedência
2  NORMALIZAÇÃO     src/recommendation/normalize    specs → 11 atributos 0–100
3  PLAYER PROFILE   src/recommendation/profile      respostas → ~28 scores
4  MOTOR            src/recommendation/engine       ranking determinístico e auditável
5  IA               src/ai            interpreta texto livre · escreve explicações · nunca inventa
```

**Garantias verificadas por teste**, não por convenção:

- **Determinismo** — mesmas respostas + mesmas versões ⇒ mesmo ranking, sempre.
- **Fronteira** — `src/recommendation` não importa React, Next, banco, IA ou pagamentos. Por isso o
  simulador do admin roda exatamente o código de produção.
- **Integridade de gauge** — 500 perfis sintéticos, nenhuma recomendação aponta para uma combinação
  marca+modelo+espessura que não exista e não esteja disponível no Brasil.
- **Anti-alucinação** — todo numeral de uma explicação gerada por IA é validado contra um conjunto
  fechado de fatos. Um swingweight inventado rejeita o texto e o sistema cai para o determinístico.
- **Entitlements** — o payload é *construído* a partir dos acessos, não filtrado. Sem `top3_access`,
  marca e modelo do 2º e 3º colocados não existem na resposta.
- **Ética** — se o 3º colocado não for uma opção realmente boa, o pódio encolhe e o upsell não é
  ofertado.

---

## Documentação

| Documento | Conteúdo |
|---|---|
| [`00_RISKS_AND_DECISIONS.md`](docs/00_RISKS_AND_DECISIONS.md) | **Comece por aqui.** 11 riscos e as decisões tomadas |
| [`PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md) | Posicionamento, funil, produtos, métrica central |
| [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Stack, camadas, árvore do projeto |
| [`DATA_MODEL.md`](docs/DATA_MODEL.md) | Schema completo com procedência por campo |
| [`RECOMMENDATION_ENGINE.md`](docs/RECOMMENDATION_ENGINE.md) | Todas as fórmulas, pesos e justificativas |
| [`STRING_AND_TENSION_ENGINE.md`](docs/STRING_AND_TENSION_ENGINE.md) | Seleção por variante real + motor de tensão |
| [`QUESTIONNAIRE.md`](docs/QUESTIONNAIRE.md) | 8 etapas, lógica condicional |
| [`MONETIZATION.md`](docs/MONETIZATION.md) | Produtos, entitlements, idempotência |
| [`DATA_SOURCING.md`](docs/DATA_SOURCING.md) | Hierarquia de fontes e trava de release |
| [`ADMIN_SPEC.md`](docs/ADMIN_SPEC.md) | CRUD, fila de verificação, simulador |
| [`TEST_STRATEGY.md`](docs/TEST_STRATEGY.md) | Personas e testes de integridade |
| [`DESIGN.md`](docs/DESIGN.md) | Tokens, componentes, mobile-first |
| [`CALIBRATION_LOG.md`](docs/CALIBRATION_LOG.md) | Achados da validação e correções |

---

## Regra de ouro

> Nunca tentar parecer mais inteligente do que os dados disponíveis. Quando a confiança for baixa,
> dizer isso. Quando faltar especificação, não inventar. Quando duas raquetes empatarem, deixar
> evidente. Quando houver trade-off, explicar.

O sistema aplica isso sobre si mesmo: reporta as próprias lacunas de catálogo, recusa-se a vender
uma análise que não consegue sustentar, e separa **compatibilidade** de **confiança** em toda tela.
