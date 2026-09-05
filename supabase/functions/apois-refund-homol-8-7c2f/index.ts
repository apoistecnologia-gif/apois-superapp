import { retiredProvider } from "../_shared/retired-provider.ts";
// provider_retired: endpoint aposentado; nenhum efeito financeiro/provider é permitido.
Deno.serve((req) => retiredProvider(req, "apois-refund-homol-8-7c2f", "RETIRED_FAIL_CLOSED"));
