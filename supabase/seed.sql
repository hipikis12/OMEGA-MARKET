-- Dados de demonstração (opcional). Rode depois de 0001_init.sql.
-- Troque/arquive estes produtos antes de vender de verdade.
insert into public.categories(slug, name, icon, position) values
  ('templates', 'Templates & UI',   '▦', 1),
  ('ebooks',    'E-books',          '▤', 2),
  ('cursos',    'Cursos',           '▶', 3),
  ('software',  'Software & Licenças', '⌘', 4),
  ('audio',     'Áudio & Música',   '♪', 5)
on conflict (slug) do nothing;

insert into public.products(slug, title, subtitle, description, category, price_cents, compare_cents, delivery, features, status, featured) values
  ('kit-ui-aurora', 'Kit UI Aurora', '120 componentes para dashboards modernos',
   'Biblioteca completa de componentes em Figma e HTML/CSS, com modo escuro, tokens de design e documentação de uso.',
   'templates', 9790, 14900, 'download', array['Arquivos Figma + HTML','Modo claro e escuro','Atualizações gratuitas'], 'published', true),
  ('ebook-marketing-digital', 'Guia de Marketing Digital 2027', 'Do zero às primeiras vendas online',
   'E-book de 180 páginas com estratégias práticas de tráfego, conteúdo e conversão para pequenos negócios.',
   'ebooks', 3990, null, 'download', array['PDF e EPUB','180 páginas','Planilhas bônus'], 'published', true),
  ('curso-flutter-pro', 'Curso Flutter Pro', 'Apps Android e iOS do zero ao deploy',
   'Mais de 40 horas de aulas em vídeo com projetos reais, Firebase, gerenciamento de estado e publicação nas lojas.',
   'cursos', 19700, 29700, 'download', array['40h de vídeo','Código-fonte dos projetos','Certificado'], 'published', true),
  ('omega-backup-pro', 'Omega Backup Pro', 'Licença vitalícia para 1 computador',
   'Software de backup incremental com criptografia AES-256 e agendamento. Você recebe a chave de ativação na biblioteca.',
   'software', 7990, null, 'license', array['Licença vitalícia','Criptografia AES-256','Suporte por e-mail'], 'published', false),
  ('pack-lofi-beats', 'Pack Lo-Fi Beats', '50 trilhas livres de royalties',
   'Trilhas em WAV e MP3 para vídeos, lives e podcasts, com licença de uso comercial.',
   'audio', 4990, 6990, 'download', array['50 faixas WAV + MP3','Uso comercial','Stems inclusos'], 'published', false)
on conflict (slug) do nothing;

insert into public.license_keys(product_id, code)
select id, 'OMEGA-' || upper(substr(md5(random()::text), 1, 5)) || '-' || upper(substr(md5(random()::text), 1, 5)) || '-' || upper(substr(md5(random()::text), 1, 5))
from public.products, generate_series(1, 20) where slug = 'omega-backup-pro'
on conflict do nothing;

insert into public.coupons(code, percent, expires_at, max_uses) values
  ('BEMVINDO10', 10, now() + interval '90 days', 500)
on conflict (code) do nothing;
