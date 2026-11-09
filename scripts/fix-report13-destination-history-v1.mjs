// APOIS REPORT13 / INV-066 — only in isolated Passenger Corridas workspace.
// Recent history is optional; a validated destination/stop is not.
// Explicit favorites require successfully persisted storage before success.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const work = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas");
const updates = new Map();
function edit(relative, transform) {
  const path = resolve(work, relative);
  const before = readFileSync(path, "utf8");
  if (before.includes("APOIS_REPORT13_HISTORY_SELECTION_V1")) {
    throw Error("[FAIL] REPORT13 already applied " + relative);
  }
  const after = transform(before);
  if (after === before) throw Error("[FAIL] REPORT13 no changes " + relative);
  updates.set(path, after);
}
function once(src, before, after, name) {
  const count = src.split(before).length - 1;
  if (count !== 1) throw Error("[FAIL] REPORT13 " + name + " expected 1, got " + count);
  return src.replace(before, after);
}

// Return true only after Storage.saveRecent or Storage.saveFavorites completed.
// Refresh is advisory: a read failure after a confirmed write cannot turn the
// successful save into an error. Do not rewrite the existing storage key logic.
edit("src/hooks/use-destination-history.tsx", (original) => {
  let s = original;
  s = once(s,
    "  addToHistory: (destination: DestinationAddress) => void;",
    "  addToHistory: (destination: DestinationAddress) => boolean;",
    "recent callback return type");
  s = once(s,
    '    icon?: FavoriteIconType,\n  ) => void;',
    '    icon?: FavoriteIconType,\n  ) => boolean;',
    "favorite callback return type");
  s = once(s,
    "    (destination: DestinationAddress) => {\n      if (!user) return;",
    "    (destination: DestinationAddress): boolean => {\n      // APOIS_REPORT13_HISTORY_SELECTION_V1: no account -> no local save reported.\n      if (!user) return false;",
    "recent callback user identity");
  s = once(s,
    '      recentDestinationsService.addRecent(newItem);\n      refresh();',
    '      recentDestinationsService.addRecent(newItem);\n      try { refresh(); } catch { /* Saved successfully; local list could not refresh. */ }\n      return true;',
    "actual recent write acknowledgment");
  s = once(s,
    '    (destination: DestinationAddress, nickname?: string, icon?: FavoriteIconType) => {\n      if (!user) return;',
    '    (destination: DestinationAddress, nickname?: string, icon?: FavoriteIconType): boolean => {\n      if (!user) return false;',
    "favorite callback user identity");
  s = once(s,
    '      favoritesService.addFavorite(newItem as DestinationHistoryItem);\n      refresh();',
    '      favoritesService.addFavorite(newItem as DestinationHistoryItem);\n      try { refresh(); } catch { /* Save completed; local list could not refresh. */ }\n      return true;',
    "actual favorite write acknowledgment");
  for (const token of [
    "APOIS_REPORT13_HISTORY_SELECTION_V1",
    "addToHistory: (destination: DestinationAddress) => boolean;",
    ") => boolean;",
    "recentDestinationsService.addRecent(newItem);",
    "favoritesService.addFavorite(newItem as DestinationHistoryItem);",
  ]) if (!s.includes(token)) throw Error("[FAIL] REPORT13 provider contract " + token);
  return s;
});

edit("src/routes/_authenticated.buscar-destino.tsx", (original) => {
  let s = original;
  if (!s.includes("APOIS_REPORT12_MAP_SELECTION_V1") ||
      !s.includes("APOIS_FAVORITES_IN_DESTINATION_SEARCH_V1") ||
      !s.includes("APOIS_CLIENTE_DESTINATION_FEEDBACK_V2")) {
    throw Error("[FAIL] REPORT13 needs approved map, favorites and autocomplete integrations");
  }

  const safeHelpers = [
    '  // APOIS_REPORT13_HISTORY_SELECTION_V1: destination must be valid before optional history.',
    '  const isSelectableAddress=(details: DestinationAddress): boolean => Boolean(',
    '    details && typeof details.placeId === "string" && details.placeId.trim() &&',
    '    typeof details.label === "string" && details.label.trim() &&',
    '    typeof details.formattedAddress === "string" && details.formattedAddress.trim() &&',
    '    typeof details.latitude === "number" && Number.isFinite(details.latitude) &&',
    '    typeof details.longitude === "number" && Number.isFinite(details.longitude) &&',
    '    Math.abs(details.latitude) <= 90 && Math.abs(details.longitude) <= 180',
    '  );',
    '  // Only the history call is optional: never catch Places, routing or map errors here.',
    '  const completeAddressSelection=(details: DestinationAddress): boolean => {',
    '    if (!isSelectableAddress(details)) {',
    '      toast.error("Este endereço não tem uma posição válida. Escolha outro resultado.");',
    '      return false;',
    '    }',
    '    let historySaved=false;',
    '    try { historySaved=addToHistory(details) === true; } catch { /* quota, read or write denied */ }',
    '    handleFinalSelection(details);',
    '    if (!historySaved) {',
    '      toast.warning("Endereço selecionado, mas não foi possível salvar no histórico deste aparelho.");',
    '    }',
    '    return true;',
    '  };',
    '',
  ].join("\n");

  s = once(s,
    '  // Salva o endereco validado pelo Places, sem iniciar nenhuma corrida.',
    safeHelpers+'  // Salva o endereco validado pelo Places, sem iniciar nenhuma corrida.',
    "insert selective history isolation");

  const saveBefore = [
    '  const saveAddress=(details:DestinationAddress,target:"home"|"briefcase"|"heart")=>{',
    '    const name=target==="home"?"Casa":target==="briefcase"?"Trabalho":details.label;',
    '    addFavorite(details,name,target);',
    '    toast.success(target==="home"?"Casa salva.":target==="briefcase"?"Trabalho salvo.":"Local salvo nos favoritos.");',
    '    setSaveTarget(null);',
    '    clearQuery();',
    '    inputRef.current?.blur();',
    '  };',
  ].join("\n");
  const saveAfter = [
    '  const saveAddress=(details:DestinationAddress,target:"home"|"briefcase"|"heart"): boolean => {',
    '    if (!isSelectableAddress(details)) {',
    '      toast.error("Este endereço não tem uma posição válida para salvar.");',
    '      return false;',
    '    }',
    '    const name=target==="home"?"Casa":target==="briefcase"?"Trabalho":details.label;',
    '    try {',
    '      const saved=addFavorite(details,name,target);',
    '      if (!saved) {',
    '        toast.error("Não foi possível salvar o favorito. Confira sua sessão e tente novamente.");',
    '        return false;',
    '      }',
    '    } catch {',
    '      toast.error("Não foi possível salvar o favorito neste aparelho. Libere espaço ou tente novamente.");',
    '      return false;',
    '    }',
    '    toast.success(target==="home"?"Casa salva.":target==="briefcase"?"Trabalho salvo.":"Local salvo nos favoritos.");',
    '    setSaveTarget(null);',
    '    clearQuery();',
    '    inputRef.current?.blur();',
    '    return true;',
    '  };',
  ].join("\n");
  s = once(s, saveBefore, saveAfter, "favorite save must confirm persistence");

  // Suggestion has confirmed Places details. Keep the existing favorite branch,
  // but do not allow an ancillary localStorage failure to enter the Places catch.
  s = once(s,
    '      if(saveTarget){saveAddress(details,saveTarget);return;}\n      addToHistory(details);\n      handleFinalSelection(details);',
    '      if(saveTarget){saveAddress(details,saveTarget);return;}\n      completeAddressSelection(details);',
    "suggestion details -> best-effort history");

  s = once(s,
    '    if(saveTarget){saveAddress(item,saveTarget);return;}\n    addToHistory(item);\n    handleFinalSelection(item);',
    '    if(saveTarget){saveAddress(item,saveTarget);return;}\n    completeAddressSelection(item);',
    "history/favorite item -> best-effort history");

  s = once(s,
    '        saveAddress(details, saveTarget);\n        setIsPickingOnMap(false);\n        setIsBottomSheetOpen(true);',
    '        if (saveAddress(details, saveTarget)) {\n          setIsPickingOnMap(false);\n          setIsBottomSheetOpen(true);\n        }',
    "map favorite only closes after stored");
  s = once(s,
    '      addToHistory(details);\n      handleFinalSelection(details);\n      toast.success(isStopSelection ? "Parada selecionada no mapa." : "Destino selecionado no mapa.");',
    '      if (completeAddressSelection(details)) {\n        toast.success(isStopSelection ? "Parada selecionada no mapa." : "Destino selecionado no mapa.");\n      }',
    "map selection accepts optional history failures");

  for (const marker of [
    "APOIS_REPORT13_HISTORY_SELECTION_V1",
    "completeAddressSelection(details)",
    'if(saveTarget){saveAddress(details,saveTarget);return;}',
    'if(saveTarget){saveAddress(item,saveTarget);return;}',
    "const saved=addFavorite(details,name,target)",
    "addToHistory(details) === true",
    "handleFinalSelection(details)",
    'toast.warning("Endereço selecionado',
    "APOIS_REPORT12_MAP_SELECTION_V1",
    'data-apois-favorite-save-mode="true"',
    'placesService.selectPrediction(suggestion)',
  ]) if (!s.includes(marker)) throw Error("[FAIL] REPORT13 route contract missing " + marker);
  return s;
});

// Never leave a partial patch if a prior hardener changed its anchors.
for (const [path, source] of updates) writeFileSync(path, source, "utf8");
console.log("[OK] REPORT13: optional recent history cannot block validated selection; favorite toast requires stored result.");
