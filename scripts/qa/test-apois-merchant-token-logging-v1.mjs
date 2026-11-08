// INV-008: execute the real logger with an injected synthetic credential.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";

const source=readFileSync(fileURLToPath(new URL("../build-merchant-panel.mjs",import.meta.url)),"utf8");
const beginning=source.indexOf("function run(bin, args, options = {}) {");
const end=source.indexOf("\n}\n\nif (!existsSync",beginning);
assert.ok(beginning>=0&&end>beginning,"Missing build command runner");
const runFunction=source.slice(beginning,end+2);

test("Git build command logs never disclose args, literal or Basic-encoded secrets",()=>{
 const secret="APOIS_SYNTHETIC_TOKEN_TEST_ONLY";
 const encoded=Buffer.from("x-access-token:"+secret).toString("base64");
 const logs=[];
 let invoked=false;
 runInNewContext(runFunction+"\nrun('git',['-c', 'http.https://github.com/.extraheader=AUTHORIZATION: basic "+encoded+"','submodule','update'],{})",{
  root:"/test",
  process:{platform:"linux",env:{},exit:()=>{throw Error("Unexpected exit");}},
  spawnSync:()=>{invoked=true;return {status:0};},
  console:{log:(...args)=>logs.push(args.join(" ")),warn:()=>{}},
 });
 assert.equal(invoked,true);
 const emitted=logs.join("\n");
 assert.ok(!emitted.includes(secret));
 assert.ok(!emitted.includes(encoded));
 assert.ok(!emitted.includes("extraheader"));
 assert.ok(emitted.includes("[RUN]"));
});

test("Checkout uses environment Git configuration, not credentialed -c arguments",()=>{
 assert.ok(source.includes("GIT_CONFIG_COUNT"));
 assert.ok(source.includes("GIT_CONFIG_KEY_"));
 assert.ok(source.includes("GIT_CONFIG_VALUE_"));
 assert.ok(source.includes("GIT_CONFIG_VALUE_${configIndex}"));
 assert.ok(!source.includes("args.join(' ')"));
 assert.ok(!source.includes("'http.https://github.com/.extraheader='+authHeader"));
 const tokenArg=source.indexOf("`http.https://github.com/.extraheader=${authHeader}`");
 assert.equal(tokenArg,-1);
});
