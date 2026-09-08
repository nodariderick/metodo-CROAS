# ARCHITECTURE.md
### CROAS OS — Arquitetura técnica do monorepo
**Versão:** 1.0 · **Data:** 13/08/2026 · **Status:** Referência obrigatória para qualquer código escrito neste repositório

> Este documento é normativo. Se um código contradiz o que está aqui, o código está errado.

---

## 1. Regras de ouro

Nove regras que não se negociam. Toda revisão de código verifica estas primeiro.

| # | Regra |
|---|---|
| **R1** | **O front não tem regra de negócio.** `web/` renderiza dados e captura eventos. Cálculo, decisão, validação de domínio e autorização vivem só na `api/`. |
| **R2** | **O front nunca decide permissão.** Esconder um botão é cosmético. Quem autoriza é a api, em toda requisição, sempre. |
| **R3** | **Nenhum `fetch` fora do `api-client`.** Existe um único ponto de saída HTTP no front. |
| **R4** | **Toda entrada é validada com Zod na api** antes de tocar em qualquer service. |
| **R5** | **Nenhum ID de recurso é confiado sem checagem de posse.** Receber `studentId` não significa poder lê-lo. |
| **R6** | **Nenhum arquivo é público.** Todo acesso a bucket passa por URL assinada de curta duração emitida pela api. |
| **R7** | **Nada de segredo no repositório.** Nem em `web/`, nem em comentário, nem em seed. |
| **R8** | **Dinheiro é `Decimal`, nunca `Float`.** E toda transação nasce com status `PENDING`. |
| **R9** | **Toda escrita relevante gera registro em `audit_logs`.** Quem, o quê, quando, de onde. |

### Por que R1 importa

Se o cálculo de margem estiver no front, existem duas verdades no sistema: a do gráfico e a do banco. Elas divergem no primeiro bug e ninguém sabe qual está certa. Além disso, tudo que roda no navegador é visível e adulterável pelo usuário — regra de negócio no front é regra de negócio pública e editável.

**O que o front pode fazer:** formatar (`1234.5` → `R$ 1.234,50`), ordenar uma lista já recebida, controlar estado de UI (aba aberta, modal, loading), validar formato de campo para dar feedback rápido — sabendo que a api vai revalidar.

**O que o front não pode fazer:** somar receitas, calcular margem ou percentual de meta, decidir se uma etapa da trilha está liberada, definir se um aluno está inadimplente, montar o próximo estágio de um lead.

> Regra prática: se o número aparece na tela, ele veio pronto do backend.

---

## 2. Estrutura de pastas

```
croas-os/
├─ web/                                  Next.js 14 · App Router · TypeScript
│  ├─ src/
│  │  ├─ app/
│  │  │  ├─ (auth)/login/
│  │  │  ├─ (master)/                    layout com guarda de rota MASTER
│  │  │  │  ├─ dashboard/
│  │  │  │  ├─ financeiro/
│  │  │  │  ├─ alunos/[id]/
│  │  │  │  ├─ comercial/
│  │  │  │  ├─ equipe/
│  │  │  │  ├─ agenda/
│  │  │  │  └─ acessos/
│  │  │  ├─ (client)/                    área do aluno
│  │  │  │  ├─ trilha/
│  │  │  │  ├─ pasta/
│  │  │  │  └─ sessoes/
│  │  │  └─ api/auth/[...nextauth]/      NextAuth (único endpoint no web)
│  │  ├─ modules/                        espelha os módulos da api
│  │  │  └─ students/
│  │  │     ├─ components/               UI do módulo
│  │  │     ├─ hooks/                    useStudents, useStudent
│  │  │     ├─ api.ts                    chamadas via api-client
│  │  │     └─ types.ts                  reexporta tipos de @croas/contracts
│  │  ├─ components/ui/                  design system (Button, Card, Table…)
│  │  ├─ lib/
│  │  │  ├─ api-client.ts                ÚNICO ponto de saída HTTP
│  │  │  ├─ socket.ts                    cliente WebSocket
│  │  │  ├─ auth.ts                      config NextAuth
│  │  │  └─ format.ts                    moeda, data, percentual
│  │  └─ styles/tokens.css               cores e tipografia
│  └─ package.json
│
├─ api/                                  Fastify · TypeScript · Prisma
│  ├─ src/
│  │  ├─ modules/
│  │  │  └─ students/
│  │  │     ├─ students.routes.ts        rota + permissão + schema
│  │  │     ├─ students.controller.ts    HTTP in/out, zero lógica
│  │  │     ├─ students.service.ts       REGRA DE NEGÓCIO mora aqui
│  │  │     ├─ students.repository.ts    único lugar que fala com Prisma
│  │  │     └─ students.schema.ts        Zod de entrada e saída
│  │  ├─ core/
│  │  │  ├─ auth/                        verificação de JWT, sessão
│  │  │  ├─ permissions/                 requirePermission, requireOwnership
│  │  │  ├─ storage/                     bucket, URLs assinadas
│  │  │  ├─ realtime/                    servidor WebSocket, rooms, emit
│  │  │  ├─ audit/                       gravação de audit_logs
│  │  │  ├─ errors/                      AppError e handler global
│  │  │  ├─ db/                          PrismaClient singleton
│  │  │  └─ config/                      env validado com Zod no boot
│  │  ├─ jobs/                           filas e agendados
│  │  └─ server.ts
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  ├─ migrations/
│  │  └─ seed.ts
│  └─ package.json
│
├─ packages/
│  └─ contracts/                         tipos e schemas Zod COMPARTILHADOS
│     └─ src/{students,finance,commercial,…}.ts
│
├─ .env.example
├─ pnpm-workspace.yaml
└─ ARCHITECTURE.md
```

### Módulos (mesmo nome nos dois lados)

`auth` · `users` · `permissions` · `dashboard` · `finance` · `students` · `commercial` · `team` · `calendar` · `files` · `notifications`

Um módulo novo nunca importa arquivos internos de outro módulo. Se `finance` precisa de aluno, chama `studentsService`, nunca `studentsRepository`.

---

## 3. Integração web ↔ api

```
Componente React
   └─ hook (React Query)
        └─ modules/<mod>/api.ts
             └─ lib/api-client.ts   ← anexa JWT, trata erro, valida resposta
                  └─ HTTPS
                       └─ Fastify route
                            ├─ authenticate           (quem é você)
                            ├─ requirePermission      (pode ver este módulo)
                            ├─ validate (Zod)         (o corpo está correto)
                            └─ controller → service → repository → Postgres
```

**Contrato:** `packages/contracts` é a fonte única de verdade dos tipos. A api valida a saída contra o mesmo schema que o front usa para tipar. Se divergirem, o build quebra — que é exatamente o que deve acontecer.

**Padrão de resposta:**
```jsonc
// sucesso
{ "data": { ... }, "meta": { "page": 1, "total": 42 } }

// erro
{ "error": { "code": "STUDENT_NOT_FOUND", "message": "Aluno não encontrado" } }
```
`code` é estável e legível por máquina. `message` é português, para o usuário. Mensagem de erro nunca vaza stack trace, SQL, caminho de arquivo ou nome de coluna.

---

## 4. Banco de dados

PostgreSQL + Prisma. Toda tabela tem `id` (UUID v7), `created_at`, `updated_at`.
Exclusão é lógica (`deleted_at`) em tudo que envolve pessoa, dinheiro ou arquivo.

### 4.1 Acesso e identidade

**`users`**
| Campo | Tipo | Nota |
|---|---|---|
| id | uuid PK | |
| email | text unique | vem do Google |
| name | text | |
| avatar_url | text? | |
| role | enum | `MASTER` · `COLLABORATOR` · `CLIENT` |
| google_id | text unique | |
| is_active | boolean | desativar ≠ deletar |
| last_login_at | timestamptz? | |
| deleted_at | timestamptz? | |

> Existe **um** `MASTER`. A aplicação recusa a criação de um segundo.

**`permissions`** — controla o acesso módulo a módulo do colaborador
| Campo | Tipo | Nota |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | |
| module | enum | dashboard, finance, students, commercial, team, calendar, permissions |
| level | enum | `NONE` · `READ` · `WRITE` |
| granted_by | uuid FK → users | |

`UNIQUE (user_id, module)`. Ausência de linha = `NONE`. `MASTER` ignora a tabela. `CLIENT` nunca tem linha aqui — seu acesso é definido por posse, não por módulo.

**`audit_logs`** — append-only, sem update, sem delete
| Campo | Tipo |
|---|---|
| id, actor_id, action, entity, entity_id, before (jsonb), after (jsonb), ip, user_agent, created_at |

---

### 4.2 Alunos e trilha

**`students`** — `user_id` FK única (o login do aluno), `name`, `phone`, `status` (`ACTIVE` · `PAUSED` · `FINISHED` · `CHURNED`), `started_at`, `ended_at`, `owner_id` (mentor responsável), `notes`

**`plans`** — `name`, `type` (`PADRAO` · `PREMIUM`), `sessions_count`, `duration_months`, `price` (Decimal 12,2), `is_active`

**`enrollments`** — liga aluno e plano: `student_id`, `plan_id`, `starts_at`, `ends_at`, `status`, `price_paid` (Decimal). Renovação cria uma nova linha; o histórico não é sobrescrito.

**`trail_steps`** — etapas configuráveis da jornada: `enrollment_id`, `order`, `key` (`CONTRACT` · `ANAMNESIS` · `OBJECTIVES` · `SMART_GOALS` · `SESSIONS` · `REVIEW` · `RENEWAL`), `status` (`LOCKED` · `PENDING` · `DONE`), `completed_at`

> O desbloqueio de etapa é calculado no `students.service`. O front recebe o status pronto (R1).

**`mentoring_sessions`** — `enrollment_id`, `scheduled_at`, `duration_min`, `status` (`SCHEDULED` · `DONE` · `NO_SHOW` · `CANCELED`), `google_event_id`, `notes` (privado do mentor), `summary` (visível ao aluno), `recording_url`

**`form_templates`** / **`form_responses`** — anamnese, objetivos e metas SMART. A resposta guarda `answers` (jsonb) + `scores` (jsonb, as 9 áreas de 1 a 10) + `answered_at`. Cada nova aplicação é uma linha nova — é isso que produz o gráfico de evolução.

**`smart_goals`** — `student_id`, `title`, `due_date`, `status` (`NOT_STARTED` · `IN_PROGRESS` · `DONE`), `completed_at`

---

### 4.3 Arquivos

**`files`**
| Campo | Tipo | Nota |
|---|---|---|
| id | uuid PK | |
| owner_type | enum | `STUDENT` · `USER` · `COMPANY` |
| owner_id | uuid | |
| category | enum | `CONTRACT` · `TRANSCRIPT` · `MINDMAP` · `RECEIPT` · `OTHER` |
| storage_key | text | caminho no bucket — **nunca exposto ao front** |
| original_name | text | sanitizado |
| mime_type | text | detectado no servidor, não confiado do cliente |
| size_bytes | bigint | |
| checksum_sha256 | text | |
| visible_to_client | boolean | default `false` |
| uploaded_by | uuid FK → users | |

---

### 4.4 Comercial

**`leads`** — `name`, `email`, `phone`, `origin` (`INSTAGRAM` · `REFERRAL` · `TALK` · `PARTNERSHIP` · `OTHER`), `stage` (`LEAD` · `CALL_SCHEDULED` · `CALL_DONE` · `PROPOSAL` · `WON` · `LOST`), `plan_interest`, `estimated_value` (Decimal), `owner_id`, `next_followup_at`, `lost_reason`, `converted_student_id`

**`lead_events`** — histórico imutável de movimentação: `lead_id`, `from_stage`, `to_stage`, `note`, `actor_id`, `created_at`. É daqui que sai a taxa de conversão por etapa e por origem.

---

### 4.5 Financeiro

**`bank_accounts`** — `name`, `provider` (`PLUGGY` · `BELVO` · `MANUAL`), `external_id`, `last_sync_at`. **Nunca guarda credencial bancária** — só o token do agregador, criptografado.

**`transaction_categories`** — `name`, `kind` (`REVENUE` · `COST`), `parent_id`

**`transactions`**
| Campo | Tipo | Nota |
|---|---|---|
| id | uuid PK | |
| bank_account_id | uuid FK? | |
| occurred_at | date | |
| description | text | |
| amount | **Decimal(14,2)** | positivo = entrada, negativo = saída |
| category_id | uuid FK? | |
| suggested_category_id | uuid FK? | sugestão automática |
| status | enum | `PENDING` · `RECONCILED` · `IGNORED` |
| reconciled_by | uuid FK? → users | |
| reconciled_at | timestamptz? | |
| external_id | text? | idempotência da importação |
| student_id | uuid FK? | quando a receita é de um aluno |

`UNIQUE (bank_account_id, external_id)` — impede lançamento duplicado em reimportação.

> **Regra de negócio crítica:** apenas transações `RECONCILED` entram em DRE, fluxo de caixa e dashboard. Nenhuma query de relatório pode esquecer esse filtro. Isole isso em uma única função no `finance.service` e use só ela.

**`goals`** — `year`, `month?`, `type` (`REVENUE` · `SALES_COUNT` · `TEAM`), `target_amount` (Decimal), `owner_id?`

**`receivables`** — `student_id`, `enrollment_id`, `due_date`, `amount` (Decimal), `status` (`OPEN` · `PAID` · `OVERDUE`), `paid_at`, `transaction_id?`

---

### 4.6 Equipe e notificações

**`tasks`** — `title`, `description`, `assignee_id`, `due_date`, `status` (`TODO` · `DOING` · `DONE`), `priority`, `related_entity`, `related_id`, `completed_at`

**`notifications`** — `user_id`, `type`, `title`, `body`, `link`, `read_at`, `created_at`

---

### 4.7 Índices obrigatórios

```
students(status, owner_id)
mentoring_sessions(scheduled_at), (enrollment_id, status)
transactions(status, occurred_at), (bank_account_id, external_id) UNIQUE
leads(stage, owner_id), (next_followup_at)
receivables(status, due_date)
permissions(user_id, module) UNIQUE
audit_logs(entity, entity_id, created_at)
files(owner_type, owner_id)
```

---

## 5. Segurança

### 5.1 Autenticação

- Google OAuth como único método. Sem senha no sistema, sem tela de cadastro aberta.
- NextAuth no `web/` emite a sessão; a `api/` valida o JWT de forma independente em toda requisição.
- Access token de vida curta (15 min) + refresh token em cookie `httpOnly`, `Secure`, `SameSite=Lax`.
- **Acesso é por convite.** Login com Google que não corresponde a um `users.is_active = true` recebe 403 e nenhuma conta é criada. Sem isso, qualquer conta Google do mundo entra no seu sistema.

### 5.2 Autorização — três camadas, todas obrigatórias

```
1. authenticate        → JWT válido? usuário ativo?
2. requirePermission   → este módulo está liberado neste nível para este usuário?
3. requireOwnership    → este registro específico pertence a ele?
```

A camada 3 é a que impede o ataque mais provável e mais barato deste sistema: o **IDOR**. Um aluno logado troca o ID na URL de `/alunos/eu` para `/alunos/outro` e lê a mentoria alheia. Camadas 1 e 2 passam — ele está autenticado e o módulo é permitido. Só a checagem de posse barra.

```ts
// Padrão obrigatório em todo service que recebe um id vindo do cliente
async function getStudent(id: string, actor: Actor) {
  const student = await repo.findById(id);
  if (!student) throw new AppError('STUDENT_NOT_FOUND', 404);

  if (actor.role === 'CLIENT' && student.userId !== actor.userId) {
    throw new AppError('STUDENT_NOT_FOUND', 404); // 404, não 403
  }
  if (actor.role === 'COLLABORATOR' && !actor.can('students', 'READ')) {
    throw new AppError('FORBIDDEN', 403);
  }
  return student;
}
```

> Devolver **404 em vez de 403** para recurso de outra pessoa é deliberado: 403 confirma que o registro existe. Não entregue essa informação.

### 5.3 Regras por perfil

| Perfil | Alcance |
|---|---|
| `MASTER` | Tudo. Único que gerencia permissões e vê dados financeiros. |
| `COLLABORATOR` | Só módulos com `level != NONE`. `READ` bloqueia toda rota de escrita. Nunca vê `finance` sem liberação explícita. |
| `CLIENT` | Somente leitura, somente registros onde `student.user_id = actor.id`. Nunca acessa `mentoring_sessions.notes`, `students.notes`, nem qualquer rota de `finance`, `commercial`, `team` ou `permissions`. |

### 5.4 Entrada e transporte

- **Zod em 100% das entradas** — body, query, params e headers customizados. Sem `any`, sem cast.
- **Prisma sempre parametrizado.** `$queryRawUnsafe` é proibido no repositório.
- **CORS** com allowlist explícita de origem. Sem `*`.
- **Helmet** com CSP, HSTS e `X-Content-Type-Options`.
- **Rate limit:** 100 req/min por usuário; 10/min em login, upload e emissão de URL assinada.
- **HTTPS obrigatório**, HTTP redireciona.
- Payload máximo de 1 MB em JSON (upload é fluxo separado).

### 5.5 Dados sensíveis

- Segredos só em variáveis de ambiente, validadas com Zod no boot — a api recusa subir com env faltando.
- Tokens de agregador bancário criptografados em repouso (AES-256-GCM, chave fora do banco).
- **Logs nunca registram** token, cabeçalho de autorização, dado bancário ou conteúdo de anamnese. Anamnese contém informação de saúde, sono e finanças pessoais do aluno — trate como dado sensível sob a LGPD.
- Nome de arquivo enviado pelo cliente é sanitizado e nunca usado como caminho no bucket.
- Backup diário do Postgres com retenção de 30 dias e teste de restauração mensal.

### 5.6 LGPD

- Base legal registrada no aceite do contrato (`enrollments`).
- Exportação dos dados do aluno em JSON, sob demanda.
- Exclusão: anonimiza `students` e `users`, preserva `transactions` e `audit_logs` por obrigação fiscal.
- Retenção de gravações e transcrições definida em contrato e aplicada por job.

---

## 6. Bucket de arquivos

**Bucket privado, sempre.** Nenhum objeto tem leitura pública — nem contrato, nem mapa mental, nem avatar.

### Estrutura de chaves
```
students/{studentId}/contracts/{fileId}-{slug}.pdf
students/{studentId}/transcripts/{fileId}-{slug}.pdf
students/{studentId}/mindmaps/{fileId}-{slug}.pdf
company/finance/{year}/{month}/{fileId}-{slug}.pdf
users/{userId}/avatar/{fileId}.webp
```
A chave é derivada no servidor a partir do `fileId` (UUID). Nunca do nome enviado pelo cliente.

### Upload — presigned, em três passos
```
1. POST /api/v1/files/upload-url
   → api valida permissão, MIME e tamanho declarado
   → cria files (status PENDING) e devolve URL assinada (5 min)
2. Front envia o binário direto ao bucket
3. POST /api/v1/files/{id}/confirm
   → api confere tamanho e checksum reais, detecta o MIME pelos magic bytes,
     marca CONFIRMED. Divergiu? apaga o objeto e falha.
```
O passo 3 existe porque o cliente pode declarar `application/pdf` e enviar um executável.

### Download
```
GET /api/v1/files/{id}/download
→ verifica posse e visible_to_client
→ devolve URL assinada de 60 segundos, uso único
→ registra em audit_logs
```
O `storage_key` nunca chega ao navegador. O front recebe apenas `/files/{id}/download`.

### Limites
| Regra | Valor |
|---|---|
| Tamanho máximo | 25 MB por arquivo |
| MIME aceitos | `application/pdf`, `image/png`, `image/jpeg`, `image/webp` |
| Validade da URL de upload | 5 minutos |
| Validade da URL de download | 60 segundos |
| Versionamento | ativado no bucket |
| Criptografia em repouso | obrigatória |

> Arquivo de aluno só aparece na Pasta do Aluno quando `visible_to_client = true`. O padrão é `false` — a exposição é uma decisão consciente, nunca um acidente.

---

## 7. WebSocket

Serve para uma coisa: refletir na tela, na hora, algo que outra pessoa ou um job mudou. Não é canal de dados nem de comando.

### Regras
1. **Handshake autenticado.** JWT validado na conexão; sem token, a conexão cai. Token expirado durante a sessão derruba o socket.
2. **Servidor emite, cliente escuta.** O cliente só pode pedir `join`/`leave` de sala. Nenhuma mutação de estado entra por socket — isso é HTTP.
3. **Sala é autorizada no join**, com as mesmas três camadas da seção 5.2.
4. **Evento carrega notificação, não dado sensível.** Manda `{ id, type }`; o cliente busca o recurso por HTTP, onde a permissão é reavaliada. Isso evita vazar por broadcast o que a rota jamais entregaria.

### Salas
| Sala | Quem entra |
|---|---|
| `user:{userId}` | o próprio usuário |
| `student:{studentId}` | o aluno dono e quem tem `students:READ` |
| `module:finance` | `MASTER` e quem tem `finance:READ` |
| `module:commercial` | quem tem `commercial:READ` |

### Eventos servidor → cliente
```
notification.created      { id }
transaction.reconciled    { id, status }
lead.stage_changed        { leadId, toStage }
task.updated              { taskId, status }
session.reminder          { sessionId, minutesUntil }
file.ready                { fileId, studentId }
bank.sync_finished        { accountId, imported }
```

### Eventos cliente → servidor
```
room.join    { room }     ← autorizado no servidor
room.leave   { room }
```
Só isso. Qualquer outro evento vindo do cliente é ignorado e logado.

### Operação
Reconexão com backoff exponencial (1s → 30s). Se o socket cair, a aplicação continua funcionando por HTTP — WebSocket é melhoria de experiência, nunca dependência. Em múltiplas instâncias, adapter Redis para broadcast.

---

## 8. Erros

```ts
class AppError extends Error {
  constructor(
    public code: string,      // 'STUDENT_NOT_FOUND'
    public status: number,    // 404
    public message: string    // 'Aluno não encontrado'
  ) { super(message); }
}
```
Handler global captura tudo. Erro não tratado vira `500 INTERNAL_ERROR` com mensagem genérica e log completo no servidor — nunca no corpo da resposta.

---

## 9. Ambientes

| Ambiente | Banco | Bucket | Observação |
|---|---|---|---|
| `development` | Postgres local | bucket dev | seed com dados fictícios |
| `staging` | espelho anonimizado | bucket staging | **nunca dado real de aluno** |
| `production` | Postgres gerenciado | bucket prod | backup diário, acesso restrito |

Migração roda por `prisma migrate deploy` em pipeline. Nunca `db push` em produção.

---

## 10. Checklist antes de subir qualquer módulo

- [ ] Nenhum cálculo de negócio no `web/`
- [ ] Toda rota tem `authenticate` + `requirePermission`
- [ ] Toda rota que recebe ID tem `requireOwnership`
- [ ] Toda entrada validada com Zod
- [ ] Recurso de terceiro devolve 404, não 403
- [ ] Nenhum `storage_key` sai da api
- [ ] Nenhum segredo no código
- [ ] Escritas relevantes gravam `audit_logs`
- [ ] Valores monetários em `Decimal`
- [ ] Relatórios filtram `status = RECONCILED`
- [ ] Eventos de socket carregam ID, não payload sensível
- [ ] Migração testada em staging

---

*Documento vivo. Mudança de arquitetura se discute aqui antes de virar código.*
