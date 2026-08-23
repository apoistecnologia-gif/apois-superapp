import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function patch(path, transform, label) {
  const full = resolve(path);
  const before = readFileSync(full, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`[OK] ${label} (já aplicado)`);
    return;
  }
  writeFileSync(full, after, 'utf8');
  console.log(`[OK] ${label}`);
}

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) throw new Error(`${label}: padrão esperado não encontrado`);
  return source.replace(search, replacement);
}

patch('.work/entregas/src/routes/enderecos/novo.tsx', (source) => {
  source = replaceRequired(
    source,
    '    } catch (error: any) {\n      toast.error(`Erro ao salvar: ${error.message}`);\n    } finally {',
    '    } catch (error) {\n      console.error("customer address create failed", error);\n      toast.error("Não foi possível salvar este endereço. Confira os dados e tente novamente.");\n    } finally {',
    'Novo endereço não expõe erro técnico do backend',
  );
  return source;
}, 'Entregas: criação de endereço usa mensagem segura');

patch('.work/entregas/src/routes/enderecos/editar/$addressId.tsx', (source) => {
  source = replaceRequired(
    source,
    '  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {\n    const { name, value } = e.target;\n    setFormData((prev) => ({\n      ...prev,\n      [name]: value,\n      ...(locationFields.has(name) ? { latitude: null, longitude: null } : {}),\n    }));\n  };',
    '  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {\n    const { name, value } = e.target;\n    setFormData((prev) => {\n      const previousValue = String(prev[name as keyof typeof prev] ?? "").trim();\n      const isCompletingMissingField = locationFields.has(name) && previousValue.length === 0;\n      const mustReconfirmPoint = locationFields.has(name) && !isCompletingMissingField;\n      return {\n        ...prev,\n        [name]: value,\n        ...(mustReconfirmPoint ? { latitude: null, longitude: null } : {}),\n      };\n    });\n  };',
    'Edição preserva coordenadas ao completar campo que o GPS não identificou',
  );
  source = replaceRequired(
    source,
    '    } catch (error: any) {\n      toast.error(`Erro ao salvar: ${error.message}`);\n    } finally {',
    '    } catch (error) {\n      console.error("customer address update failed", error);\n      toast.error("Não foi possível atualizar este endereço. Confira os dados e tente novamente.");\n    } finally {',
    'Editar endereço não expõe erro técnico do backend',
  );
  return source;
}, 'Entregas: edição de endereço preserva GPS e usa mensagem segura');

patch('.work/entregas/src/routes/enderecos.tsx', (source) => {
  return replaceRequired(
    source,
    'className="sticky top-0 z-50 flex items-center justify-center border-b border-zinc-900 bg-black/90 px-4 pb-4 pt-8 backdrop-blur-lg"',
    'className="sticky top-0 z-50 flex items-center justify-center border-b border-zinc-900 bg-black/90 px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] backdrop-blur-lg"',
    'Lista de endereços respeita safe area superior',
  );
}, 'Entregas: lista de endereços respeita barra superior do Android');

patch('.work/entregas/src/components/CustomerLocationAddressSelector.tsx', (source) => {
  if (!source.includes('import { Geolocation } from "@capacitor/geolocation";')) {
    source = `import { Geolocation } from "@capacitor/geolocation";\n${source}`;
  }

  const startMarker = '  const locate = async () => {';
  const endMarker = '\n\n  useEffect(() => {';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error('Localização: função locate esperada não encontrada');

  const nativeLocate = `  const locate = async () => {\n    if (isLocating) return;\n    setIsLocating(true);\n    try {\n      let permission = await Geolocation.checkPermissions();\n      if (permission.location !== "granted" && permission.coarseLocation !== "granted") {\n        permission = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });\n      }\n      if (permission.location !== "granted" && permission.coarseLocation !== "granted") {\n        toast.error("Permita o acesso à localização para preencher seu endereço automaticamente.");\n        return;\n      }\n\n      const position = await Geolocation.getCurrentPosition({\n        enableHighAccuracy: true,\n        timeout: 15000,\n        maximumAge: 15000,\n      });\n      const lat = position.coords.latitude;\n      const lng = position.coords.longitude;\n\n      try {\n        const data = await invokeMaps({ action: "reverse_geocode", lat, lng });\n        const first = data?.results?.[0];\n        if (!first?.address_components) throw new Error("reverse_geocode_empty");\n\n        const address = parseAddressComponents(first.address_components);\n        onAddressSelected({ ...address, latitude: lat, longitude: lng });\n        const missing = [\n          !address.street && "rua",\n          !address.number && "número",\n          !address.neighborhood && "bairro",\n          !address.city && "cidade",\n          !address.state && "UF",\n          !address.postal_code && "CEP",\n        ].filter(Boolean);\n        if (missing.length > 0) {\n          toast.success(\`Localização encontrada. Complete apenas: \${missing.join(", ")}.\`);\n        } else {\n          toast.success("Endereço preenchido pela sua localização.");\n        }\n      } catch (error) {\n        console.error("Erro ao converter GPS em endereço:", error);\n        onAddressSelected({\n          street: "",\n          number: "",\n          neighborhood: "",\n          city: "",\n          state: "",\n          postal_code: "",\n          latitude: lat,\n          longitude: lng,\n        });\n        toast.error("Localização obtida. Complete manualmente os dados do endereço que não puderam ser identificados.");\n      }\n    } catch (error) {\n      console.error("Erro de geolocalização:", error);\n      toast.error("Não foi possível acessar sua localização. Verifique a permissão do aplicativo e tente novamente.");\n    } finally {\n      setIsLocating(false);\n    }\n  };`;

  source = `${source.slice(0, start)}${nativeLocate}${source.slice(end)}`;
  source = source.replace(
    '      toast.error(error instanceof Error ? error.message : "Não foi possível carregar o endereço.");',
    '      toast.error("Não foi possível carregar este endereço. Tente outra busca ou complete os dados manualmente.");',
  );

  if (source.includes('navigator.geolocation')) throw new Error('Localização: navigator.geolocation legado ainda presente');
  if (source.includes('Localização obtida, mas não foi possível buscar o endereço: ${error.message}')) {
    throw new Error('Localização: erro técnico ainda exposto ao cliente');
  }
  return source;
}, 'Entregas: localização de endereço usa plugin nativo e mensagens seguras');

patch('.work/entregas/src/components/GoogleMapsAddressSelector.tsx', (source) => {
  source = source.replace('import { useServerFn } from "@tanstack/react-start";\n', '');
  source = source.replace(
    'import { autocompleteAddress, geocodeAddress, getPlaceDetails } from "@/lib/google-maps.functions";\n',
    '',
  );
  if (!source.includes('import { Geolocation } from "@capacitor/geolocation";')) {
    source = `import { Geolocation } from "@capacitor/geolocation";\n${source}`;
  }

  // The snapshot's fallback map center (used only before the merchant/customer
  // searches or drags the pin) was a hardcoded developer coordinate with no
  // relation to any real address. Swap it for Brasília — a real, recognizable
  // reference point, not a leftover test value.
  source = replaceRequired(
    source,
    'useState(initialCenter || { lat: -9.3891, lng: -40.5031 })',
    'useState(initialCenter || { lat: -15.7801, lng: -47.9292 })',
    'Mapa de edição: centro padrão do mapa usa referência real (Brasília) em vez de coordenada de desenvolvimento',
  );

  const serverFnBlock = `  const geocodeFn = useServerFn(geocodeAddress);\n  const autocompleteFn = useServerFn(autocompleteAddress);\n  const detailsFn = useServerFn(getPlaceDetails);\n\n  const getAccessToken = async () => {\n    const {\n      data: { session },\n      error,\n    } = await supabase.auth.getSession();\n    if (error || !session?.access_token) throw new Error("Sessão expirada");\n    return session.access_token;\n  };`;
  const edgeBlock = `  const invokeMaps = async (body: Record<string, unknown>) => {\n    const { data, error } = await supabase.functions.invoke("google-maps-address", { body });\n    if (error) throw error;\n    if (data?.error) throw new Error(String(data.error));\n    return data;\n  };`;
  source = replaceRequired(
    source,
    serverFnBlock,
    edgeBlock,
    'Mapa de edição usa Edge Function em vez de TanStack Server Functions',
  );

  source = source.replace(
    '      const accessToken = await getAccessToken();\n      const data = await geocodeFn({ data: { lat, lng, accessToken } });',
    '      const data = await invokeMaps({ action: "reverse_geocode", lat, lng });',
  );
  source = source.replace(
    '      const accessToken = await getAccessToken();\n      const data = await autocompleteFn({ data: { input: value, accessToken } });',
    '      const data = await invokeMaps({ action: "autocomplete", input: value.trim() });',
  );
  source = source.replace(
    '      const accessToken = await getAccessToken();\n      const data = await detailsFn({ data: { placeId: suggestion.place_id, accessToken } });',
    '      const data = await invokeMaps({ action: "place_details", placeId: suggestion.place_id });',
  );

  const startMarker = '  const handleGetCurrentLocation = () => {';
  const endMarker = '\n\n  const handleSearch = async';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error('Mapa de edição: handleGetCurrentLocation não encontrado');
  const nativeLocation = `  const handleGetCurrentLocation = async () => {\n    if (isMerchantProduct) {\n      toast.error("No painel do estabelecimento, pesquise o endereço real da loja no mapa.");\n      return;\n    }\n    if (isLocating) return;\n    setIsLocating(true);\n    try {\n      let permission = await Geolocation.checkPermissions();\n      if (permission.location !== "granted" && permission.coarseLocation !== "granted") {\n        permission = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });\n      }\n      if (permission.location !== "granted" && permission.coarseLocation !== "granted") {\n        toast.error("Permita o acesso à localização para confirmar o ponto da entrega.");\n        return;\n      }\n      const position = await Geolocation.getCurrentPosition({\n        enableHighAccuracy: true,\n        timeout: 15000,\n        maximumAge: 30000,\n      });\n      const { latitude: lat, longitude: lng } = position.coords;\n      await confirmCoordinates(lat, lng, "Localização atual confirmada!");\n    } catch (error) {\n      console.error("customer mapped location failed", error);\n      toast.error("Não foi possível obter sua localização. Verifique a permissão do aplicativo.");\n    } finally {\n      setIsLocating(false);\n    }\n  };`;
  source = `${source.slice(0, start)}${nativeLocation}${source.slice(end)}`;

  source = source.replace('onClick={handleGetCurrentLocation}', 'onClick={() => void handleGetCurrentLocation()}');
  source = source.replace('                  handleGetCurrentLocation();', '                  void handleGetCurrentLocation();');

  if (source.includes('useServerFn(') || source.includes('google-maps.functions')) {
    throw new Error('Mapa de edição: TanStack Server Functions ainda presentes no bundle mobile');
  }
  if (source.includes('navigator.geolocation')) {
    throw new Error('Mapa de edição: navigator.geolocation legado ainda presente');
  }
  return source;
}, 'Entregas: mapa de edição funciona no APK sem servidor TanStack e usa GPS nativo');
