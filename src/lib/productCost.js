// Integer arithmetic keeps half-cent rounding consistent with PostgreSQL numeric.
export function filamentProductionCost(grams, price) {
  function scaled(value, places) {
    const text = String(value ?? "").trim() || "0";
    if (!new RegExp(`^\\d+(?:\\.\\d{1,${places}})?$`).test(text) || Number(text) > 10000000) {
      throw new Error(`Informe valores de filamento entre zero e 10.000.000, com até ${places} casas decimais.`);
    }
    const [whole, fraction = ""] = text.split(".");
    return BigInt(whole) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, "0"));
  }
  const milligrams = scaled(grams, 3);
  const centsPerKg = scaled(price, 2);
  if (milligrams === 0n || centsPerKg === 0n) return null;
  const cents = (milligrams * centsPerKg + 500000n) / 1000000n;
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

export function updateProductFilament(form, field, value) {
  const next = { ...form, [field]: value };
  try {
    const cost = filamentProductionCost(next.filamento_gramas, next.filamento_valor_kg);
    if (cost !== null) next.custo_medio = cost;
  } catch { /* The form and save validation report incomplete or invalid input. */ }
  return next;
}
