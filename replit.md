# CROAS OS — Sistema de Gestão 360

Plataforma centralizada de operação para o negócio de mentoria CROAS. Substitui planilhas, WhatsApp e Google Forms por um sistema unificado com três perfis de acesso: Master (Derick, acesso total), Colaborador (acesso por módulo liberado), e Cliente (acesso aos próprios dados).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (porta configurada via workflow)
- `pnpm --filter @workspace/web run dev` — Frontend React+Vite
- `pnpm run typecheck` — typecheck completo (libs + artifacts)
- `pnpm run build` — typecheck + build tudo
- `pnpm --filter @workspace/api-spec run codegen` — regerar hooks React Query e schemas Zod do OpenAPI spec
- `pnpm --filter @workspace/db run push` — push de schema DB (dev only)
- Env obrigatórias: `DATABASE_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + Passport.js (Google OAuth) + express-session (connect-pg-simple)
- Frontend: React + Vite + Wouter + TanStack Query + shadcn/ui + Tailwind
- DB: PostgreSQL + Drizzle ORM
- Validação: Zod (v3), drizzle-zod
- Codegen: Orval (OpenAPI → hooks + Zod schemas)

## Design Identity

- Fundo: `#0A0908` | Painéis: `#131110` | Ouro: `#D69A21` / `#F0C25C` | Texto: `#F3ECDD`
- Fontes: Bodoni Moda (títulos), IBM Plex Sans (UI), IBM Plex Mono (números)
- App sempre em dark mode (`class="dark"` no `<html>`)

## Where things live

- `lib/api-spec/openapi.yaml` — contrato OpenAPI (fonte da verdade)
- `lib/db/src/schema/` — schema Drizzle (users, permissions, activity_log)
- `artifacts/api-server/src/routes/` — rotas Express por domínio
- `artifacts/api-server/src/lib/passport.ts` — Google OAuth config
- `artifacts/api-server/src/middlewares/auth.ts` — requireAuth, requireMaster
- `artifacts/api-server/src/lib/activity.ts` — logActivity helper
- `artifacts/web/src/` — frontend React
- `artifacts/web/src/hooks/use-auth.tsx` — useAuth, AuthGuard, RoleGuard

## Módulos (Roadmap)

| Fase | Módulo | Status |
|------|--------|--------|
| M0 | Auth + Usuários + Permissões | ✅ Completo |
| M3+M3.1 | Trilha do Aluno + Pasta do Aluno | Pendente |
| M4 | Comercial (CRM) | Pendente |
| M2 | Financeiro | Pendente |
| M5+M1 | Equipe + Dashboard 360 | Pendente |

## Architecture decisions

- **Google OAuth only** — sem email/senha. O sistema cria o usuário automaticamente no primeiro login (role CLIENT por padrão). Usuário MASTER é pré-seeded por email `derick@croas.com.br`.
- **Permissões granulares** — tabela `permissions` com `userId × module × level (NONE|READ|WRITE)`. MASTER tem acesso total sem verificar tabela; outros perfis consultam antes de servir.
- **Activity log automático** — toda mutação chama `logActivity()` no handler, sem middleware automático para manter controle explícito.
- **OpenAPI first** — spec em `lib/api-spec/openapi.yaml` gera hooks (api-client-react) e schemas Zod (api-zod). Nunca escrever types manualmente.
- **Zod v3 + Orval** — usar `type: number` (não `type: integer`) no spec para evitar `zod.int()` que não existe em Zod v3.

## User preferences

- Idioma do sistema: Português brasileiro
- Design sempre dark mode, sem modo claro
- Sem emojis na UI
- Google OAuth como único método de login

## Gotchas

- `type: integer` no OpenAPI spec gera `zod.int()` que não existe em Zod v3 — usar `type: number` para todos os campos inteiros
- Após mudar schema em `lib/db/`, rodar `pnpm run typecheck:libs` antes do typecheck dos artifacts (declarations ficam stale)
- O cookie de sessão precisa de `sameSite: "none"` em produção para funcionar com o proxy Replit
- O callback URL do Google OAuth é auto-detectado via `REPLIT_DOMAINS` ou `REPLIT_DEV_DOMAIN`

## Pointers

- Ver skill `pnpm-workspace` para estrutura do monorepo, TypeScript e convenções de pacotes
