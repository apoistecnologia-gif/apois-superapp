import pathlib,tempfile,unittest
from catalog import read_xml,search,key
class CatalogTest(unittest.TestCase):
    def test_real_vertex_and_exact_numbers(self):
        xml="""<osm><node id="1" lat="-7.45" lon="-41.48"><tag k="addr:street" v="Rua São José"/><tag k="addr:housenumber" v="12"/></node><node id="2" lat="-7.46" lon="-41.48"><tag k="addr:street" v="Rua São José"/><tag k="addr:housenumber" v="120"/></node><node id="3" lat="-7.47" lon="-41.48"><tag k="name" v="Itainópolis"/><tag k="place" v="town"/></node><node id="4" lat="-23" lon="-46"><tag k="name" v="Fora"/><tag k="place" v="town"/></node><way id="5"><nd ref="1"/><nd ref="2"/><tag k="highway" v="residential"/><tag k="name" v="Rua São José"/></way></osm>"""
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/"source.osm";p.write_text(xml);rows=read_xml(p)
        self.assertEqual(len(rows),4)
        self.assertEqual([r["number"] for r in search(rows,"sao jose 12")],["12"])
        self.assertEqual([r["number"] for r in search(rows,"sao jose 120")],["120"])
        self.assertEqual(search(rows,"sao jose 1"),[])
        self.assertEqual(search(rows,"Itainopolis")[0]["kind"],"place")
        self.assertEqual(search(rows,"Fora"),[])
        self.assertEqual(search(rows,"")[0:] ,[])
        self.assertTrue(all(r["requires_confirmation"] for r in rows))
        street=next(r for r in rows if r["kind"]=="street")
        self.assertEqual((street["lat"],street["lon"]),(-7.46,-41.48))
    def test_missing_geometry_fails(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/"source.osm";p.write_text('<osm><way id="1"><nd ref="9"/><tag k="highway" v="residential"/><tag k="name" v="Rua A"/></way></osm>')
            with self.assertRaises(ValueError):read_xml(p)
    def test_normalization(self):
        self.assertEqual(key("PRAÇA São José"),"praca sao jose")
