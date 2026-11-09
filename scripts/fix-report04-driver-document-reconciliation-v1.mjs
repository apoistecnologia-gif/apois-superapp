// INV-044: client-side forbidden Storage DELETE replaced by server reconciliation.
// Runs only in isolated workspace. The matching Edge and SQL remain staged, NOT deployed.
import {existsSync,readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const workspace=resolve(process.cwd(),process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const path=resolve(workspace,"src/lib/driverDocuments.mobile.ts");
if(!existsSync(path))throw Error("[INV044] Driver documents library missing");
let s=readFileSync(path,"utf8");
if(!s.includes("APOIS_REPORT04_DRIVER_DOCUMENT_RECONCILIATION")){
  const cleanupStart=s.indexOf("async function cleanupUploadedObject(");
  const uploadStart=s.indexOf("\nexport async function uploadDriverDocument(",cleanupStart);
  if(cleanupStart<0||uploadStart<=cleanupStart)throw Error("[INV044] cleanup contract changed");
  const helper=[
    "// APOIS_REPORT04_DRIVER_DOCUMENT_RECONCILIATION",
    "function parseDriverDocumentResult(value: unknown,slot:DriverDocumentSlot):DriverDocumentUpdateResult {",
    " if(!isRecord(value)||value.ok!==true||value.slot!==slot)throw Error(\"driver_document_invalid_response\");",
    " return {ok:true,driverId:readString(value,\"driver_id\"),slot,",
    "  documentsStatus:readString(value,\"documents_status\"),",
    "  approvalStatus:readString(value,\"approval_status\"),complete:value.complete===true};",
    "}",
    "async function reconcileUploadedObject(slot:DriverDocumentSlot,bucket:string,path:string):Promise<DriverDocumentUpdateResult> {",
    " try {",
    "  const {data,error}=await supabase.functions.invoke(\"driver-document-reconcile\",{body:{slot,bucket,path}});",
    "  if(error||!isRecord(data)||data.recorded!==true)throw Error(\"reconcile_service_missing\");",
    "  if(data.status===\"linked\")return parseDriverDocumentResult(data.result,slot);",
    "  if(data.status===\"pending\"||data.status===\"retained_evidence\")",
    "   throw Error(\"O arquivo foi preservado e a pendência de conciliação foi registrada. Atualize seus documentos antes de tentar outro envio.\");",
    "  throw Error(\"reconcile_unknown\");",
    " }catch(cause){",
    "  if(cause instanceof Error&&cause.message.startsWith(\"O arquivo foi preservado\"))throw cause;",
    "  throw Error(\"Não foi possível confirmar se o documento entrou em análise. Atualize o cadastro antes de tentar reenviar para evitar duplicidade.\");",
    " }",
    "}",
    ""
  ].join("\n");
  s=s.slice(0,cleanupStart)+helper+s.slice(uploadStart);
  const rpcStart=s.indexOf("  const rpc = supabase as unknown as RpcClient;");
  const last=s.lastIndexOf("\n}");
  if(rpcStart<0||last<=rpcStart||!s.slice(rpcStart,last).includes("cleanupUploadedObject(bucket, objectPath)"))
    throw Error("[INV044] RPC rejection contract changed");
  const replacement=[
    "  const rpc = supabase as unknown as RpcClient;",
    "  try {",
    "    const {data,error}=await rpc.rpc(\"driver_update_document\",{",
    "      _slot:slot,_storage_path:objectPath",
    "    });",
    "    if(error)throw Error(\"driver_document_rpc_not_confirmed\");",
    "    return parseDriverDocumentResult(data,slot);",
    "  }catch{",
    "    // A resposta pode ter se perdido depois do commit. Consultar e enfileirar",
    "    // no servidor; nunca excluir pelo cliente com permissao de INSERT somente.",
    "    return reconcileUploadedObject(slot,bucket,objectPath);",
    "  }"
  ].join("\n");
  s=s.slice(0,rpcStart)+replacement+s.slice(last);
  if(s.includes("cleanupUploadedObject")||s.includes(".remove([objectPath])"))
    throw Error("[INV044] unsafe client cleanup still present");
  writeFileSync(path,s,"utf8");
}
const route=resolve(workspace,"src/routes/motorista.documentos.tsx");
if(!existsSync(route))throw Error("[INV044] documents route missing");
let page=readFileSync(route,"utf8");
if(!page.includes("APOIS_REPORT04_DOCUMENT_RECOVERY_MESSAGE")){
 const anchor='      setUploadError("Não foi possível enviar o documento. Verifique o arquivo e tente novamente.");';
 if(page.split(anchor).length!==2)throw Error("[INV044] upload error message changed");
 page=page.replace(anchor,
  '// APOIS_REPORT04_DOCUMENT_RECOVERY_MESSAGE\n'+
  '      const message=caughtError instanceof Error?caughtError.message:"";\n'+
  '      setUploadError(message.startsWith("O arquivo foi preservado")||message.startsWith("Não foi possível confirmar se o documento")\n'+
  '        ?message:"Não foi possível enviar o documento. Verifique o arquivo e tente novamente.");');
 writeFileSync(route,page,"utf8");
}
console.log("[OK] INV-044: upload rejection reconciled by server endpoint; no client DELETE");
