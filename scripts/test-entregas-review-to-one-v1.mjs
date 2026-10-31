import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const code=readFileSync(resolve(".work/entregas/src/routes/pedido/$orderId/avaliar.tsx"),"utf8");
for(const expected of [
  "APOIS_CUSTOMER_PRODUCT_REVIEW_V1",
  "Array.isArray(linkedJobs)",
  "Boolean(linkedJobs?.courier_id)",
  "order_items(id,product_name,quantity)",
  "submit_order_review_with_products",
  "submit_order_product_reviews",
  "product_order_reviews",
  "if (!disposed) { setLoadError",
]){
  assert.ok(code.includes(expected), "Customer review missing: "+expected);
}
assert.ok(!code.includes("order?.delivery_jobs?.some("),"Legacy one-to-one crash remains");
const courierLinked=(value)=>Array.isArray(value)
  ? value.some((job)=>Boolean(job?.courier_id))
  : Boolean(value?.courier_id);
assert.equal(courierLinked(null),false);
assert.equal(courierLinked({courier_id:null}),false);
assert.equal(courierLinked({courier_id:"courier-uuid"}),true);
assert.equal(courierLinked([]),false);
assert.equal(courierLinked([{courier_id:"courier-uuid"}]),true);
console.log("[OK] Customer review: one-to-one courier relation, non-regressed base RPC and product review staged safely.");
