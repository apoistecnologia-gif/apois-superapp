import importlib.util,io,pathlib,struct,tarfile,tempfile,unittest
spec=importlib.util.spec_from_file_location("graph",pathlib.Path(__file__).with_name("verify-graph.py"))
graph=importlib.util.module_from_spec(spec);spec.loader.exec_module(graph)

class GraphIndexTest(unittest.TestCase):
    def create(self,p,offset=1536,tileid=8,name="0/000/001.gph",kind=tarfile.REGTYPE):
        with tarfile.open(p,"w") as t:
            index=struct.pack("<QLL",offset,tileid,4)
            m=tarfile.TarInfo("index.bin");m.size=len(index);t.addfile(m,io.BytesIO(index))
            m=tarfile.TarInfo(name);m.size=4;m.type=kind
            t.addfile(m,io.BytesIO(b"tile"))
    def test_valid_index(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/"graph.tar";self.create(p)
            result=graph.inspect(p)
            self.assertEqual(result["tiles"],1)
            self.assertEqual(len(result["sha256"]),64)
    def test_reject_bad_offset(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/"graph.tar";self.create(p,offset=512)
            with self.assertRaises(AssertionError):graph.inspect(p)
    def test_reject_bad_id(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/"graph.tar";self.create(p,tileid=99)
            with self.assertRaises(AssertionError):graph.inspect(p)
    def test_reject_traversal(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/"graph.tar";self.create(p,name="../000/001.gph")
            with self.assertRaises(AssertionError):graph.inspect(p)
    def test_reject_symlink(self):
        with tempfile.TemporaryDirectory() as d:
            p=pathlib.Path(d)/"graph.tar";self.create(p,kind=tarfile.SYMTYPE)
            with self.assertRaises(AssertionError):graph.inspect(p)
