import { z, type ZodTypeAny } from 'zod';
import { randomUUID } from 'node:crypto';
import { addChild, fromOutlineMarkdown, mindmapSchema, type MindMap, type Permission } from '@cerebro/shared';
import type { Deps } from '../deps';
import type { ToolDef } from './provider';
import { createItem } from '../modules/items/repo';
import { cleanTitle, createNote } from '../modules/notes/repo';
import { search } from '../modules/notes/graph';

export type ToolCtx = { deps: Deps; userId: string; permissions: Permission[] };

type Tool = { name: string; description: string; perm?: Permission; schema: ZodTypeAny; json: Record<string, unknown>; exec: (c: ToolCtx, a: any) => unknown };

const prop = (type: string, description: string, extra: object = {}) => ({ type, description, ...extra });
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, required });
const iso = z.string().datetime({ offset: true });

export function loadOwnedMap(c: ToolCtx, id: string): { row: any; map: MindMap } {
  const row = c.deps.db.prepare('select * from mindmaps where id=? and user_id=?').get(id, c.userId) as any;
  if (!row) throw new Error('Mapa mental não encontrado');
  return { row, map: JSON.parse(row.graph_json) as MindMap };
}

function saveMap(c: ToolCtx, id: string, map: MindMap): void {
  const ok = mindmapSchema.safeParse(map);
  if (!ok.success) throw new Error('Mapa resultante inválido');
  c.deps.db.prepare('update mindmaps set graph_json=?, updated_at=? where id=?').run(JSON.stringify(ok.data), c.deps.now().toISOString(), id);
}

function addChildren(c: ToolCtx, mindmapId: string, parentId: string | undefined, texts: string[]): number {
  const { map } = loadOwnedMap(c, mindmapId);
  const parent = parentId ?? map.rootId;
  if (!map.nodes[parent]) throw new Error('Nó não encontrado');
  let cur = map;
  for (const t of texts) cur = addChild(cur, parent, t.trim().slice(0, 500)).map;
  saveMap(c, mindmapId, cur);
  return texts.length;
}

const TOOLS: Tool[] = [
  {
    name: 'criar_item', description: 'Cria uma tarefa/ideia na caixa de entrada do usuário.', perm: 'items.write',
    schema: z.object({ title: z.string().trim().min(1), body: z.string().optional(), status: z.enum(['inbox', 'next', 'waiting', 'someday']).optional(), dueAt: iso.optional() }),
    json: obj({ title: prop('string', 'Título curto'), body: prop('string', 'Detalhes'), status: prop('string', 'inbox, next, waiting ou someday', { enum: ['inbox', 'next', 'waiting', 'someday'] }), dueAt: prop('string', 'Data/hora ISO 8601 (opcional)') }, ['title']),
    exec: (c, a) => { const i = createItem(c.deps, c.userId, { title: a.title, body: a.body, status: a.status, dueAt: a.dueAt }); return { ok: true, id: i.id, title: i.title, status: i.status }; },
  },
  {
    name: 'criar_nota', description: 'Cria uma nota em Markdown na biblioteca. Use [[Título]] para ligar a outras notas.', perm: 'notes.write',
    schema: z.object({ title: z.string().trim().min(1), body: z.string().max(100_000).optional() }),
    json: obj({ title: prop('string', 'Título da nota'), body: prop('string', 'Conteúdo em Markdown') }, ['title']),
    exec: (c, a) => { const title = cleanTitle(a.title) || 'Sem título'; const n = createNote(c.deps, c.userId, { title, body: a.body }); return { ok: true, id: n.id, title: n.title }; },
  },
  {
    name: 'criar_evento', description: 'Agenda um evento no calendário.', perm: 'items.write',
    schema: z.object({ title: z.string().trim().min(1), startAt: iso, endAt: iso.optional() }),
    json: obj({ title: prop('string', 'Título'), startAt: prop('string', 'Início ISO 8601'), endAt: prop('string', 'Fim ISO 8601 (opcional)') }, ['title', 'startAt']),
    exec: (c, a) => { const i = createItem(c.deps, c.userId, { title: a.title, kind: 'event', status: 'next', startAt: a.startAt, endAt: a.endAt }); return { ok: true, id: i.id }; },
  },
  {
    name: 'listar_agenda', description: 'Lista itens com data entre duas datas (padrão: próximos 7 dias).',
    schema: z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
    json: obj({ from: prop('string', 'YYYY-MM-DD'), to: prop('string', 'YYYY-MM-DD') }),
    exec: (c, a) => {
      const from = a.from ?? c.deps.now().toISOString().slice(0, 10);
      const to = a.to ?? new Date(Date.parse(from) + 7 * 86400_000).toISOString().slice(0, 10);
      const rows = c.deps.db.prepare(
        `select id, title, kind, status, coalesce(start_at, due_at) w from items
         where user_id=? and status not in ('done','trashed') and coalesce(start_at, due_at) is not null
           and substr(coalesce(start_at, due_at),1,10) between ? and ? order by w`,
      ).all(c.userId, from, to) as any[];
      return { items: rows.map(r => ({ id: r.id, title: r.title, kind: r.kind, status: r.status, when: r.w })) };
    },
  },
  {
    name: 'buscar', description: 'Busca por texto nas notas e itens do usuário.',
    schema: z.object({ q: z.string().trim().min(1) }),
    json: obj({ q: prop('string', 'Termos de busca') }, ['q']),
    exec: (c, a) => search(c.deps, c.userId, a.q),
  },
  {
    name: 'resumir_nota', description: 'Lê o conteúdo de uma nota (por id ou título) para resumi-la.',
    schema: z.object({ noteId: z.string().optional(), title: z.string().optional() }).refine(v => v.noteId || v.title, 'Informe noteId ou title'),
    json: obj({ noteId: prop('string', 'Id da nota'), title: prop('string', 'Título da nota') }),
    exec: (c, a) => {
      const r = (a.noteId
        ? c.deps.db.prepare('select title, body_md from notes where id=? and user_id=?').get(a.noteId, c.userId)
        : c.deps.db.prepare('select title, body_md from notes where user_id=? and lower(title)=lower(?) order by created_at, rowid limit 1').get(c.userId, a.title)) as any;
      if (!r) throw new Error('Nota não encontrada');
      return { title: r.title, body: String(r.body_md).slice(0, 8000) };
    },
  },
  {
    name: 'adicionar_ao_mapa', description: 'Adiciona nós filhos a um mapa mental existente.', perm: 'notes.write',
    schema: z.object({ mindmapId: z.string(), parentNodeId: z.string().optional(), texts: z.array(z.string().trim().min(1)).min(1).max(30) }),
    json: obj({ mindmapId: prop('string', 'Id do mapa'), parentNodeId: prop('string', 'Nó pai (padrão: raiz)'), texts: { type: 'array', items: { type: 'string' }, description: 'Textos dos novos nós' } }, ['mindmapId', 'texts']),
    exec: (c, a) => ({ ok: true, added: addChildren(c, a.mindmapId, a.parentNodeId, a.texts) }),
  },
  {
    name: 'expandir_ramo', description: 'Expande um ramo do mapa mental com sugestões de sub-tópicos curtos.', perm: 'notes.write',
    schema: z.object({ mindmapId: z.string(), nodeId: z.string(), filhos: z.array(z.string().trim().min(1)).min(1).max(12) }),
    json: obj({ mindmapId: prop('string', 'Id do mapa'), nodeId: prop('string', 'Nó a expandir'), filhos: { type: 'array', items: { type: 'string' }, description: 'De 3 a 6 sub-tópicos curtos' } }, ['mindmapId', 'nodeId', 'filhos']),
    exec: (c, a) => ({ ok: true, added: addChildren(c, a.mindmapId, a.nodeId, a.filhos) }),
  },
  {
    name: 'gerar_mapa', description: 'Cria um mapa mental novo a partir de um outline em Markdown (# raiz, depois listas com "- ").', perm: 'notes.write',
    schema: z.object({ titulo: z.string().trim().min(1).max(200), outline: z.string().min(1).max(50_000) }),
    json: obj({ titulo: prop('string', 'Título do mapa'), outline: prop('string', 'Outline Markdown: "# Raiz" e itens "- ramo" com indentação de 2 espaços') }, ['titulo', 'outline']),
    exec: (c, a) => {
      const map = fromOutlineMarkdown(a.outline, a.titulo);
      const ok = mindmapSchema.safeParse(map);
      if (!ok.success) throw new Error('Outline inválido ou grande demais');
      const id = randomUUID();
      c.deps.db.prepare('insert into mindmaps(id,user_id,title,graph_json,updated_at) values(?,?,?,?,?)').run(id, c.userId, a.titulo, JSON.stringify(ok.data), c.deps.now().toISOString());
      return { ok: true, mindmapId: id, nodes: Object.keys(map.nodes).length };
    },
  },
];

export function buildTools(c: ToolCtx): { defs: ToolDef[]; run: (name: string, args: unknown) => Promise<string> } {
  const allowed = TOOLS.filter(t => !t.perm || c.permissions.includes(t.perm));
  return {
    defs: allowed.map(t => ({ name: t.name, description: t.description, input_schema: t.json })),
    async run(name, args) {
      const t = allowed.find(x => x.name === name);
      if (!t) return JSON.stringify({ error: `Ferramenta indisponível: ${name}` });
      const parsed = t.schema.safeParse(args);
      if (!parsed.success) return JSON.stringify({ error: 'Argumentos inválidos: ' + parsed.error.issues.map(i => `${i.path.join('.') || 'args'} ${i.message}`).join('; ') });
      try {
        return JSON.stringify(t.exec(c, parsed.data));
      } catch (e) {
        return JSON.stringify({ error: (e as Error).message });
      }
    },
  };
}
