# Segundo Cérebro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protótipo web+mobile de segundo cérebro (GTD, notas estilo Obsidian, mapa mental interativo, assistente de IA multimodal, administração de usuários/perfis/recuperação de senha) servido em uma única porta.

**Architecture:** Monorepo npm workspaces em `segundo-cerebro/`: `packages/shared` (Zod, permissões, parser de wikilinks, operações puras do mapa mental), `apps/api` (Fastify + SQLite/FTS5, módulos por domínio, provider de IA plugável) e `apps/app` (Expo Router + react-native-web, exportado para web e servido pela API).

**Tech Stack:** Node 22, TypeScript, Fastify, better-sqlite3, Zod, Vitest, `@anthropic-ai/sdk` (`claude-sonnet-5-5`), Expo + Expo Router + react-native-web, Playwright (verificação).

**Spec:** `docs/superpowers/specs/2026-11-11-segundo-cerebro-design.md`

## Global Constraints

- Todo o código novo fica em `segundo-cerebro/`; não tocar no projeto Django da raiz.
- UI em português do Brasil, tema escuro, layout da imagem de referência (sidebar esquerda, painel de calendário à direita, abas no topo).
- Senhas: `scrypt` de `node:crypto`, mínimo 10 caracteres. Tokens de sessão/recuperação: 256 bits aleatórios, só o hash SHA-256 no banco.
- Recuperação: código de uso único, expira em 1 h; resposta de "esqueci a senha" idêntica exista ou não o e-mail.
- Toda consulta filtra por `user_id`; rotas protegidas por permissão (`users.manage`, `profiles.manage`, `recovery.manage`, `audit.view`, `notes.write`, `items.write`, `assistant.use`, `export.data`).
- Erros da API: `{ "error": { "code": string, "message": string } }`.
- IA: `ANTHROPIC_API_KEY` presente → Claude real (`claude-sonnet-5-5`); ausente → modo demo. Chave nunca vai ao cliente.
- Perfis de sistema: Administrador, Membro, Somente leitura; nunca remover o último administrador.
- Sem vídeo/avatar. Voz de entrada nativa e STT de servidor ficam fora.
- Um commit por tarefa, mensagem em português no formato `feat: ...`/`test: ...`.

## Review Focus

- Wikilink com título duplicado, com alias `[[a|b]]`, dentro de bloco de código ou apontando para nota inexistente (não pode quebrar backlinks nem criar nota fantasma).
- Admin tenta bloquear/rebaixar/excluir a si mesmo ou o último administrador (deve ser recusado com `LAST_ADMIN`).
- Código de recuperação reutilizado, expirado ou de solicitação negada (deve falhar sem revelar o motivo exato e sem trocar a senha).
- Claude indisponível, sem chave ou com timeout (o chat continua respondendo em modo demo e a mensagem do usuário não se perde).
- Mapa mental com ciclo, nó órfão, ramo recolhido ao remover o pai ou JSON inválido vindo do cliente (rejeitar ou sanear, nunca travar o editor).

---

### Task 1: Esqueleto do monorepo e pacote shared

**Files:**
- Create: `segundo-cerebro/package.json`, `segundo-cerebro/tsconfig.base.json`, `segundo-cerebro/.gitignore`, `segundo-cerebro/.env.example`
- Create: `segundo-cerebro/packages/shared/{package.json,tsconfig.json,src/index.ts,src/permissions.ts,src/schemas.ts}`
- Create: `segundo-cerebro/apps/api/{package.json,tsconfig.json,vitest.config.ts}`
- Test: `segundo-cerebro/packages/shared/src/permissions.test.ts`

**Interfaces:**
- Produces: `PERMISSIONS: readonly string[]` (as 8 permissões do Global Constraints), `type Permission`, `hasPermission(perms: Permission[], needed: Permission): boolean`, `SYSTEM_PROFILES: Record<'admin'|'member'|'readonly', Permission[]>`, Zod `loginSchema`, `passwordSchema` (≥10).

- [ ] **Step 1: Escrever teste** — `hasPermission(SYSTEM_PROFILES.readonly,'notes.write')===false`, `hasPermission(SYSTEM_PROFILES.admin,'users.manage')===true`, `passwordSchema.safeParse('curta').success===false`.
- [ ] **Step 2:** `npm test -w packages/shared` → FAIL (módulo inexistente).
- [ ] **Step 3:** Criar workspaces, tsconfig, vitest e implementar `permissions.ts`/`schemas.ts` conforme Interfaces.
- [ ] **Step 4:** `npm install && npm test -w packages/shared` → PASS.
- [ ] **Step 5:** Commit `feat: esqueleto do monorepo e pacote shared`.

### Task 2: Banco SQLite, migrações e config

**Files:**
- Create: `apps/api/src/config.ts`, `apps/api/src/db/{connection.ts,migrate.ts}`, `apps/api/src/db/migrations/001_init.sql`
- Test: `apps/api/src/db/migrate.test.ts`

**Interfaces:**
- Produces: `loadConfig(env=process.env): Config` (`port`, `dbPath`, `anthropicKey?`, `adminEmail?`, `adminPassword?`, `smtpUrl?`); `openDb(path: string): Database` (WAL, foreign_keys ON); `migrate(db): void` idempotente. `001_init.sql` cria todas as tabelas da seção 4 da spec, incluindo `notes_fts` e `items_fts` (FTS5).

- [ ] **Step 1: Teste** — `openDb(':memory:')`+`migrate` duas vezes não falha; tabelas `users, profiles, sessions, password_recovery, audit_log, areas, items, notes, links, tags, mindmaps, assistant_settings, conversations, messages, logbook` existem; inserir nota e achá-la por `notes_fts MATCH`.
- [ ] **Step 2:** rodar → FAIL. **Step 3:** implementar (tabela `schema_migrations` controla versão; FTS mantido por triggers). **Step 4:** PASS. **Step 5:** Commit.

### Task 3: Autenticação, sessões e permissões

**Files:**
- Create: `apps/api/src/server.ts` (`buildServer(deps): FastifyInstance`), `apps/api/src/modules/auth/{password.ts,tokens.ts,sessions.ts,routes.ts,guard.ts,bootstrap.ts}`
- Test: `apps/api/src/modules/auth/auth.test.ts`

**Interfaces:**
- Produces: `hashPassword(pw): Promise<string>`, `verifyPassword(pw, hash): Promise<boolean>`, `newToken(): {token: string; hash: string}`, `requirePermission(p: Permission)` preHandler que define `req.user: {id, email, name, permissions: Permission[], mustChangePassword: boolean}`, `ensureAdmin(db, cfg): Promise<void>`; rotas `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password`, `GET /api/auth/setup-status`, `POST /api/auth/setup` (só se não há usuários).
- Consumes: Task 2 (`openDb`, `migrate`), Task 1 (permissões, schemas).

- [ ] **Step 1: Testes** — login correto devolve token e `/me` com permissões; senha errada → 401 `INVALID_CREDENTIALS` e linha em `audit_log`; usuário `locked` → 403; sem token → 401; `readonly` chamando rota `items.write` → 403; 6ª tentativa de login errada em 1 min → 429; `setup` falha com 409 se já existe usuário; token no banco é hash (nunca igual ao enviado).
- [ ] **Step 2:** FAIL. **Step 3:** implementar com `scrypt` (salt 16 bytes, `scrypt$salt$hash`), `@fastify/rate-limit`. **Step 4:** PASS. **Step 5:** Commit.

### Task 4: Administração — usuários, perfis, auditoria

**Files:**
- Create: `apps/api/src/modules/admin/{users.ts,profiles.ts,audit.ts,routes.ts}`
- Test: `apps/api/src/modules/admin/admin.test.ts`

**Interfaces:**
- Produces: `GET/POST /api/admin/users`, `PATCH /api/admin/users/:id` (nome, perfil, `status`), `POST /api/admin/users/:id/revoke-sessions`, `DELETE /api/admin/users/:id` (soft); `GET/POST/PATCH/DELETE /api/admin/profiles`; `GET /api/admin/audit?limit&before`; `logAudit(db, actorId, action, target, meta?)`. Criar usuário devolve `{user, temporaryPassword}` (exibida uma vez, `must_change_password=1`).
- Consumes: Task 3 (`requirePermission`, `hashPassword`).

- [ ] **Step 1: Testes** — membro recebe 403 em `/api/admin/users`; admin cria usuário e a senha temporária permite login e força troca; criar com e-mail repetido → 409; bloquear usuário revoga sessões; remover/rebaixar/bloquear o último admin → 409 `LAST_ADMIN`; perfil de sistema não é removível (409); editar permissões de perfil reflete no `/me` do usuário; toda ação gera `audit_log`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** Commit.

### Task 5: Recuperação de senha

**Files:**
- Create: `apps/api/src/modules/recovery/{service.ts,routes.ts,mailer.ts}`
- Test: `apps/api/src/modules/recovery/recovery.test.ts`

**Interfaces:**
- Produces: `POST /api/auth/forgot {email}` (sempre 202 com a mesma resposta); `GET /api/admin/recovery?status=`; `POST /api/admin/recovery/:id/approve` → `{code}` (exibido uma vez); `POST /api/admin/recovery/:id/deny`; `POST /api/admin/users/:id/force-reset` → `{code}`; `POST /api/auth/reset {email, code, newPassword}`. `interface Mailer { send(to: string, subject: string, text: string): Promise<void> }` com `ConsoleMailer` e `SmtpMailer` (se `SMTP_URL`).
- Consumes: Task 4 (`logAudit`), Task 3 (`newToken`, `hashPassword`).

- [ ] **Step 1: Testes** — `forgot` com e-mail inexistente e existente têm corpo idêntico; só existente cria `pending`; código válido troca a senha e derruba sessões antigas; reuso do código → 400 genérico `INVALID_CODE`; código vencido (relógio injetado +61 min) e solicitação negada → mesmo erro; `approve` por membro → 403; banco guarda só hash do código; ações auditadas.
- [ ] **Step 2:** FAIL. **Step 3:** implementar com relógio injetável (`deps.now()`). **Step 4:** PASS. **Step 5:** Commit.

### Task 6: Itens GTD, áreas, calendário e logbook

**Files:**
- Create: `apps/api/src/modules/items/{repo.ts,routes.ts,recurrence.ts,review.ts}`
- Test: `apps/api/src/modules/items/items.test.ts`, `recurrence.test.ts`

**Interfaces:**
- Produces: `POST /api/items` (captura → `status:'inbox'`), `GET /api/items?status&area&project&month`, `PATCH /api/items/:id` (mover entre `inbox|next|waiting|someday|done`), `DELETE`, CRUD `/api/areas`, `GET /api/calendar?month=YYYY-MM`, `GET /api/review/weekly` (inbox, aguardando, projetos sem próxima ação, algum dia), `GET /api/logbook`; `nextOccurrence(rule: string, after: Date): Date | null` (regras `daily|weekly|monthly|weekdays`); concluir item recorrente cria a próxima ocorrência; toda conclusão grava `logbook`.
- Consumes: Task 3 (`requirePermission('items.write')`).

- [ ] **Step 1: Testes** — captura entra na inbox e contador do `GET` bate; mover para `next` e filtrar; usuário B não enxerga itens do A; `nextOccurrence('weekly', 2026-11-11)` = 2026-11-18; concluir recorrente gera novo item; `calendar?month=2026-10` só traz itens do mês; projeto sem item `next` aparece na revisão semanal; busca FTS acha título.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** Commit.

### Task 7: Notas estilo Obsidian (parser, links, busca, diárias, import/export)

**Files:**
- Create: `packages/shared/src/markdown.ts` (+ `markdown.test.ts`), `apps/api/src/modules/notes/{repo.ts,routes.ts,graph.ts,transfer.ts}`
- Test: `apps/api/src/modules/notes/notes.test.ts`

**Interfaces:**
- Produces (shared): `parseNote(md: string): {frontmatter: Record<string,unknown>; links: {target: string; alias?: string}[]; tags: string[]; headings: {level:number; text:string}[]}` — ignora blocos/inline de código. API: CRUD `/api/notes`, `GET /api/notes/:id/backlinks`, `GET /api/notes/:id/unlinked` (menções sem link), `GET /api/search?q`, `GET /api/graph?tag&area` → `{nodes:{id,title}[], edges:{source,target}[]}`, `POST /api/notes/daily` (cria/abre a nota do dia `YYYY-MM-DD` a partir do template), CRUD `/api/templates`, `POST /api/import` (.md/.zip), `GET /api/export` (zip de .md; exige `export.data`).
- Consumes: Task 2 (FTS), Task 3.

- [ ] **Step 1: Testes** — `parseNote('a [[B|alias]] #t `[[x]]` #t2')` → links `[B]`, tags `['t','t2']`; wikilink para título inexistente não cria nota; renomear nota atualiza backlinks; dois títulos iguais → resolve ao mais antigo e não duplica aresta; `daily` chamado 2× devolve a mesma nota; busca FTS acha trecho do corpo; export→import em usuário novo preserva títulos e links; grafo só inclui notas do usuário.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (links/tags re-derivados em cada salvamento). **Step 4:** PASS. **Step 5:** Commit.

### Task 8: Modelo de mapa mental (funções puras) e API

**Files:**
- Create: `packages/shared/src/mindmap.ts` (+ `mindmap.test.ts`), `apps/api/src/modules/mindmaps/{routes.ts}`
- Test: `apps/api/src/modules/mindmaps/mindmaps.test.ts`

**Interfaces:**
- Produces (shared): `type MindNode = {id: string; parentId: string|null; text: string; x: number; y: number; color?: string; collapsed?: boolean; noteId?: string; itemId?: string}`; `type MindMap = {rootId: string; nodes: Record<string, MindNode>}`; `mindmapSchema` (Zod, rejeita ciclo e nó sem pai existente); funções imutáveis `createMap(title): MindMap`, `addChild(m, parentId, text?): {map, id}`, `addSibling(m, id, text?): {map, id}`, `removeNode(m, id): MindMap` (remove subárvore; raiz não removível), `moveNode(m, id, x, y): MindMap` (move descendentes junto), `setText`, `toggleCollapse`, `layoutRadial(m): MindMap`, `visibleNodes(m): MindNode[]` (oculta descendentes de recolhidos), `toOutlineMarkdown(m): string`, `fromOutlineMarkdown(md): MindMap`; `class History<T> { push(s: T): void; undo(): T|undefined; redo(): T|undefined }`.
- API: CRUD `/api/mindmaps` (valida com `mindmapSchema`, 400 `INVALID_MAP`), `POST /api/mindmaps/:id/to-notes` (ramo → notas/tarefas).

- [ ] **Step 1: Testes** — `addChild` aumenta nós e liga ao pai; `removeNode` na raiz lança; remover pai remove descendentes e não deixa órfãos; `moveNode` desloca filhos; `visibleNodes` esconde filhos de recolhido; `toOutlineMarkdown`→`fromOutlineMarkdown` preserva hierarquia/texto; `layoutRadial` não sobrepõe irmãos (distância mínima); `mindmapSchema` rejeita ciclo; `History` undo/redo; `PUT` com JSON inválido → 400 e mapa anterior preservado.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS. **Step 5:** Commit.

### Task 9: Assistente — provider de IA, ferramentas, demo e Claude

**Files:**
- Create: `apps/api/src/ai/{provider.ts,demo.ts,claude.ts,tools.ts,select.ts}`, `apps/api/src/modules/assistant/{routes.ts,settings.ts,process-inbox.ts}`
- Test: `apps/api/src/ai/ai.test.ts`, `apps/api/src/modules/assistant/assistant.test.ts`

**Interfaces:**
- Produces: `interface AiProvider { mode: 'demo'|'claude'; respond(input: {system: string; messages: ChatMessage[]; tools: ToolDef[]}): Promise<AiResult> }`; `type ChatMessage = {role:'user'|'assistant'; content: string; imageBase64?: string; imageMime?: string}`; `selectProvider(cfg): AiProvider` (Claude se há chave); ferramentas em `tools.ts`: `criar_item, criar_nota, buscar, criar_evento, listar_agenda, resumir_nota, adicionar_ao_mapa, expandir_ramo, gerar_mapa`, cada uma `run(ctx, args)` com args validados por Zod; rotas `POST /api/assistant/chat` (SSE ou JSON), `GET/PUT /api/assistant/settings` (`voice, language='pt-BR', rate, tone, replyMode:'text'|'audio'|'both'`), `GET /api/assistant/mode`, `POST /api/assistant/process-inbox` → sugestões `{itemId, status, dueAt?, reason}[]` (não aplica), `POST /api/assistant/process-inbox/apply`.
- Consumes: Tasks 6, 7, 8 (repos), Task 3 (`assistant.use`).

- [ ] **Step 1: Testes** — sem chave `selectProvider(...).mode==='demo'`; demo respondendo "anota: comprar pão" cria item via `criar_item`; `process-inbox` em modo demo devolve uma sugestão por item e não altera nada até `apply`; ferramenta com args inválidos retorna erro sem derrubar o chat; provider Claude falsificado que lança erro/timeout → resposta de fallback demo e mensagem do usuário salva; `tone`/`replyMode` das settings entram no `system`; imagem é repassada ao provider; chave nunca aparece em `/mode`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar `claude.ts` com `@anthropic-ai/sdk` (tool use em loop de até 5 passos, timeout 30 s) — testado com SDK injetado. **Step 4:** PASS. **Step 5:** Commit.

### Task 10: App Expo — shell, tema, cliente API, login e layout da referência

**Files:**
- Create: `apps/app/{package.json,app.json,tsconfig.json}`, `apps/app/app/_layout.tsx`, `app/login.tsx`, `app/forgot.tsx`, `app/(main)/_layout.tsx`
- Create: `apps/app/src/{api/client.ts,theme.ts,state/session.ts,components/{Sidebar,TopTabs,CalendarPanel,CaptureButton,Toast,EmptyState}.tsx}`
- Test: `apps/app/src/api/client.test.ts`

**Interfaces:**
- Produces: `api<T>(path: string, init?: {method?: string; body?: unknown}): Promise<T>` (injeta Bearer, lança `ApiError{code,message}`), `useSession(): {user, login, logout, can(p: Permission): boolean}`, `theme` (cores do tema escuro da imagem), layout principal com sidebar (itens da imagem), alternador **Produtividade | Biblioteca**, seletor "Todas as áreas", painel de calendário à direita, abas no topo; em telas estreitas a sidebar vira menu e o painel direito some.
- Consumes: rotas das Tasks 3 e 6.

- [ ] **Step 1: Teste** — `api()` envia `Authorization`, converte `{error}` em `ApiError`, e em 401 limpa a sessão.
- [ ] **Step 2:** FAIL. **Step 3:** implementar shell e telas de login/"esqueci a senha"/troca de senha obrigatória. **Step 4:** `npm test -w apps/app` PASS e `npx expo export --platform web` gera `dist/`. **Step 5:** Commit.

### Task 11: App — telas de Produtividade

**Files:**
- Create: `apps/app/app/(main)/{inbox,calendar,focus,next,waiting,someday,projects,recurring,checklists,review,logbook}.tsx`, `apps/app/src/components/{ItemRow,ProcessSheet,Pomodoro}.tsx`

**Interfaces:**
- Consumes: Task 6 e Task 9 (`process-inbox`). Produz: tela **Caixa de entrada** com "Tire da cabeça…" e estado vazio da imagem, botões **Processar** (IA) e **Processar por voz**, ação rápida de mover item; **Foco** com pomodoro 25/5; **Revisão semanal** em passos.

- [ ] **Step 1:** Escrever teste de lógica `pomodoro.test.ts` (`tick` conclui ciclo de 25 min e alterna para pausa de 5).
- [ ] **Step 2:** FAIL. **Step 3:** implementar telas e `Pomodoro`. **Step 4:** PASS + `expo export` sem erro. **Step 5:** Commit.

### Task 12: App — Biblioteca (editor, backlinks, busca, grafo, paleta)

**Files:**
- Create: `apps/app/app/(main)/library/{index,[id]}.tsx`, `apps/app/src/components/{MarkdownEditor,BacklinksPanel,OutlinePanel,GraphView,CommandPalette}.tsx`

**Interfaces:**
- Consumes: Task 7. Produz: editor com preview e autocompletar `[[`; painéis de backlinks/menções/outline; `GraphView` (SVG com pan/zoom e filtro por tag); `CommandPalette` aberta com Ctrl/Cmd+K (buscar nota, criar nota, nota do dia, ir para tela).

- [ ] **Step 1:** Teste de lógica `wikilink-complete.test.ts`: `suggest(titles, '[[pro')` devolve títulos que casam por prefixo/fuzzy ordenados.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS + `expo export`. **Step 5:** Commit.

### Task 13: App — Mapa mental interativo

**Files:**
- Create: `apps/app/app/(main)/library/mindmaps/{index,[id]}.tsx`, `apps/app/src/components/mindmap/{MindMapCanvas,NodeView,Toolbar,Minimap}.tsx`, `apps/app/src/components/mindmap/useMindMapEditor.ts`

**Interfaces:**
- Consumes: Task 8 (operações puras e `History`), Task 9 (`expandir_ramo`, `gerar_mapa`). Produz: `useMindMapEditor(initial: MindMap): {map, selectedId, select, apply(fn: (m: MindMap) => MindMap): void, undo, redo, dirty}`; `MindMapCanvas` com pan (arrastar fundo), zoom (roda/pinça), arrastar nós, `Tab`/`Enter`/`Del`/`F2`/duplo clique, recolher/expandir, paleta de cores, minimapa, salvamento automático com debounce de 800 ms, **Expandir com IA**, **Gerar mapa de tema/nota**, exportar outline/SVG/PNG, vincular nó a nota.

- [ ] **Step 1: Testes** (`useMindMapEditor.test.ts`): `apply(addChild)` marca `dirty` e seleciona o novo nó; `undo` restaura o mapa anterior e `redo` reaplica; atalhos mapeiam `Tab`→`addChild` e `Enter`→`addSibling`; exclusão da raiz é ignorada sem erro.
- [ ] **Step 2:** FAIL. **Step 3:** implementar o hook e o canvas SVG (eventos de ponteiro unificados web/nativo). **Step 4:** PASS + `expo export`. **Step 5:** Commit.

### Task 14: App — Assistente (voz, foto, TTS, configurações)

**Files:**
- Create: `apps/app/app/(main)/assistant.tsx`, `apps/app/app/(main)/settings/assistant.tsx`, `apps/app/src/voice/{recognition.ts,speech.ts}`, `apps/app/src/components/{ChatBubble,PhotoPicker,ModeBadge}.tsx`

**Interfaces:**
- Consumes: Task 9. Produz: `startDictation(lang: string, onText: (t: string, final: boolean) => void): {stop(): void} | null` (Web Speech API; `null` se não suportado, UI mostra aviso), `speak(text: string, opts: {voice?: string; lang: string; rate: number}): void` e `stopSpeaking()`; chat com texto, microfone, foto (câmera/arquivo → base64), resposta falada conforme `replyMode`; `ModeBadge` mostra **Demo** ou **Claude**; captura rápida da sidebar usa os mesmos componentes.

- [ ] **Step 1:** Teste `speech.test.ts` com `speechSynthesis` falso: `replyMode:'text'` não chama `speak`; `'both'` chama com `lang/rate` das settings; `startDictation` sem API devolve `null`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS + `expo export`. **Step 5:** Commit.

### Task 15: App — Administração

**Files:**
- Create: `apps/app/app/(main)/admin/{users,profiles,recovery,audit}.tsx`, `apps/app/src/components/PermissionMatrix.tsx`

**Interfaces:**
- Consumes: Tasks 4 e 5. Produz: tabelas de usuários (criar, editar, bloquear, encerrar sessões, exibir senha temporária uma vez), editor de perfis com matriz de permissões, fila de recuperação (aprovar → mostra código uma vez com botão copiar; negar), log de auditoria. Itens de admin só aparecem quando `can(...)`.

- [ ] **Step 1:** Teste `permissionMatrix.test.ts`: alternar uma permissão gera o array correto e impede salvar perfil sem `assistant.use` se for de sistema "Membro".
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS + `expo export`. **Step 5:** Commit.

### Task 16: Servir em uma porta, README e verificação de ponta a ponta

**Files:**
- Create: `apps/api/src/static.ts`, `segundo-cerebro/README.md`, `segundo-cerebro/scripts/{dev.sh,e2e.mjs}`
- Modify: `apps/api/src/server.ts` (servir `apps/app/dist` com fallback SPA em rotas não-`/api`)

**Interfaces:**
- Produces: `npm run build` (export web + build da API), `npm start` (uma porta, `PORT` padrão 8787), `node scripts/e2e.mjs` (Playwright) cobrindo: setup/login do admin; criar usuário pelo painel; fluxo "esqueci a senha" → aprovação → redefinição → login; capturar item e vê-lo na inbox; criar nota com `[[link]]` e ver o backlink; abrir grafo; criar mapa mental com `Tab`/`Enter`, arrastar nó, recarregar e ver persistido; chat no modo demo. Salva screenshots em `segundo-cerebro/docs/screens/`.
- README documenta stack, variáveis (`ANTHROPIC_API_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SMTP_URL`, `PORT`), modo demo e `git subtree split --prefix=segundo-cerebro` para migrar ao repositório próprio.

- [ ] **Step 1:** Teste `static.test.ts`: `GET /` devolve o `index.html`, `GET /api/inexistente` → 404 JSON (não HTML), rota SPA `/library/x` devolve `index.html`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar e escrever e2e e README. **Step 4:** `npm test` (todos os workspaces) PASS; `npm start` + `node scripts/e2e.mjs` sem falhas. **Step 5:** Commit; reportar a porta com `report_preview_port`.

---

## Auto-revisão

- Cobertura da spec: auth/admin/recuperação/auditoria (T3–T5), GTD, calendário, foco, revisão e logbook (T6, T11), notas Obsidian, grafo, diárias, busca, import/export (T7, T12), mapa mental interativo com IA (T8, T13), assistente multimodal e configurações (T9, T14), Processar inbox (T9, T11), uma porta e Playwright (T16).
- Consistência de nomes: `requirePermission`, `logAudit`, `parseNote`, `MindMap`/`addChild`, `AiProvider.respond`, `useMindMapEditor` usados com a mesma assinatura em todas as tarefas.
- Proporção: spec ≈ 110 linhas; este plano traz só decisões (interfaces, testes e comandos), sem corpos de função.
