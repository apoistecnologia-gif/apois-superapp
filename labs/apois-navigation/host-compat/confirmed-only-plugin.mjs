// Derive the real-ride-only Capacitor candidate from the reviewed lab transport.
// Never expose synthetic replay methods in a candidate application.
import assert from 'node:assert/strict'
export function confirmedOnlyPlugin(source){
 const start='    @PluginMethod\n    public void open(PluginCall call) {'
 const end='    @Override protected void handleOnDestroy(){'
 assert.equal(source.split(start).length,2)
 assert.equal(source.split(end).length,2)
 assert.ok(source.indexOf(start)<source.indexOf(end))
 // Activity owns configuration; a late plugin destroy must not revoke another owner.
 let result=source.slice(0,source.indexOf(start))+'}\n'
 result=result.replace('import br.com.apois.navigation.lab.LabNavigationBridge;\n','')
 result=result.replace('public class ApoisNavigationLabPlugin extends Plugin','public class ApoisConfirmedNavigationPlugin extends Plugin')
 result=result.replace('@CapacitorPlugin(name="ApoisNavigationLab")','@CapacitorPlugin(name="ApoisConfirmedNavigation")')
 assert.ok(!result.includes('LabNavigationBridge')&&!result.includes('public void open(')&&!result.includes('public void update(')&&!result.includes('public void close('))
 assert.deepEqual([...result.matchAll(/@PluginMethod\s+public void (\w+)\(/g)].map(m=>m[1]),['confirmedAvailability','openConfirmed','cancelConfirmedPreparation','closeConfirmed'])
 return result
}
