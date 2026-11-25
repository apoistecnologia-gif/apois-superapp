import json
import pathlib
import tempfile
import unittest
from import_catalog import build, sha

XML="""<osm version="0.6">
<node id="1" lat="-9.4" lon="-40.5"><tag k="name" v="Escola Pública"/><tag k="amenity" v="school"/></node>
<node id="2" lat="-9.42" lon="-40.51"><tag k="name" v="Museu"/><tag k="tourism" v="museum"/></node>
<node id="3" lat="-9.42" lon="-40.51"><tag k="name" v="Casa"/><tag k="building" v="house"/></node>
<node id="4" lat="-9.42" lon="-40.51"><tag k="name" v="Privado"/><tag k="amenity" v="school"/><tag k="access" v="private"/></node>
<node id="5" lat="0" lon="0"><tag k="name" v="Fora"/><tag k="amenity" v="school"/></node>
<node id="6" lat="-9.42" lon="-40.51"><tag k="amenity" v="school"/></node>
<way id="1"><tag k="name" v="Sem centro calculado"/><tag k="amenity" v="school"/></way>
</osm>"""

class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.dir=pathlib.Path(self.temp.name)
        self.source=self.dir/"fixture.osm"
        self.source.write_text(XML,encoding="utf-8")
    def generate(self, filename="catalog.json", version=1, digest=None):
        return build(self.source,digest or sha(self.source),version,self.dir/filename,fixture=True)
    def test_filters_and_stable_id(self):
        a=self.generate()
        b=self.generate("next.json",2)
        self.assertEqual(a["count"],2)
        self.assertEqual(a["source"],"SYNTHETIC_XML_FIXTURE")
        self.assertEqual([r["osm_id"] for r in a["rows"]],[1,2])
        self.assertEqual([r["id"] for r in a["rows"]],[r["id"] for r in b["rows"]])
        self.assertTrue(all(not r["active"] for r in a["rows"]))
        self.assertEqual(a,json.loads((self.dir/"catalog.json").read_text()))
    def test_invalid_digest_version_and_overwrite(self):
        with self.assertRaises(ValueError): self.generate(digest="a"*64)
        with self.assertRaises(ValueError): self.generate(version=0)
        self.generate()
        with self.assertRaises(ValueError): self.generate()
    def test_duplicate_node_is_not_silently_accepted(self):
        self.source.write_text(XML.replace('id="2"','id="1"'),encoding="utf-8")
        with self.assertRaises(ValueError): self.generate()

if __name__=="__main__":
    unittest.main()
