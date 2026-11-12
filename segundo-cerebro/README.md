# Segundo Cérebro

Protótipo de um **segundo cérebro pessoal** para web e mobile: caixa de entrada GTD, agenda, notas estilo Obsidian
(`[[links]]`, backlinks, grafo), **mapas mentais interativos**, um **assistente de IA** que entende texto, voz e foto e
responde em texto e/ou áudio, e uma **área de administração** (usuários, perfis, recuperação de senha, auditoria).

A interface segue o app de referência: sidebar com *Capturar item*, *Caixa de entrada*, *Calendário*, *Foco*, *Próxima ação*,
*Aguardando resposta*, *Algum dia/talvez*, *Projetos*, *Recorrências*, *Checklists*, *Revisão semanal* e *Logbook*; painel de
calendário à direita; abas no topo; alternador **Produtividade | Biblioteca**.

| Caixa de entrada + IA | Nota com links | Grafo |
|---|---|---|
| ![](docs/screens/03-processar-com-ia.png) | ![](docs/screens/04-nota-com-links.png) | ![](docs/screens/05-grafo.png) |

| Mapa mental interativo | Assistente | Perfis e permissões |
|---|---|---|
| ![](docs/screens/07-mapa-mental.png) | ![](docs/screens/08-assistente.png) | ![](docs/screens/10-admin-perfis.png) |

> As capturas são geradas por `npm run e2e` (veja [Testes](#testes)).

## Rodando

Requisitos: Node 22+.

```bash
cd segundo-cerebro
npm install
npm run build          # exporta o app web (apps/app/dist)
npm start              # API + app web em http://localhost:8787 (uma única porta)
```

No primeiro acesso, se não houver usuários, o app mostra a tela **Primeiro acesso** para criar o administrador.
Alternativamente, defina `ADMIN_EMAIL` e `ADMIN_PASSWORD` e o administrador é criado na primeira subida.

```bash
ANTHROPIC_API_KEY=sk-ant-... ADMIN_EMAIL=voce@exemplo.com ADMIN_PASSWORD='uma-senha-longa' npm start
```

Desenvolvimento com recarga automática (API em `:8787`, Expo web em `:8081`): `npm run dev`.

### Variáveis de ambiente

| Variável | Padrão | Para quê |
|---|---|---|
| `PORT` | `8787` | Porta HTTP. |
| `DB_PATH` | `./data/cerebro.sqlite` | Arquivo SQLite (criado sozinho). |
| `ANTHROPIC_API_KEY` | — | Liga o Claude (`claude-sonnet-5-5`). **Sem ela o assistente roda em modo demo.** A chave fica só no servidor. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | — | Cria o primeiro administrador (senha ≥ 10 caracteres). |
| `SMTP_URL` | — | Ex.: `smtps://user:pass@smtp.exemplo.com`. Com ela, o código de recuperação de senha também vai por e-mail. |
| `WEB_DIR` | `apps/app/dist` | Pasta do app web exportado a ser servida. |

## Funcionalidades

**Produtividade (GTD)** — captura rápida (modal, linha de adição e assistente); caixa de entrada com **Processar** (a IA
sugere próxima ação / aguardando / algum dia / projeto e uma data; você ajusta e só então aplica); áreas (“Todas as áreas”);
datas, **recorrências** (diária, semanal, dias úteis, mensal — concluir cria a próxima), projetos com a regra “toda projeto
precisa de uma próxima ação”, checklists, **Foco** com pomodoro 25/5, **revisão semanal** em 5 passos e **logbook**.

**Biblioteca (estilo Obsidian)** — notas em Markdown com editor/pré-visualização, `[[wikilinks]]` com autocompletar
(alias `[[a|b]]` e seção `[[a#b]]`), **backlinks** e menções sem link, `#tags`, propriedades (frontmatter), estrutura (outline),
**grafo** com pan/zoom e filtros, **notas diárias** e templates, busca no texto (SQLite FTS5), **paleta de comandos**
(`Ctrl/Cmd+K`), **importar** `.md`/`.zip` de um vault do Obsidian e **exportar** tudo em Markdown.

**Mapas mentais interativos** — arraste os nós; `Tab` cria filho, `Enter` cria irmão, duplo clique/`F2` edita, `Delete`
remove, `Espaço` recolhe/expande, setas navegam, `Ctrl+Z` / `Ctrl+Shift+Z` desfazem/refazem; pan e zoom, minimapa, cores,
layout radial sem sobreposição, vínculo de nó com nota, salvamento automático. Com IA: **expandir ramo** e **gerar mapa** a partir
de um tema ou de uma nota. Exporta **outline Markdown, SVG e PNG** e converte um ramo em **notas** ou **tarefas**.

**Assistente** — texto, **voz** (ditado pelo navegador), **foto** (câmera/arquivo, reduzida antes do envio) e respostas em
**texto, áudio ou ambos**, conforme as configurações: idioma, voz, velocidade e tom. Usa ferramentas para criar itens, notas e
eventos, buscar, consultar a agenda e mexer em mapas. Se o Claude cair ou demorar mais de 30 s, responde em modo demo sem perder
a sua mensagem.

**Administração** (por permissão) — usuários (criar com senha temporária mostrada uma vez, editar, bloquear, encerrar sessões,
excluir), **perfis** com matriz de permissões, **recuperação de senha** (o usuário pede; o administrador aprova ou nega e entrega
um código de uso único que vale 1 h; também há “redefinir senha” direto) e **auditoria** de acessos e ações.

## Arquitetura

```
segundo-cerebro/
  packages/shared/   regras e tipos compartilhados: permissões, parser de Markdown/wikilinks, mapa mental (funções puras)
  apps/api/          Fastify + SQLite (better-sqlite3, FTS5): auth, admin, itens, notas, mapas, assistente, estáticos
  apps/app/          Expo (React Native + react-native-web) com Expo Router: web e mobile na mesma base
  scripts/           dev.sh, e2e.mjs
```

| Camada | Escolha | Por quê |
|---|---|---|
| App | Expo + React Native Web + Expo Router (TypeScript) | Uma base de código para web, iOS e Android. |
| API | Node 22 + Fastify + Zod | Leve, tipada, roda no container da nuvem. |
| Banco | SQLite + FTS5 | Zero serviço externo no protótipo; migrável para Postgres. |
| IA | `@anthropic-ai/sdk`, `claude-sonnet-5-5`, *tool use* + visão | Assistente que age (cria, busca, edita) e lê fotos. |
| Voz | Web Speech API (entrada) e `speechSynthesis`/`expo-speech` (saída) | Sem custo e sem chave no protótipo. |
| Testes | Vitest + Playwright | Lógica pura testada sem UI; fluxos reais no navegador. |

A IA é uma interface (`AiProvider`) com duas implementações — Claude e demo — escolhida pela presença da chave.
O núcleo do editor de mapas (`MindEditorCore`) e as operações do mapa são puros e testados sem React.

## Segurança

Senhas com `scrypt` (salt por usuário); tokens de sessão e de recuperação de 256 bits guardados só como hash SHA-256;
limite de tentativas em login e redefinição; a rota “esqueci a senha” responde igual exista ou não o e-mail; código de uso
único com validade de 1 hora; toda consulta é filtrada por usuário; entradas validadas com Zod; chave da IA nunca vai ao cliente.
**Sem escalada de privilégio:** quem administra usuários, perfis ou recuperações só concede ou age sobre contas e perfis cujas
permissões administrativas ele próprio possui (`403 ESCALATION`); não é possível remover o último administrador nem agir sobre a
própria conta de forma destrutiva.

Para uso fora de um ambiente de teste, coloque a API atrás de **HTTPS** (proxy reverso) e faça backup do arquivo SQLite.

## Testes

```bash
npm test               # 249 testes: shared (38) + api (123) + app (88)
npm run build && npm run e2e   # 9 fluxos no navegador, com servidor e banco temporários; salva docs/screens/
```

O `e2e` percorre: primeiro acesso → captura e processamento com IA → notas, backlink, autocompletar e grafo → mapa mental
(Tab/Enter, arrastar, IA, persistência) → assistente → administração → troca obrigatória de senha → recuperação de senha → auditoria.
Requer o pacote `playwright` com Chromium.

## API (resumo)

`/api/auth/*` (login, logout, me, setup, change-password, forgot, reset) · `/api/admin/{users,profiles,recovery,audit}` ·
`/api/items` (+ `counts`, `:id/entries`) · `/api/areas` · `/api/calendar` · `/api/review/weekly|complete` · `/api/logbook` ·
`/api/notes` (+ `daily`, `:id/backlinks`, `:id/unlinked`) · `/api/templates` · `/api/search` · `/api/graph` ·
`/api/import` · `/api/export` · `/api/mindmaps` (+ `:id/to-notes`) ·
`/api/assistant/{chat,history,mode,settings,process-inbox,mindmap/expand,mindmap/generate}`. Erros: `{ "error": { "code", "message" } }`.

## Migrar para um repositório próprio

Esta pasta nasceu dentro de outro repositório. Para extrair o histórico só do app:

```bash
git subtree split --prefix=segundo-cerebro -b segundo-cerebro-only
git push git@github.com:SEU_USUARIO/segundo-cerebro.git segundo-cerebro-only:main
```

## Limites conhecidos e próximos passos

- **Verificado no navegador (web).** Os builds nativos iOS/Android compartilham o código, mas não foram executados neste ambiente.
- **Voz de entrada no celular nativo** (reconhecimento no app) e provedor de transcrição no servidor ficam para a fase 2; no
  celular, o microfone do teclado funciona no campo de texto. Ditado e fala dependem do navegador (Chrome/Edge/Safari).
- O vídeo com avatar foi descartado do escopo.
- Sem sincronização offline, notificações push, multiusuário compartilhado (notas/mapas são pessoais) ou cobrança.
- O limite do perfil **Membro** de manter o assistente é validado na interface; a API ainda permite editá-lo.
- Para crescer: Postgres no lugar do SQLite, fila para tarefas de IA longas e armazenamento de arquivos para fotos.

A especificação e o plano de implementação estão em `../docs/superpowers/specs` e `../docs/superpowers/plans`.

## Publicar (acessar do celular)

O repositório traz um `Dockerfile` (API + app web, porta 8787, SQLite em `/data`). No [Fly.io](https://fly.io):

```bash
cd segundo-cerebro
fly launch --no-deploy --copy-config      # ajuste o nome do app em fly.toml
fly volumes create cerebro_data --size 1 --region gru
fly secrets set ADMIN_EMAIL=voce@exemplo.com ADMIN_PASSWORD='uma-senha-longa' ANTHROPIC_API_KEY=sk-ant-...
fly deploy
```

O app fica em `https://<nome>.fly.dev` (HTTPS, necessário para microfone e câmera no celular). Qualquer serviço que rode
Docker com um volume em `/data` também serve (Railway, Render com disco, VPS). Sem `ANTHROPIC_API_KEY` o assistente fica em modo demo.

## APK de prévia (Android)

O app mobile precisa de um servidor público (veja "Publicar"). Em `apps/app/eas.json`, troque `EXPO_PUBLIC_API_URL` pela URL do
seu servidor (https) e gere o APK na nuvem do Expo (conta gratuita em expo.dev):

```bash
cd segundo-cerebro/apps/app
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

Ao final, o EAS mostra um link e um QR code para baixar o `.apk` e instalar no celular (permita "instalar de fontes desconhecidas").
