create table profiles(
  id text primary key,
  name text not null unique,
  description text not null default '',
  permissions_json text not null default '[]',
  is_system integer not null default 0
);

create table users(
  id text primary key,
  email text not null unique,
  name text not null,
  password_hash text not null,
  profile_id text not null references profiles(id),
  status text not null default 'active' check (status in ('active','locked','invited')),
  must_change_password integer not null default 0,
  created_at text not null,
  last_login_at text,
  deleted_at text
);

create table sessions(
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at text not null,
  user_agent text,
  created_at text not null
);

create table password_recovery(
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','used','expired','denied')),
  token_hash text,
  requested_at text not null,
  resolved_by text,
  resolved_at text,
  expires_at text
);

create table audit_log(
  id integer primary key autoincrement,
  actor_id text,
  action text not null,
  target text,
  meta_json text,
  at text not null
);

create table areas(
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  name text not null,
  color text not null default '#6366f1'
);

create table items(
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  area_id text references areas(id) on delete set null,
  project_id text references items(id) on delete set null,
  title text not null,
  body text not null default '',
  kind text not null default 'task' check (kind in ('task','event','idea','checklist','project')),
  status text not null default 'inbox' check (status in ('inbox','next','waiting','someday','done','trashed')),
  due_at text,
  start_at text,
  end_at text,
  recurrence_rule text,
  waiting_on text,
  created_at text not null,
  completed_at text
);
create index items_user_status on items(user_id, status);

create table checklist_entries(
  id text primary key,
  item_id text not null references items(id) on delete cascade,
  text text not null,
  done integer not null default 0,
  position integer not null default 0
);

create table notes(
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  area_id text references areas(id) on delete set null,
  path text not null,
  title text not null,
  body_md text not null default '',
  frontmatter_json text not null default '{}',
  is_daily integer not null default 0,
  created_at text not null,
  updated_at text not null
);
create index notes_user_title on notes(user_id, title);

create table links(
  src_note_id text not null references notes(id) on delete cascade,
  dst_title text not null,
  dst_note_id text references notes(id) on delete set null
);
create index links_dst on links(dst_note_id);

create table tags(
  note_id text not null references notes(id) on delete cascade,
  tag text not null,
  primary key (note_id, tag)
);

create table templates(
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  name text not null,
  body_md text not null default ''
);

create table mindmaps(
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  title text not null,
  graph_json text not null,
  updated_at text not null
);

create table assistant_settings(
  user_id text primary key references users(id) on delete cascade,
  voice text,
  language text not null default 'pt-BR',
  rate real not null default 1,
  tone text not null default 'conciso',
  reply_mode text not null default 'both' check (reply_mode in ('text','audio','both')),
  model text
);

create table conversations(
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  created_at text not null
);

create table messages(
  id text primary key,
  conversation_id text not null references conversations(id) on delete cascade,
  role text not null,
  content_json text not null,
  created_at text not null
);

create table logbook(
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  at text not null,
  kind text not null,
  ref_id text,
  summary text not null
);

create virtual table notes_fts using fts5(title, body_md, content='notes', content_rowid='rowid');
create trigger notes_ai after insert on notes begin
  insert into notes_fts(rowid, title, body_md) values (new.rowid, new.title, new.body_md);
end;
create trigger notes_ad after delete on notes begin
  insert into notes_fts(notes_fts, rowid, title, body_md) values ('delete', old.rowid, old.title, old.body_md);
end;
create trigger notes_au after update on notes begin
  insert into notes_fts(notes_fts, rowid, title, body_md) values ('delete', old.rowid, old.title, old.body_md);
  insert into notes_fts(rowid, title, body_md) values (new.rowid, new.title, new.body_md);
end;

create virtual table items_fts using fts5(title, body, content='items', content_rowid='rowid');
create trigger items_ai after insert on items begin
  insert into items_fts(rowid, title, body) values (new.rowid, new.title, new.body);
end;
create trigger items_ad after delete on items begin
  insert into items_fts(items_fts, rowid, title, body) values ('delete', old.rowid, old.title, old.body);
end;
create trigger items_au after update on items begin
  insert into items_fts(items_fts, rowid, title, body) values ('delete', old.rowid, old.title, old.body);
  insert into items_fts(rowid, title, body) values (new.rowid, new.title, new.body);
end;
