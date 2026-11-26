package br.com.apois.navigation.lab

import android.content.Context
import org.json.JSONObject
import java.security.MessageDigest

private const val CATALOG_SHA="6e7b3aa0b05eda46c078ad0ed97ffeaa12609bbe0d74ab59ca636ec2efda9ccf"
private const val SOURCE_SHA="fd9182eb0bd8c7c10ee9e1ae493b9b4e7c1b69055e05b6ea5e6ca81a5718273d"
internal fun loadPilotSearchCatalog(context:Context):PilotSearchCatalog{
    val bytes=context.assets.open("apois-field-search/search-candidates.json").use{input->
        val out=java.io.ByteArrayOutputStream();val buffer=ByteArray(8192)
        while(true){val n=input.read(buffer);if(n<0)break;check(out.size()+n<=502443);out.write(buffer,0,n)}
        out.toByteArray()
    }
    check(bytes.size==502443)
    val digest=MessageDigest.getInstance("SHA-256").digest(bytes).joinToString(""){"%02x".format(it.toInt() and 255)}
    check(digest==CATALOG_SHA)
    val obj=JSONObject(bytes.toString(Charsets.UTF_8))
    check(obj.getInt("schema")==1&&!obj.getBoolean("active")&&obj.getString("extract_sha256")==SOURCE_SHA&&obj.getString("license")=="ODbL-1.0")
    val rows=obj.getJSONArray("rows");check(rows.length()==2990)
    val candidates=ArrayList<PilotSearchCandidate>(rows.length())
    for(i in 0 until rows.length()){
        val r=rows.getJSONObject(i)
        val id=r.getString("id");val kind=r.getString("kind");val label=r.getString("label")
        val number=r.getString("number");val locality=r.getString("locality")
        val lat=r.getDouble("lat");val lon=r.getDouble("lon")
        check(r.getBoolean("requires_confirmation")&&id.length in 1..80&&label.length in 1..240&&number.length<=120&&locality.length<=120)
        check(kind in setOf("address","street","place")&&lat.isFinite()&&lon.isFinite())
        check(if(kind=="address")number.isNotBlank() else number.isEmpty())
        // Catalog contains bbox-edge candidates; never present ones outside the
        // actual map/route policy, even if they were signed into the lab asset.
        if(fieldV3Target(lat.toString(),lon.toString())!=null)candidates.add(PilotSearchCandidate(id,kind,label,lat,lon,number,locality))
    }
    check(candidates.isNotEmpty())
    return PilotSearchCatalog(candidates)
}
