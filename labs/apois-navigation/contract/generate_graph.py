"""Tiny fictitious grid for testing the real Valhalla engine, never for driving."""
import pathlib,sys,xml.etree.ElementTree as ET
root=ET.Element("osm",version="0.6",generator="APOIS synthetic navigation test")
# Synthetic coordinates, not actual mapped roads.
for r in range(3):
    for c in range(3):
        ET.SubElement(root,"node",id=str(1+r*3+c),lat=str(-2.0+r*.003),lon=str(-20.0+c*.003),version="1")
for i,ids in enumerate([[1,2,3],[4,5,6],[7,8,9],[1,4,7],[2,5,8],[3,6,9]],start=100):
    w=ET.SubElement(root,"way",id=str(i),version="1")
    for n in ids: ET.SubElement(w,"nd",ref=str(n))
    for k,v in {"highway":"residential","name":"Rua de Teste "+str(i),"maxspeed":"30"}.items():
        ET.SubElement(w,"tag",k=k,v=v)
ET.ElementTree(root).write(sys.argv[1],encoding="utf-8",xml_declaration=True)
