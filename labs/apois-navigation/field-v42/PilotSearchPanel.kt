package br.com.apois.navigation.lab

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.util.Locale

@Composable internal fun PilotSearchPanel(catalog:PilotSearchCatalog,onSelect:(PilotSearchCandidate)->Unit){
    var query by remember { mutableStateOf("") }
    var matches by remember { mutableStateOf<List<PilotSearchCandidate>>(emptyList()) }
    var searching by remember { mutableStateOf(false) }
    LaunchedEffect(query,catalog){
        val current=query
        matches=emptyList();searching=current.trim().length>=2
        if(searching){
            delay(180)
            matches=withContext(Dispatchers.Default){catalog.find(current)}
            searching=false
        }
    }
    OutlinedTextField(value=query,onValueChange={query=it.take(120);matches=emptyList();searching=it.trim().length>=2},label={Text("Pesquisar rua ou localidade")},singleLine=true,modifier=Modifier.fillMaxWidth())
    if(searching)Text("Buscando no catálogo local…")
    else if(query.trim().length>=2&&matches.isEmpty())Text("Nenhum resultado OSM. Tente outro nome ou use coordenadas.")
    for(row in matches){
        OutlinedCard(modifier=Modifier.fillMaxWidth()){
            Column(Modifier.padding(8.dp)){
                Text(row.label,style=MaterialTheme.typography.titleSmall)
                val type=when(row.kind){"address"->"Número cadastrado";"street"->"Ponto da rua, não número de imóvel";else->"Ponto de referência"}
                Text(type,style=MaterialTheme.typography.bodySmall)
                if(row.locality.isNotBlank())Text(row.locality,style=MaterialTheme.typography.bodySmall)
                Text(String.format(Locale.ROOT,"%.5f, %.5f",row.lat,row.lon),style=MaterialTheme.typography.bodySmall)
                TextButton(onClick={onSelect(row);query="";matches=emptyList()}){Text("Selecionar: "+row.label)}
            }
        }
    }
}
