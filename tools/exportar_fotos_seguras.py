"""Copias de fotografías para compartir: conserva originales locales y elimina
EXIF/IPTC/XMP privados. En JPEG conserva intacto el flujo de píxeles comprimido.
"""
from pathlib import Path
import shutil
import struct


def jpeg_orientation(payload):
    if not payload.startswith(b'Exif\x00\x00'):
        return None
    tiff = payload[6:]
    endian = '<' if tiff[:2] == b'II' else '>' if tiff[:2] == b'MM' else None
    if endian is None or len(tiff) < 8:
        return None
    try:
        offset = struct.unpack_from(endian+'I', tiff, 4)[0]
        count = struct.unpack_from(endian+'H', tiff, offset)[0]
        for index in range(count):
            entry = offset + 2 + index*12
            tag, kind, size = struct.unpack_from(endian+'HHI', tiff, entry)
            if tag == 274 and kind == 3 and size == 1:
                value = struct.unpack_from(endian+'H', tiff, entry+8)[0]
                return value if 1 <= value <= 8 else None
    except (struct.error, IndexError):
        return None
    return None


def jpeg_parts(raw):
    if raw[:2] != b'\xff\xd8':
        raise ValueError('El archivo no es un JPEG válido.')
    position = 2
    segments = []
    while position < len(raw):
        start = position
        if raw[position] != 255:
            raise ValueError('Segmento JPEG no reconocido.')
        while raw[position] == 255:
            position += 1
        marker = raw[position]
        position += 1
        if marker in (0xDA, 0xD9):
            return segments, raw[start:]
        if marker == 0x01 or 0xD0 <= marker <= 0xD7:
            segments.append((marker, raw[start:position], b''))
            continue
        size = struct.unpack_from('>H', raw, position)[0]
        end = position + size
        if size < 2 or end > len(raw):
            raise ValueError('Longitud JPEG no válida.')
        segments.append((marker, raw[start:end], raw[position+2:end]))
        position = end
    raise ValueError('El JPEG no contiene datos de imagen.')


def clean_jpeg(raw):
    segments, pixels = jpeg_parts(raw)
    orientation = next((value for marker, _, payload in segments if marker == 0xE1 and (value := jpeg_orientation(payload))), None)
    output = bytearray(b'\xff\xd8')
    # Keep only the orientation needed by the browser; never GPS or maker notes.
    if orientation and orientation != 1:
        tiff = b'II*\x00' + struct.pack('<I', 8) + struct.pack('<H', 1)
        tiff += struct.pack('<HHI', 274, 3, 1) + struct.pack('<H', orientation) + b'\x00\x00' + b'\x00'*4
        exif = b'Exif\x00\x00' + tiff
        output += b'\xff\xe1' + struct.pack('>H', len(exif)+2) + exif
    for marker, segment, _ in segments:
        # JFIF, ICC and Adobe color transforms preserve visual interpretation.
        if marker == 0xFE or 0xE1 <= marker <= 0xEF and marker not in (0xE2, 0xEE):
            continue
        output += segment
    output += pixels
    return bytes(output)


def export_photo(source, destination):
    source, destination = Path(source), Path(destination)
    if source.resolve() == destination.resolve():
        raise ValueError('La copia pública debe ser distinta del original.')
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_mtime >= source.stat().st_mtime:
        return destination
    if source.suffix.lower() in ('.jpg', '.jpeg'):
        destination.write_bytes(clean_jpeg(source.read_bytes()))
    else:
        try:
            from PIL import Image, ImageOps
        except ImportError as error:
            raise RuntimeError('Pillow es necesario para exportar PNG/WebP sin metadatos.') from error
        with Image.open(source) as opened:
            image = ImageOps.exif_transpose(opened)
            image = image.convert('RGBA' if 'A' in image.getbands() else 'RGB')
            image.info.clear()
            if destination.suffix.lower() == '.png':
                image.save(destination, 'PNG')
            elif destination.suffix.lower() == '.webp':
                image.save(destination, 'WEBP', lossless=True)
            else:
                raise ValueError('Formato de fotografía no compatible.')
    return destination
