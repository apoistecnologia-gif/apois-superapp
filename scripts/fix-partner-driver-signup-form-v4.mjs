import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(".work/partner-motorista");
const read = (file) => readFileSync(resolve(root, file), "utf8");
const write = (file, content) => writeFileSync(resolve(root, file), content, "utf8");
function once(source, from, to, label) {
  const n = source.split(from).length - 1;
  if (n !== 1) throw Error("[FAIL] Cadastro V4 " + label + " anchors=" + n);
  return source.replace(from, to);
}

const formFile = "src/routes/motorista.cadastro.tsx";
let form = read(formFile);
if (form.includes("APOIS_DRIVER_SIGNUP_FORM_V4")) throw Error("[FAIL] V4 already applied");
if (!form.includes("APOIS_DRIVER_REGISTRATION_EXIT_V3") || !form.includes("APOIS_VEHICLE_SIX_PHOTOS_V1"))
  throw Error("[FAIL] Missing reviewed signup/13-photo baseline");

const helpers = [
  "// APOIS_DRIVER_SIGNUP_FORM_V4: render DD/MM/AAAA, submit ISO and retain sensitive fields unchanged.",
  "const DRIVER_UPPERCASE_FIELDS = new Set([",
  '  "name", "vehicle_model", "vehicle_plate", "vehicle_color", "address",',
  '  "address_number", "address_complement", "province", "city", "state"',
  "]);",
  "function maskDriverBirthDate(value: string): string {",
  '  const digits = value.replace(/\\D/g, "").slice(0, 8);',
  '  return digits.slice(0, 2) + (digits.length >= 2 ? "/" : "") +',
  '    digits.slice(2, 4) + (digits.length >= 4 ? "/" : "") + digits.slice(4, 8);',
  "}",
  "function parseDriverBirthDateBR(value: string): string | null {",
  '  const match = /^(\\d{2})\\/(\\d{2})\\/(\\d{4})$/.exec(value);',
  "  if (!match) return null;",
  "  const day = Number(match[1]);",
  "  const month = Number(match[2]);",
  "  const year = Number(match[3]);",
  "  const candidate = new Date(year, month - 1, day);",
  "  if (year < 1900 || candidate.getFullYear() !== year ||",
  "    candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return null;",
  "  const now = new Date();",
  "  let age = now.getFullYear() - year;",
  "  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) age -= 1;",
  "  if (age < 18 || age > 110) return null;",
  '  return match[3] + "-" + match[2] + "-" + match[1];',
  "}",
  "function uppercaseDriverField(event: React.FormEvent<HTMLFormElement>) {",
  "  const field = event.target;",
  "  if (!(field instanceof HTMLInputElement) || !DRIVER_UPPERCASE_FIELDS.has(field.name)) return;",
  '  if (field.type !== "text") return;',
  '  const next = field.value.toLocaleUpperCase("pt-BR");',
  "  if (next === field.value) return;",
  "  const start = field.selectionStart;",
  "  const end = field.selectionEnd;",
  "  field.value = next;",
  "  if (start !== null && end !== null) field.setSelectionRange(start, end);",
  "}",
  ""
].join("\n");

form = once(form, "function ProgressSteps({ step }", helpers + "function ProgressSteps({ step }", "helper placement");
form = once(form, "  const [submitted, setSubmitted] = useState(false);",
  '  const [submitted, setSubmitted] = useState(false);\n  const [birthDateDisplay, setBirthDateDisplay] = useState("");',
  "birth mask state");

form = once(form,
  '      if (!String(data.get(field) ?? "").trim()) {',
  '      if (field === "birth_date" && !parseDriverBirthDateBR(String(data.get(field) ?? ""))) {\n' +
  '        setError("Informe uma data de nascimento válida (DD/MM/AAAA), com idade mínima de 18 anos.");\n' +
  '        element?.focus();\n' +
  '        return false;\n' +
  '      }\n' +
  '      if (!String(data.get(field) ?? "").trim()) {',
  "step-two date validation");

form = once(form,
  '    const parsed = schema.safeParse(Object.fromEntries(new FormData(e.currentTarget).entries()));',
  '    const rawData = Object.fromEntries(new FormData(e.currentTarget).entries());\n' +
  '    const birthISO = parseDriverBirthDateBR(String(rawData.birth_date ?? ""));\n' +
  '    if (!birthISO) {\n' +
  '      setError("Informe sua data de nascimento válida no formato DD/MM/AAAA (idade mínima de 18 anos).");\n' +
  '      return;\n' +
  '    }\n' +
  '    const parsed = schema.safeParse({ ...rawData, birth_date: birthISO });',
  "ISO date submitted to existing backend contract");

form = once(form,
  '    } catch (err) {\n      setError(translateAuthError(err));\n    } finally {',
  '    } catch (err) {\n' +
  '      if (err instanceof Error && err.message === "Conta criada. Confirme seu e-mail e depois entre para concluir o cadastro.") {\n' +
  '        // Authentication exists, but no verified session: photos were NOT submitted.\n' +
  '        try { sessionStorage.setItem("apois-driver-await-email-v4", "1"); } catch { /* unavailable */ }\n' +
  '        navigate({ to: "/motorista/login", replace: true });\n' +
  '        return;\n' +
  '      }\n' +
  '      setError(translateAuthError(err));\n' +
  '    } finally {',
  "leave signup after email-confirmation gate");

form = once(form,
  '<form ref={formRef} onSubmit={onSubmit} method="post" noValidate className="min-w-0">',
  '<form ref={formRef} onSubmit={onSubmit} onInputCapture={uppercaseDriverField} method="post" noValidate className="min-w-0">',
  "uppercase typed fields without changing email or password");

const oldBirth = '<DSInput name="birth_date" required type="date" className="h-12 min-w-0 bg-[#0D0F11] [color-scheme:dark]" />';
const newBirth = '<DSInput name="birth_date" required type="text" inputMode="numeric" autoComplete="bday" ' +
  'placeholder="DD/MM/AAAA" maxLength={10} value={birthDateDisplay} ' +
  'onChange={(event) => setBirthDateDisplay(maskDriverBirthDate(event.currentTarget.value))} ' +
  'onKeyDown={(event) => { if (event.key === "Backspace" && birthDateDisplay.endsWith("/")) { ' +
  'event.preventDefault(); setBirthDateDisplay(birthDateDisplay.slice(0, -2)); } }} ' +
  'className="h-12 min-w-0 bg-[#0D0F11] tabular-nums" />';
form = once(form, oldBirth, newBirth, "typed date input");

write(formFile, form);

const loginFile = "src/routes/motorista.login.tsx";
let login = read(loginFile);
if (!login.includes('function DriverLoginPage()') || !login.includes('const [error, setError]'))
  throw Error("[FAIL] Cannot identify login form");
if (login.includes("APOIS_DRIVER_SIGNUP_FORM_V4")) throw Error("[FAIL] Login patch already applied");
login = once(login, 'import { useRef, useState } from "react";',
  'import { useEffect, useRef, useState } from "react";', "login useEffect");
login = once(login,
  '  const [error, setError] = useState<string | null>(null);',
  '  const [error, setError] = useState<string | null>(null);\n' +
  '  const [registrationNotice, setRegistrationNotice] = useState(false);\n' +
  '  // APOIS_DRIVER_SIGNUP_FORM_V4\n' +
  '  useEffect(() => {\n' +
  '    try {\n' +
  '      if (sessionStorage.getItem("apois-driver-await-email-v4") === "1") {\n' +
  '        sessionStorage.removeItem("apois-driver-await-email-v4");\n' +
  '        setRegistrationNotice(true);\n' +
  '      }\n' +
  '    } catch { /* private-mode storage unavailable */ }\n' +
  '  }, []);',
  "login confirmation banner state");
login = once(login,
  '          {error ? <div role="alert"',
  '          {registrationNotice ? <div role="status" aria-live="polite" ' +
  'className="rounded-[16px] border border-emerald-300/30 bg-emerald-50 p-4 text-sm font-semibold leading-relaxed text-emerald-950">' +
  'Sua conta de acesso foi criada. Confirme o e-mail recebido e depois entre. ' +
  'Os documentos ainda não foram enviados; após confirmar, volte ao cadastro para concluir o envio com o mesmo e-mail e senha.' +
  '</div> : null}\n          {error ? <div role="alert"',
  "login notice before errors");
write(loginFile, login);

console.log("[OK] APOIS Motorista V4: signup leaves step 3 for login on confirmation gate, typed Brazilian DOB and uppercase fields.");
