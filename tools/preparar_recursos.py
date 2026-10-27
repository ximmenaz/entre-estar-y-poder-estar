"""Recortes rectangulares reproducibles. No modifica los PNG originales."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'assets' / 'escenas'
OUTPUT.mkdir(parents=True, exist_ok=True)
for source in sorted(ROOT.glob('0*.png')):
    image = Image.open(source).convert('RGB')
    # Área central completa, incluidas sus anotaciones originales. Sin retoque.
    image.crop((380, 155, 1102, 970)).save(OUTPUT / (source.stem + '.webp'), quality=94)
# El mapa se repite en las siete referencias. Se conserva su trazado y color.
Image.open(ROOT / '01_Centro.png').convert('RGB').crop((50, 318, 349, 618)).save(
    ROOT / 'assets' / 'mapa-territorial.webp', lossless=True)
