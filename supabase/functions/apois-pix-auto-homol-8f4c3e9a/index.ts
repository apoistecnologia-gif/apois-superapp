import { retiredProvider } from "../_shared/retired-provider.ts";
// provider_retired: endpoint aposentado; nenhum efeito financeiro/provider é permitido.
Deno.serve((req) => retiredProvider(req, "apois-pix-auto-homol-8f4c3e9a", "RETIRED_FAIL_CLOSED"));
