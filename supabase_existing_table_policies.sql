-- Ejecutar en Supabase SQL Editor si la tabla existe y RLS bloquea la lectura.
-- Ajusta políticas según seguridad real antes de producción.

alter table public.gastos_junquillar_app enable row level security;

drop policy if exists "junqo_select_gastos" on public.gastos_junquillar_app;
create policy "junqo_select_gastos"
on public.gastos_junquillar_app
for select
to anon
using (proyecto = 'Junquillar');

-- Solo si quieres permitir inserciones desde la app pública.
drop policy if exists "junqo_insert_gastos" on public.gastos_junquillar_app;
create policy "junqo_insert_gastos"
on public.gastos_junquillar_app
for insert
to anon
with check (proyecto = 'Junquillar');
