#!/usr/bin/env python3
"""Actualiza todas las fotos compatibles del archivo local; nunca modifica originales.
Uso: python3 tools/actualizar_galeria.py [--carpeta fotos_smalldata]
Pillow es opcional: si está disponible genera copias WebP optimizadas.
"""
from pathlib import Path
import argparse
import hashlib
import json
from exportar_fotos_seguras import export_photo
try:
    from PIL import Image, ImageOps
except ImportError:
    Image = ImageOps = None

ROOT = Path(__file__).resolve().parent.parent
FORMATS = {'.jpg', '.jpeg', '.png', '.webp'}

def build_manifest(folder='fotos_smalldata'):
    source = (ROOT / folder).resolve()
    source.relative_to(ROOT)
    if not source.is_dir():
        if (ROOT/'data/galeria.json').is_file():
            print('Se conserva el manifiesto y las copias compartibles; los originales locales no están en este clon.');return json.loads((ROOT/'data/galeria.json').read_text())
        raise SystemExit('No existe la carpeta de fotografías: ' + str(source))
    target = ROOT / 'data' / 'galeria.json'
    previous = json.loads(target.read_text()) if target.exists() else {}
    known = {p.get('archivo_origen',p['original']): p for p in previous.get('fotografias', [])}
    base = json.loads((ROOT / 'data' / 'territorios.json').read_text())
    for photo in base.get('archivo', {}).get('fotografias', []):
        known.setdefault(photo.get('archivo_origen',photo['original']), photo)
    output = ROOT / 'assets' / 'galeria'
    output.mkdir(parents=True, exist_ok=True)
    photos, ignored = [], []
    scanned=set()
    files = sorted((p for p in source.rglob('*') if p.is_file() and not p.name.startswith('.')), key=lambda p: p.relative_to(source).as_posix().casefold())
    for path in files:
        if path.suffix.lower() not in FORMATS:
            ignored.append(path.relative_to(ROOT).as_posix())
            continue
        original = path.relative_to(ROOT).as_posix()
        scanned.add(original)
        shared=ROOT/'assets'/'fotografias-completas'/path.relative_to(source)
        export_photo(path,shared)
        old = known.get(original, {})
        image_path = shared.relative_to(ROOT).as_posix()
        width, height = old.get('ancho'), old.get('alto')
        if Image:
            try:
                with Image.open(path) as opened:
                    picture = ImageOps.exif_transpose(opened)
                    width, height = picture.size
                    digest = hashlib.sha256(original.encode()).hexdigest()[:10]
                    derivative = output / (digest + '.webp')
                    if not derivative.exists() or derivative.stat().st_mtime < path.stat().st_mtime:
                        picture.thumbnail((1500, 1500))
                        picture = picture.convert('RGBA' if 'A' in picture.getbands() else 'RGB')
                        picture.save(derivative, 'WEBP', quality=87)
                    image_path = derivative.relative_to(ROOT).as_posix()
            except (OSError, ValueError) as error:
                print('Se conserva la ruta original; no se pudo optimizar', path.name, str(error))
        elif old.get('imagen') and (ROOT / old['imagen']).is_file():
            image_path = old['imagen']
        photos.append({
            'id': old.get('id') or 'foto-' + hashlib.sha256(original.encode()).hexdigest()[:12],
            'nombre': path.name,
            'archivo_origen': original,
            'original': shared.relative_to(ROOT).as_posix(),
            'imagen': image_path,
            'ancho': width,
            'alto': height,
            'territorio': old.get('territorio'),
            'descripcion': old.get('descripcion'),
            'alt': old.get('alt') or 'Fotografía del archivo de recorridos del equipo: ' + path.name,
            'fuente': old.get('fuente') or 'Archivo fotográfico proporcionado por el equipo.',
            'fecha': old.get('fecha')
        })
    for old in previous.get('fotografias',[]):
        original=old.get('archivo_origen',old['original'])
        if original not in scanned and (ROOT/old['original']).is_file():photos.append(old)
    document = {'version': 2, 'carpeta_origen': source.relative_to(ROOT).as_posix(), 'formatos_compatibles': sorted(FORMATS), 'nota': 'Todas las fotografías compatibles de la carpeta. Los nombres de archivo no establecen ubicación ni fecha de recorrido. Se conservan las proporciones y los originales.', 'fotografias': photos, 'archivos_no_compatibles': ignored}
    target.write_text(json.dumps(document, ensure_ascii=False, indent=2) + '\n')
    print(f'Manifiesto actualizado: {len(photos)} fotografías; {len(ignored)} archivos no compatibles conservados en origen.')
    return document

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--carpeta', default='fotos_smalldata')
    build_manifest(parser.parse_args().carpeta)
