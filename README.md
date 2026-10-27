# Entre estar y PODER estar

Atlas editorial interactivo de Small Data sobre condiciones de habitabilidad en ocho territorios de Cuauhtémoc, CDMX. HTML, CSS y JavaScript, en una sola página y sin compilación.

El [estado del proyecto](ESTADO_DEL_PROYECTO.md) distingue lo completado, los ajustes de esta continuación y los datos que todavía faltan.

## Vista previa

Desde la carpeta del proyecto:

```sh
python3 -m http.server 4187 --bind 127.0.0.1
```

Abrir <http://127.0.0.1:4187>. Se necesita HTTP para cargar los JSON y módulos; no abrir `index.html` por doble clic. Ctrl+C detiene el servidor. Montserrat y Caveat se solicitan a Google Fonts; el resto de los recursos está dentro del proyecto.

## Componentes conservados

Hero, investigación, leyenda, selección de ocho territorios, mapas originales completos, comparación, siete tarjetas expandibles, carrusel de 32 fotografías, archivo sonoro de diez grabaciones y reflexión final. El desplazamiento vertical permanece libre. No hay cuentas, formularios ni aportaciones de visitantes.

La navegación territorial actualiza una sola escena; no crea ocho páginas. Las anotaciones cierran con Escape y devuelven el foco. Los controles admiten teclado y tap. Se respeta `prefers-reduced-motion`.

## Identidad de Small Data

| Variable | Color | Tono de referencia |
| --- | --- | --- |
| Costo | Verde | `#4ca239` |
| Transporte | Azul | `#1f4fdf` |
| Comodidad | Naranja | `#fcaa3f` |
| Seguridad percibida | Rojo | `#f14e4c` |
| Permanencia | Morado | `#8e55f5` |

La correspondencia procede de las indicaciones del equipo. Los tonos se extrajeron de `referencia.png`; las coordenadas de las muestras están documentadas en `identidad_small_data`, dentro del JSON territorial. Los colores cartográficos de los ocho mapas se conservan independientemente.

Los tamaños de las siluetas originales `pequeña.svg`, `mediana.svg` y `grande.svg` equivalen a bajo, medio y alto; los puntos principales miden aproximadamente 28, 45 y 62 px. Se utilizan máscaras CSS para aplicar el color de cada variable sin modificar los SVG. No hay degradados ni donas. Un nivel alto de costo significa mayor gasto, no una condición más favorable.

## Datos y procedencia

- `data/territorios.json`: identidad, mapas, categorías, observaciones cualitativas, siete hallazgos transversales y archivo sonoro.
- `data/territorios_small_data_preliminar.json`: cinco variables por cada uno de los ocho territorios.
- `data/galeria.json`: inventario de las fotografías y sus copias visualizables.

Actualmente las **40 valoraciones de nivel están pendientes**, con `nivel: null` y `estado: sin_dato`. No se recibió el archivo original de valoraciones mencionado en una solicitud anterior; la plantilla está identificada como tal. Esto no convierte la investigación de campo en una simulación: se conservan las fotografías, los hallazgos y la observación cualitativa de Parque México.

Los niveles no se deducen de reputaciones, imágenes o nombres de archivo. Los ejemplos de las pruebas unitarias nunca se incorporan a los JSON que consume la página.

### Incorporar valoraciones

Editar en el JSON complementario el territorio y una de estas claves: `costo`, `transporte`, `comodidad`, `seguridad`, `permanencia`.

```json
{
  "nivel": null,
  "estado": "sin_dato",
  "observacion": null,
  "origen": null,
  "referencias_secundarias": [],
  "informacion_pendiente": []
}
```

Con un registro real, `nivel` admite 1, 2 o 3. `observacion_usuario` se rotula **Observación del equipo**; `hipotesis`, **Valoración preliminar**. Ambos requieren observación y origen. `sin_dato` requiere `nivel: null` y se representa mediante un guion. La ausencia se explica una sola vez y no genera tarjetas vacías ni círculos pequeños.

La escena muestra primero el PNG y luego los niveles disponibles, en el orden cromático de la leyenda, mediante opacidad y crecimiento desde escala 0.4. Los iconos contextuales se revelan después. Los pulsos son lentos y escalonados; indican información disponible, no mediciones nuevas.

Las anotaciones muestran variable, nivel, territorio, significado, observación, origen y estado. Las observaciones generales se mantienen junto al mapa; un punto sobre el PNG necesita una posición reconocible y documentada que coincida exactamente con la imagen de la escena.

La portada también exige `posicion_mapa_general` documentada para superponer un registro. Si un círculo ya pertenece a la imagen, `integrado_en_imagen: true` genera solo un área interactiva transparente. No se generan coordenadas de muestra ni puntos duplicados.

### Observaciones cualitativas

La observación de Parque México está en `registros` del JSON principal. Describe permanencia sin consumo en el contexto del recorrido, sin asignar un nivel. Los siete hallazgos del equipo conservan separados el texto observado y su interpretación. No se distribuyen automáticamente entre territorios.

## Fotografías

El carrusel conserva la proporción de las imágenes, muestra parcialmente la siguiente y dispone de flechas, contador, scroll horizontal nativo/swipe y teclas izquierda/derecha, Home y End. No tiene reproducción automática. Un clic abre la fotografía completa en un diálogo dentro de la página.

Para agregar fotografías locales:

```sh
python3 tools/actualizar_galeria.py
```

La carpeta de entrada es `fotos_smalldata/`; se admiten JPG, JPEG, PNG y WebP. Los HEIC se conservan localmente y sus versiones JPEG son las que utiliza la web. El generador mantiene territorio, fecha y descripción cuando ya estén documentados; no los infiere.

### Copias sin metadatos de ubicación

Se detectaron metadatos GPS en 26 fotografías. Los originales de `fotos_smalldata/` permanecen locales y están excluidos de Git. Las copias de resolución completa de `assets/fotografias-completas/` se incluyen en el respaldo y se usan al ampliar imágenes.

En JPEG se retiran EXIF privado, IPTC, XMP y comentarios, conservando únicamente la orientación necesaria y los segmentos de color. **El flujo de píxeles JPEG comprimido no se vuelve a codificar.** Las pruebas comparan esos bytes con los originales. No se alteran visualmente las fotografías.

`archivo_origen` conserva la ruta de autoría local; `original` señala la copia completa compartible y `imagen` la vista optimizada. `assets/galeria/` contiene copias WebP de hasta 1500 px. Pillow es opcional para las miniaturas JPEG y necesario para exportar nuevos PNG/WebP sin metadatos. En un clon sin los originales locales se conservan el manifiesto y las copias compartibles existentes.

## Sonido

Según la indicación más reciente, los diez archivos sin procedencia territorial documentada **permanecen en el archivo general del proyecto**. No se asignan a los ocho mapas por sus títulos ni por disponibilidad.

El archivo general tiene el botón **Mantén presionado para escuchar la ciudad**, con `sonido.svg`, selector y alternativa reproducir/pausar. Mantener mouse, dedo, Espacio o Enter inicia la grabación; soltar pausa inmediatamente. Las ondas aparecen solo durante reproducción. Cancelación, salida del control, pérdida de foco, cambio de visibilidad, territorio o sección detienen el sonido. Solo puede reproducirse una grabación a la vez.

Las rutas y metadatos están en `archivo.audios`, dentro de `data/territorios.json`:

- `alcance: general` y `territorio: null`: archivo general sin atribución geográfica.
- `alcance: territorial`, un ID territorial válido y `procedencia_territorial` documentada: habilitan el control en ese mapa.
- `lugar_registrado`, `descripcion`, `duracion` y `posicion`: solo cuando están disponibles. La duración actual es una estimación técnica leída del archivo.

Los archivos admitidos son MP3, WAV, M4A y OGG. `ruta` y `archivo` se reconocen como nombres alternativos del campo de recurso. `audios_territoriales` es una lista complementaria opcional. No se usan grabaciones externas ni se inventan lugares.

## Archivos de implementación

`index.html`, `styles.css` y `script.js` definen la página. `small-data.mjs` valida niveles y procedencia; `field-gallery.mjs` gestiona el carrusel; `territorial-audio.mjs` controla audio y asociaciones. Los originales de mapas y símbolos están en `mapas_nvos/` e `iconos/`, sin retoques.

`tools/actualizar_galeria.py` actualiza el archivo fotográfico y `tools/exportar_fotos_seguras.py` prepara copias compartibles. `tools/preparar_recursos.py` es un helper histórico de recursos anteriores y no se necesita para ejecutar esta versión.

## Verificación

```sh
node --test tools/tests/*.test.mjs
python3 -m unittest discover -s tools/tests -p 'test_*.py'
node --input-type=module --check < script.js
```

Las pruebas cubren colores y tamaños, estados, ausencia de coordenadas ficticias, descarte de ejemplos técnicos, audio sostenido y accesible, limpieza al soltar y cambiar contexto, alcance sonoro y archivo fotográfico completo sin GPS. La revisión en navegador comprueba mapas, tarjetas, carrusel, audio y tamaños de 320 a 1440 px.

## Respaldo en GitHub

Se reutiliza el repositorio público existente <https://github.com/ximmenaz/entre-estar-y-poder-estar>, por indicación del equipo. Su rama `main` ya publica GitHub Pages. Esta continuación se sincroniza en `codex/continuar-atlas-2026-10-26` para no activar una publicación nueva. No se modifica la configuración de Pages ni se reescribe el historial.

Los archivos crudos con metadatos GPS, cachés, capturas locales y credenciales quedan excluidos. El respaldo incluye código, ocho PNG, SVG, JSON, fotografías compartibles, audios y recursos necesarios para ejecutar la página.
