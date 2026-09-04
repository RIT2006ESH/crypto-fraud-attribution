// Probes /api/traces validation with precisely-constructed address strings.
const BASE = "0x28C6c06298d514Db089934071355E5743bf21d60";

const cases = [
  ["plain valid", BASE],
  ["leading/trailing ASCII space", `  ${BASE}  `],
  ["trailing newline", `${BASE}\n`],
  ["NBSP padded (U+00A0)", ` ${BASE} `],
  ["zero-width space inside (U+200B)", BASE.slice(0, 20) + "​" + BASE.slice(20)],
  ["zero-width joiner appended (U+200D)", `${BASE}‍`],
  ["LTR mark appended (U+200E)", `${BASE}‎`],
  ["0X uppercase prefix", `0X${BASE.slice(2)}`],
  ["truncated to 38 hex", BASE.slice(0, 40)],
  ["one extra hex char", `${BASE}a`],
];

for (const [name, walletAddress] of cases) {
  const res = await fetch("http://localhost:8080/api/traces", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, chain: "ethereum" }),
  });
  let detail = "";
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    detail = ` :: ${body.error ?? ""}`;
  } else {
    await res.text();
  }
  console.log(`HTTP ${res.status}  ${name.padEnd(36)}${detail}`);
}
