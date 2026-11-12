#!/usr/bin/env node
/**
 * Teste de ponta a ponta: sobe o servidor com um banco temporário, percorre os fluxos principais no
 * navegador (Playwright) e salva capturas de tela em docs/screens/.
 *   npm run build && npm run e2e
 * Requer o pacote `playwright` com um Chromium instalado.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = createRequire(import.meta.url)('playwright');
const PORT = Number(process.env.E2E_PORT ?? 8799);
const BASE = `http://localhost:${PORT}`;
const SHOTS = join(root, 'docs/screens');
if (!existsSync(join(root, 'apps/app/dist/index.html'))) { console.error('Rode "npm run build" antes do e2e.'); process.exit(2); }
mkdirSync(SHOTS, { recursive: true });

if ((await fetch(`${BASE}/api/auth/setup-status`).then(() => true, () => false))) { console.error(`A porta ${PORT} já está em uso; defina E2E_PORT.`); process.exit(2); }

const tmp = mkdtempSync(join(tmpdir(), 'cerebro-e2e-'));
const server = spawn(process.execPath, [join(root, 'node_modules/tsx/dist/cli.mjs'), 'apps/api/src/main.ts'], { cwd: root, detached: true, env: { ...process.env, PORT: String(PORT), DB_PATH: join(tmp, 'e2e.sqlite'), ADMIN_EMAIL: '', ADMIN_PASSWORD: '', ANTHROPIC_API_KEY: '' }, stdio: 'ignore' });
const stop = () => { try { process.kill(-server.pid, 'SIGTERM'); } catch { server.kill('SIGTERM'); } rmSync(tmp, { recursive: true, force: true }); };
process.on('exit', stop);

const results = [];
let browser;
try {
  for (let i = 0; ; i++) {
    try { if ((await fetch(`${BASE}/api/auth/setup-status`)).ok) break; } catch { /* ainda subindo */ }
    if (i > 60) throw new Error('servidor não subiu');
    await new Promise(r => setTimeout(r, 500));
  }
  browser = await chromium.launch();
  const pages = [];
  const newPage = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const p = await ctx.newPage(); pages.push(p); return p;
  };
  const see = (p, t, ms = 12000) => p.locator(`text=${t} >> visible=true`).first().waitFor({ timeout: ms });
  const shot = (p, name) => p.screenshot({ path: join(SHOTS, `${name}.png`) });
  const step = async (name, fn) => {
    const t0 = Date.now();
    try { await fn(); results.push([true, name]); console.log(`ok    ${name} (${Date.now() - t0} ms)`); }
    catch (e) { results.push([false, name]); console.log(`FALHA ${name}\n      ${String(e.message).split('\n')[0]}`); }
  };
  const login = async (p, email, pw) => { await p.goto(`${BASE}/login`); await p.getByLabel('E-mail').fill(email); await p.getByLabel('Senha').fill(pw); await p.getByTestId('login-submit').click(); };
  const secret = async (p) => (await p.getByTestId('secret-value').locator('visible=true').first().innerText()).trim();
  const editing = (p) => p.waitForFunction(() => { const e = document.activeElement; return !!e && e.getAttribute('aria-label') === 'Texto do nó' && e.value === 'Novo nó' && e.selectionStart === 0 && e.selectionEnd === e.value.length; });
  const node = (p, t) => p.getByRole('button', { name: new RegExp(`^Nó ${t}`) }).locator('visible=true').first();

  const admin = await newPage();
  await step('primeiro acesso cria o administrador', async () => {
    await admin.goto(BASE); await see(admin, 'Primeiro acesso'); await shot(admin, '01-primeiro-acesso');
    await admin.getByLabel('Nome').fill('Dona do Sistema'); await admin.getByLabel('E-mail').fill('admin@exemplo.com');
    await admin.getByLabel('Senha (mín. 10 caracteres)').fill('senha-do-admin-123'); await admin.getByRole('button', { name: 'Criar administrador' }).click();
    await see(admin, 'Caixa de entrada.');
  });

  await step('capturar item e processar a caixa de entrada com IA (demo)', async () => {
    await admin.getByRole('button', { name: 'Capturar item' }).first().click();
    await admin.getByPlaceholder('O que está na sua cabeça?').fill('Ligar para o dentista amanhã'); await admin.getByRole('button', { name: 'Salvar' }).click();
    await see(admin, 'Capturado na caixa de entrada');
    for (const t of ['Aguardar resposta do João', 'Projeto reforma da casa']) { await admin.getByPlaceholder('Adicionar item…').fill(t); await admin.getByRole('button', { name: 'Adicionar' }).first().click(); await see(admin, t); }
    await shot(admin, '02-caixa-de-entrada');
    await admin.getByTestId('process-inbox').click(); await see(admin, 'Revise as sugestões'); await admin.waitForTimeout(500); await shot(admin, '03-processar-com-ia');
    await admin.getByRole('button', { name: 'Aplicar 3' }).click(); await see(admin, 'Sua caixa de entrada está vazia.');
    await admin.getByRole('link', { name: 'Próxima ação' }).click(); await see(admin, 'Ligar para o dentista amanhã');
  });

  await step('notas: wikilink, backlink, autocompletar e grafo', async () => {
    await admin.getByRole('button', { name: 'Biblioteca' }).click(); await see(admin, 'Escreva em Markdown');
    await admin.getByTestId('new-note').click(); await admin.getByLabel('Título da nota').fill('Receitas'); await admin.getByLabel('Conteúdo da nota').fill('bolo de cenoura #cozinha'); await see(admin, 'Salvo', 8000);
    await admin.getByRole('link', { name: 'Todas as notas' }).click(); await admin.getByTestId('new-note').click();
    await admin.getByLabel('Título da nota').fill('Projeto Aurora'); const ed = admin.getByLabel('Conteúdo da nota'); await ed.click(); await ed.pressSequentially('Ver [[Rec');
    await admin.getByRole('button', { name: 'Receitas' }).click(); await see(admin, 'Salvo', 8000); await shot(admin, '04-nota-com-links');
    await admin.getByRole('link', { name: 'Receitas' }).first().click(); await see(admin, 'Backlinks · 1');
    await admin.getByRole('link', { name: 'Grafo' }).first().click(); await see(admin, '2 notas · 1 ligações'); await shot(admin, '05-grafo');
    await admin.keyboard.press('Control+k'); await admin.getByLabel('Paleta de comandos').fill('cenoura'); await see(admin, 'bolo de cenoura #cozinha'); await shot(admin, '06-paleta-de-comandos'); await admin.keyboard.press('Escape');
  });

  await step('mapa mental interativo: Tab/Enter, arrastar e persistir', async () => {
    await admin.getByRole('link', { name: 'Mapas mentais' }).first().click(); await admin.getByTestId('new-mindmap').click();
    await node(admin, 'Novo mapa mental').waitFor(); await node(admin, 'Novo mapa mental').click();
    for (const [key, text] of [['Tab', 'Ideias'], ['Enter', 'Passos'], ['Tab', 'Passo 1']]) { await admin.keyboard.press(key); await editing(admin); await admin.keyboard.type(text); await admin.keyboard.press('Enter'); await node(admin, text).waitFor(); }
    const box = await node(admin, 'Ideias').boundingBox();
    await admin.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await admin.mouse.down(); await admin.mouse.move(box.x + 90, box.y - 100, { steps: 8 }); await admin.mouse.up();
    await node(admin, 'Passos').click(); await admin.getByRole('button', { name: 'Expandir com IA' }).click(); await see(admin, 'novos nós');
    await admin.getByRole('button', { name: 'Ajustar' }).click(); await admin.waitForTimeout(400); await see(admin, 'Salvo', 8000); await shot(admin, '07-mapa-mental');
    // regressão: "Ajustar" precisa enquadrar todos os nós dentro da área do mapa (o navegador não pode ter rolado o contêiner)
    const area = await admin.getByLabel('Minimapa').locator('visible=true').first().evaluate(e => { const r = e.parentElement.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; });
    for (const t of ['Novo mapa mental', 'Ideias', 'Passos', 'Passo 1']) {
      const bb = await node(admin, t).boundingBox();
      if (bb.x < area.l - 2 || bb.x + bb.width > area.r + 2 || bb.y < area.t - 2 || bb.y + bb.height > area.b + 2) throw new Error(`"${t}" ficou fora da área após Ajustar`);
    }
    await admin.reload(); await node(admin, 'Passo 1').waitFor({ timeout: 15000 });
  });

  await step('assistente (modo demo) registra uma anotação', async () => {
    await admin.getByRole('link', { name: 'Assistente' }).first().click(); await see(admin, 'Fale ou escreva. Eu organizo.');
    await admin.getByLabel('Mensagem para o assistente').fill('anota: comprar pão'); await admin.getByRole('button', { name: 'Enviar' }).click(); await see(admin, 'Anotado na caixa de entrada'); await see(admin, 'Item criado'); await shot(admin, '08-assistente');
  });

  let temp;
  await step('administração: criar usuário e entregar a senha temporária', async () => {
    await admin.getByRole('link', { name: 'Administração' }).click(); await see(admin, 'Quem tem acesso e com qual perfil.');
    await admin.getByTestId('new-user').click(); await admin.getByLabel('Nome').fill('Ana Souza'); await admin.getByLabel('E-mail').fill('ana@exemplo.com'); await admin.getByTestId('save-user').click();
    await see(admin, 'Usuário criado'); temp = await secret(admin); await admin.getByRole('button', { name: 'Já anotei, fechar' }).click(); await shot(admin, '09-admin-usuarios');
    await admin.getByRole('tab', { name: 'Perfis', exact: true }).click(); await see(admin, 'Defina o que cada tipo de usuário pode fazer.'); await admin.getByRole('button', { name: /Perfil Membro/ }).click(); await shot(admin, '10-admin-perfis');
  });

  const ana = await newPage();
  await step('usuário novo troca a senha temporária e não vê a administração', async () => {
    await login(ana, 'ana@exemplo.com', temp); await see(ana, 'Defina uma nova senha');
    await ana.getByLabel('Senha atual (temporária)').fill(temp); await ana.getByLabel('Nova senha (mín. 10 caracteres)').fill('senha-da-ana-123'); await ana.getByRole('button', { name: 'Salvar nova senha' }).click();
    await see(ana, 'Caixa de entrada.'); if (await ana.getByRole('link', { name: 'Administração' }).count()) throw new Error('membro enxerga a administração');
  });

  const anon = await newPage();
  await step('recuperação de senha: pedido → aprovação do admin → código → nova senha', async () => {
    await anon.goto(`${BASE}/forgot`); await anon.getByLabel('E-mail').fill('ana@exemplo.com'); await anon.getByRole('button', { name: 'Solicitar recuperação' }).click(); await see(anon, 'Se o e-mail estiver cadastrado');
    await admin.getByRole('tab', { name: /Recuperação de senha/ }).click(); await see(admin, 'ana@exemplo.com'); await admin.getByRole('button', { name: 'Aprovar' }).click(); await see(admin, 'Código de recuperação');
    const code = await secret(admin); await shot(admin, '11-admin-recuperacao'); await admin.getByRole('button', { name: 'Já anotei, fechar' }).click();
    await anon.goto(`${BASE}/reset`); await anon.getByLabel('E-mail').fill('ana@exemplo.com'); await anon.getByLabel('Código').fill(code); await anon.getByLabel('Nova senha').fill('outra-senha-da-ana'); await anon.getByRole('button', { name: 'Redefinir senha' }).click();
    await see(anon, 'Entrar'); await login(anon, 'ana@exemplo.com', 'outra-senha-da-ana'); await see(anon, 'Caixa de entrada.');
  });

  await step('auditoria registra as ações', async () => {
    await admin.getByRole('tab', { name: 'Auditoria', exact: true }).click(); await see(admin, 'Acessos e ações administrativas');
    for (const t of ['Usuário criado', 'Recuperação aprovada', 'Senha redefinida']) await see(admin, t, 5000);
  });
} catch (e) {
  console.error('Erro fatal no e2e:', e.message);
  results.push([false, 'execução']);
} finally {
  await browser?.close();
  stop();
}
const failed = results.filter(r => !r[0]);
console.log(`\n${results.length - failed.length}/${results.length} passos ok${failed.length ? ' — falhas: ' + failed.map(f => f[1]).join('; ') : ''}`);
process.exit(failed.length ? 1 : 0);
