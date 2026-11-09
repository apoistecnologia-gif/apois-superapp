import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {test} from "node:test";
import {patchPassengerNotification} from "../fix-corridas-notification-visual11-v1.mjs";

test("RV11 CV-035: Passenger notifications announce read status without changing markAsRead",()=>{
 const root=process.cwd();
 const file=resolve(root,process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas","src/routes/_authenticated.notificacoes.tsx");
 const s=readFileSync(file,"utf8");
 assert.equal(patchPassengerNotification(s),s);
 assert.ok(s.includes("APOIS_CV11_PASSENGER_NOTIFICATION_READ_V1"));
 assert.ok(s.includes('{unread ? "Não lida. " : "Lida. "}'));
 assert.ok(s.includes("if (unread) void markAsRead(notification.id);"));
 assert.ok(s.includes("notification.title"));
 assert.ok(s.includes("notification.body"));
 assert.ok(s.includes("formatNotificationDate(notification.created_at)"));
 assert.equal((s.match(/markAsRead\(notification.id\)/g)||[]).length,1);
 const builder=readFileSync(resolve(root,"scripts/build-isolated-module.mjs"),"utf8");
 assert.ok(builder.includes("fix-corridas-notification-visual11-v1.mjs"));
 assert.ok(builder.includes("test-corridas-notification-visual11-v1.test.mjs"));
 const lock=JSON.parse(readFileSync(resolve(root,".apois/source-lock.json"),"utf8"));
 assert.equal(lock.sources.corridas_passageiro.commit,"7b047f75a1a919a5336c0df6e0d60b14b02f2618");
});
