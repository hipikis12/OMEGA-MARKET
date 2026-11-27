-- Categorias iniciais (opcional). Rode depois de 0001_init.sql.
-- Você pode editá-las depois em Administração › Ajustes.
insert into public.categories(slug, name, icon, position) values
  ('templates', 'Templates & UI',      '▦', 1),
  ('ebooks',    'E-books',             '▤', 2),
  ('cursos',    'Cursos',              '▶', 3),
  ('software',  'Software & Licenças', '⌘', 4),
  ('audio',     'Áudio & Música',      '♪', 5)
on conflict (slug) do nothing;
