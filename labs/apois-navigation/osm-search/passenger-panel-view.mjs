import { createPassengerPanel } from './passenger-panel.mjs'

// Mount in a dedicated experimental container only. map is an injected OSM
// MapLibre adapter exposing on/off('click'); the existing Google map is not used.
export function mountPassengerPanel(root, { map, onReturn = () => {}, ...options } = {}) {
  const panel = createPassengerPanel(options)
  if (!panel.open()) return null
  const doc = root.ownerDocument
  const el = (tag, text) => { const node = doc.createElement(tag); if (text) node.textContent = text; return node }
  const button = (text, action) => { const b = el('button',text); b.type = 'button'; b.addEventListener('click',action); return b }
  const box = el('section'), title = el('h2','Seleção experimental de corrida')
  const status = el('p'); status.setAttribute('role','status')
  const label = el('label','Buscar endereço ou ponto de interesse')
  const input = el('input'); input.type = 'search'; input.maxLength = 120; label.append(input)
  const list = el('div'), chosen = el('p'), hint = el('p')
  const accept = button('Usar ponto sugerido', () => { panel.acceptSuggestion(); render() })
  const confirm = button('Confirmar embarque e destino', async () => { const work = panel.confirm(); render(); await work; render() })
  const close = () => { dispose(); onReturn() }
  const dispose = () => { panel.close(); clearInterval(timer); map?.off('click',tap); box.remove() }
  const tap = event => { panel.suggestTap({lat:event?.lngLat?.lat,lng:event?.lngLat?.lng}); render() }
  const render = () => {
    const s = panel.state(); if (s.phase === 'closed') return
    status.textContent = ({editing:'Escolha e confira os dois pontos.',confirming:'Confirmando seleção…',confirmed:'Seleção confirmada. Nenhuma corrida foi criada.',expired:'Seleção expirada. Confirme novamente.',error:'Não foi possível confirmar. Tente novamente ou volte ao fluxo atual.'})[s.phase]
    chosen.textContent = 'Embarque: '+(s.pickup?.label ?? 'Não selecionado')+' | Destino: '+(s.destination?.label ?? 'Não selecionado')
    hint.textContent = s.suggestion ? 'Ponto sugerido: '+s.suggestion.label : ''
    accept.hidden = !s.suggestion
    confirm.disabled = !s.pickup || !s.destination || s.phase === 'confirming' || s.phase === 'confirmed'
    list.replaceChildren(...panel.search(input.value).map(p=>button(p.label,()=>{panel.selectSearch(input.value,p.id); render()})))
  }
  const focus = field => {panel.focus(field); input.value=''; render(); input.focus()}
  input.addEventListener('input',render)
  box.append(title,el('p','Laboratório OSM • © OpenStreetMap contributors'),button('Escolher embarque',()=>focus('pickup')),button('Escolher destino',()=>focus('destination')),label,list,chosen,hint,accept,confirm,status,button('Cancelar e voltar ao fluxo atual',close))
  root.append(box); map?.on('click',tap)
  const timer = setInterval(()=>{ if(panel.state().phase==='expired') render() },1000)
  render()
  return { dispose, confirmedInput:panel.confirmedInput }
}
