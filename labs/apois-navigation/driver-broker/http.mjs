export const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
export const json=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})
export const deny=status=>json(status,{ok:false,error_code:'navigation_unavailable'})
export async function boundedJson(message,limit=2048,ms=2000){
 if(message.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json'||!message.body)throw Error('content')
 const reader=message.body.getReader();let total=0,raw='',expired=false;const decoder=new TextDecoder('utf-8',{fatal:true})
 const timer=setTimeout(()=>{expired=true;void reader.cancel().catch(()=>{})},ms)
 try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>limit){void reader.cancel().catch(()=>{});throw Error('size')}raw+=decoder.decode(value,{stream:true})}if(expired)throw Error('timeout');return JSON.parse(raw+decoder.decode())}finally{clearTimeout(timer);reader.releaseLock()}
}
