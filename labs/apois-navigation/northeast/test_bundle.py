import json,pathlib,tempfile,unittest
from bundle import build,digest
class TestBundle(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.report=pathlib.Path(self.tmp.name)/"report";self.root=pathlib.Path(self.tmp.name)/"bundle"
        self.report.mkdir();self.root.mkdir()
        (self.root/"nordeste.pmtiles").write_bytes(b"test-map")
        (self.root/"valhalla_tiles.tar").write_bytes(b"test-graph")
        (self.report/"source.sha256").write_text("a"*64+"  nordeste.osm.pbf\n")
        (self.report/"map.sha256").write_text(digest(self.root/"nordeste.pmtiles")+"  nordeste.pmtiles\n")
        self.coverage={"samples":[{"uf":i%9,"roads":1} for i in range(11)],"archive_bytes":8}
        self.routes={"cases":[{"ok":True} for _ in range(15)]}
        self.write("map-coverage.json",self.coverage);self.write("routing-coverage.json",self.routes);self.write("valhalla-status.json",{"version":"fixture"})
    def write(self,n,v): (self.report/n).write_text(json.dumps(v))
    def test_reproducible(self):
        m=build(self.report,self.root);self.assertEqual(m,build(self.report,self.root));self.assertFalse(m["deployable"]);self.assertEqual(len(m["files"]),3)
    def test_mismatched_map(self):
        (self.root/"nordeste.pmtiles").write_bytes(b"bad")
        with self.assertRaises(ValueError): build(self.report,self.root)
    def test_failed_route(self):
        self.routes["cases"][0]["ok"]=False;self.write("routing-coverage.json",self.routes)
        with self.assertRaises(ValueError): build(self.report,self.root)
    def test_missing_graph(self):
        (self.root/"valhalla_tiles.tar").unlink()
        with self.assertRaises(ValueError): build(self.report,self.root)
if __name__=="__main__": unittest.main()
