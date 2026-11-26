/** Build a read-only expression safe before the local HTML body has been parsed. */
export const textCheckpoint = text => 'typeof document.body?.innerText === "string" && document.body.innerText.includes('+JSON.stringify(text)+')'
