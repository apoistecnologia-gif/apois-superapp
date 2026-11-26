"""Use exactly the same extract as the approved inactive Vale map and graph."""
import pathlib,sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/"embedded-search"))
from catalog import generate
generate(pathlib.Path(sys.argv[1]),pathlib.Path(sys.argv[2]),
    expected_sha="c50dd021ab11518b230c191bc9fa85f683c9b82810f605476532c16172f55238",
    bounds=(-40.80,-9.65,-40.20,-9.10),cities=("Petrolina","Juazeiro"))
