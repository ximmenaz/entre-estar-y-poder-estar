import json
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[2]
class GalleryManifestTests(unittest.TestCase):
 def test_manifest_includes_every_compatible_original_once(self):
  manifest=json.loads((ROOT/'data/galeria.json').read_text())
  source=ROOT/manifest['carpeta_origen']
  original_available=source.is_dir()
  inventory=source if original_available else ROOT/'assets/fotografias-completas'
  expected={p.relative_to(ROOT).as_posix() for p in inventory.rglob('*') if p.is_file() and p.suffix.lower() in {'.jpg','.jpeg','.png','.webp'}}
  actual=[p.get('archivo_origen',p['original']) if original_available else p['original'] for p in manifest['fotografias']]
  self.assertEqual(set(actual),expected)
  self.assertEqual(len(actual),len(set(actual)))
 def test_images_and_metadata_are_real_project_resources(self):
  manifest=json.loads((ROOT/'data/galeria.json').read_text())
  territories={t['id'] for t in json.loads((ROOT/'data/territorios.json').read_text())['territorios']}
  for photo in manifest['fotografias']:
   self.assertTrue((ROOT/photo['original']).is_file())
   self.assertTrue((ROOT/photo['imagen']).is_file())
   self.assertEqual(photo['nombre'],Path(photo.get('archivo_origen',photo['original'])).name)
   self.assertTrue(photo['territorio'] is None or photo['territorio'] in territories)

 def test_shared_jpegs_have_no_location_metadata_and_preserve_compressed_pixels(self):
  import sys
  sys.path.insert(0,str(ROOT/'tools'))
  from exportar_fotos_seguras import jpeg_parts, jpeg_orientation
  manifest=json.loads((ROOT/'data/galeria.json').read_text())
  for photo in manifest['fotografias']:
   raw=ROOT/photo['archivo_origen'];shared=ROOT/photo['original']
   self.assertNotEqual(raw,shared)
   if raw.suffix.lower() in {'.jpg','.jpeg'}:
    shared_segments,shared_pixels=jpeg_parts(shared.read_bytes())
    if raw.is_file():
     raw_segments,raw_pixels=jpeg_parts(raw.read_bytes())
     self.assertEqual(raw_pixels,shared_pixels)
    self.assertTrue(all(marker not in {0xED,0xFE} for marker,_,_ in shared_segments))
    exif=[payload for marker,_,payload in shared_segments if marker==0xE1]
    self.assertTrue(all(len(payload)==32 and jpeg_orientation(payload) is not None for payload in exif))

if __name__=='__main__':unittest.main()
