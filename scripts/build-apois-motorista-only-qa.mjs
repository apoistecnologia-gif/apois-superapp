// APOIS_MOTORISTA_ONLY_QA_V1
// Isola Entregas SOMENTE no APK de homologação, sem remover código-fonte.
import {readFileSync,writeFileSync,existsSync,mkdirSync,rmSync,copyFileSync} from "node:fs";
import {resolve} from "node:path";
const phase=process.argv[2];
const root=process.cwd();
const branding=resolve(root,process.env.APOIS_MOTORISTA_ONLY==="1" ? ".work/motorista-only-branding" : "superapp/branding");
const officialRedLogo=resolve(root,"superapp/branding/apois-client-red-logo.b64");
const dist=resolve(root,"superapp/partner-shell/dist");
const androidRoot=resolve(root,"superapp/partner-shell/android");
function must(ok,message){if(!ok)throw Error("[FAIL] APOIS MOTORISTA ONLY: "+message)}
function read(path){must(existsSync(path),"ausente: "+path);return readFileSync(path,"utf8")}
function write(path,txt){writeFileSync(path,txt,"utf8")}
if(phase==="brand"){
  const encoded=read(officialRedLogo).trim();
  mkdirSync(branding,{recursive:true});
  must(encoded.startsWith("iVBORw0KGgo"),"identidade oficial vermelha PNG nao encontrada");
  const png=Buffer.from(encoded,"base64");
  must(png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),"PNG invalido");
  const w=png.readUInt32BE(16),h=png.readUInt32BE(20);
  must(w>=96&&h>=96,"resolucao invalida da arte oficial APOIS");
  for(const filename of ["apois-launcher.png","apois-launcher-foreground.png"]){
    writeFileSync(resolve(branding,filename),png);
  }
  console.log("[OK] Logo oficial APOIS aplicada ao overlay descartavel: "+w+"x"+h);
}else if(phase==="config"){
  // APOIS_MOTORISTA_APPNAME_QA_V2: alterar apenas o checkout descartável.
  // O packageId e a assinatura permanecem intactos para atualizar o app instalado.
  const configPath=resolve(root,"superapp/partner-shell/capacitor.config.ts");
  let config=read(configPath);
  must(config.includes("appId: 'br.com.apois.parceiro'"),"identificador original deve ser preservado");
  must(config.includes("appName: 'APOIS Parceiro'")||config.includes("appName: 'APOIS Motorista'"),"campo appName inesperado");
  config=config.replace("appName: 'APOIS Parceiro'","appName: 'APOIS Motorista'");
  must(config.includes("appName: 'APOIS Motorista'"),"appName não foi corrigido");
  write(configPath,config);
  console.log("[OK] Nome Capacitor do APK exclusivo: APOIS Motorista; packageId inalterado");
}else if(phase==="web"){
  const courier=resolve(dist,"modules/entregador");
  must(existsSync(resolve(dist,"modules/motorista/index.html")),"modulo Motorista ausente");
  rmSync(courier,{recursive:true,force:true});
  mkdirSync(resolve(dist,"assets"),{recursive:true});
  copyFileSync(resolve(branding,"apois-launcher.png"),resolve(dist,"assets/apois-brand.png"));
  const html=read(resolve(root,"superapp/partner-shell/index-motorista-only.html"));
  must(html.includes('APOIS MOTORISTA')&&html.includes('apois-parceiro:motorista-google-url'),"bootstrap Driver incompleto");
  must(!html.includes("modules/entregador")&&!html.includes("Sou Entregador"),"seletor antigo presente");
  write(resolve(dist,"index.html"),html);
  // Tela de boas-vindas e arte aprovadas: copiadas sem qualquer geracao de IA.
  const welcome=read(resolve(root,"superapp/partner-shell/motorista-welcome.html"));
  if(!welcome.includes("data-apois-driver-approved-welcome-v1")||!welcome.includes("apois-driver-welcome-enter"))
    throw Error("[FAIL] Boas-vindas oficial alterada");
  const heroEncoded=read(resolve(root,"superapp/partner-shell/branding/apois-motorista-hero.webp.b64")).trim();
  if(!heroEncoded.startsWith("UklGR"))throw Error("[FAIL] Arte oficial hero WebP ausente");
  const hero=Buffer.from(heroEncoded,"base64");
  if(hero.subarray(0,4).toString()!=="RIFF"||hero.subarray(8,12).toString()!=="WEBP")
    throw Error("[FAIL] Arte hero inválida");
  writeFileSync(resolve(dist,"assets/apois-motorista-hero.webp"),hero);
  write(resolve(dist,"motorista-welcome.html"),welcome);
  if(!html.includes("APOIS_MOTORISTA_APPROVED_WELCOME_RESTORED_V1"))
    throw Error("[FAIL] Entrada nao abre boas-vindas aprovada");
  must(!existsSync(courier),"Entregador permaneceu no bundle");
  console.log("[OK] Bundle exclusivo Motorista: GPS/consulta/push/callback Driver mantidos");
}else if(phase==="native"){
  const javaDir=resolve(androidRoot,"app/src/main/java/br/com/apois/parceiro");
  const manifestPath=resolve(androidRoot,"app/src/main/AndroidManifest.xml");
  const mainPath=resolve(javaDir,"MainActivity.java");
  let manifest=read(manifestPath),main=read(mainPath);
  must(main.includes("registerPlugin(DriverLocationPlugin.class)"),"GPS Motorista nao registrado");
  must(main.includes("registerPlugin(DriverVoicePlugin.class)"),"voz Motorista nao registrada");
  must(main.includes("registerPlugin(CourierLocationPlugin.class)"),"registro Courier esperado ausente");
  main=main.replace(/\s*registerPlugin\(CourierLocationPlugin\.class\);/g,"");
  write(mainPath,main);
  const courierService=/<service\b(?=[^>]*android:name=["']\.CourierLocationService["'])[^>]*\/>/g;
  must(courierService.test(manifest),"servico Courier nao encontrado no Manifest");
  manifest=manifest.replace(courierService,"");
  // Corrigir somente rótulos do app; nunca mudar seu identificador.
  manifest=manifest.replace(/android:label="APOIS Parceiro"/g,'android:label="APOIS Motorista"');
  must(!manifest.includes('android:label="APOIS Parceiro"'),"label legado permaneceu no Manifest");
  write(manifestPath,manifest);
  for(const file of ["CourierLocationPlugin.java","CourierLocationService.java"]){
    const path=resolve(javaDir,file);
    must(existsSync(path),"classe Courier esperada: "+file);
    rmSync(path);
  }
  must(manifest.includes('android:name=".DriverLocationService"'),"Foreground Service Motorista ausente");
  must(!manifest.includes("CourierLocation"),"Manifest ainda referencia Courier");
  must(!main.includes("CourierLocation"),"Activity ainda referencia Courier");
  const stringsPath=resolve(androidRoot,"app/src/main/res/values/strings.xml");
  const strings=read(stringsPath).replace(/(<string\s+name="app_name">)[^<]*(<\/string>)/,"$1APOIS Motorista$2")
    .replace(/(<string\s+name="title_activity_main">)[^<]*(<\/string>)/,"$1APOIS Motorista$2");
  must(strings.includes("APOIS Motorista"),"app_name Android incorreto");
  write(stringsPath,strings);
  const splashPath=resolve(androidRoot,"app/src/main/res/drawable/apois_partner_splash.xml");
  write(splashPath,read(splashPath).replaceAll("#050505","#FFFFFF"));
  console.log("[OK] Android so Motorista: classes Courier excluidas, FGS Driver intacto, app_name APOIS Motorista");
}else{
  throw Error("Uso: node scripts/build-apois-motorista-only-qa.mjs brand|config|web|native");
}
