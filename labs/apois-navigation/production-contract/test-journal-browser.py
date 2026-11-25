#!/usr/bin/env python3
"""Actual Chromium process restart test, no CDP, no external network or data."""
import functools
import http.server
import json
import os
import pathlib
import queue
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time

browser, module = sys.argv[1:]
script = r"""
import {openRideJournal} from './ride-journal.mjs'
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const scope=id(97),first={selectionId:id(2),requestKey:id(3),owner:id(4)},second={...first,owner:id(5)}
const phase=new URL(location.href).searchParams.get('phase')
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const ensure=(condition,message)=>{if(!condition)throw Error(message)}
let result
try{
 const a=await openRideJournal()
 if(phase==='reserve'){
  const b=await openRideJournal()
  const winners=await Promise.all([a.reserve(scope,first),b.reserve(scope,second)])
  ensure(winners.filter(Boolean).length===1,'concurrent reserve')
  const winner=winners[0]?first:second,loser=winners[0]?second:first
  a.close();b.close()
  const reopened=await openRideJournal()
  ensure(equal(await reopened.read(scope),winner),'reopen')
  ensure(!await reopened.clear(scope,loser),'wrong CAS clear')
  ensure(await reopened.read(id(99))===null,'account scope')
  reopened.close();result={ok:true,phase,winner}
 }else if(phase==='recover'){
  const winner=await a.read(scope)
  ensure(equal(winner,first)||equal(winner,second),'pending entry disappeared')
  ensure(await a.clear(scope,winner),'clear failed')
  ensure(await a.read(scope)===null,'clear not persisted')
  a.close();result={ok:true,phase,winner}
 }else throw Error('unknown test phase')
}catch(e){result={ok:false,phase,error:String(e)}}
await fetch('/result',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(result)})
"""
with tempfile.TemporaryDirectory(prefix="apois-browser-") as tmp:
    root = pathlib.Path(tmp)
    shutil.copyfile(module, root / "ride-journal.mjs")
    (root / "test.mjs").write_text(script, encoding="utf8")
    (root / "index.html").write_text('<!doctype html><meta charset="utf-8"><body>Journal test<script type="module" src="./test.mjs"></script>', encoding="utf8")
    results = queue.Queue()
    class Handler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass
        def do_POST(self):
            if self.path != "/result" or self.headers.get("Content-Type") != "application/json":
                self.send_error(404)
                return
            try:
                size = int(self.headers.get("Content-Length", "0"))
                if not 1 <= size <= 2048:
                    raise ValueError("size")
                value = json.loads(self.rfile.read(size))
                results.put(value)
                self.send_response(204)
                self.end_headers()
            except Exception:
                self.send_error(400)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Handler, directory=tmp))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    def run(phase):
        log = root / (phase + ".log")
        with log.open("wb") as output:
            child = subprocess.Popen([browser, "--headless", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
                "--disable-background-networking", "--no-first-run", "--no-default-browser-check",
                "--user-data-dir=" + str(root / "profile"),
                f"http://127.0.0.1:{server.server_port}/index.html?phase={phase}"],
                stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
            try:
                deadline = time.monotonic() + 30
                while time.monotonic() < deadline:
                    try:
                        result = results.get(timeout=0.25)
                        assert result.get("ok") is True and result.get("phase") == phase, result
                        return result
                    except queue.Empty:
                        if child.poll() is not None:
                            raise RuntimeError("Chromium exited early")
                raise RuntimeError("Chromium test did not return")
            except Exception:
                print(log.read_text(errors="replace")[-6000:], file=sys.stderr)
                raise
            finally:
                try:
                    os.killpg(child.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
                try:
                    child.wait(timeout=6)
                except subprocess.TimeoutExpired:
                    os.killpg(child.pid, signal.SIGKILL)
                    child.wait(timeout=3)
                time.sleep(0.5)
    try:
        before = run("reserve")
        after = run("recover")
        assert before["winner"] == after["winner"]
        print("APOIS_INDEXEDDB_BROWSER_OK", json.dumps({"strictDurability":True,"concurrentConnections":True,"browserProcessRestart":True,"accountIsolation":True,"compareAndSwap":True}))
    finally:
        server.shutdown()
        server.server_close()
