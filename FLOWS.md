# FLOWS.md
### CROAS OS — Telas e fluxos
**Versão:** 1.0 · **Data:** 13/08/2026 · **Complementa:** `PRODUCT.md` e `ARCHITECTURE.md`

> `PRODUCT.md` define as regras. Este documento define **o que aparece na tela, o que acontece a cada clique e o que o usuário vê quando algo dá errado**. Regras citadas como `RN-XXX` estão em `PRODUCT.md`.
>
> Referência visual de todas as telas: `croas-os.html`.

---

## 1. Mapa de navegação

```
LOGIN (Google)
   │
   ├── MASTER ─────────────────────────────────────────────
   │     🎯 Visão 360        T-01
   │     💰 Financeiro       T-02  ├ A conciliar  T-02a
   │                               ├ DRE          T-02b
   │                               ├ Fluxo caixa  T-02c
   │                               └ Metas        T-02d
   │     🎓 Alunos           T-03  └ Dossiê       T-03a
   │     🤝 Comercial        T-04  └ Ficha lead   T-04a
   │     👥 Equipe           T-05
   │     📅 Agenda           T-06
   │     🔐 Acessos          T-07
   │
   ├── COLABORADOR ────────────────────────────────────────
   │     Só os módulos liberados. Os demais aparecem
   │     com 🔒 e não são clicáveis.
   │
   └── CLIENTE ────────────────────────────────────────────
         🎓 Minha trilha     T-08
         📁 Minha pasta      T-09
         📅 Minhas sessões   T-10
```

**Regra de rota.** O menu esconde o que não é permitido, mas isso é cosmético. Acesso direto por URL a uma rota sem permissão devolve a tela **Sem acesso** (`E-03`), nunca o conteúdo.

---

## 2. Convenções de tela

Toda tela que carrega dados tem quatro estados. Nenhum pode ser esquecido.

| Estado | Comportamento |
|---|---|
| **Carregando** | Esqueleto com a forma do conteúdo real. Nunca spinner centralizado em tela cheia. |
| **Com dados** | O conteúdo normal. |
| **Vazio** | Explica o que apareceria ali e oferece a ação que preenche. Nunca "Nenhum registro encontrado" sozinho. |
| **Erro** | Diz o que falhou e oferece "Tentar de novo". Nunca código técnico. |

**Copy dos botões.** O botão diz o que acontece. "Aprovar", não "Confirmar". "Publicar resumo", não "Salvar". E o nome se mantém do botão até a confirmação: quem clica em "Publicar" lê "Resumo publicado".

**Confirmação.** Só para ação destrutiva ou irreversível: apagar, cancelar sessão, revogar acesso, encerrar ciclo. Aprovar transação e mover lead não pedem confirmação — pedem desfazer.

**Desfazer.** Toda ação reversível mostra por 8 segundos um aviso com "Desfazer".

---

## 3. Fluxos de entrada

### F-01 · Login

```
Tela de login  →  [Entrar com Google]  →  consentimento Google
   │
   ├─ e-mail cadastrado e ativo  →  redireciona conforme o perfil
   │      MASTER      → T-01 Visão 360
   │      COLLABORATOR → primeiro módulo liberado
   │      CLIENT      → T-08 Minha trilha
   │
   ├─ e-mail não cadastrado  →  E-01 "Acesso não liberado"    (RN-004)
   └─ usuário desativado     →  E-02 "Acesso desativado"
```

**Tela de login.** Fundo escuro, logo em raio dourado ao centro, uma frase (`Sua mentoria, organizada.`) e um único botão. Nada mais. Sem formulário de cadastro — não existe autoatendimento neste sistema.

**E-01 · Acesso não liberado.** "Esse e-mail ainda não tem acesso ao CROAS OS. Fale com quem te convidou." Sem revelar se o e-mail existe na base.

### F-02 · Convite de colaborador

```
Master em T-07 Acessos  →  [+ Convidar colaborador]
   │
   ├─ informa nome, e-mail Google e função
   ├─ marca as permissões módulo a módulo   (RN-002)
   ├─ [Enviar convite]  →  e-mail com link
   │
   └─ colaborador entra com Google  →  vê só o que foi liberado
```

O convite não define permissão sozinho: o Master marca a matriz antes de enviar. Convidado sem nenhum módulo marcado entra e vê a tela vazia `V-01` — "Nenhum módulo liberado ainda".

### F-03 · Primeiro acesso do aluno

```
Lead marcado como Fechado no Comercial    (RN-053)
   │
   ├─ sistema cria o aluno e o usuário CLIENT
   ├─ envia e-mail: "Sua mentoria começou"
   │
   └─ aluno entra com Google  →  T-08 com a trilha na etapa 2
         └─ card em destaque: "Comece pela anamnese"  →  formulário
```

Na primeira visita, a Pasta (T-09) já tem o contrato. Ver algo dentro logo no primeiro acesso é o que faz o aluno voltar.

---

## 4. Telas do Master

### T-01 · Visão 360

**Objetivo.** Em uma tela, sem clicar, responder: o negócio está bem e o que precisa de mim hoje.

**Composição, de cima para baixo:**

| Bloco | Conteúdo | Ação |
|---|---|---|
| Saudação | Nome, data, resumo do dia ("3 sessões hoje · 2 follow-ups vencendo") | — |
| **Capacidade** | Raio preenchido com % de ocupação, sessões/semana, alunos ativos, vagas livres (RN-060) | Clique leva a T-06 |
| Indicadores | Caixa hoje · Faturado no mês · Margem · Leads no funil | Cada card leva ao módulo |
| Receita mensal | Barras 2026 vs. 2025, mesmo período (RN-037) | — |
| Meta do ano | Anel de progresso, realizado, projeção, gap | Leva a T-02d |
| **Precisa de você** | Lista de alertas ativos | Cada item leva ao registro |
| Próximos 7 dias | Sessões e calls | Leva a T-06 |

**Alertas em "Precisa de você"** — ordenados por urgência, no máximo 5:
1. Aluno com trilha travada (RN-020)
2. Transações aguardando conciliação (RN-030)
3. Recebível em atraso (RN-039)
4. Janela de renovação aberta (RN-021)
5. Capacidade acima de 85% (RN-062)

**Estado vazio.** Operação nova, sem dados: os cards mostram "—" e um bloco central com "Comece cadastrando seu primeiro aluno" e o atalho. Nunca gráficos zerados.

---

### T-02 · Financeiro

Quatro abas. Abre sempre em **A conciliar** — é a que exige ação.

#### T-02a · A conciliar

**Objetivo.** Limpar a fila de transações pendentes rápido.

Cada linha: data · descrição do banco · categoria sugerida · valor (verde entrada, vermelho saída) · `[✓ Aprovar]` `[✎ Editar]`.

```
F-04 · Conciliar uma transação

[✓ Aprovar]  →  status vira Conciliada          (RN-031)
             →  linha esmaece e sai da fila
             →  contador do topo diminui
             →  aviso "Conciliado · Desfazer" por 8s

[✎ Editar]   →  painel lateral abre
             →  ajusta categoria, vincula a aluno, marca como Ignorada (RN-033)
             →  [Salvar e aprovar]
```

`[Aprovar todas]` pede confirmação e mostra quantas e qual valor total serão aprovadas com a categoria sugerida.

**Estado vazio — o bom.** "Nada pendente. Sua conciliação está em dia." com um raio dourado. Esse estado é uma recompensa, não um vazio.

#### T-02b · DRE

Tabela: linhas = Receita bruta, Custos, Resultado, Margem. Colunas = meses + total.
Abaixo, gráfico de margem mês a mês com a leitura em texto ("A margem caiu de X% para Y% — os custos cresceram mais rápido que a receita").

Seletor de período: ano corrente · ano anterior · comparativo. Mês sem receita exibe `—` na margem (RN-036).

#### T-02c · Fluxo de caixa

Quatro indicadores no topo (saldo hoje, a receber 30d, a pagar 30d, previsto 90d) e um gráfico com linha contínua para realizado e tracejada para previsão. Abaixo, a tabela de recebíveis com status.

**F-05 · Baixar recebível:** `[Marcar como pago]` → vincula a uma transação conciliada ou registra baixa manual → status `Pago` (RN-040).

#### T-02d · Metas

Anel de progresso do ano, realizado vs. meta, e o cálculo do esforço restante em texto claro: quanto falta, por quantos meses, quanto por mês e quantos % acima da média atual. Gráfico de meta vs. realizado por mês, com barras verdes quando bate.

`[✎ Ajustar meta]` abre a distribuição mensal editável (RN-042).

---

### T-03 · Alunos

**Lista.** Quatro indicadores (ativos · trilha atrasada · renovação em 30d · evolução média) e a tabela.

Colunas: aluno + data de início · plano (Premium em dourado) · etapa atual · barra de progresso · próxima sessão · sinalização · `[Abrir]`.

Filtros: status, plano, mentor, "só travados", "só em renovação".

#### T-03a · Dossiê do aluno

Duas colunas.

**Esquerda:**
- **Evolução da anamnese** — radar com duas camadas: entrada e hoje (RN-024). Sem anamnese respondida, o card explica que a trilha está parada e oferece `[📨 Reenviar formulário]`.
- **Metas SMART** — lista com status, `[+ Nova meta]`.

**Direita:**
- **Trilha ponta a ponta** — as 7 etapas com estado visual: concluída (✓ dourado), atual (contorno pulsante), bloqueada (número apagado). Etapa travada há mais de 7 dias fica em vermelho (RN-020).
- **Pasta do aluno** — arquivos com indicador de visível/oculto e `[⬆️ Enviar arquivo]`.

**Topo:** nome, plano, início, próxima sessão, e as ações `[Registrar sessão]` `[Pausar]` `[Renovar ciclo]`.

```
F-06 · Registrar uma sessão realizada

[Registrar sessão]  →  painel abre
   ├─ status: Realizada · Falta · Cancelada        (RN-027)
   ├─ ANOTAÇÕES (privadas)  — fundo escuro, cadeado, aviso "só você vê"
   ├─ RESUMO (para o aluno) — fundo claro, aviso "o aluno vai ler isto"
   └─ [Salvar]  ou  [Salvar e publicar resumo]     (RN-028)
```

> Os dois campos são visualmente **opostos** de propósito. Confundi-los é o erro mais caro possível neste sistema (RN-026). Cor, ícone e rótulo trabalham juntos para tornar a troca improvável.

```
F-07 · Renovar ciclo

Janela abre 30 dias ou 2 sessões antes do fim     (RN-021)
   │
[Renovar ciclo]  →  escolhe plano e valor
                 →  novo ciclo criado, anterior preservado   (RN-011)
                 →  trilha reinicia na etapa 2 (Reavaliação)
```

---

### T-04 · Comercial

**Topo:** leads no mês · calls realizadas · fechamentos vs. meta · conversão geral.

**Kanban** com cinco colunas. Cada card: nome, origem com ícone, plano de interesse. Arrastar move o estágio.

```
F-08 · Mover um lead

arrastar card  →  estágio atualizado, evento gravado    (RN-051)
   │
   ├─ para "Perdido"  →  pede motivo, obrigatório       (RN-052)
   │
   └─ para "Fechado"  →  painel de conversão
         ├─ confirma plano, valor e data de início
         ├─ [Criar aluno]
         └─ cria aluno + usuário + envia anamnese       (RN-053)
              → aviso: "Aluno criado. Anamnese enviada."
              → atalho: [Abrir dossiê]
```

**Abaixo do kanban:** conversão por origem em barras horizontais (RN-056), com a leitura em texto, e a lista de follow-ups do dia com ações rápidas `[📞 Ligar]` `[💬 WhatsApp]` `[✉️ Enviar proposta]`.

**Estado vazio.** "Nenhum lead no funil. Cadastre o primeiro para começar a medir conversão."

---

### T-05 · Equipe

Um card por pessoa: avatar, nome, função, meta do mês com barra, tarefas abertas e concluídas no prazo (RN-071).

Abaixo, tabela de tarefas abertas: tarefa · responsável · prazo · status. Prazo vencido em vermelho.

`[+ Nova tarefa]` → título, responsável, prazo, prioridade e vínculo opcional com aluno ou lead (RN-073).

Um bloco final, permanente, com a leitura honesta da operação: quem entrega mentoria e onde está o gargalo.

---

### T-06 · Agenda

Grade semanal, horários nas linhas e dias nas colunas. Eventos coloridos por tipo: sessão em dourado, comercial e interno em azul.

Topo: sessões na semana · horários livres · lembretes enviados · faltas no mês.

```
F-09 · Agendar uma sessão

[+ Novo evento]  →  aluno, data, hora, duração
   ├─ conflito de horário?  →  bloqueia e mostra o evento conflitante  (RN-083)
   ├─ cria no Google Agenda                                            (RN-081)
   └─ agenda os lembretes de 24h e 1h                                  (RN-082)
```

Abaixo da grade, a configuração dos lembretes, cada um com liga/desliga.

**Falha de sincronização.** Faixa no topo: "A sincronização com o Google falhou há X minutos. Os horários podem estar desatualizados." com `[Sincronizar agora]`. Nunca mostrar agenda desatualizada em silêncio.

---

### T-07 · Acessos

Matriz: pessoas nas linhas, módulos nas colunas. Cada célula tem dois botões, `👁` (ver) e `✎` (ver e editar). Nenhum marcado = sem acesso.

Linha do Master: "Total" em todas as colunas, sem controles (RN-001).
Linha dos Alunos: fixa e não editável, explicando que o acesso deles é por posse (RN-003).

```
F-10 · Alterar permissão

clique em 👁 ou ✎  →  muda na hora
                    →  registra autor, data e hora     (RN-005)
                    →  aviso "Permissão atualizada · Desfazer"
                    →  se a pessoa estiver logada, a tela dela
                       se atualiza pelo WebSocket
```

`[+ Convidar colaborador]` inicia F-02.

---

## 5. Telas do Cliente

O aluno tem três telas. Nada mais. Toda a complexidade da operação é invisível para ele.

### T-08 · Minha trilha

| Bloco | Conteúdo |
|---|---|
| Saudação | "Olá, [nome]" · plano · % concluído · próxima sessão |
| **Progresso** | O mesmo raio da Visão 360, agora com o avanço dele na trilha |
| Método CROAS | Cards dos módulos: concluído ✅ · em andamento ⚡ · bloqueado 🔒 |
| Como você evoluiu | Radar da anamnese: entrada vs. hoje (RN-025) |
| Seu plano de ação | Metas SMART com status |
| Anotações da última sessão | Apenas o campo **resumo**, e só se publicado (RN-028) |

**Primeiro acesso.** Sem anamnese respondida, tudo abaixo do progresso é substituído por um card único: "Comece pela anamnese — são 10 minutos e é o que permite personalizar sua mentoria." com o botão do formulário.

**Nunca aparece aqui:** anotações privadas, valores, situação de pagamento, comparação com outros alunos.

### T-09 · Minha pasta

Grade de arquivos com ícone por tipo: 📜 contrato · 🎙️ resumo de sessão · 🧠 mapa mental · 📋 formulário respondido.

Cada card: nome, tipo, data e `⬇️`. Só aparece o que foi publicado (RN-091).

```
F-11 · Baixar arquivo

clique  →  api verifica posse
        →  devolve link assinado de 60 segundos
        →  download inicia
        →  registro de auditoria                    (RN-094)
```

**Estado vazio.** "Seus materiais aparecem aqui depois da primeira sessão."

### T-10 · Minhas sessões

Card em destaque com a próxima sessão, aviso sobre os lembretes e `[🎥 Entrar na sala]` — ativo 15 minutos antes.
Abaixo, histórico: número, data, tema e `[📄 Ver resumo]` quando publicado.

Sessão com status `Falta` aparece marcada, sem julgamento no texto: "Não realizada".

---

## 6. Jornadas completas

### J-01 · Da indicação ao aluno ativo

```
Alguém indica  →  [+ Novo lead] em T-04, origem "Indicação"
   → arrasta para Call agendada, cria evento em T-06
   → call acontece, arrasta para Call realizada
   → [✉️ Enviar proposta], arrasta para Proposta
   → fecha  →  arrasta para Fechado
        → painel de conversão: plano, valor, início
        → aluno criado, anamnese enviada, contrato na pasta
        → aluno entra, responde anamnese
        → trilha avança para Objetivos
        → primeira sessão agendada
        → aluno ATIVO, contando na capacidade
```

Da indicação ao ativo, o dado é digitado **uma vez**. Nada é recadastrado.

### J-02 · A semana do Master

```
Segunda   T-01 Visão 360 → lê os alertas → resolve o que trava
          T-02a Conciliar a semana → fila zerada
Terça-Qui T-06 Agenda → sessões → F-06 registra e publica resumos
Sexta     T-04 Comercial → follow-ups → move o funil
          T-02d Metas → confere o mês contra a meta
```

### J-03 · Aluno travado

```
Aluno não responde a anamnese
   → 7 dias  →  sinalizado (RN-020)
   → aparece em "Precisa de você" na T-01
   → Master clica  →  T-03a dossiê
   → [📨 Reenviar formulário]
   → responde  →  trilha destrava sozinha, sinalização some
```

### J-04 · Fim de ciclo

```
Faltam 30 dias ou 2 sessões       (RN-021)
   → alerta na T-01 e etiqueta 🔄 na T-03
   → Master agenda a sessão de renovação
   → renovou?  →  F-07, novo ciclo, trilha reinicia na Reavaliação
   → não renovou?  →  ciclo Encerrado
        → sai da capacidade
        → mantém acesso à pasta por 30 dias    (RN-019)
```

---

## 7. Telas de erro e casos de borda

| Código | Situação | O que aparece |
|---|---|---|
| **E-01** | E-mail sem acesso | "Esse e-mail ainda não tem acesso ao CROAS OS. Fale com quem te convidou." |
| **E-02** | Usuário desativado | "Seu acesso foi desativado." |
| **E-03** | Rota sem permissão | "Você não tem acesso a esta área." + volta ao primeiro módulo liberado |
| **E-04** | Registro de terceiro | Tela de "não encontrado" — nunca confirma que existe |
| **E-05** | Sessão expirada | Aviso discreto + botão de entrar de novo, preservando a página |
| **E-06** | Api fora do ar | "Não conseguimos carregar. Tente de novo." + `[Tentar de novo]` |
| **E-07** | Upload rejeitado | Diz o motivo: tipo não aceito ou tamanho acima de 25 MB |
| **E-08** | Google Agenda dessincronizado | Faixa no topo da T-06 |
| **V-01** | Colaborador sem módulo | "Nenhum módulo liberado ainda. Fale com o Derick." |

**Casos de borda a tratar:**
- Aluno com dois ciclos no histórico → o dossiê mostra o vigente com seletor para os anteriores
- Transação conciliada e depois editada → volta para a fila e exige nova aprovação (RN-035)
- Lead reaberto depois de perdido → histórico anterior preservado (RN-054)
- Aluno pausado → sai da capacidade, mantém a pasta (RN-018)
- Sessão cancelada com mais de 24h → não consome sessão do plano (RN-027)

---

## 8. Comportamento em tempo real

Atualizam sozinhas, sem recarregar (ver seção WebSocket em `ARCHITECTURE.md`):

| Tela | Atualiza quando |
|---|---|
| T-01 | Novo alerta ou transação conciliada |
| T-02a | Importação bancária traz transações novas |
| T-04 | Outra pessoa move um lead |
| T-05 | Tarefa concluída |
| T-07 | Permissão alterada — a tela de quem está logado muda na hora |

A mudança entra com transição suave e um marcador discreto. Nunca um salto de layout com o cursor no meio do caminho.

---

## 9. Mobile

O Master usa no desktop; o aluno, quase sempre no celular. A área do cliente é **desenhada primeiro para o celular**.

| Tela | Adaptação |
|---|---|
| T-08, T-09, T-10 | Coluna única, cards grandes, alvo de toque de 44px |
| T-01 | Indicadores empilhados, capacidade centralizada |
| T-04 Kanban | Rolagem horizontal com uma coluna por vez |
| T-02b DRE | Rolagem horizontal com a primeira coluna fixa |
| Menu lateral | Vira menu inferior no celular |

---

## 10. Acessibilidade

- Foco visível em todo elemento navegável por teclado
- Kanban operável sem arrastar: cada card tem menu de "mover para"
- Emoji sempre acompanhado de texto — nunca é o único portador de significado
- Contraste mínimo de 4,5:1 em texto; o dourado `#D69A21` sobre `#0A0908` cumpre
- Animação respeita `prefers-reduced-motion`
- Status nunca comunicado só por cor: sempre com rótulo ou ícone junto

---

*Documento vivo. Tela nova ou fluxo novo entra aqui antes de virar código.*
