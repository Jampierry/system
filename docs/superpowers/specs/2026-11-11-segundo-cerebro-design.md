# Segundo Cérebro — Design (protótipo v0)

Data: 2026-11-11 · Branch: `claude/segundo-cerebro-app-rv64t8` · Pasta do app: `segundo-cerebro/`
(isolada do projeto Django SGFP que já existe na raiz; será migrada para repositório próprio depois via `git subtree split`).

## 1. Objetivo

App web e mobile de "segundo cérebro" pessoal: captura rápida, fluxo GTD, agenda, notas ligadas
estilo Obsidian, mapas mentais e um assistente de IA multimodal (texto, voz, foto) que responde em
texto e áudio conforme a configuração do usuário. Inclui módulo de administração (usuários,
perfis, recuperação de senha). Referência visual: app da imagem anexa (tema escuro, sidebar
esquerda, painel de calendário à direita, abas no topo).

Sucesso do protótipo: fatia vertical funcional rodando na nuvem da Anthropic, em **uma única porta**
(API + web exportado), testável pelo navegador, com `ANTHROPIC_API_KEY` opcional.

Fora do escopo: vídeo com avatar (descartado), sync offline, push, billing, multi-tenant.

## 2. Stack

| Camada | Escolha |
|---|---|
| Monorepo | npm workspaces: `apps/api`, `apps/app`, `packages/shared` |
| App web+mobile | Expo (React Native) + Expo Router + react-native-web, TypeScript |
| API | Node 22 + Fastify + TypeScript |
| Banco | SQLite (`better-sqlite3`) com FTS5 para busca; migrações SQL versionadas |
| Validação/tipos | Zod em `packages/shared`, compartilhado entre API e app |
| Senhas | `scrypt` do `node:crypto` (sem dependência nativa extra) |
| Sessões | Token opaco aleatório, guardado como hash SHA-256 no banco, enviado em `Authorization: Bearer` |
| IA | `@anthropic-ai/sdk`, modelo `claude-sonnet-5-5`, tool use + visão (imagens) |
| Voz entrada | Web Speech API (web). Nativo: gravação enviada ao servidor com provedor STT plugável — fase 2 |
| Voz saída | `speechSynthesis` (web) / `expo-speech` (nativo), voz/idioma/velocidade por perfil |
| Mapa mental/grafo | SVG próprio com pan/zoom (sem dependência pesada), nós salvos como JSON |
| Testes | Vitest (API e lógica compartilhada) |

**Modo IA:** se `ANTHROPIC_API_KEY` existir → Claude real. Senão → modo demo (respostas simuladas
determinísticas que ainda exercitam as ferramentas: criar nota/tarefa/evento). Um badge na UI indica o modo.

## 3. Arquitetura

```
segundo-cerebro/
  packages/shared/   schemas Zod, tipos, permissões, utilitários (parser de wikilinks/tags)
  apps/api/          Fastify: auth, admin, items, notes, mindmaps, assistant, search
    src/db/          conexão, migrações, repositórios
    src/modules/     um diretório por domínio (auth, admin, items, notes, ...)
    src/ai/          provider.ts (interface), claude.ts, demo.ts, tools.ts
  apps/app/          Expo Router: telas, componentes, tema, cliente da API
```

Unidades isoladas: cada módulo da API expõe rotas + repositório; o provider de IA é uma interface
(`respond(messages, tools) → stream`) com duas implementações; o cliente do app fala só com a API
tipada via `packages/shared`. Em produção do protótipo a API serve também o `expo export --platform web`.

## 4. Modelo de dados (SQLite)

- `users(id, email, name, password_hash, profile_id, status[active|locked|invited], must_change_password, created_at, last_login_at)`
- `profiles(id, name, description, permissions_json, is_system)` — perfis: **Administrador**, **Membro**, **Somente leitura** (sistema) + customizados.
- `sessions(id, user_id, token_hash, expires_at, user_agent, created_at)`
- `password_recovery(id, user_id, status[pending|approved|used|expired|denied], token_hash, requested_at, resolved_by, resolved_at, expires_at)`
- `audit_log(id, actor_id, action, target, meta_json, at)`
- `areas(id, user_id, name, color)` — o dropdown "Todas as áreas" da imagem.
- `items(id, user_id, area_id, project_id, title, body, kind[task|event|idea|checklist], status[inbox|next|waiting|someday|done|trashed], due_at, start_at, end_at, recurrence_rule, waiting_on, created_at, completed_at)`
- `checklist_entries(id, item_id, text, done, position)`
- `notes(id, user_id, area_id, path, title, body_md, frontmatter_json, is_daily, created_at, updated_at)`
- `links(src_note_id, dst_title, dst_note_id nullable)` e `tags(note_id, tag)` — derivados do corpo ao salvar.
- `notes_fts` (FTS5 sobre título+corpo), `items_fts`.
- `mindmaps(id, user_id, title, graph_json, updated_at)`
- `assistant_settings(user_id, voice, language, rate, tone, reply_mode[text|audio|both], model)`
- `conversations(id, user_id, created_at)` / `messages(id, conversation_id, role, content_json, created_at)`
- `logbook(id, user_id, at, kind, ref_id, summary)` — alimenta o Logbook e a Revisão semanal.

Isolamento: toda consulta filtra por `user_id`; permissões verificadas por middleware.

## 5. Funcionalidades

### 5.1 Produtividade (seguindo a imagem)
Sidebar: **Capturar item** (+ botão de microfone), **Caixa de entrada** (contador), **Calendário**,
**Foco**, **Próxima ação**, **Aguardando resposta**, **Algum dia/talvez**, **Projetos**,
**Recorrências**, **Checklists**, **Revisão semanal**, **Logbook**.
- Botão **Processar** (IA): percorre a caixa de entrada e propõe classificação (próxima ação / aguardando /
  algum dia / projeto / nota), com data sugerida; usuário aceita ou ajusta item a item. Há também o
  **Processar por voz** (o botão com ícone de onda).
- **Foco**: itens do dia + temporizador pomodoro; **Revisão semanal**: assistente passo a passo
  (esvaziar inbox, revisar aguardando, projetos sem próxima ação, algum dia).
- Painel direito: calendário do mês com marcação de itens e lista dos pendentes do mês.
- Abas no topo (várias telas abertas) e seletor de áreas.

### 5.2 Biblioteca (estilo Obsidian)
Alternador **Produtividade | Biblioteca** como na imagem. Na Biblioteca:
- Notas em Markdown com **editor + preview**, `[[wikilinks]]` (com autocompletar), **backlinks** e
  **menções sem link**, `#tags`, propriedades (frontmatter YAML), painel de **outline**.
- **Visão de grafo** (SVG, filtro por tag/área), **notas diárias** (um clique, template), **templates**.
- **Paleta de comandos / troca rápida** (Ctrl/Cmd+K), **busca full-text** (FTS5) com filtros.
- **Mapas mentais** (nós, filhos, cores, arrastar, salvar) e opção "converter ramo em notas/tarefas".
- **Importar vault Obsidian** (upload de .md/zip) e **exportar tudo em Markdown** (dados do usuário são dele).

### 5.3 Assistente
Chat por texto, **voz** (ditado), **foto** (câmera/arquivo, enviada como imagem ao Claude) e resposta em
texto e/ou áudio. Ferramentas do assistente: `criar_item`, `criar_nota`, `buscar`, `criar_evento`,
`listar_agenda`, `resumir_nota`, `adicionar_ao_mapa`. Configurações por usuário: voz, idioma (padrão pt-BR),
velocidade, tom (conciso/detalhado/informal), modo de resposta (texto/áudio/ambos). Foto capturada pode
virar item na caixa de entrada com texto extraído (OCR via Claude).

### 5.4 Administração (permissão `admin.*`)
- **Usuários**: listar/buscar, criar (senha temporária gerada + `must_change_password`), editar, trocar perfil,
  bloquear/desbloquear, encerrar sessões, excluir (soft).
- **Perfis**: CRUD com matriz de permissões (`users.manage`, `profiles.manage`, `recovery.manage`,
  `notes.write`, `items.write`, `assistant.use`, `audit.view`, `export.data`...). Perfis de sistema não podem
  ser removidos; impede remover o último administrador.
- **Recuperação de senha**: usuário clica em "Esqueci a senha" → cria solicitação `pending` (resposta
  neutra, não revela se o e-mail existe) → fila no painel admin → admin **aprova** gerando código de uso único
  (expira em 1 h, guardado só como hash, exibido uma vez ao admin para entregar ao usuário) ou **nega**; admin
  também pode **forçar redefinição** direto. Se SMTP estiver configurado (`SMTP_URL`), o código segue por e-mail;
  senão fica só no painel (adapter `Mailer` com implementação console). Usar o código derruba sessões antigas.
- **Auditoria**: log de login, falhas, ações administrativas e recuperações (visível com `audit.view`).
- **Primeiro acesso**: se não há usuários, cria admin a partir de `ADMIN_EMAIL`/`ADMIN_PASSWORD` ou, na ausência,
  de uma tela de setup inicial.

## 6. Segurança
Senha ≥ 10 caracteres, scrypt com salt por usuário; rate limit em login e recuperação; tokens aleatórios
de 256 bits com hash no banco; CORS restrito; validação Zod em toda entrada; limite de tamanho de upload
de imagem; segredo da API do Claude só no servidor; respostas de recuperação sem enumeração de e-mail;
auditoria das ações sensíveis.

## 7. Erros e testes
- Erros padronizados `{ error: { code, message } }`; app mostra toasts e estados vazios (como a "caixa vazia" da imagem).
- Se a chamada ao Claude falhar/estourar timeout → mensagem clara e fallback ao modo demo na resposta, sem perder a entrada do usuário.
- Vitest: auth/sessões/permissões, fluxo de recuperação, parser de wikilinks/tags e backlinks, FTS, ferramentas
  do assistente (modo demo), importação/exportação. Verificação final: subir servidor, percorrer fluxos no
  Playwright (login, capturar, processar, nota com link, grafo, admin) e capturar screenshots.

## 8. Entrega em fases dentro do protótipo
1. Esqueleto do monorepo, banco, auth, admin (usuários/perfis/recuperação/auditoria).
2. Itens GTD + captura + calendário + foco.
3. Notas estilo Obsidian (wikilinks, backlinks, tags, busca, grafo, diárias) + mapas mentais.
4. Assistente (demo + Claude, voz, foto, TTS, configurações) + Processar inbox.
5. Servir tudo em uma porta, README, verificação com Playwright.

## 9. Premissas e riscos
- Voz de entrada no nativo e STT de servidor ficam para a fase 2; no protótipo o teste de voz é no navegador (Chrome/Edge).
- `expo export` e dependências precisam de acesso ao npm no ambiente; se bloqueado, o web é gerado com Vite como plano B (mesma API).
- Migração futura para repositório próprio: `git subtree split --prefix=segundo-cerebro`.
