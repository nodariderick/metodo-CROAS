# CROAS OS — Auditoria de implementação

Data da revisão: 2026-09-08

Documentos de referência:

- `ARCHITECTURE.md`
- `FLOWS.md`
- `PRODUCT.md`

## Ajustes incluídos nesta revisão

### Autenticação Google por convite

O login Google agora vincula somente usuários ativos que já existem no CROAS OS.
Uma identidade Google desconhecida não cria mais uma conta `CLIENT`
automaticamente. Recusas do provedor, contas desativadas, contas sem convite e
falhas inesperadas retornam à tela de login com mensagens distintas e
acionáveis.

### Recuperação de senha

Foi corrigido o estreitamento de tipo do identificador do usuário dentro da
transação que consome o token de redefinição. A operação continua atômica:
o token é validado, marcado como usado e a senha é atualizada na mesma
transação.

## Requisitos já atendidos

- Monorepo React/Vite + Express + PostgreSQL, com contratos compartilhados.
- Papéis `MASTER`, `COLLABORATOR` e `CLIENT`.
- Sessões de autenticação persistidas no PostgreSQL.
- Senhas com hash bcrypt e credenciais externas em Replit Secrets.
- Módulos de alunos, comercial, financeiro, equipe e permissões.
- Registro de atividades para operações importantes.
- Tema visual escuro e identidade CROAS.

## Prioridade alta — tratar em revisões próprias

### Arquivos privados e portal do cliente

Os documentos exigem downloads temporários e autorização por posse/publicação.
A implementação atual ainda expõe caminhos persistentes de objetos em alguns
fluxos. O ajuste deve centralizar autorização no servidor, ocultar chaves de
storage e registrar downloads.

### Permissões por módulo e por operação

As regras descrevem níveis `NONE`, `READ` e `WRITE`. Algumas rotas verificam
acesso ao módulo, mas ainda não diferenciam leitura de escrita em todas as
mutações. A revisão deve cobrir acesso direto à API, não apenas esconder itens
na interface.

### Notas privadas e dados do aluno

Notas internas, resumos publicados e dados financeiros precisam de separação
explícita para garantir que clientes vejam somente os próprios dados
publicáveis.

## Escopo futuro descrito nos documentos

Os itens abaixo são objetivos de produto, não pequenas correções desta PR:

- Sincronização bidirecional com Google Agenda.
- Dashboard 360 completo e alertas operacionais.
- Ciclos, renovação, pausa, encerramento e arquivamento de alunos.
- Publicação consciente de materiais no portal do cliente.
- Regras completas da trilha e reavaliações por plano.
- Relatórios financeiros, comparativos e exportação.
- Estados responsivos e de erro/vazio em todos os módulos.

Cada bloco deve ser implementado e validado em uma PR própria para manter
segurança, revisão e rollback simples.