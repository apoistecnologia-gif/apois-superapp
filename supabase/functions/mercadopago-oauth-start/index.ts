import { retiredProvider } from "../_shared/retired-provider.ts";
// provider_retired: endpoint aposentado; nenhum efeito financeiro/provider é permitido.
Deno.serve((req) => retiredProvider(req, "mercadopago-oauth-start", "OAUTH_RETIRED"));
