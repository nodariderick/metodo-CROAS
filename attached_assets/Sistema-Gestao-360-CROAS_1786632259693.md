# Sistema de Gestão 360 — Método CROAS
### Documento de especificação de produto (v1)
**Autor:** Derick Nodari · **Data:** 13 de agosto de 2026 · **Status:** Rascunho para validação

---

## 1. Objetivo

Centralizar em um único sistema a operação hoje espalhada entre planilhas, Google Forms, WhatsApp, agenda e pastas soltas. Três resultados esperados:

1. **Visão única do negócio** para o dono (financeiro, alunos, comercial e equipe na mesma tela).
2. **Experiência profissional para o cliente** — o aluno loga e encontra tudo dele em um lugar.
3. **Delegação sem perder controle** — colaboradores acessam só o que precisam.

---

## 2. Perfis de acesso

Login único via **Google OAuth** para todos os perfis.

| Perfil | Quem é | Alcance |
|---|---|---|
| **Master** | Derick | Todos os módulos, todos os dados, gestão de permissões |
| **Colaborador** | Comercial, suporte/admin, social media | Somente módulos liberados individualmente pelo Master |
| **Cliente** | Alunos de mentoria | Somente os próprios dados (visualização) |

### Regra de permissão
O Master libera **módulo a módulo**, por pessoa. Cada módulo tem dois níveis: **Ver** e **Editar**.

| Módulo | Master | Comercial | Suporte/Admin | Social Media | Cliente |
|---|---|---|---|---|---|
| Dashboard 360 | Ver | — | — | — | — |
| Financeiro | Ver + Editar | — | Ver | — | — |
| Trilha do Aluno | Ver + Editar | — | Ver + Editar | — | Só o próprio |
| Pasta do Aluno | Ver + Editar | — | Ver + Editar | — | Só a própria |
| Comercial (CRM) | Ver + Editar | Ver + Editar | Ver | — | — |
| Equipe | Ver + Editar | — | — | — | — |
| Agenda | Ver + Editar | Ver | Ver | — | Só as próprias sessões |

> Esta tabela é o padrão inicial. Toda célula é ajustável pelo Master na tela de permissões.

---

## 3. Módulos

### M0 · Base do sistema *(pré-requisito de tudo)*
- Login com Google OAuth
- Cadastro de usuários e atribuição de perfil
- Tela de permissões (matriz clicável por pessoa × módulo)
- Registro de atividade (quem alterou o quê e quando)

---

### M1 · Dashboard 360 *(tela inicial do Master)*
Visão de uma tela só, sem cliques. Blocos:

| Bloco | Indicador |
|---|---|
| Caixa | Saldo atual, entradas e saídas do mês, previsão 30 dias |
| Receita | Faturado no mês vs. meta anual (% atingido) |
| Alunos | Ativos, em risco de atraso na trilha, encerrando nos próximos 30 dias |
| Comercial | Leads no funil, fechamentos do mês vs. meta |
| **Capacidade** | Sessões agendadas vs. capacidade máxima de atendimento |
| Agenda | Próximos 7 dias |

> **Por que "Capacidade":** você é hoje o único mentor da operação. Vender mais do que consegue entregar é o risco número um do negócio. Este indicador existe para você ver o teto antes de bater nele.

---

### M2 · Financeiro

**Fonte de dados:** integração bancária automática **com validação manual obrigatória**. Nada entra no DRE sem sua aprovação.

**Fluxo de conciliação:**
```
Transação importada do banco
   → Caixa de "A conciliar"
   → Você aprova e categoriza (ou o sistema sugere a categoria)
   → Entra no DRE e nos dashboards
```

**Telas:**

| Tela | Conteúdo |
|---|---|
| A conciliar | Fila de transações pendentes de aprovação |
| Fluxo de caixa | Realizado + previsão (30/60/90 dias) |
| DRE | Receita, custos por categoria, margem — mensal e acumulado |
| Comparativos | Mês vs. mês anterior · mês vs. mesmo mês do ano anterior · ano vs. ano |
| Recebíveis | A receber, vencidos, inadimplência por aluno |
| Metas | Meta de receita anual, quebrada por mês, com % atingido e projeção de fechamento |

**Categorias:** herdadas da sua planilha atual (a ser enviada). A planilha é a fonte do modelo de dados e do histórico inicial.

> **Alerta técnico:** o mcp.ai ainda não opera no Brasil ("coming soon to your country"). Para conexão bancária real será necessário um agregador de Open Finance com operação local — **Pluggy** ou **Belvo** são os padrões de mercado aqui. Decisão para a fase técnica; não bloqueia o desenho. Plano B imediato: importação de OFX/CSV do banco, mesmo fluxo de conciliação.

---

### M3 · Trilha do Aluno

**Planos oferecidos:**

| Plano | Duração | Encontros |
|---|---|---|
| Padrão | 6 a 12 meses | 3 encontros online |
| Premium | 6 a 12 meses | Encontros mensais |

O plano é campo do cadastro e define automaticamente a trilha, o número de sessões e o valor.

**Jornada mapeada (ponta a ponta):**
```
1. Contratação (vem do módulo Comercial)
2. Anamnese inicial          [Google Forms]
3. Formulário de Objetivos   [Google Forms]
4. Metas SMART               [Google Forms]
5. Sessões 1:1 agendadas
6. Tarefas e metas entre sessões
7. Reavaliação periódica
8. Encerramento ou renovação
```

**Dossiê do Aluno (visão do Master):** as respostas dos três formulários consolidadas em uma ficha única, com o histórico das notas 1–10 das nove áreas da anamnese em gráfico de evolução.

**Painel do Master:** lista de alunos com plano, etapa atual, próxima sessão, tarefas em aberto e sinalização de atraso na trilha.

#### M3.1 · Pasta do Aluno *(visão do Cliente)*
O que o aluno vê ao logar:

- Progresso na trilha e nos módulos
- Plano de ação e anotações da última sessão
- Evolução das notas da anamnese (gráfico)
- **Contrato**
- **Resumos das transcrições dos encontros**
- **Mapas mentais em PDF**
- Próximas sessões agendadas

> Este é o módulo de maior percepção de valor para quem paga. Ver o próprio progresso é o que sustenta renovação.

---

### M4 · Comercial (CRM)

**Origem dos leads:** Instagram/conteúdo orgânico · Indicação de alunos · Parcerias e palestras.

**Funil:** `Lead → Call agendada → Call realizada → Proposta → Fechado / Perdido`

**Telas:**

| Tela | Conteúdo |
|---|---|
| Kanban | Cards de lead arrastáveis entre as etapas do funil |
| Follow-ups do dia | Lista de contatos pendentes, ordenada por prioridade |
| Conversão | Taxa por etapa **e por origem do lead** |
| Metas | Vendas fechadas vs. meta do mês |

> **Por que "por origem":** com três canais orgânicos, saber qual deles realmente fecha define onde você investe seu tempo. Hoje isso é invisível.

**Integração:** venda fechada → cria o aluno no M3 e dispara o envio da anamnese automaticamente.

---

### M5 · Equipe

**Composição atual:** Comercial/vendas · Suporte, admin e social media. *(Mentoria: só o Master.)*

| Função | Descrição |
|---|---|
| Tarefas | Atribuição com responsável, prazo e status |
| Metas individuais | Meta por pessoa e acompanhamento do realizado |
| Desempenho | Painel simples: tarefas concluídas no prazo, metas atingidas |
| Permissões | Atalho para a matriz de acesso do M0 |

---

### M6 · Agenda

- **Visualização do Google Agenda dentro do sistema** (sem sair da plataforma)
- **Lembrete automático pré-sessão** para aluno e mentor
- Vínculo evento ↔ aluno, para que a sessão apareça na trilha e na Pasta do Aluno

---

## 4. Modelo de dados — entidades principais

| Entidade | Relação |
|---|---|
| **Usuário** | perfil, permissões |
| **Aluno** | pertence a um Usuário-cliente · tem um Plano |
| **Plano** | Padrão ou Premium · define trilha e nº de sessões |
| **Sessão** | pertence a um Aluno · vinculada a um evento da Agenda |
| **Formulário** | Anamnese / Objetivos / Metas SMART · pertence a um Aluno |
| **Arquivo** | contrato, transcrição, mapa mental · pertence a um Aluno |
| **Tarefa** | do Aluno (entre sessões) ou da Equipe |
| **Lead** | vira Aluno ao fechar |
| **Transação** | receita ou despesa · status: a conciliar / conciliada |
| **Meta** | de receita (anual/mensal) ou de equipe (individual) |

---

## 5. Roadmap de construção

### Recomendação: comece pela Trilha do Aluno

Você deixou esta escolha em aberto, então assumo a recomendação como PO. **Fase 1 = M3 + M3.1.** Três razões:

1. É o **coração do produto** — tudo o mais orbita o aluno.
2. Entrega valor imediato **para quem paga**: o cliente loga e vê contrato, transcrições, mapas mentais e progresso. Isso sustenta renovação e justifica preço.
3. O Financeiro, apesar de urgente, depende de integração bancária que **ainda está bloqueada** (mcp.ai indisponível no Brasil). Começar por ele é começar pelo risco técnico.

| Fase | Prazo | Escopo | Entrega |
|---|---|---|---|
| **0** | 2–3 semanas | M0 — login Google, usuários, permissões | Fundação |
| **1** | 6–8 semanas | M3 + M3.1 + M6 | Aluno loga e vê tudo dele; você gerencia a trilha |
| **2** | 4–6 semanas | M4 Comercial | Funil visual e conversão por origem |
| **3** | 6–8 semanas | M2 Financeiro | Conciliação, DRE, metas de receita |
| **4** | 3–4 semanas | M5 Equipe + M1 Dashboard 360 | Visão consolidada final |

> O Dashboard 360 fica por último de propósito: ele só existe se os módulos que o alimentam já existirem.

---

## 6. Como construir

Você também deixou esta em aberto. Recomendação:

**Caminho principal — construir com IA sobre stack real.** Você já tem conta **Vercel autenticada com o time `croas`**, o que elimina a etapa mais chata da infraestrutura. Stack sugerida: **Next.js + Supabase + Vercel**. Supabase resolve banco de dados, login Google e permissões nativamente. Custo inicial próximo de zero, e o sistema é seu — não fica preso a uma plataforma.

**Caminho alternativo — no-code (Softr + Airtable).** Se a Fase 1 precisar existir em 30 dias em vez de 60. Sobe rápido, mas trava no Financeiro e fica caro conforme cresce.

> Sendo direto: para um sistema com três perfis de acesso, permissão por módulo e integração bancária, o no-code encosta no limite antes da Fase 3. O caminho principal é o certo.

---

## 7. Decisões pendentes

| # | Pendência | Responsável |
|---|---|---|
| 1 | Enviar a planilha financeira detalhada (base do modelo de dados) | Derick |
| 2 | Definir agregador de Open Finance (Pluggy / Belvo) e listar os bancos | Fase técnica |
| 3 | Definir valores dos planos Padrão e Premium no sistema | Derick |
| 4 | Definir origem das transcrições dos encontros (gravação → transcrição → resumo) | Derick |
| 5 | Confirmar se os Google Forms continuam ou migram para dentro do sistema | Fase 1 |
| 6 | Definir meta de receita anual para configurar o M2 | Derick |

---

*Documento vivo — atualizar a cada rodada de validação.*
