import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
const root=new URL("./",import.meta.url);
const manifest=JSON.parse(readFileSync(new URL("snapshot.json",root),"utf8"));
assert.equal(manifest.source,"apoistecnologia-gif/say-hello-buddy-23-84b5dcbf");
assert.equal(manifest.commit,"05e0a02da2d95ef9339177ef180c3d984bebde64");
const expected=["experimental/apois-navigation/schema.sql","experimental/apois-navigation/fixture.sql","experimental/apois-navigation/test.sql","experimental/apois-navigation/import_catalog.py","experimental/apois-navigation/test_import_catalog.py","experimental/apois-navigation/client.test.mjs","src/services/navigation/independent-selection.ts","experimental/apois-navigation/ui/search.mjs","experimental/apois-navigation/ui/map-selection.mjs","experimental/apois-navigation/ui/passenger-flow.mjs","experimental/apois-navigation/ui/passenger-panel.mjs","experimental/apois-navigation/ui/passenger-panel-view.mjs","experimental/apois-navigation/ui/passenger-panel.test.mjs","experimental/apois-navigation/ui/README.md"];
assert.deepEqual(manifest.blobs.map(x=>x.path).sort(),expected.sort());
for(const {path,sha} of manifest.blobs){
  assert.match(sha,/^[a-f0-9]{40}$/);
  const actual=execFileSync("git",["hash-object",fileURLToPath(new URL(path,root))],{encoding:"utf8"}).trim();
  assert.equal(actual,sha,path);
}
console.log("APOIS_PASSENGER_SNAPSHOT_OK",manifest.commit,manifest.blobs.length);
