-- SQL limpio para GitHub Pages usando publishable/anon key.
-- Ejecutar en Supabase > SQL Editor > New query > Run.

insert into storage.buckets (id, name, public)
values ('comprobantes-junquillar', 'comprobantes-junquillar', true)
on conflict (id) do nothing;

drop policy if exists "junquillar_storage_insert_auth" on storage.objects;
drop policy if exists "junquillar_storage_select_auth" on storage.objects;
drop policy if exists "junquillar_storage_update_auth" on storage.objects;
drop policy if exists "cj_insert_auth" on storage.objects;
drop policy if exists "cj_select_auth" on storage.objects;
drop policy if exists "cj_update_auth" on storage.objects;
drop policy if exists "cj_delete_auth" on storage.objects;
drop policy if exists "Permitir subir archivos junquillar" on storage.objects;
drop policy if exists "Permitir leer archivos junquillar" on storage.objects;

create policy "Permitir subir archivos junquillar"
on storage.objects
for insert
to anon
with check (
  bucket_id = 'comprobantes-junquillar'
  and (
    name like 'junquillar/imagenes/%'
    or name like 'junquillar/pdf/%'
    or name like 'junquillar/planillas/%'
  )
);

create policy "Permitir leer archivos junquillar"
on storage.objects
for select
to anon
using (
  bucket_id = 'comprobantes-junquillar'
  and (
    name like 'junquillar/imagenes/%'
    or name like 'junquillar/pdf/%'
    or name like 'junquillar/planillas/%'
  )
);

alter table public.gastos_junquillar_app enable row level security;

drop policy if exists "gja_select_auth" on public.gastos_junquillar_app;
drop policy if exists "gja_insert_auth" on public.gastos_junquillar_app;
drop policy if exists "gja_update_auth" on public.gastos_junquillar_app;
drop policy if exists "gja_delete_auth" on public.gastos_junquillar_app;
drop policy if exists "Permitir insertar gastos junquillar app" on public.gastos_junquillar_app;
drop policy if exists "Permitir leer gastos junquillar app" on public.gastos_junquillar_app;

create policy "Permitir insertar gastos junquillar app"
on public.gastos_junquillar_app
for insert
to anon
with check (proyecto = 'Junquillar');

create policy "Permitir leer gastos junquillar app"
on public.gastos_junquillar_app
for select
to anon
using (proyecto = 'Junquillar');
