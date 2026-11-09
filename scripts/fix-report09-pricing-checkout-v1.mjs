// APOIS Relatório 09. Aplica correções SOMENTE na cópia isolada de Corridas.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
const workspace = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas");
const patches = [
  {
    "path": "src/hooks/use-route.tsx",
    "marker": "APOIS_REPORT09_ROUTE_CURRENT_V1",
    "must": [
      "APOIS_ROUTE_CLEAR_SAFE_V1"
    ],
    "pairs": [
      [
        "  isStale: boolean;",
        "  isStale: boolean;\n  isCurrent: boolean; // APOIS_REPORT09_ROUTE_CURRENT_V1"
      ],
      [
        "  const [error, setError] = useState<string | null>(null);",
        "  const [error, setError] = useState<string | null>(null);\n\n  // Rota retida pode ser exibida, mas não autoriza a escolha B com dados da A.\n  // GPS com variação inferior a 85 m não é tratado como alteração de intenção.\n  const [hasUnrecoveredRouteError, setHasUnrecoveredRouteError] = useState(false);\n  const routeIsCurrent = Boolean(!hasUnrecoveredRouteError && route && location && destination && status !== \"failed\" &&\n    route.destination.lat === destination.latitude &&\n    route.destination.lng === destination.longitude &&\n    (route.intermediates ?? []).length === orderedStops.length &&\n    orderedStops.every((stop, index) =>\n      route.intermediates?.[index]?.lat === stop.latitude &&\n      route.intermediates?.[index]?.lng === stop.longitude) &&\n    Math.hypot(\n      (location.latitude - route.origin.lat) * 111320,\n      (location.longitude - route.origin.lng) * 111320 * Math.cos(location.latitude * Math.PI / 180)\n    ) <= 85);"
      ],
      [
        "        isStale: status === \"stale\",",
        "        isStale: status === \"stale\",\n        isCurrent: routeIsCurrent,"
      ],
      [
        "      setRoute(newRoute);\n      setStatus(\"success\");",
        "      setHasUnrecoveredRouteError(false);\n      setRoute(newRoute);\n      setStatus(\"success\");"
      ],
      [
        "      if (err.name === \"AbortError\") return;\n      setError(",
        "      if (err.name === \"AbortError\") return;\n      setHasUnrecoveredRouteError(true);\n      setError("
      ],
      [
        "          ++routeGenerationRef.current;\n          setRoute(null);",
        "          ++routeGenerationRef.current;\n          setHasUnrecoveredRouteError(false);\n          setRoute(null);"
      ]
    ]
  },
  {
    "path": "src/hooks/use-checkout-preparation.tsx",
    "marker": "APOIS_REPORT09_CHECKOUT_V1",
    "must": [],
    "pairs": [
      [
        "  const { route } = useRoute();",
        "  const { route, isCurrent: routeIsCurrent, status: routeStatus } = useRoute(); // APOIS_REPORT09_CHECKOUT_V1"
      ],
      [
        "  const { estimate, status: pricingStatus } = usePricing();",
        "  const { estimate, status: pricingStatus, isCurrent: pricingIsCurrent } = usePricing();"
      ],
      [
        "    if (!route) blockingReasons.push(\"route_missing\");",
        "    if (!route) blockingReasons.push(\"route_missing\");\n    if (!routeIsCurrent || routeStatus === \"failed\") blockingReasons.push(\"route_outdated\");"
      ],
      [
        "    if (pricingStatus !== \"success\" || !estimate || !estimate.available)",
        "    if (!pricingIsCurrent || pricingStatus !== \"success\" || !estimate || !estimate.available)"
      ],
      [
        "  }, [user, route, selectedCategory, estimate, pricingStatus, selectedMethod, walletState, wallet]);",
        "  }, [user, route, routeIsCurrent, routeStatus, selectedCategory, estimate, pricingStatus, pricingIsCurrent, selectedMethod, walletState, wallet]);"
      ]
    ]
  },
  {
    "path": "src/components/pricing/FareDetails.tsx",
    "marker": "APOIS_REPORT09_RETRY_V1",
    "must": [],
    "pairs": [
      [
        "  const { selectedEstimate, status, error } = usePricing();",
        "  const { selectedEstimate, status, error, calculatePricing } = usePricing(); // APOIS_REPORT09_RETRY_V1"
      ],
      [
        "  if (error) return <div className=\"px-6 py-2 text-red-500 text-xs\">{error}</div>;",
        "  if (error) return (\n    <div className=\"px-4 py-3 text-red-600 text-xs space-y-2\" role=\"alert\">\n      <p>{error}</p>\n      <button type=\"button\" onClick={() => void calculatePricing()}\n        className=\"min-h-11 rounded-xl border border-red-300 px-4 font-bold\">Tentar novamente</button>\n    </div>\n  );"
      ]
    ]
  },
  {
    "path": "src/routes/_authenticated.inicio.tsx",
    "marker": "APOIS_REPORT09_HOME_GUARD_V1",
    "must": [
      "APOIS_COMPACT_HOME_V1"
    ],
    "pairs": [
      [
        "  const handleReview = () => {\n    initiateReview();",
        "  const handleReview = () => {\n    if (!checkout.readiness) return; // APOIS_REPORT09_HOME_GUARD_V1\n    initiateReview();"
      ]
    ]
  },
  {
    "path": "src/routes/_authenticated.revisar-solicitacao.tsx",
    "marker": "APOIS_REPORT09_REVIEW_GUARD_V1",
    "must": [
      "APOIS_RIDE_COMFORT_PREFS_V1"
    ],
    "pairs": [
      [
        "      const response = await confirmRide(comfort);",
        "      if (!checkout.readiness) return; // APOIS_REPORT09_REVIEW_GUARD_V1\n      const response = await confirmRide(comfort);"
      ],
      [
        "  }, [confirmRide, comfort, isSubmitting, navigate, recoverActiveRide, walletState]);",
        "  }, [confirmRide, comfort, checkout.readiness, isSubmitting, navigate, recoverActiveRide, walletState]);"
      ],
      [
        "        {error && (",
        "        {!checkout.readiness && walletState !== \"blocked\" && (\n          <p role=\"status\" className=\"text-xs text-amber-300\">Rota ou valores em atualização. Aguarde o cálculo válido antes de solicitar.</p>\n        )}\n\n        {error && ("
      ]
    ]
  },
  {
    "path": "src/hooks/rides/use-ride-request.tsx",
    "marker": "APOIS_REPORT09_SUBMIT_GUARD_V1",
    "must": [
      "APOIS_STOPS_REQUEST_V2",
      "APOIS_RIDE_COMFORT_PREFS_V1"
    ],
    "pairs": [
      [
        "import React, { createContext, useContext, useState, useCallback, useRef } from \"react\";",
        "import React, { createContext, useContext, useState, useCallback, useRef, useLayoutEffect } from \"react\";"
      ],
      [
        "import { useRoute } from \"@/hooks/use-route\";",
        "import { useRoute } from \"@/hooks/use-route\";\nimport { useCheckoutPreparation } from \"@/hooks/use-checkout-preparation\";"
      ],
      [
        "  const { route } = useRoute();",
        "  const { route } = useRoute();\n  const { checkout } = useCheckoutPreparation();"
      ],
      [
        "  const activeSubmissionRef = useRef<Promise<RideRequestResponse | null> | null>(null);",
        "  const activeSubmissionRef = useRef<Promise<RideRequestResponse | null> | null>(null);\n  // APOIS_REPORT09_SUBMIT_GUARD_V1: leitura atual após awaits do handler de revisão.\n  const liveConfirmRef = useRef({ checkout, route, category: selectedCategory?.key ?? null,\n    method: selectedMethod, stops: \"\" });\n  useLayoutEffect(() => { liveConfirmRef.current = { checkout, route, category: selectedCategory?.key ?? null,\n    method: selectedMethod,\n    stops: JSON.stringify([...confirmedStops].sort((a, b) => a.order - b.order)\n      .map((stop) => ({ lat: stop.latitude, lng: stop.longitude }))) };\n  }, [checkout, route, selectedCategory?.key, selectedMethod, confirmedStops]);"
      ],
      [
        "      setRequest((previous) => ({ ...previous, isSubmitting: true, error: null }));",
        "      const latest = liveConfirmRef.current;\n      const matchesReview = latest.checkout.readiness && latest.route === route &&\n        latest.category === selectedCategory.key && latest.method === selectedMethod &&\n        requestDataRef.current.category === selectedCategory.key &&\n        requestDataRef.current.paymentMethod === selectedMethod &&\n        sameCoordinates(route.origin, requestDataRef.current.origin) &&\n        sameCoordinates(route.destination, requestDataRef.current.destination) &&\n        stopsSignatureRef.current === JSON.stringify(route.intermediates ?? []) &&\n        latest.stops === stopsSignatureRef.current;\n      if (!matchesReview) {\n        setRequest((previous) => ({ ...previous,\n          error: \"Rota, categoria ou valores mudaram. Volte e revise a solicitação.\" }));\n        return null;\n      }\n      setRequest((previous) => ({ ...previous, isSubmitting: true, error: null }));"
      ]
    ]
  }
];
const pricing = "// APOIS_REPORT09_PRICING_V1: resultado vinculado à entrada atual; backend é autoridade do preço.\nimport React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect } from \"react\";\nimport { useRoute } from \"@/hooks/use-route\";\nimport { useRideCategories } from \"@/hooks/use-ride-categories\";\nimport { FareEstimate, PricingRequest, ServiceDetails } from \"@/types/pricing\";\nimport { pricingService } from \"@/services/pricing/pricing-service\";\nimport { useRideStops } from \"@/hooks/rides/use-ride-stops\";\n\ninterface PricingContextType {\n  estimates: FareEstimate[];\n  selectedEstimate: FareEstimate | null;\n  estimate: FareEstimate | null;\n  status: \"idle\" | \"loading\" | \"success\" | \"error\";\n  error: string | null;\n  isCurrent: boolean;\n  serviceDetails: ServiceDetails;\n  setServiceDetails: (details: ServiceDetails) => void;\n  calculatePricing: () => Promise<void>;\n}\n\nconst PricingContext = createContext<PricingContextType | undefined>(undefined);\n\nexport const PricingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {\n  const { route, isCurrent: routeIsCurrent } = useRoute();\n  const { selectedCategory, categories } = useRideCategories();\n  const { orderedStops } = useRideStops();\n  const [estimates, setEstimates] = useState<FareEstimate[]>([]);\n  const [status, setStatus] = useState<\"idle\" | \"loading\" | \"success\" | \"error\">(\"idle\");\n  const [statusKey, setStatusKey] = useState(\"\");\n  const [appliedKey, setAppliedKey] = useState(\"\");\n  const [error, setError] = useState<string | null>(null);\n  const [serviceDetails, setServiceDetails] = useState<ServiceDetails>({});\n\n  // A assinatura inclui todos os dados realmente enviados ao serviço.\n  const request = useMemo<PricingRequest | null>(() => {\n    if (!route || !routeIsCurrent) return null;\n    return {\n      routeId: route.requestKey,\n      origin: { latitude: route.origin.lat, longitude: route.origin.lng },\n      destination: { latitude: route.destination.lat, longitude: route.destination.lng },\n      stops: orderedStops.map((s) => ({ latitude: s.latitude, longitude: s.longitude })),\n      distanceMeters: route.distanceMeters,\n      durationSeconds: route.durationSeconds,\n      categoryIds: categories.map((c) => c.id),\n    };\n  }, [route, routeIsCurrent, orderedStops, categories]);\n  const requestKey = request ? JSON.stringify(request) : \"\";\n  const latestRequestKeyRef = useRef(requestKey);\n  useLayoutEffect(() => { latestRequestKeyRef.current = requestKey; }, [requestKey]);\n\n  const activeRequestRef = useRef<{ key: string; promise: Promise<void> } | null>(null);\n  const lastSuccessfulRef = useRef<{ key: string; timestamp: number } | null>(null);\n  const requestSequenceRef = useRef(0);\n  // Evita pular o recálculo ao voltar para A depois de iniciar B.\n  const displayedSuccessRef = useRef(false);\n  useLayoutEffect(() => {\n    displayedSuccessRef.current = status === \"success\" && statusKey === requestKey && appliedKey === requestKey;\n  }, [status, statusKey, appliedKey, requestKey]);\n  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);\n\n  const calculatePricing = useCallback(async () => {\n    if (!request || !requestKey) {\n      setEstimates([]);\n      setAppliedKey(\"\");\n      setStatusKey(\"\");\n      setStatus(\"idle\");\n      setError(null);\n      return;\n    }\n    // Apenas UMA consulta simultânea para a mesma entrada.\n    if (activeRequestRef.current?.key === requestKey) return activeRequestRef.current.promise;\n    // Reuso de sucesso por no máximo 30 segundos. Erros NÃO bloqueiam nova tentativa.\n    if (displayedSuccessRef.current && lastSuccessfulRef.current?.key === requestKey &&\n        Date.now() - lastSuccessfulRef.current.timestamp < 30000) return;\n\n    const attempt = ++requestSequenceRef.current;\n    setStatusKey(requestKey);\n    setStatus(\"loading\");\n    setError(null);\n    const task = pricingService.estimateFares(request)\n      .then((response) => {\n        if (latestRequestKeyRef.current !== requestKey || attempt !== requestSequenceRef.current) return;\n        setEstimates(response.estimates);\n        setAppliedKey(requestKey);\n        lastSuccessfulRef.current = { key: requestKey, timestamp: Date.now() };\n        setStatus(\"success\");\n      })\n      .catch((err) => {\n        if (latestRequestKeyRef.current !== requestKey || attempt !== requestSequenceRef.current) return;\n        console.error(\"[PricingProvider] Error calculating pricing:\", err);\n        lastSuccessfulRef.current = null;\n        setEstimates([]);\n        setAppliedKey(\"\");\n        setError(\"Não foi possível calcular os valores agora. Tente novamente.\");\n        setStatus(\"error\");\n      })\n      .finally(() => {\n        if (activeRequestRef.current?.promise === task) activeRequestRef.current = null;\n      });\n    activeRequestRef.current = { key: requestKey, promise: task };\n    return task;\n  }, [request, requestKey]);\n\n  useEffect(() => {\n    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);\n    debounceTimerRef.current = setTimeout(() => { void calculatePricing(); }, 500);\n    return () => {\n      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);\n    };\n  }, [calculatePricing]);\n\n  // A UI nunca expõe preço, erro ou sucesso pertencentes a outra assinatura.\n  const currentStatus = !requestKey ? \"idle\" : statusKey === requestKey ? status : \"loading\";\n  const isCurrent = currentStatus === \"success\" && appliedKey === requestKey && !!requestKey;\n  const visibleEstimates = isCurrent ? estimates : [];\n  const selectedEstimate = visibleEstimates.find((e) => e.categoryId === selectedCategory?.id) || null;\n\n  return (\n    <PricingContext.Provider\n      value={{\n        estimates: visibleEstimates,\n        selectedEstimate,\n        estimate: selectedEstimate,\n        status: currentStatus,\n        error: statusKey === requestKey && currentStatus === \"error\" ? error : null,\n        isCurrent,\n        serviceDetails,\n        setServiceDetails,\n        calculatePricing,\n      }}\n    >\n      {children}\n    </PricingContext.Provider>\n  );\n};\n\nexport const usePricing = () => {\n  const context = useContext(PricingContext);\n  if (!context) throw new Error(\"usePricing must be used within PricingProvider\");\n  return context;\n};\n";
function gitBlobSha(content) {
  return createHash("sha1").update("blob " + Buffer.byteLength(content) + String.fromCharCode(0) + content).digest("hex");
}
function transform(path, source) {
  if (path === "src/hooks/use-pricing.tsx") {
    if (source.includes("APOIS_REPORT09_PRICING_V1")) return source;
    if (gitBlobSha(source) !== "f941ac7431c53bf7d58cea636f354ee577cb97fd")
      throw new Error("[FAIL] Report09: pricing diferente do snapshot pinado; não sobrescrever");
    return pricing;
  }
  const item = patches.find((entry) => entry.path === path);
  if (!item) throw new Error("[FAIL] Report09: caminho fora do escopo " + path);
  if (source.includes(item.marker)) return source;
  for (const marker of item.must) {
    if (!source.includes(marker)) throw new Error("[FAIL] Report09: depende de hardener anterior " + marker + " em " + path);
  }
  let result = source;
  for (const [from, to] of item.pairs) {
    if (!result.includes(from)) throw new Error("[FAIL] Report09: âncora não encontrada: " + path + " / " + from.slice(0,90));
    if (result.split(from).length !== 2) throw new Error("[FAIL] Report09: âncora repetida em " + path);
    result = result.replace(from, to);
  }
  if (!result.includes(item.marker)) throw new Error("[FAIL] Report09: patch não aplicado " + path);
  return result;
}
for (const path of ["src/hooks/use-pricing.tsx", ...patches.map((entry) => entry.path)]) {
  const absolute = resolve(workspace, path);
  const source = readFileSync(absolute, "utf8");
  const result = transform(path, source);
  if (source !== result) writeFileSync(absolute, result, "utf8");
  console.log("[OK] APOIS Relatório 09: " + path);
}
