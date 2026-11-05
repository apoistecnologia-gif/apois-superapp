// FL-04: prevent parallel passenger rating submissions in one live Driver session.
// Executed after the existing ride/rating handoff transformations in the isolated Motorista workspace.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const path=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista","src/routes/motorista.app.tsx");
let s=readFileSync(path,"utf8");
function one(old,next,label) {
 const n=s.split(old).length-1;
 if(n!==1)throw Error("[FAIL] Rating guard "+label+": "+n);
 s=s.replace(old,next);
}
one('  const [submittingRating, setSubmittingRating] = useState(false);',
`  const [submittingRating, setSubmittingRating] = useState(false);
  // APOIS_DRIVER_RATING_SINGLE_FLIGHT_V1: synchronous guard before React state flush.
  const ratingSubmittingRef = useRef(false);`,"new ref");
one(`    if (submittingRating || ratingSubmitted) return; // garante envio único`,
`    if (submittingRating || ratingSubmitted || ratingSubmittingRef.current) return; // one flight per ride`,"early guard");
one(`    setSubmittingRating(true);
    setRatingError(null);`,
`    ratingSubmittingRef.current = true;
    setSubmittingRating(true);
    setRatingError(null);`,"synchronous lock");
one(`    } finally { setSubmittingRating(false); }`,
`    } finally { ratingSubmittingRef.current = false; setSubmittingRating(false); }`,"release on server error/success");
one(`  function skipRating() {
    if (ratingRide) ratedRidesRef.current.add(ratingRide.id);`,
`  function skipRating() {
    if (ratingSubmittingRef.current) return;
    if (ratingRide) ratedRidesRef.current.add(ratingRide.id);`,"no skip while sending");
if(!s.includes("await callRate(")||!s.includes("ratedRidesRef.current.add(ratedRideId)")||!s.includes('event: "rating.closed"'))throw Error("[FAIL] Earlier rating handoff not preserved");
writeFileSync(path,s,"utf8");
console.log("[OK] Driver rating: per-session synchronous in-flight guard, repeat blocked, failure releases lock, original server flow preserved.");
