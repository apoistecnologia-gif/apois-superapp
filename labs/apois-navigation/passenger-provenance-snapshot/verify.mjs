import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
const root=new URL("./",import.meta.url);
const manifest=JSON.parse(readFileSync(new URL("snapshot.json",root),"utf8"));
assert.equal(manifest.source,"apoistecnologia-gif/say-hello-buddy-23-84b5dcbf");
assert.equal(manifest.commit,"c463fae7bb670003dfa16c3487d6627340679b21");
assert.equal(manifest.blobs.length,7);
for(const {path,sha} of manifest.blobs){
  assert.ok(/^(experimental\/apois-navigation\/[a-z_.]+|src\/services\/navigation\/independent-selection\.ts)$/.test(path),path);
  const actual=execFileSync("git",["hash-object",fileURLToPath(new URL(path,root))],{encoding:"utf8"}).trim();
  assert.equal(actual,sha,path);
}
console.log("APOIS_PASSENGER_SNAPSHOT_OK",manifest.commit,manifest.blobs.length);
