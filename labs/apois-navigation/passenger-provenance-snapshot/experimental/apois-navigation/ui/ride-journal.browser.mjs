import {openRideJournal} from './ride-journal.mjs'
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const scope=id(1),entry={selectionId:id(2),requestKey:id(3),owner:id(4)},other={...entry,owner:id(5)}
try{
 const a=await openRideJournal(),b=await openRideJournal()
 const winners=await Promise.all([a.reserve(scope,entry),b.reserve(scope,other)])
 if(winners.filter(Boolean).length!==1)throw Error('concurrent reserve')
 const winner=winners[0]?entry:other,loser=winners[0]?other:entry
 a.close();b.close()
 const reopened=await openRideJournal()
 if(JSON.stringify(await reopened.read(scope))!==JSON.stringify(winner))throw Error('not durable')
 if(await reopened.clear(scope,loser))throw Error('wrong CAS clear')
 if(await reopened.read(id(99))!==null)throw Error('account scope')
 if(!await reopened.clear(scope,winner)||await reopened.read(scope)!==null)throw Error('clear failed')
 reopened.close()
 document.body.textContent='APOIS_INDEXEDDB_BROWSER_OK'
}catch(e){document.body.textContent='APOIS_INDEXEDDB_BROWSER_FAIL '+e}
