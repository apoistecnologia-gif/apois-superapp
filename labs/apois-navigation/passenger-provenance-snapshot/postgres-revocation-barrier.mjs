// CI fixture only: docker exec over a PostgreSQL container with --network none.
// SHARE on the tombstone table conflicts with all INSERT/UPDATE/DELETE writes.
// A revocation trigger therefore cannot commit between the snapshot and SQLite
// admission. No claim of cancelling an already admitted upstream request.
import {spawn} from 'node:child_process'
import {createInterface} from 'node:readline'
export function fixtureBarrier(signal,work) {
  return run(signal,work)
}
async function run(signal,work) {
  if(signal.aborted) throw Error('aborted')
  const child=spawn('docker',['exec','-i','apois-provenance-fixture','psql','-X','-qAt','-U','postgres','-d','apois_navigation_fixture','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']})
  child.stdin.on('error',()=>{})
  child.stderr.resume()
  let failure
  child.on('error',e=>{failure=e;child.stdout.destroy(e)})
  const lines=createInterface({input:child.stdout,crlfDelay:Infinity})
  const iterator=lines[Symbol.asyncIterator]()
  const stop=()=>{child.stdin.end();child.kill()}
  signal.addEventListener('abort',stop,{once:true})
  const timer=setTimeout(stop,4000)
  let seq=0
  async function command(sql) {
    if(signal.aborted||failure||child.exitCode!==null)throw Error('fixture authority unavailable')
    const marker='APOIS_BARRIER_'+(++seq)
    child.stdin.write(sql+'\n\\echo '+marker+'\n')
    const out=[]
    while(true){
      const {value,done}=await iterator.next()
      if(done)throw Error('fixture authority disconnected')
      if(value===marker)return out
      out.push(value)
    }
  }
  try{
    await command("begin; set local lock_timeout='1200ms'; set local statement_timeout='2s'; set local idle_in_transaction_session_timeout='3s'; lock table apois_nav_lab.revoked_leg in share mode;")
    const result=await work(async(limit,readSignal)=>{
      if(readSignal.aborted||!Number.isInteger(limit)||limit<1||limit>4097)throw Error('invalid read')
      const out=await command("select coalesce(jsonb_agg(jsonb_build_object('rideId',ride_id,'phase',phase)),'[]'::jsonb) from (select ride_id,phase from apois_nav_lab.revoked_leg order by ride_id,phase limit "+limit+") t;")
      if(out.length!==1)throw Error('unexpected snapshot')
      return JSON.parse(out[0])
    })
    await command('commit;')
    if(signal.aborted)throw Error('aborted')
    return result
  }finally{
    clearTimeout(timer);signal.removeEventListener('abort',stop)
    child.stdin.end('\\q\n');lines.close()
  }
}
