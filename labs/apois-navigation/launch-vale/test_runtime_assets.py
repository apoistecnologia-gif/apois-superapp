import unittest
from runtime_assets import allowed,validate_style
class RuntimeAssetsTest(unittest.TestCase):
    def base(self):return {"version":8,"sources":{"regional":{"type":"vector","url":"pmtiles://asset://apois-regional/vale.pmtiles"}},"glyphs":"asset://apois-regional/glyphs/{fontstack}/{range}.pbf","layers":[]}
    def test_local_style(self):validate_style(self.base())
    def test_remote(self):
        s=self.base();s["sources"]["regional"]["url"]="https://example.invalid/tiles"
        with self.assertRaises(AssertionError):validate_style(s)
        s=self.base();s["sprite"]="https://example.invalid/sprites"
        with self.assertRaises(AssertionError):validate_style(s)
        s=self.base();s["layers"]=[{"metadata":"https://example.invalid/"}]
        with self.assertRaises(AssertionError):validate_style(s)
    def test_paths(self):
        for p in ("../vale.pmtiles","glyphs/Open Sans Regular/1-256.pbf","glyphs/Open Sans Regular/00-255.pbf","glyphs/Other/0-255.pbf"):
            self.assertFalse(allowed(p))
        self.assertTrue(allowed("glyphs/Open Sans Regular/256-511.pbf"))
