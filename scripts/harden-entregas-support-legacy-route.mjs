import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || ".work/entregas";
const file = resolve(workspace, "src/routes/chamado-suporte.$ticketId.tsx");
if (!existsSync(file)) throw new Error("[FAIL] APOIS Entregas: rota legada de suporte não encontrada");
const old = readFileSync(file, "utf8");

const updated = `// APOIS_SUPPORT_LEGACY_REDIRECT_V1
// Mantém deep links antigos, mas impede duas implementações conflitantes
// de conversa e anexo de suporte. A rota canônica valida sessão e acesso.
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/chamado-suporte/$ticketId")({
  ssr: false,
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/perfil/ajuda/chamado/$ticketId",
      params: { ticketId: params.ticketId },
      replace: true,
    });
  },
  component: () => null,
  head: () => ({ meta: [{ title: "Chamado de suporte | APOIS ENTREGA" }] }),
});
`;

if (old === updated) {
  console.log("[OK] Entregas: suporte legado já redireciona para a conversa canônica");
} else if (old.includes("APOIS_SUPPORT_LEGACY_REDIRECT_V1")) {
  throw new Error("[FAIL] Entregas: redirect legado alterado; revisão necessária");
} else if (
  old.includes('createFileRoute("/chamado-suporte/$ticketId")') &&
  old.includes('supabase.functions.invoke("customer-support"') &&
  old.includes('ticket.status !== "closed"')
) {
  writeFileSync(file, updated, "utf8");
  console.log("[OK] Entregas: rota antiga preservada como alias sem lógica duplicada");
} else {
  throw new Error("[FAIL] Entregas: versão inesperada da rota legada; nada foi alterado");
}
