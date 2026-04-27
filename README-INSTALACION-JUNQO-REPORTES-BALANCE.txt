CORRECCIÓN JUNQO — REPORTES / BALANCE

Archivos incluidos:
1) reportes-balance-fix.js

Qué corrige:
- Hace funcionar los botones nuevos de Reportes:
  - Exportar PDF
  - Exportar Excel
  - Ver detalle
- Agrega descarga de Balance Excel y Balance CSV dentro del bloque de detalle.
- La exportación de Balance toma el Balance real del módulo Balance (#balance-table).
- No cambia diseño visual, sidebar, colores ni estilos base.
- No modifica app.js ni styles.css.

Instalación:
1) Sube reportes-balance-fix.js a la raíz del repositorio junqo-app.
2) Edita index.html.
3) Al final, antes de </body>, deja los scripts así:

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
<script src="supabaseClient.js"></script>
<script src="app.js"></script>
<script src="reportes-balance-fix.js"></script>
</body>

Validación:
1) Abrir la app publicada.
2) Entrar a Reportes.
3) Probar Exportar Excel.
4) Probar Exportar PDF.
5) Presionar Ver detalle.
6) Descargar Balance Excel o Balance CSV.
7) Confirmar que el archivo incluye el Balance General con:
   - Terreno
   - Obra en Curso
   - IVA Crédito Fiscal
   - Cuenta por pagar al Socio
   - Gastos por pagar
   - Totales

Nota:
El conector de GitHub permitió leer el repositorio, pero no escribir archivos directamente.
Por eso se entrega esta corrección como archivo listo para subir manualmente.
