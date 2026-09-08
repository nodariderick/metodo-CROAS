# PRODUCT.md
### CROAS OS — Regras de produto
**Versão:** 1.0 · **Data:** 13/08/2026 · **Complementa:** `ARCHITECTURE.md`

> `ARCHITECTURE.md` define **como** construir. Este documento define **o que o sistema faz** e **por quê**. Toda regra aqui tem um código (`RN-XXX`) para ser citada em código, teste e discussão.

---

## 1. O produto

**Problema.** A operação da mentoria roda hoje espalhada entre planilha, três formulários do Google, WhatsApp, agenda e pastas soltas. Ninguém tem visão do todo, o aluno não vê o próprio progresso e delegar exige dar acesso a tudo ou a nada.

**Solução.** Um sistema único onde o dono enxerga o negócio inteiro, o colaborador acessa só o que precisa e o aluno encontra a mentoria dele em um lugar só.

**Resultado esperado.**

| Para quem | O que muda |
|---|---|
| Dono | Vê caixa, alunos, funil e capacidade sem abrir cinco ferramentas |
| Colaborador | Trabalha com autonomia sem acesso ao financeiro |
| Aluno | Vê progresso, contrato, resumos e materiais — e renova por isso |

**Princípio norteador.** O sistema existe para mostrar a verdade da operação, não para embelezá-la. Quando um número for ruim, ele aparece.

---

## 2. Perfis

| Perfil | Quem é | Alcance |
|---|---|---|
| **Master** | O dono | Tudo. Único que vê financeiro e gerencia permissões. |
| **Colaborador** | Comercial, suporte/admin, social media | Só os módulos liberados, no nível liberado |
| **Cliente** | Aluno de mentoria | Somente leitura, somente os próprios dados |

**RN-001** — Existe exatamente um Master. O sistema recusa a criação de um segundo.
**RN-002** — Permissão é concedida módulo a módulo, por pessoa, em dois níveis: **ver** ou **ver e editar**. Não existe cargo pré-definido.
**RN-003** — O acesso do Cliente não passa por permissão de módulo. Ele é definido por posse: vê o que é dele, e só.
**RN-004** — Ninguém entra sem convite. Login com Google não cadastrado é recusado, e nenhuma conta é criada.
**RN-005** — Toda alteração de permissão fica registrada com autor, data e hora.

---

## 3. Glossário

| Termo | Significado |
|---|---|
| **Aluno** | Pessoa em mentoria ativa, pausada ou encerrada |
| **Ciclo** | Um contrato de mentoria, do início ao fim. Renovar abre um ciclo novo |
| **Trilha** | As 7 etapas da jornada do aluno dentro de um ciclo |
| **Anamnese** | Questionário inicial com nota de 1 a 10 em 9 áreas da vida |
| **Sessão** | Encontro 1:1 entre mentor e aluno |
| **Conciliar** | Aprovar e categorizar uma transação para que ela entre no financeiro |
| **Capacidade** | Quantas sessões cabem na agenda do mentor por semana |

---

## 4. Alunos e trilha

### 4.1 Planos

| Plano | Duração | Encontros |
|---|---|---|
| **Padrão** | 6 a 12 meses | 3 encontros online |
| **Premium** | 6 a 12 meses | Encontros mensais |

**RN-010** — O plano define automaticamente a quantidade de sessões, a duração do ciclo e o valor. Trocar de plano no meio do ciclo encerra o ciclo atual e abre um novo.
**RN-011** — Renovação nunca sobrescreve o ciclo anterior. O histórico de todos os ciclos é preservado e visível.

### 4.2 A trilha

```
1. Contratação  →  2. Anamnese  →  3. Objetivos  →  4. Metas SMART
                          →  5. Sessões  →  6. Reavaliação  →  7. Renovação
```

**RN-012** — A trilha é sequencial. Uma etapa só abre quando a anterior é concluída.
**RN-013** — A **Contratação** conclui automaticamente quando um lead é marcado como Fechado no Comercial. É o único ponto de entrada de aluno no sistema.
**RN-014** — **Anamnese, Objetivos e Metas SMART** concluem quando o formulário correspondente é respondido.
**RN-015** — **Sessões** conclui quando todas as sessões do plano têm status `Realizada` ou `Falta`.
**RN-016** — **Reavaliação** é uma segunda aplicação da anamnese. Obrigatória no plano Premium, opcional no Padrão.
**RN-017** — O cálculo de qual etapa está aberta acontece no backend. O front apenas exibe o estado recebido.

### 4.3 Status do aluno

| Status | Quando |
|---|---|
| `Ativo` | Ciclo vigente e dentro do prazo |
| `Pausado` | Suspensão acordada — o relógio do ciclo para |
| `Encerrado` | Ciclo concluído sem renovação |
| `Cancelado` | Interrompido antes do fim |

**RN-018** — Aluno pausado não conta na capacidade nem aparece na lista de ativos, mas mantém acesso à pasta dele.
**RN-019** — Aluno encerrado ou cancelado perde acesso à área do aluno após 30 dias, e a pasta fica arquivada e acessível ao Master.

### 4.4 Sinalizações automáticas

**RN-020 · Trilha travada** — aluno com etapa pendente há mais de **7 dias** é marcado como travado e aparece em "Precisa de você".
**RN-021 · Janela de renovação** — abre quando faltam **30 dias** ou **2 sessões** para o fim do ciclo, o que vier primeiro.
**RN-022 · Risco de abandono** — aluno com 2 faltas consecutivas ou 21 dias sem sessão realizada é sinalizado.

### 4.5 Anamnese e evolução

As 9 áreas avaliadas de 1 a 10: **Rotina · Espiritualidade · Autoconfiança · Gestão emocional · Carreira · Sono · Físico · Alimentação · Finanças**.

**RN-023** — Cada aplicação da anamnese gera um registro novo. Resposta nunca é sobrescrita — é a sequência delas que produz o gráfico de evolução.
**RN-024** — A evolução é a diferença entre a última aplicação e a primeira, por área e na média.
**RN-025** — O aluno vê as próprias notas e a evolução. Não vê comparação com outros alunos, nem média geral, nem ranking. **Isso é deliberado:** anamnese não é boletim, e comparar pessoas em áreas como sono, finanças e autoconfiança produz vergonha, não progresso.

### 4.6 Sessões

| Status | Significado |
|---|---|
| `Agendada` · `Realizada` · `Falta` · `Cancelada` |

**RN-026** — Sessão tem dois campos de texto: **anotações** (privadas do mentor, nunca visíveis ao aluno) e **resumo** (escrito para o aluno). Confundir os dois é o erro mais caro possível neste sistema.
**RN-027** — Cancelamento com mais de 24h de antecedência não consome sessão do plano. Falta sem aviso consome.
**RN-028** — O resumo só aparece na pasta do aluno quando é marcado como publicado.

---

## 5. Financeiro

Visível **apenas ao Master** e a quem ele liberar explicitamente.

### 5.1 Conciliação

**RN-030** — Toda transação nasce com status **Pendente**. Nenhuma entra em relatório antes de ser aprovada.
**RN-031** — Apenas transações **Conciliadas** compõem DRE, fluxo de caixa, margem, metas e dashboard. Sem exceção.
**RN-032** — O sistema sugere a categoria; a decisão é sempre humana.
**RN-033** — Transação pode ser marcada como **Ignorada** (transferência entre contas próprias, estorno). Ignorada não entra em relatório nem volta para a fila.
**RN-034** — Reimportação não duplica lançamento: o identificador externo do banco é único.
**RN-035** — Editar uma transação já conciliada exige nova aprovação e gera registro de auditoria.

> **Por que a validação é manual.** Categorização automática erra, e erro em categoria vira decisão errada sobre o negócio. Um clique por transação é barato; um DRE mentiroso não é.

### 5.2 Cálculos

Definidos aqui para que não haja duas versões do mesmo número.

```
Receita bruta (mês)  = Σ transações conciliadas, tipo receita, no mês
Custos (mês)         = Σ transações conciliadas, tipo custo, no mês
Resultado (mês)      = Receita bruta − Custos
Margem líquida (%)   = Resultado ÷ Receita bruta × 100

Realizado do ano     = Σ receita bruta dos meses fechados + mês corrente
Projeção do ano      = (Realizado ÷ meses decorridos) × 12
Gap da meta (%)      = (Projeção − Meta) ÷ Meta × 100
Necessário por mês   = (Meta − Realizado) ÷ meses restantes
Esforço adicional(%) = (Necessário por mês ÷ média mensal − 1) × 100

Saldo previsto (90d) = Saldo atual + recebíveis em aberto − contas a pagar
```

**RN-036** — Mês sem receita não calcula margem. Exibe `—`, nunca `0%` e nunca divisão por zero.
**RN-037** — Comparativo anual sempre confronta o mesmo período: janeiro–agosto de 2026 contra janeiro–agosto de 2025, nunca contra o ano cheio.
**RN-038** — Valor monetário é sempre decimal com 2 casas. Arredondamento só na exibição.

### 5.3 Recebíveis

**RN-039** — Recebível vira `Em atraso` no dia seguinte ao vencimento, automaticamente.
**RN-040** — Baixa manual ou vínculo com uma transação conciliada marca como `Pago`.
**RN-041** — Aluno com recebível em atraso há mais de 15 dias é sinalizado ao Master. **O acesso dele à plataforma não é bloqueado automaticamente** — cobrança é conversa, não corte de acesso.

### 5.4 Metas

**RN-042** — A meta anual é definida pelo Master e distribuída igualmente pelos 12 meses, com ajuste manual mês a mês.
**RN-043** — O sistema mostra realizado, projeção e o esforço necessário para fechar a meta. Não altera a meta sozinho.

---

## 6. Comercial

### 6.1 Funil

```
Lead → Call agendada → Call realizada → Proposta → Fechado
                                                 ↘ Perdido
```

**RN-050** — O lead avança um estágio por vez. Pular etapa é permitido, mas fica registrado.
**RN-051** — Todo movimento de estágio gera um evento com autor, data e origem. É daí que sai a taxa de conversão.
**RN-052** — `Perdido` exige motivo. Sem motivo, o dado não serve para nada.
**RN-053** — `Fechado` **cria o aluno automaticamente**, conclui a etapa de Contratação e dispara o envio da anamnese.
**RN-054** — Lead perdido pode ser reaberto; o histórico anterior é preservado.

### 6.2 Origem

Origens: **Instagram/orgânico · Indicação · Parcerias e palestras · Outro**.

**RN-055** — Origem é obrigatória na criação do lead.
**RN-056** — A conversão é calculada **por origem**, não só no agregado.

```
Conversão por origem = leads Fechados da origem ÷ total de leads da origem × 100
```

> **Por que separar por origem.** Com três canais orgânicos e tempo limitado, saber qual deles fecha define onde investir a semana. A conversão agregada esconde exatamente essa resposta.

### 6.3 Follow-up

**RN-057** — Todo lead ativo tem data de próximo contato. Sem data, ele aparece como "sem follow-up definido".
**RN-058** — Lead com follow-up vencido entra na lista do dia, ordenado por atraso.
**RN-059** — Lead sem contato há 30 dias é sinalizado como esfriado.

---

## 7. Capacidade — o indicador central

**RN-060** — O sistema calcula e exibe permanentemente a capacidade de atendimento:

```
Capacidade (%) = sessões agendadas na semana ÷ capacidade máxima × 100
Vagas livres   = capacidade máxima − sessões agendadas
```

**RN-061** — A capacidade máxima semanal é configurada pelo Master.
**RN-062** — Quando a capacidade passa de **85%**, o sistema alerta no dashboard e no módulo Comercial.

> **Por que este número tem destaque.** Toda a mentoria é entregue por uma pessoa. O teto de faturamento não é o tamanho do funil — é o número de horas na agenda. Vender além da capacidade não gera receita, gera atraso de entrega e cancelamento. Este indicador existe para que a decisão de acelerar as vendas seja consciente.

---

## 8. Equipe

**RN-070** — Colaborador tem meta mensal e tarefas com responsável e prazo.
**RN-071** — Desempenho é medido por tarefas concluídas no prazo e meta atingida. Nada além disso — o sistema não infere produtividade por tempo de tela, atividade ou qualquer proxy comportamental.
**RN-072** — Colaborador vê as próprias tarefas e metas. Vê as dos outros apenas se tiver permissão no módulo Equipe.
**RN-073** — Tarefa pode ser vinculada a um aluno ou lead, e aparece no contexto dele.

---

## 9. Agenda

**RN-080** — A agenda espelha o Google Agenda dentro do sistema. O Google continua sendo a fonte da verdade.
**RN-081** — Sessão criada no sistema gera evento no Google; evento alterado no Google atualiza a sessão.
**RN-082** — Lembretes automáticos configuráveis: 24h antes e 1h antes, para aluno e mentor.
**RN-083** — Conflito de horário é bloqueado no agendamento, com aviso do evento conflitante.
**RN-084** — O aluno vê apenas as próprias sessões. Nunca a agenda completa do mentor.

---

## 10. Pasta do aluno

O módulo de maior percepção de valor para quem paga.

**RN-090** — Conteúdo da pasta: contrato, resumos das sessões, mapas mentais, formulários respondidos e materiais enviados pelo mentor.
**RN-091** — Todo arquivo nasce **oculto**. A publicação para o aluno é sempre uma decisão consciente.
**RN-092** — O aluno baixa; não envia, não edita, não apaga.
**RN-093** — Nenhum arquivo tem link público. Cada download passa por verificação de posse.
**RN-094** — Todo download é registrado — serve como comprovação de entrega.

---

## 11. Notificações

| Evento | Para quem | Canal |
|---|---|---|
| Trilha travada há 7 dias | Master | Sistema |
| Transações aguardando conciliação | Master | Sistema, diário |
| Janela de renovação aberta | Master | Sistema |
| Recebível em atraso | Master | Sistema |
| Capacidade acima de 85% | Master | Sistema |
| Follow-up vencendo hoje | Responsável pelo lead | Sistema |
| Tarefa vencendo | Responsável | Sistema |
| Sessão em 24h e em 1h | Aluno e mentor | E-mail e WhatsApp |
| Novo material na pasta | Aluno | E-mail |

**RN-100** — Notificação nunca carrega dado sensível no corpo. Ela avisa e leva ao sistema, onde a permissão é verificada.
**RN-101** — O aluno não recebe notificação sobre inadimplência dele por canal automático.

---

## 12. O que o sistema não faz

Escopo negativo, para evitar expansão silenciosa.

- **Não substitui o Google Agenda.** Espelha.
- **Não é plataforma de aulas.** A CROAS Academy segue separada.
- **Não emite nota fiscal nem faz contabilidade.** Organiza dados para o contador.
- **Não processa pagamento.** Registra e concilia o que já aconteceu.
- **Não faz disparo de marketing em massa.**
- **Não pontua, classifica nem faz score de aluno.** Mede evolução individual contra o próprio ponto de partida.
- **Não bloqueia acesso do aluno por inadimplência.**
- **Não monitora colaborador.** Acompanha entrega combinada, não comportamento.

---

## 13. Critérios de aceite

| Módulo | Pronto quando |
|---|---|
| **Acessos** | Master libera módulo a módulo; colaborador só vê o liberado; alteração vai para auditoria |
| **Alunos** | Trilha avança sozinha conforme as regras; dossiê mostra evolução da anamnese; travamento sinaliza em 7 dias |
| **Pasta** | Aluno vê só o publicado; download registrado; nenhum link público existe |
| **Financeiro** | Nada entra em relatório sem conciliação; DRE e margem batem com a planilha atual; reimportação não duplica |
| **Comercial** | Fechar lead cria aluno e dispara anamnese; conversão sai por origem |
| **Equipe** | Tarefas com responsável e prazo; meta acompanhada |
| **Agenda** | Sincronização nos dois sentidos; lembretes disparam; conflito bloqueado |
| **Capacidade** | Cálculo correto e alerta acima de 85% |

---

## 14. Como saber se o produto deu certo

Medir em 90 dias de uso:

| Indicador | Alvo |
|---|---|
| Planilhas paralelas ainda em uso | Zero |
| Transações conciliadas em até 7 dias | Acima de 90% |
| Alunos que acessam a pasta ao menos 1x por mês | Acima de 60% |
| Alunos com trilha travada há mais de 7 dias | Abaixo de 10% |
| Taxa de renovação | Acima da linha de base atual |
| Leads sem follow-up definido | Zero |

**RN-110** — Se depois de 90 dias o Master ainda mantém a planilha financeira em paralelo, o módulo Financeiro falhou, independentemente de estar tecnicamente funcionando.

---

*Documento vivo. Regra nova entra aqui antes de virar código.*
