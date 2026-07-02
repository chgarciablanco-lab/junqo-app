# García Blanco Family Office — Piloto Autos

App real conectada a Supabase (proyecto `garcia-blanco-family-office`).
Este piloto incluye: login y el módulo de Autos completo (listar, agregar, editar, eliminar).

## Cómo correrlo localmente

```bash
npm install
npm run dev
```

Abre el link que te muestre la terminal (normalmente http://localhost:5173).

## Cómo entrar

- Usuario: chgarciablanco@gmail.com
- Contraseña: (no se guarda en este repo — pídela por un canal privado).

**Importante:** si esta contraseña estuvo antes escrita en texto plano aquí, cámbiala
cuanto antes desde el dashboard de Supabase (Authentication → Users), ya que pudo quedar
expuesta. Considera además agregar una pantalla de "cambiar contraseña".

## Cómo desplegarlo (Vercel)

1. Sube esta carpeta a un repositorio de GitHub.
2. Conecta el repo en Vercel (Framework Preset: Vite).
3. Deploy. No necesitas variables de entorno adicionales — las claves de Supabase
   usadas aquí son la URL y la "anon key" pública, seguras para exponer en el frontend
   porque el acceso real está protegido por Row Level Security (RLS) en la base de datos.

## Base de datos

Proyecto Supabase: `garcia-blanco-family-office` (id: mlbbbskhoficppzisfqo)
Tabla: `public.autos`

RLS activo: solo usuarios autenticados (con cuenta creada en el proyecto) pueden
leer, crear, editar y eliminar autos. Por ahora cualquier usuario autenticado tiene
acceso total (pensado para el uso familiar entre ustedes 3).

## Siguientes pasos

Este es el módulo piloto. El resto de las pantallas que diseñamos (Sociedades,
Propiedades, Trabajadores, Impuestos, Arriendos, Inversiones, Otros gastos) se
conectan siguiendo exactamente el mismo patrón: tabla en Supabase + pantalla que
lee/escribe con `supabase.from('tabla')`.
