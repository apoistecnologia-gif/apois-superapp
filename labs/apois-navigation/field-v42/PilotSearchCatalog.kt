package br.com.apois.navigation.lab

import java.text.Normalizer
import java.util.Locale

internal data class PilotSearchCandidate(val id:String,val kind:String,val label:String,val lat:Double,val lon:Double,val number:String,val locality:String)
internal fun pilotSearchKey(s:String)=Normalizer.normalize(s.lowercase(Locale.ROOT),Normalizer.Form.NFKD)
    .replace(Regex("\\p{M}+"),"").replace(Regex("[^a-z0-9]+")," ").trim()
internal class PilotSearchCatalog(rows:List<PilotSearchCandidate>){
    private data class Entry(val row:PilotSearchCandidate,val labelKey:String,val words:List<String>,val numbers:Set<String>)
    private val index=rows.map{r->Entry(r,pilotSearchKey(r.label),pilotSearchKey(r.label+" "+r.locality).split(" "),pilotSearchKey(r.number).split(" ").toSet())}
    init{require(rows.size<=50000&&rows.map{it.id}.toSet().size==rows.size)}
    fun find(query:String,limit:Int=12):List<PilotSearchCandidate>{
        if(query.length>120)return emptyList()
        val normalized=pilotSearchKey(query)
        val words=normalized.split(" ").filter{it.isNotEmpty()}
        if(words.sumOf{it.length}<2)return emptyList()
        val nums=words.filter{it.all(Char::isDigit)}.toSet()
        return index.asSequence().filter{e->
            (nums.isEmpty()||(e.row.kind=="address"&&e.numbers.containsAll(nums)))&&
            words.all{w->e.words.any{it.startsWith(w)}}
        }.sortedWith(compareBy<Entry>{if(it.labelKey==normalized)0 else 1}
            .thenBy{when(it.row.kind){"address"->0;"place"->1;else->2}}
            .thenBy{it.row.label}.thenBy{it.row.id})
            .take(limit.coerceIn(0,20)).map{it.row}.toList()
    }
}
