/**
 * Faixas de referência do domínio — docs/RECOMMENDATION_ENGINE.md §1.
 *
 * ┌───────────────────────────────────────────────────────────────────────────────────┐
 * │ v2 — ESPECIFICAÇÕES CONSOLIDADAS DE MERCADO                                              │
 * │                                                                                          │
 * │ O motor usa EXCLUSIVAMENTE os campos que as quatro marcas publicam no próprio catálogo e │
 * │ que qualquer varejista especializado reproduz — os mesmos do spec card do brand book:    │
 * │                                                                                          │
 * │   peso (sem cordas) · balanço · padrão de encordoamento · tamanho da cabeça ·            │
 * │   perfil do quadro (viga) · comprimento · faixa de tensão                                │
 * │                                                                                          │
 * │ REMOVIDOS na v2: swingweight, rigidez RA, twistweight e peso encordoado. São medições de │
 * │ laboratório, não são publicadas pelo fabricante, variam por exemplar e não são obtíveis   │
 * │ de forma consistente entre as quatro marcas. Depender delas mantinha o catálogo em        │
 * │ completude 0.61 e travava a confiança em "Média" para todo mundo.                         │
 * └───────────────────────────────────────────────────────────────────────────────────┘
 */

/**
 * 2.34.0 — existe um teto de peso estático do quadro, por porte, sexo e faixa etária.
 *
 * Até aqui o motor só tinha PONTUAÇÃO de encaixe físico, e ela ordena por inércia de swing (peso ×
 * balanço) — o que é a grandeza certa: é ela que a pessoa sente. Só que a inércia não sabe quanto
 * braço existe do outro lado, e nos extremos isso vira um erro visível: um menino de 12 anos com
 * 52 kg recebia quadros de 295 a 305 g, com encaixe físico de 77 e 84 de 100. A pontuação não
 * estava errada; faltava um limite absoluto acima dela.
 *
 * A partir daqui o perfil carrega `frame_weight_ceiling_g` e o ranking não oferece quadro acima
 * dele. A recomendação para os perfis de porte menor muda — é a primeira vez desde a 2.12.0 que uma
 * regra nova pode trocar a raquete indicada para um perfil inteiro, e não só reordenar empates.
 *
 * A fórmula, as medições e o que cada termo custa estão em `frameWeightCeiling`
 * (recommendation/profile/build-profile.ts); a razão de o teto ser aplicado depois da pontuação, e
 * não junto dos filtros duros, está em `applyWeightCeiling` (engine/rank-rackets.ts).
 *
 * ─── E MAIS TRÊS COISAS ENTRARAM NA MESMA VERSÃO, TODAS SOBRE O MESMO ASSUNTO ──────────────
 *
 * 1. O relatório passa a EXPLICAR o peso. A nota de inércia (`buildWeightReading`) responde à
 *    objeção que o teto tornou inevitável: por que a raquete mais pesada é a que gira com menos
 *    esforço. Ela só aparece quando existem dois quadros concretos para comparar.
 *
 * 2. Menores de 16 ainda pequenos para o catálogo adulto recebem o aviso de migração juvenil
 *    (`buildJuniorTransitionNote`): a recomendação é a melhor DENTRE as adultas, e quadros de 25 e
 *    26 polegadas seguem legítimos nessa fase — coisa que este catálogo não avalia.
 *
 * 3. A TENSÃO muda de número para parte do público, e por conserto de defeito.
 *    `current_string.string_type` nunca era preenchido: o questionário não perguntava a categoria
 *    da corda atual e nada a derivava. `computeTension` comparava esse `null` com o tipo
 *    recomendado para decidir o peso da experiência do jogador — a comparação nunca dava igual,
 *    todo mundo ficava nos 35% em vez de 55%, e o relatório afirmava "o tipo de corda muda" para
 *    quem não estava mudando de tipo. Agora a pergunta existe, é opcional, e a comparação é por
 *    família (`sameStringFamily`), porque poliéster e copoliéster são a mesma coisa para quem joga.
 *    Junto veio o bloco de corda e tensão para a RAQUETE ATUAL (`current_racket_setup`).
 *
 * 2.33.0 — a comparação com a variação de fábrica saiu do relatório inteiro.
 *
 * A 2.32.0 tirou a frase do card da raquete atual e a manteve no bloco de empate técnico do pódio,
 * onde ela era o argumento que dava escala ao "0,45 ponto". O pedido era outro: o problema é a
 * COMPARAÇÃO, não o lugar dela.
 *
 * E o pedido está certo. A frase obriga quem lê a segurar duas grandezas ao mesmo tempo — a
 * diferença entre DUAS raquetes distintas e a variação entre duas unidades de UM mesmo modelo —
 * para entender uma frase que só precisava dizer que a diferença é pequena. O bloco do pódio agora
 * fecha com "uma margem pequena demais para chamar as outras de piores", que é a conclusão que
 * importa e não pede nenhuma conta.
 *
 * O argumento em si continua válido e continua registrado em `podium-tie.ts`: é ele que sustenta a
 * decisão de não exibir casa decimal no score. O que ele deixou de ser é texto de produto. Uma
 * justificativa de engenharia não vira automaticamente uma boa explicação para quem lê.
 *
 * O RANKING não muda.
 *
 * 2.32.0 — o card da raquete atual parou de comparar a diferença com a variação de fábrica.
 *
 * A frase do empate trazia `menor que um ponto, menos do que separa duas unidades da mesma raquete
 * saídas de fábrica`. A segunda metade é redundante — "menor que um ponto" já diz o tamanho — e
 * ela aparecia DUAS VEZES na mesma página, porque o bloco de empate técnico do pódio usa a mesma
 * comparação algumas seções abaixo.
 *
 * Lá ela fica, e deve ficar: é o argumento que sustenta chamar 0,45 ponto de empate, e sem ela
 * aquele número não tem referência de escala. Aqui era ilustração repetida, e ilustração repetida
 * vira ruído — o leitor para para conferir se são a mesma informação ou duas diferentes.
 *
 * O RANKING não muda.
 *
 * 2.31.0 — até o caso em que a raquete do jogador VENCE virou condicional.
 *
 * Ele terminava em `Nenhuma troca de quadro te levaria adiante daqui`. Verdade, e ainda assim um
 * ponto final onde cabia um caminho: quem chegou aqui incomodado com alguma coisa continua
 * incomodado depois de ler que está tudo certo.
 *
 * Vencer o ranking não é o mesmo que estar satisfeito. O texto separa os dois — se está satisfeito,
 * não há motivo para trocar; se algo incomoda, a alavanca é a corda e a tensão, e os eixos dizem
 * onde. É a única resposta útil neste ramo, porque aqui não existe raquete melhor a oferecer.
 *
 * Com isto os CINCO veredictos ficam condicionais: nenhum deles decide pelo leitor, nem para trocar
 * nem para ficar.
 *
 * O RANKING não muda.
 *
 * 2.30.0 — o veredicto do EMPATE entrou na mesma escada dos outros quatro.
 *
 * O ramo criado na 2.29.0 saiu dizendo `Não há ganho a buscar numa troca de quadro` — exatamente o
 * registro categórico que a 2.27.0 tinha acabado de remover dos outros casos, reintroduzido sem
 * querer num ramo novo. Mesmo defeito, mesma razão: concluir sobre a troca a partir de um agregado
 * que não sabe ONDE está a diferença, para alguém que em geral chegou aqui incomodado com algo
 * específico.
 *
 * Aqui o argumento é ainda mais forte que no caso de 1 a 3 pontos, porque a diferença é MENOR —
 * cabe dentro do arredondamento. Se em três pontos o que decide já é tato, adaptação e marca, em
 * menos de um ponto isso vale integralmente.
 *
 * Os cinco textos agora seguem a mesma escada: dizem o tamanho real da diferença, calibram a
 * expectativa, oferecem o setup como caminho de maior retorno e — até 3 pontos — mandam olhar os
 * eixos, que é onde está a informação que o agregado apagou. Do 4 em diante o convite ao teste
 * cresce; do 9 em diante a recomendação é firme. Nenhum decide pelo leitor em nenhuma das duas
 * direções, e um teste varre os quatro contra o registro categórico.
 *
 * O RANKING não muda.
 *
 * 2.29.0 — o empate no arredondamento parou de virar "primeiro lugar".
 *
 * Defeito pego por leitura, com o relatório na tela: o card exibia `2º lugar, 88% de
 * compatibilidade` no título e, no corpo, `A raquete que você já tem é a melhor opção`. `gap` é a
 * diferença entre dois `fit_score` já ARREDONDADOS — 88,45 da primeira contra 88,00 da atual viram
 * 88 e 88 —, e o ramo de gap zero assumia que zero significa 1º lugar.
 *
 * Zero ali significa outra coisa: empatadas no número exibido. O caso agora tem texto próprio, que
 * diz a posição real e enquadra a diferença (menor que um ponto, menos do que separa duas unidades
 * da mesma raquete saídas de fábrica). O ramo de "melhor opção" passou a exigir `rank === 1`.
 *
 * Nenhuma das 22 personas produz esse estado — medido, ZERO delas cai em `gap === 0`. Por isso o
 * teste que o tranca monta o cenário à mão em vez de varrer personas: um ramo que nenhuma persona
 * alcança não é coberto por nenhuma varredura de personas, e foi assim que ele chegou à produção.
 *
 * O RANKING não muda.
 *
 * 2.28.0 — "O que você deve perceber" passa a saber o que a pessoa PEDIU, e a conta da tensão
 * fecha na tela.
 *
 * ─── AS EXPECTATIVAS ────────────────────────────────────────────────────────────────────────
 *
 * Reclamação do usuário: o relatório dele abria com `Spin: trajetória mais plana; o spin dependerá
 * mais da sua técnica` — sendo que ele não pediu spin. Eram dois defeitos empilhados.
 *
 * `explainExpectations` recebia só a raquete, sem o perfil: era impossível distinguir o eixo que
 * decidiu a recomendação daquele que o leitor nunca mencionou. E os limiares eram ABSOLUTOS (>= 65
 * e <= 40) sobre atributos derivados que regridem ao centro — o erro de unidades que
 * `catalog-scale.ts` já corrigira no resto do motor. Medido no catálogo de produção: em potência
 * (21…57), spin (21…55) e estabilidade (40…62) NENHUMA raquete alcançava 65, então a frase
 * positiva desses três eixos não podia ser exibida a ninguém, nunca. Só a negativa disparava.
 * Resultado: média de 1,0 linha por raquete, das quais 0,8 eram limitação, e 18 das 47 raquetes
 * saíam sem linha nenhuma. A seção prometia "o que esperar em quadra" e entregava defeitos em
 * eixos sorteados.
 *
 * Agora mede por POSIÇÃO de catálogo, com corte em 60/40 — calibrado sobre 4.000 perfis, onde a
 * zona sem destaque cai de 55,8% (70/30) para 27,4%. Todo eixo declarado aparece, com o lado que
 * for; os que ficam no meio saem agrupados em uma linha que os nomeia, em vez de repetirem a mesma
 * frase. Eixos não pedidos entram só quando notáveis, no máximo dois, e nunca repetindo o que a
 * seção de trocas já explicou com o raciocínio junto. Medido depois: 2,96 linhas por relatório,
 * 0,0% de pedido sem cobertura, 0,2% caindo no texto genérico.
 *
 * O trade-off NÃO foi escondido: ele tem seção própria (`buildTradeOffs`), que já media por posição
 * e já partia do que foi pedido. O que saiu daqui foi a duplicata sem raciocínio.
 *
 * ─── A TENSÃO ───────────────────────────────────────────────────────────────────────────────
 *
 * Mesma leitura, outro defeito: base 55 lbs, ajustes de −3, −2,1 e −1,3 na tela, resultado 50.
 * Quem somasse chegava a −6,4 e via −5. Havia quatro fontes de divergência e nenhuma aparecia: o
 * `slice(0, 3)` omitia ajustes sem dizer que existiam, a ancoragem misturava a tensão atual, os
 * clamps diziam "ajustamos" sem dizer de quanto para quanto, e o arredondamento final. Agora a
 * lista traz o somatório dos ajustes omitidos, o subtotal explícito, os dois valores de cada clamp
 * e — só quando muda algo visível — o arredondamento. Trancado por `tests/ethics/tension-arithmetic`.
 *
 * O RANKING não mudou em nenhuma das duas: nenhum score, peso, limiar ou penalidade foi tocado.
 *
 * 2.27.0 — o veredicto sobre a raquete ATUAL parou de afirmar o resultado financeiro de uma troca.
 *
 * Os dois limiares não mudaram (`KEEP_CURRENT_GAP` 4, `REAL_UPGRADE_GAP` 9), e nenhum score, peso
 * ou penalidade foi tocado: as mesmas respostas produzem a mesma raquete e o mesmo `gap`. O que
 * mudou é o SIGNIFICADO do que se lê no veredicto, e por isso a versão sobe.
 *
 * A frase antiga do caso `keep` era `Uma diferença desse tamanho não paga a troca de um quadro`.
 * Ela concluía, de um `fit_score` agregado, uma coisa que o agregado não sabe: `gap` resume oito
 * componentes num número só e perde ONDE está a diferença. Duas raquetes a 2 pontos podem ser
 * quase idênticas ou divergir forte num eixo e compensar no outro — e quem preenche o questionário
 * com uma raquete na mão em geral está incomodado com algo ESPECÍFICO, que é o motivo de ter
 * procurado a análise. Responder "fique com a sua" a essa pessoa ignora a pergunta que ela fez.
 *
 * O texto novo diz o mesmo sobre a MAGNITUDE — diferença pequena, não espere um salto, corda e
 * tensão têm maior retorno e custam uma fração — e para de decidir por quem lê: nessa faixa quem
 * decide é tato, adaptação e preferência de marca, que nenhum modelo mede. Fica a instrução de
 * olhar os eixos, porque é lá que está a informação que o número agregado apagou.
 *
 * Os casos `marginal` e `upgrade` foram reescritos na mesma escada: moderado passa a convidar ao
 * teste, e grande passa a recomendar com firmeza. Nenhum dos quatro usa urgência, escassez ou
 * incentivo a comprar — §58 vale nas duas direções, e empurrar a troca aqui seria o mesmo defeito
 * com o sinal trocado.
 *
 * 2.26.0 — a frase de separação do pódio para de errar a própria conta, e passa a dizer quantas
 * MARCAS há dentro do empate técnico.
 *
 * O veredicto "indiferente" trazia "— quase um quarto do catálogo" com a fração escrita à mão,
 * enquanto ele dispara a partir de 20% e não tem teto. Numa amostra real saiu "5 das 9 raquetes
 * avaliadas ficaram empatadas — quase um quarto do catálogo": 55% descrito como um quarto, com os
 * dois números na mesma frase para qualquer leitor conferir. A fração agora é calculada.
 *
 * A CONTAGEM DE MARCAS é a resposta honesta a um viés medido numa varredura de 20.000 perfis: uma
 * única família, a Wilson Blade, leva 21,9% de todas as recomendações, e a Wilson sai com 1,38× o
 * share que tem no catálogo — sem que a composição do catálogo explique isso, já que na faixa modal
 * (295–310 g, 97–100 pol²) as quatro marcas estão equilibradas em 8/8/7/6. E a vitória é frágil:
 * proibir a família vencedora custa mediana de 1,11 ponto de match, ABAIXO do limiar de empate
 * técnico de 2,0.
 *
 * A saída que NÃO foi tomada, e o motivo está documentado em `selectPodium`: girar a marca do 1º
 * lugar seria recomendar uma raquete que pontuou menos por um motivo que o cliente não pediu, e
 * quebraria a consistência entre `podium[0]` e `full_ranking[0]` de que `buildCurrentStanding`
 * depende. A saída tomada é dizer o que é verdade — quando dez raquetes empatam com a primeira e
 * elas vêm de quatro marcas, quem lê precisa saber que não está preso a nenhuma.
 *
 * O RANKING não muda.
 *
 * 2.25.0 — os dois números do resumo passam a ser a repartição DO GRÁFICO, não da decisão inteira.
 *
 * A 2.24.0 mostrava três (22 / 68 / 10) e explicava o terceiro. Ficou pior, e o motivo é o tipo de
 * erro que só aparece com o texto na tela: um percentual chamado "a distância entre a sua atual e
 * a recomendada" ao lado de um match de 92% convida a ler que a distância entre as duas raquetes
 * é de 10% — que é outra grandeza inteiramente.
 *
 * Agora os dois blocos são renormalizados entre si e fecham 100, e a frase diz "entre os oito
 * eixos do gráfico" em vez de "da decisão". A distinção não é preciosismo: os pesos crus dos oito
 * somam ~90%, e chamar 24% de "fração da decisão" seria trocar um texto confuso por um errado. O
 * critério que não aparece (`transition_fit`) continua explicado onde ele mora, na comparação com
 * a raquete atual.
 *
 * A LINHA LARANJA passa a ser dita pelo que se quer dela, não pelo vão. As duas versões anteriores
 * descreviam a falta — "houve uma troca", "entrega menos do que o seu perfil pedia" — e ensinavam
 * o leitor a caçar o buraco, que é a exceção. Dita pela proximidade, ela se lê pela regra sem
 * esconder nada: a distância continua desenhada para quem olhar.
 *
 * O RANKING e o DESENHO não mudam. E o número exibido é o único que muda de valor: 22% viram 24%
 * no exemplo acima, pela renormalização.
 *
 * 2.24.0 — três correções de LEITURA do gráfico, todas vindas de quem estava lendo. O ranking e o
 * desenho não mudam em nada; muda o que o texto afirma sobre eles.
 *
 * A REPARTIÇÃO PASSA A FECHAR 100. O resumo abaixo do gráfico dizia "o que você pediu vale 22% e o
 * encaixe com você vale 68%", e o leitor perguntou onde estavam os outros 10%. Estavam em
 * `transition_fit` — o quanto a mudança seria brusca em relação à raquete que ele já usa —, que
 * não tem eixo no radar de propósito: os oito eixos respondem "o que a raquete faz" e "o quanto
 * ela serve a você", e a transição não é nem uma coisa nem outra, ela mede a DISTÂNCIA entre dois
 * equipamentos. Agora os três números aparecem e somam 100, com o terceiro nomeado e apontando
 * para a tabela de comparação, onde ele já estava detalhado.
 *
 * "LARGURA DA FATIA" VIRA "ABERTURA DO EIXO". A frase anterior dizia que a largura da fatia era o
 * peso do eixo, e o leitor observou, com razão, que cada indicador é um VÉRTICE — e um vértice tem
 * duas arestas, uma de cada lado, compartilhadas com os vizinhos. Não havia resposta para "qual
 * aresta é a minha". O que de fato é proporcional ao peso é o ÂNGULO que o eixo ocupa em volta do
 * centro, com o vértice no meio dele.
 *
 * "TROCA" SAI DA LEGENDA DO VÃO. O termo aparecia três vezes na mesma página em sentidos um pouco
 * diferentes, e a seção que o explica se chama "As trocas desta escolha" — chamar o vão de troca
 * antes de explicar o que é uma troca é pedir para o leitor aceitar um jargão. O vão passa a ser
 * dito como fato ("entrega menos do que o seu perfil pedia naquele ponto"), com um ponteiro para
 * onde está o motivo.
 *
 * E O TESTE DE COERÊNCIA PASSA A MEDIR ÁREA DE VERDADE. Ele calculava `Σ valor × peso / Σ peso` e
 * chamava aquilo de "área ponderada" — mas média ponderada é linear no valor de cada eixo, e a
 * área de um polígono vai com o produto de raios vizinhos, ou seja, com o quadrado. O teste jurava
 * verificar o que o leitor vê e verificava outra grandeza. Medido nas personas em que o motor põe
 * a recomendada à frente, a área real amplifica a vantagem em vez de reduzi-la (p02 +4,5 pontos de
 * média viram +12,3% de área; p22, +30,5 viram +70,8%), e em nenhuma delas o desenho contradiz o
 * motor. A impressão de quase-empate no gráfico era ilusão de ótica; o teste agora tranca a porta
 * certa.
 *
 * 2.23.0 — a PREMISSA volta, somada à tolerância por posição: o eixo declarado em 1º lugar nunca
 * fica abaixo da raquete média do mercado que analisamos, sempre que existir candidata compatível
 * com o jogador que cumpra isso.
 *
 * ─── POR QUE A TOLERÂNCIA SOZINHA NÃO BASTOU ────────────────────────────────────────────
 *
 * Ela é RELATIVA: pede que a raquete esteja entre as dez melhores DO POOL COMPATÍVEL com o
 * jogador. Se o pool inteiro é fraco no eixo pedido, o topo dele continua abaixo da média do
 * catálogo — e a queixa do usuário era exatamente essa, "potência muito baixa, inclusive abaixo
 * da média".
 *
 * Medido nas 22 personas com potência forçada em 1º lugar:
 *
 *                                    2.22.0 (só tolerância)    2.23.0 (+ premissa)
 *     abaixo da média em potência            4/22                    4/22
 *     exatamente EM CIMA da média            6/22                    1/22
 *
 * O dado que decidiu foi o segundo. Sem a premissa, seis perfis diferentes caíam exatamente na
 * média, todos na MESMA raquete equilibrada — pedir potência e receber o meio de tudo. Os 4 que
 * restam são irredutíveis: baixando o mínimo de sobreviventes até 1, o limite teórico, continuam
 * 4, porque para aqueles jogadores não existe raquete segura acima da média.
 *
 * Nas personas como elas de fato respondem: 1 abaixo da média antes, ZERO depois. Custo medido:
 * 0,1 ponto de match médio (88,7 -> 88,6), match mínimo intacto em 79, nenhuma persona trocando
 * de vencedora.
 *
 * A premissa vale só no eixo declarado em 1º. Potência, controle e spin se opõem dentro da física
 * do quadro: exigir a média nos três empurraria a escolha para o meio de tudo, que é o defeito
 * oposto e igualmente ruim.
 *
 * 2.22.0 — o piso de demanda vira uma TOLERÂNCIA POR POSIÇÃO, proposta pelo usuário: o que ele
 * declarou em 1º lugar entra nas 10 melhores raquetes compatíveis com o perfil naquele aspecto, o
 * 2º nas 15, o 3º nas 20.
 *
 * Substitui as três regras absolutas anteriores — posição 60 do catálogo (2.12.0), média do
 * catálogo (2.14.0) e "não pior que a sua raquete atual" (2.21.0). Todas partilhavam o mesmo
 * defeito: piso absoluto pode ser IMPOSSÍVEL de cumprir. Nas palavras dele: "se a raquete é a
 * primeira colocada em spin e o cliente pede spin em primeiro lugar, não tem como dar outra".
 *
 * Tolerância por posição nunca tem esse problema — as dez melhores sempre existem — e se ajusta
 * sozinha ao catálogo. Medido em 660 perfis com prioridade declarada:
 *
 *     custo de exigir      mediana 4,9 pontos de match, p90 9,7
 *     regra que substitui  mediana 23 pontos, p90 35
 *
 * O PISO DE COMPATIBILIDADE DE NÍVEL sobe de 55 para 65 junto, porque o papel dele mudou: era só
 * uma válvula ("existe alguma candidata segura?"), virou o POOL de onde as dez melhores saem. Com
 * 55 a p14 caía de nível 78 para 57 — raspando o próprio piso. Com 65 o nível mínimo das 22
 * personas volta a 67 e o match mínimo SOBE de 75 para 79. Duas personas trocam de vencedora.
 *
 * A ORDEM declarada passa a viajar no perfil (`declared_priorities`). Inferir o rank pela
 * intensidade seria adivinhar: outras respostas elevam os eixos, e o 2º declarado pode acabar com
 * número maior que o 1º.
 *
 * E o relatório passa a NOMEAR a compensação — "o que ela entrega no lugar é manobrabilidade: 78
 * de 100, contra 52 da raquete mediana". Explicar por que a alternativa custa caro não é a mesma
 * coisa que mostrar o que se ganhou.
 *
 * 2.21.0 — A PROMESSA: a recomendada não entrega menos que a raquete que o jogador JÁ TEM naquilo
 * que ele pediu, sempre que existir alternativa adequada que respeite isso.
 *
 * É a regra mais forte do piso de demanda, e a que faltava. As outras duas comparam a candidata com
 * o CATÁLOGO; esta compara com a referência que o cliente tem na mão — que é a comparação que ele
 * de fato faz ao ler o relatório.
 *
 * Medido em 150 perfis com raquete atual conhecida e pedido de intensidade 15 ou mais:
 *
 *     antes da regra   a recomendada era pior que a atual num eixo pedido em 61 (40,7%)
 *                      perda média de 13,1 pontos de posição
 *                      casos sem NENHUMA alternativa que respeitasse a regra: 0 de 61
 *     depois           13,3%, e os que restam são aqueles em que a válvula recusa porque nenhuma
 *                      candidata que preservaria o atributo serve fisicamente ao jogador
 *
 * Quarenta por cento, com alternativa existindo em todos eles: não era limitação de catálogo, era
 * ausência de regra. E o dano à confiança é desproporcional ao ganho técnico — quem pede mais
 * potência e recebe menos do que já tinha conclui, corretamente, que não foi ouvido.
 *
 * DUAS DECISÕES DE DESENHO. A promessa vale a partir de intensidade 10, mais baixo que o piso de
 * catálogo (20), porque ela não empurra o jogador para região nenhuma do mercado — só proíbe andar
 * para trás. E é aplicada EIXO A EIXO, do mais pedido para o menos: exigir tudo de uma vez é
 * conjuntivo e colapsa, deixando nem o pedido principal protegido. Medido: a versão conjuntiva
 * recusava alternativas que custavam 0,1 ponto de match.
 *
 * Nenhuma das 22 personas troca de vencedora e nenhum mínimo de segurança se move.
 *
 * 2.20.0 — o SETOR de cada eixo do radar passa a ser proporcional ao peso dele na decisão, em vez
 * de todos os oito ocuparem 45 graus.
 *
 * Um radar de ângulos iguais convida a integrar a área, e área de ângulos iguais trata todo vértice
 * como se valesse o mesmo. O motor não trata. O resultado era um desenho que contradizia o próprio
 * ranking — medido nas personas com raquete atual fora do 1º lugar, a vantagem da 1ª colocada em
 * pontos de área:
 *
 *     persona   posição da atual   ângulos iguais   ponderada
 *       p02           8º             79 vs 83        82 vs 86
 *       p05          18º             82 vs 84        82 vs 85
 *       p06          17º             74 vs 84        67 vs 87
 *       p20          20º             81 vs 82        84 vs 90
 *       p22          21º             64 vs 82        60 vs 91
 *
 * Um ponto de diferença para uma raquete em VIGÉSIMO. Relato do usuário: "parece que a minha atual
 * está melhor do que a recomendada; nos aspectos que ela perde, perde por pouco, e nos que ganha,
 * ganha por muito — e ela ficou só em décimo segundo". Estava certo: o desenho somava igual o que a
 * decisão somou pesado. Com o setor proporcional, a separação média sobe de 7,0 para 12,8 pontos.
 *
 * Um piso de 7% de circunferência por eixo protege a legibilidade: sem ele um eixo de peso 0,05
 * viraria um espeto de 18 graus com o rótulo colado no vizinho. O piso custa fidelidade nos eixos
 * mais leves, e é um custo assumido e documentado.
 *
 * ANTES DISTO foi testada a hipótese de que o problema estava na ESCALA dos eixos de bola — que por
 * medirem o produto ("fração da melhor do catálogo") e não o encaixe, inflavam raquetes potentes.
 * Medido: trocar os três de bola para proximidade do alvo DERRUBA a discriminação, de 6,8 para 3,7
 * pontos de vantagem sobre a raquete atual, e de 8,3 para 0,6 sobre a mediana do ranking. A
 * hipótese estava errada e a escala anterior ficou.
 *
 * O RANKING não muda.
 *
 * 2.19.0 — nos cinco eixos de ENCAIXE a linha tracejada deixa de ser 100 fixo e passa a ser o
 * maior encaixe que alguma candidata plausível para o jogador alcança. É o mesmo princípio que já
 * valia nos três de bola — o gráfico não cobra da raquete uma distância que nenhuma escolha fecha.
 *
 * Medido nas 22 personas, o teto alcançável: Seu braço 94 de média com mínimo 62 e abaixo de 95 em
 * 6 das 22; Seu nível 96/80/7; Seu jogo 97/87/6; Seu swing 99/84/1; Seu físico sempre 100. Na
 * maioria dos casos a linha praticamente não se move, e é por isso que a mudança é segura: ela age
 * só onde a perfeição não estava no cardápio.
 *
 * O VALOR DA RAQUETE não é tocado — segue sendo a adequação crua de 0 a 100. Mexer nele seria
 * inflar a percepção de qualidade; mexer no alvo é parar de cobrar o impossível. Com isso os dois
 * blocos passam a ter o mesmo significado de linha tracejada, ainda que em escalas diferentes.
 * O RANKING não muda.
 *
 * 2.18.0 — os três eixos de bola deixam de ser desenhados em POSIÇÃO (rank dentro da faixa do
 * catálogo) e passam a ser QUANTO A RAQUETE ENTREGA em relação à que mais entrega: 100 é a melhor
 * das 47 naquele aspecto, 50 é metade do que ela entrega.
 *
 * Posição é rank, e as faixas são estreitas — spin vai de 21,1 a 55,1 no catálogo inteiro. Uma
 * raquete 1,3 ponto acima do piso desenhava em 4, e os três vértices ficavam colados no centro sem
 * que isso dissesse nada sobre o produto. A compressão linear da 2.17.0 (a faixa ocupando 15 a 90)
 * tirava o zero e não resolvia o resto: continuava sendo rank disfarçado.
 *
 * O piso do desenho passa a ser o que a MENOR do catálogo realmente entrega — 38 em potência e
 * spin, 54 em controle. A ordem entre as raquetes é idêntica: as duas escalas são lineares no
 * valor cru, então nada muda de lugar. O RANKING não muda.
 *
 * 2.17.0 — duas mudanças, uma no motor e uma na régua do gráfico.
 *
 * MOTOR: o teto do peso de `declared_priorities` sobe de 0,30 para 0,40. Veio de uma proposta do
 * usuário — cada eixo do radar com peso 1, o de prioridade 1 com 3, o de prioridade 2 com 2, o de
 * prioridade 3 com 1,5 — que, feita a aritmética, equivale a pôr o pedido em 50% a 57% da decisão.
 * Medido em 660 perfis, a direção estava certa e a magnitude não: em 0,50 aparecem as primeiras
 * vencedoras abaixo dos mínimos de segurança, e em 0,565 são onze perfis abaixo do piso de nível.
 * Em 0,40 o ganho já veio inteiro sem nenhuma violação, e os casos em que a recomendada entrega
 * MENOS que a raquete atual no eixo pedido caem de 5 para 2 em 120. Duas das 22 personas trocam de
 * vencedora e o match mínimo vai de 76 para 75.
 *
 * GRÁFICO: os eixos de bola passam a ser desenhados numa faixa de 15 a 90 em vez de 0 a 100. As
 * faixas do catálogo são estreitas — spin vai de 21,1 a 55,1 entre as 47 avaliadas —, então uma
 * raquete 1,3 ponto acima do piso era desenhada em 4, e o gráfico afirmava que ela não tem spin.
 * Pergunta do usuário: "e a raquete tem zero de spin? É isso?". Não tem. Havia também um efeito
 * geométrico: potência, spin e controle são antagônicos, então TODA raquete real tinha ao menos um
 * vértice colapsado no centro — característica da escala, não do produto.
 *
 * 2.16.0 — a série "Média do catálogo" dos cinco eixos de encaixe passa a ser a média sobre TUDO
 * que foi pontuado, e não sobre o ranking que sobrou depois do piso de demanda. O piso remove
 * raquetes de um lado só — as fracas no eixo pedido, que tendem a ser as mais pesadas —, então
 * quem sobrava era mais leve e a média de encaixe físico subia junto. Medido em 2560 eixos: desvio
 * absoluto médio de 12,6 pontos, mediana 10,2, casos de 40 (`physical_fit` desenhado em 87 quando
 * o catálogo entrega 47 para aquele jogador), e 78,8% dos eixos com desvio acima de 5.
 *
 * O efeito na tela era o inverso do que se imagina: a linha de comparação inflava e a recomendada
 * aparecia MENOS distante da média do que realmente está — o gráfico subvendia a própria escolha.
 * O RANKING não muda; muda só o que a linha cinza afirma.
 *
 * 2.15.0 — os três eixos de bola passam a ser POSIÇÃO NO CATÁLOGO nas quatro séries, e a linha
 * tracejada deles passa a ser o PEDIDO normalizado à realidade do jogador — nunca além do que a
 * melhor raquete plausível para ele alcança. Os cinco de encaixe seguem em adequação, com a
 * tracejada na borda.
 *
 * O QUE ISSO CONSERTA. Enquanto a tracejada de bola foi a borda ("100 = alcançou o melhor que
 * existe para você"), a recomendada ficava aquém em TODOS os eixos de bola por construção: o
 * melhor quadro em potência é um, o melhor em spin é outro, e ela é a melhor no CONJUNTO. Como nos
 * cinco de encaixe ela marca 90 a 100 — foi escolhida por encaixar —, o eixo que a pessoa
 * PRIORIZOU aparecia como o pior vértice do gráfico. Relato: "pedi potência e o sistema me mostra
 * que está me dando tudo menos potência". Medido depois da mudança: 0 de 626 perfis com prioridade
 * declarada têm o eixo priorizado como pior vértice.
 *
 * E some o empate falso: num eixo sem pedido as quatro séries recebiam o mesmo NEUTRAL fixo, que
 * não dependia de raquete nenhuma. Em posição de catálogo cada raquete tem a sua — 485 eixos sem
 * pedido medidos, zero coincidências.
 *
 * O RANKING não muda: nenhum score, peso ou filtro foi tocado nesta versão.
 *
 * 2.14.0 — duas mudanças que vieram do mesmo relato.
 *
 * GRÁFICO: o radar volta a ter os OITO eixos num desenho só (os trilhos de mercado foram
 * removidos), e a linha tracejada passa a ter UMA leitura — a borda do ideal, nos oito. Nos eixos
 * de bola o alvo do pedido virou o DENOMINADOR: 100 é "chegou no ideal possível para você", e o
 * alvo é o menor entre o que a pessoa pediu e o extremo alcançável entre as raquetes plausíveis
 * para ela. Nenhuma série ultrapassa a tracejada em nenhum dos 2640 eixos medidos; antes eram 460,
 * incluindo um caso que não dependia de dado nenhum — sem pedido no eixo, as raquetes valiam 70
 * contra uma linha em 55.
 *
 * MOTOR: o piso de demanda ganhou um segundo degrau. O corte conjuntivo em todos os eixos pedidos
 * desligava em quem declarava mais prioridades (162 de 266 com dois eixos, 65 de 65 com três);
 * quando ele não se sustenta, entra a PREMISSA — o eixo mais pedido não pode ficar abaixo da média
 * do catálogo nele. A vencedora fica abaixo dessa média em 14 de 686 perfis (2,0%), e nesses casos
 * é porque nenhuma candidata acima da média é segura para o perfil. Custo: match médio 86,4 ->
 * 85,2 e perfis com match >= 80% de 78,0% para 72,8%. Quatro das 22 personas trocam de vencedora.
 *
 * 2.13.0 — o alvo do trilho de mercado passou a ser LIMITADO ao teto do perfil: o menor entre o
 * pedido e a melhor posição alcançável entre as raquetes plausíveis para o jogador. O alvo cru
 * apontava acima desse teto em 70% dos 566 perfis medidos e ficava colado no fim da escala em 49%,
 * fazendo o gráfico cobrar da recomendada um vão que nenhuma escolha podia fechar (23,7 pontos em
 * média; 9,6 com o teto). Os trilhos saíram na 2.14.0; o teto sobreviveu, dentro do radar.
 *
 * 2.12.0 — pedido declarado com força virou PISO: raquetes abaixo da posição 60 do catálogo no
 * atributo pedido saem do ranking, desde que sobre candidata segura e campo para um pódio (ver
 * `applyDeclaredFloor`). É a primeira mudança desta série que altera QUAL raquete é recomendada —
 * as anteriores mexiam só na leitura do gráfico. Nas 22 personas apenas uma troca de vencedora
 * (p18, com `objective_fit` 71 -> 78); nos 770 perfis simulados a posição média no eixo pedido sobe
 * 2,2 pontos e o match >= 80% vai de 79,9% para 77,8%.
 *
 * 2.11.0 — a linha tracejada do radar passou a ter duas leituras: BORDA nos cinco eixos de encaixe
 * (ninguém passa do ideal) e TAMANHO DO PEDIDO nos três de bola (a raquete pode entregar mais do
 * que se pediu, e isso é bom). As duas unificações anteriores falharam por lados opostos.
 *
 * 2.10.0 — um eixo de bola sem pedido deixou de ser desenhado em 70 e passa a aparecer atendido
 * (100), como o motor já o tratava: `objectiveFit` exclui esses eixos da média em vez de pontuá-los.
 * O número do match não muda — ele nunca contou esses eixos. O que muda é o gráfico parar de cobrar.
 *
 * 2.9.0 — a linha do radar passou a ser o IDEAL: a borda da escala de adequação, 100 em todo eixo,
 * que nenhuma raquete ultrapassa. A 2.8.0 a tinha posto como nível de pedido (55 a 94), o que
 * plotava duas grandezas diferentes no mesmo eixo — adequação contra intensidade de pedido.
 *
 * 2.8.0 — a linha "o que seu jogo pede" do radar deixou de ser o teto da oferta e passou a ser o
 * pedido do questionário, com hierarquia entre os eixos (ver `payments/radar.ts`).
 *
 * Da 2.8.0 à 2.11.0 o RANKING não mudou: nenhum score, peso ou penalidade foi tocado, e as mesmas
 * respostas produziam a mesma raquete. Ainda assim a versão subia a cada uma, porque o relatório é
 * o produto e um mesmo número de metodologia não pode carregar dois significados diferentes para a
 * mesma linha do mesmo gráfico — quem abrir um relatório antigo precisa conseguir saber qual das
 * leituras estava valendo. A 2.12.0 é a primeira da série em que a raquete recomendada pode mudar.
 */
export const METHODOLOGY_VERSION = '2.34.0';

export type Range = readonly [lo: number, hi: number];

export const RANGES = {
  /** Da menor cabeça de torneio ao oversize recreativo. */
  head_size_sq_in: [93, 115] as Range,
  /**
   * Do ultraleve recreativo ao tour pesado, sem cordas.
   * O piso é 225 g porque frames de iniciante como a HEAD Ti.S6 chegam lá — cortar a faixa em
   * 255 g apagaria justamente o segmento que o catálogo precisa cobrir.
   */
  unstrung_weight_g: [225, 340] as Range,
  /** Peso com cordas (derivado). */
  strung_weight_g: [241, 356] as Range,
  /** Balanço sem cordas: ~9 pts head-light a fortemente head-heavy (frames leves de iniciante). */
  balance_mm: [290, 385] as Range,
  /** Perfil médio da viga: box beam fino a widebody de iniciante. */
  beam_width_avg_mm: [19, 29] as Range,
  /**
   * Índice de balanço Tennis Engineer — inércia de swing derivada de peso × balanço.
   * NÃO é swingweight e nunca é exibido como tal. Ver `computeSwingIndex()`.
   */
  swing_index: [1.25e7, 2.10e7] as Range,
} as const;

/**
 * Massa adicionada por um jogo de cordas (~16 g) e o deslocamento de balanço que ela provoca.
 *
 * As cordas ficam concentradas na cabeça, então encordoar sobe o balanço em torno de 8 mm num
 * frame de 27". Ambos são derivações declaradas a partir de dados publicados — nunca exibidas
 * como especificação do fabricante.
 */
export const STRING_SET_MASS_G = 16;
export const STRING_SET_BALANCE_SHIFT_MM = 8;

/** Eixo do índice de balanço: 10 cm do topo do cabo, convenção da indústria. */
export const SWING_AXIS_MM = 100;

/** Limites físicos absolutos de tensão por tipo de corda. */
export const TENSION_BOUNDS_LBS = {
  polyester: [40, 58] as Range,
  co_polyester: [40, 58] as Range,
  /**
   * Entre o poliéster e a synthetic gut, como o material.
   *
   * O piso sobe em relação ao poliéster porque a poliamida é mais elástica: encordoada muito baixa
   * ela vira trampolim, problema que um poliéster não tem. O teto fica abaixo do da synthetic gut
   * porque o fio único não perdoa tensão alta como uma trançada perdoa.
   */
  polyamide_monofilament: [43, 60] as Range,
  multifilament: [45, 64] as Range,
  synthetic_gut: [45, 62] as Range,
  natural_gut: [48, 66] as Range,
  hybrid: [42, 62] as Range,
} as const;

/** Usada quando o fabricante não publica a faixa — acompanhada de nota e queda de confiança. */
export const FALLBACK_BASE_TENSION_LBS = 52;

/** Offset da cross em híbridos — convenção configurável. */
export const HYBRID_CROSS_OFFSET_LBS = 2;

/** Diferença de fit abaixo da qual duas raquetes são um empate técnico (§23, §62). */
export const TECHNICAL_TIE_THRESHOLD = 2.0;

/**
 * Fit mínimo para ocupar a SEGUNDA e a TERCEIRA posição do pódio (regra ética do §30).
 *
 * Não se aplica ao primeiro colocado: ver a explicação em `selectPodium`. O §30 proíbe acrescentar
 * opções fracas para viabilizar o upsell, não entregar a melhor opção que existe.
 */
export const MIN_PODIUM_FIT = 75;

/**
 * Fit que o produto se propõe a entregar ao primeiro colocado de QUALQUER perfil.
 *
 * É uma meta de calibração, verificada pela matriz de personas — não uma trava de execução. Se o
 * motor não a atinge para algum perfil, o defeito é do motor ou do catálogo, e o lugar de corrigir
 * é lá. Inflar o número exibido para alcançá-la seria mentir sobre a qualidade da recomendação,
 * que é justamente o que este produto vende.
 */
export const TARGET_TOP_MATCH = 80;

/**
 * Piso do primeiro colocado NAS 22 PERSONAS — não um piso absoluto.
 *
 * Fica abaixo de `TARGET_TOP_MATCH` porque existem perfis cujo pedido é internamente
 * contraditório — mais estabilidade E mais manobrabilidade, que puxam a massa em direções opostas.
 * Para eles a melhor raquete do mercado ainda deixa algo por atender, e o número honesto é menor.
 *
 * ═══ O QUE ESTA CONSTANTE PROMETIA A MAIS DO QUE ENTREGA ═════════════════════════════════════
 *
 * Ela se chamava aqui "piso absoluto do primeiro colocado, verificado em teste". As duas metades
 * eram verdadeiras isoladamente e a frase inteira era falsa: o teste que a verifica
 * (`tests/ethics/always-recommendable.test.ts`) roda sobre as 22 personas, e 22 perfis escolhidos
 * a dedo não estabelecem piso nenhum sobre o universo de quem responde o questionário.
 *
 * Medido numa varredura de 12.000 perfis gerados com respostas correlacionadas (nível puxa
 * calibração, força puxa preparo, altura e peso saem de IMC realista):
 *
 *     match mínimo ......... 43,9
 *     p5 ................... 70,2
 *     mediana .............. 86,8
 *     abaixo de 70 ......... 4,3%
 *
 * Os 4,3% não são perfis contraditórios — a contagem de contradições é idêntica à do resto da
 * população. São perfis para os quais o catálogo não tem quadro: `skill_fit` cai 26,9 pontos
 * contra a média dos demais, `swing_fit` 20,4, e as penalizações sobem de 1,0 para 8,5. E eles se
 * concentram nos EXTREMOS, que é onde 47 raquetes de 285–315 g e 97–100 pol² rareiam:
 *
 *     nível 0–19 ........... 7,3% abaixo de 70      capacidade física 20–39 ... 7,0%
 *     nível 40–59 .......... 3,4%                   capacidade física 60–79 ... 4,2%
 *     nível 80–99 .......... 5,6%                   capacidade física 80–99 ... 5,2%
 *
 * Declarar prioridade também custa, e é o custo já documentado da tolerância e da premissa: sem
 * pedido nenhum são 1,8% abaixo de 70; com um pedido, 5,7%.
 *
 * Nada disso é defeito de motor — é cobertura de catálogo, e o relatório já é honesto sobre ela
 * pela confiança e pelo bloco de trocas. O que era defeito é esta constante afirmar um piso que
 * ninguém verificou. Ela continua sendo a régua das personas, e agora diz só isso.
 */
export const MIN_TOP_MATCH = 75;

/** Abaixo disto a variante não tem dados suficientes para uma recomendação paga. */
export const MIN_DATA_COMPLETENESS = 0.85;

/**
 * Perfil de viga a partir do qual o quadro é considerado rígido o bastante para representar
 * risco a quem relata desconforto recorrente.
 *
 * ⚠️ LIMITAÇÃO CONHECIDA E DOCUMENTADA: o perfil da viga é um PROXY de rigidez, não uma medição.
 * A correlação é boa na média (viga larga ⇒ mais rígida), mas tem exceções conhecidas — a Wilson
 * Clash tem viga larga e é notoriamente flexível. Por isso a proteção ao braço na v2 é
 * multicamada e o filtro de quadro é o elo mais fraco dela:
 *
 *   1. corda  — poliéster é EXCLUÍDO por regra dura (proteção mais forte, independe deste proxy)
 *   2. tensão — reduzida proporcionalmente à sensibilidade relatada
 *   3. quadro — penalização graduada + exclusão apenas nos casos mais claros (aqui)
 */
export const STIFF_BEAM_THRESHOLD_MM = 25.5;
export const VERY_STIFF_BEAM_THRESHOLD_MM = 26.5;
