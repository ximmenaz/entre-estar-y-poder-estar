# Estado del proyecto · 26 de octubre de 2026

## Completado y conservado

- Una landing con navegación por scroll, hero, investigación, leyenda, exploración, comparación, hallazgos y reflexión.
- Ocho PNG territoriales originales y su selección en una sola escena.
- Código cromático estable: verde/costo, azul/transporte, naranja/comodidad, rojo/seguridad y morado/permanencia.
- Tres tamaños sólidos, SVG originales, título en un solo color y ausencia de barra técnica.
- Siete tarjetas expandibles con los textos originales, controles ARIA y uso mediante tap/teclado.
- Carrusel de 32 fotografías locales con flechas, contador, desplazamiento horizontal y ampliación sin recortes.
- Motor de audio sostenido, ondas durante reproducción y alternativa accesible de reproducir/pausar.
- Animaciones escalonadas y anotaciones preparadas para niveles documentados, sin puntos ni coordenadas inventados.

## Ajustes de esta continuación

- Las valoraciones ausentes se presentan con guiones y un resumen único, sin cinco bloques vacíos ni ocho etiquetas repetidas en comparación.
- La comparación distribuye los ocho mapas en cuatro columnas amplias y dos en móvil.
- Los diez sonidos sin procedencia territorial permanecen en el archivo general; los mapas no los reciben automáticamente. Se exige procedencia documentada para habilitar un audio territorial.
- Se preparan copias completas de las fotografías sin metadatos privados de ubicación. Los originales locales permanecen intactos y fuera de Git.
- Se reutiliza el repositorio existente y su historial; el respaldo utiliza una rama separada de la que publica Pages.

## Información pendiente

- Hay 40 campos de nivel (`8 territorios × 5 variables`) sin valoración documentada. No son valores perdidos por una falla de conexión: el JSON está preparado y contiene `sin_dato`/`null`.
- El registro específico de Parque México es una observación cualitativa de permanencia, sin nivel asignado.
- Los siete hallazgos son transversales. No se convierten automáticamente en niveles ni se atribuyen por defecto a cada zona.
- Las fotografías y los diez audios conservan su alcance documentado; los nombres de archivo no prueban dónde se registraron.

## GitHub y publicación

Repositorio existente: <https://github.com/ximmenaz/entre-estar-y-poder-estar>.

El equipo confirmó que debe mantenerse público. `main` ya tiene GitHub Pages activo. La continuación se respalda en `codex/continuar-atlas-2026-10-26`; no se realiza una publicación nueva ni se modifica el historial de `main`.

Los archivos ejecutables del sitio usan las copias completas de fotografías sin GPS. Los crudos de `fotos_smalldata/` permanecen locales; no se incluyen credenciales, cachés ni capturas de revisión.

## Verificación de esta continuación

- 28 pruebas de JavaScript y 3 de fotografías aprobadas.
- Revisión en navegador de los ocho mapas, las siete tarjetas, navegación del carrusel, ampliación de fotografías y reproducción sostenida sin autoplay.
- Sin desbordamiento horizontal ni imágenes rotas en anchos de 320, 390, 768, 1024 y 1440 px.
- El conjunto preparado para el respaldo no contiene GPS en imágenes ni credenciales detectadas; excluye crudos y capturas locales.
