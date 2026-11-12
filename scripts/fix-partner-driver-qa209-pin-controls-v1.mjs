// APOIS_DRIVER_QA209_REAL_PIN_V1. Android QA208: faux boxes over invisible input.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const file=resolve(root,"src/routes/motorista.app.tsx"),cssFile=resolve(root,"src/styles.css");
let s=readFileSync(file,"utf8"),css=readFileSync(cssFile,"utf8");
const marker="APOIS_DRIVER_QA209_REAL_PIN_V1";
if(s.includes(marker)||css.includes(marker))throw Error("[FAIL] QA209 PIN duplicate");
const begin=s.indexOf("function ActiveRidePanel("),end=s.indexOf("\nfunction ActionButton(",begin);
if(begin<0||end<=begin)throw Error("[FAIL] QA209 PIN panel bounds");
let panel=s.slice(begin,end);
const oldHook='  const [pinCode, setPinCode] = useState("");';
if(panel.split(oldHook).length!==2)throw Error("[FAIL] QA209 pin hook");
panel=panel.replace(oldHook,oldHook+
 '\n  // '+marker+': four real focusable fields, no transparent full-row input.'+
 '\n  const pinDigitRefs = useRef<Array<HTMLInputElement | null>>([]);'+
 '\n  const [pinFocusedIndex, setPinFocusedIndex] = useState<number | null>(null);');
const inputStart=panel.indexOf('<label htmlFor="apois-motorista-pin-v4"');
const inputEnd=inputStart<0?-1:panel.indexOf("</label>",inputStart);
if(inputStart<0||inputEnd<=inputStart)throw Error("[FAIL] QA209 fake PIN markup missing");
const former=panel.slice(inputStart,inputEnd);
for(const x of ['opacity-0','maxLength={4}','value={pinCode}'])
 if(!former.includes(x))throw Error("[FAIL] QA209 PIN precondition "+x);
const fields="<div role=\"group\" aria-label=\"PIN de quatro dígitos\" className=\"grid grid-cols-4 gap-2.5\">\n                  {[0,1,2,3].map((position) => (\n                    <div key={position} className=\"relative min-w-0\">\n                      <input\n                        id={position === 0 ? \"apois-motorista-pin-v4\" : undefined}\n                        ref={(node) => { pinDigitRefs.current[position] = node; }}\n                        type=\"text\"\n                        inputMode=\"numeric\"\n                        pattern=\"[0-9]*\"\n                        autoComplete={position === 0 ? \"one-time-code\" : \"off\"}\n                        maxLength={1}\n                        disabled={pinBusy}\n                        aria-label={\"Dígito \" + (position+1) + \" do PIN\"}\n                        aria-describedby=\"apois-qa195-pin-hint\"\n                        aria-invalid={Boolean(pinError)}\n                        value={pinCode[position] ?? \"\"}\n                        onFocus={() => {\n                          if (position > pinCode.length) {\n                            pinDigitRefs.current[Math.min(pinCode.length,3)]?.focus();\n                            return;\n                          }\n                          setPinFocusedIndex(position);\n                        }}\n                        onBlur={() => setPinFocusedIndex(null)}\n                        onChange={(event) => {\n                          const digit = event.currentTarget.value.replace(/\\D/g,\"\").slice(-1);\n                          setPinError(null);\n                          if (!digit) {\n                            setPinCode((previous) => previous.slice(0,position));\n                            return;\n                          }\n                          setPinCode((previous) => (previous.slice(0,position)+digit+previous.slice(position+1)).slice(0,4));\n                          window.requestAnimationFrame(() => pinDigitRefs.current[Math.min(position+1,3)]?.focus());\n                        }}\n                        onPaste={(event) => {\n                          const digits = event.clipboardData.getData(\"text\").replace(/\\D/g,\"\").slice(0,4);\n                          if (!digits) return;\n                          event.preventDefault();\n                          setPinCode(digits); setPinError(null);\n                          window.requestAnimationFrame(() => pinDigitRefs.current[Math.min(digits.length,3)]?.focus());\n                        }}\n                        onKeyDown={(event) => {\n                          if (event.key === \"Enter\" && pinCode.length === 4) void submitPin();\n                          if (event.key === \"ArrowLeft\" && position > 0) pinDigitRefs.current[position-1]?.focus();\n                          if (event.key === \"Backspace\" && !pinCode[position] && position > 0) {\n                            event.preventDefault();\n                            setPinCode((previous) => previous.slice(0,position-1));\n                            window.requestAnimationFrame(() => pinDigitRefs.current[position-1]?.focus());\n                          }\n                        }}\n                        className=\"h-[62px] w-full min-w-0 rounded-[15px] border-2 border-[#D0D5DD] bg-[#F9FAFB] text-center text-[30px] font-extrabold tabular-nums text-[#111827] caret-[#C9141B] outline-none transition focus:border-[#C9141B] focus:bg-[#FFF1F2] focus:ring-2 focus:ring-[#C9141B]/25 disabled:opacity-60\"\n                      />\n                      {pinFocusedIndex === position && !pinCode[position] && !pinBusy && (\n                        <span aria-hidden=\"true\" data-apois-pin-caret=\"true\" className=\"pointer-events-none absolute left-1/2 top-1/2 h-7 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-[#C9141B]\" />\n                      )}\n                    </div>\n                  ))}\n                </div>";
panel=panel.slice(0,inputStart)+fields+panel.slice(inputEnd+"</label>".length);
for(const x of ["onStart(pinCode)","onClick={() => void submitPin()}","Toque em qualquer quadradinho para digitar o PIN","aria-label=\"PIN de quatro dígitos\"","data-apois-pin-caret"])
 if(!panel.includes(x))throw Error("[FAIL] QA209 PIN preserved contract "+x);
if(panel.includes('cursor-text opacity-0'))throw Error("[FAIL] QA209 transparent PIN still present");
s=s.slice(0,begin)+panel+s.slice(end);
css+="\n/* "+marker+": visible blinking caret belongs to a real numeric input. */\n"+
 '@keyframes apois-pin-caret-blink{0%,49%{opacity:1}50%,100%{opacity:0}}\n'+
 '[data-apois-pin-caret="true"]{animation:apois-pin-caret-blink 1s step-end infinite;}\n'+
 '@media(prefers-reduced-motion:reduce){[data-apois-pin-caret="true"]{animation:none;}}\n';
writeFileSync(file,s,"utf8");writeFileSync(cssFile,css,"utf8");
console.log("[OK] QA209 PIN four real touchable digits, blinking caret, backspace/paste/advance and original server PIN verification.");
