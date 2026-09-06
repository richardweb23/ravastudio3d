export function parseMeasurement(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(",", ".");
  if (!normalized || !/^\d+(?:\.\d*)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function calculateScale(currentSize, desiredSize) {
  if (
    !Number.isFinite(currentSize) ||
    !Number.isFinite(desiredSize) ||
    currentSize <= 0 ||
    desiredSize < 0
  )
    return null;
  const scale = (desiredSize / currentSize) * 100;
  const percentageChange = scale - 100;
  const physicalDifference = desiredSize - currentSize;
  if (![scale, percentageChange, physicalDifference].every(Number.isFinite))
    return null;
  return {
    scale,
    percentageChange,
    physicalDifference,
    state: scale > 100 ? "increase" : scale < 100 ? "reduction" : "original",
  };
}

