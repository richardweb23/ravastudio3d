const numberValue = (value) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};
const roundCurrency = (value) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const money = (value) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);

export const priceForMargin = (cost, margin) => {
  const marginFactor = 1 - numberValue(margin) / 100;
  return marginFactor > 0 ? roundCurrency(numberValue(cost) / marginFactor) : 0;
};

export const classifyMargin = (margin, desiredMargin, minimumMargin) => {
  if (margin >= numberValue(desiredMargin)) {
    return { label: "Margem saudável", tone: "healthy" };
  }
  if (margin >= numberValue(minimumMargin)) {
    return { label: "Margem reduzida", tone: "reduced" };
  }
  return { label: "Margem abaixo do mínimo", tone: "low" };
};

export const calculatePricing = (input) => {
  const quantity = Math.max(1, numberValue(input.quantity));
  const printHours =
    numberValue(input.printHours) + numberValue(input.printMinutes) / 60;
  const manualHours =
    numberValue(input.manualHours) + numberValue(input.manualMinutes) / 60;
  const filaments = input.filaments.map((filament) => {
    const rollGrams = numberValue(filament.rollKg) * 1000;
    const perGram = rollGrams ? numberValue(filament.rollPrice) / rollGrams : 0;
    return {
      ...filament,
      perGram,
      cost: roundCurrency(perGram * numberValue(filament.grams) * quantity),
    };
  });
  const filamentCost = filaments.reduce((total, item) => total + item.cost, 0);
  const wasteCost = roundCurrency(
    filamentCost * (numberValue(input.wastePercent) / 100),
  );
  const selectedRange = input.useRanges
    ? input.hourRanges.find(
        (range) =>
          printHours >= numberValue(range.from) &&
          (range.to === "" || printHours <= numberValue(range.to)),
      )
    : null;
  const printRate = selectedRange
    ? numberValue(selectedRange.rate)
    : numberValue(input.printRate);
  const printCost = roundCurrency(printHours * printRate);
  const manualCost = roundCurrency(manualHours * numberValue(input.manualRate));
  const energyCost = input.energyEnabled
    ? roundCurrency(
        (numberValue(input.energyWatts) / 1000) *
          printHours *
          numberValue(input.energyKwh),
      )
    : 0;
  const extrasCost = roundCurrency(
    input.extras.reduce((total, item) => {
      const multiplier = item.scope === "project" ? 1 : quantity;
      return (
        total +
        numberValue(item.quantity) * numberValue(item.unitPrice) * multiplier
      );
    }, 0),
  );
  const modelingCost = roundCurrency(
    input.modelingMode === "hours"
      ? numberValue(input.modelingHours) * numberValue(input.modelingRate)
      : numberValue(input.modelingFixed),
  );
  const beforeFixed =
    filamentCost +
    wasteCost +
    printCost +
    manualCost +
    energyCost +
    extrasCost +
    modelingCost;
  const fixedCost = roundCurrency(
    input.fixedMode === "percent"
      ? beforeFixed * (numberValue(input.fixedValue) / 100)
      : numberValue(input.fixedValue),
  );
  const totalCost = roundCurrency(beforeFixed + fixedCost);
  const unitCost = roundCurrency(totalCost / quantity);
  const rawUnitPrice = unitCost * (1 + numberValue(input.markup) / 100);
  const roundTo = numberValue(input.roundTo);
  const suggestedUnitPrice = roundTo
    ? Math.ceil(rawUnitPrice / roundTo) * roundTo
    : roundCurrency(rawUnitPrice);
  const manualUnitPrice = numberValue(input.finalUnitPrice);
  const finalUnitPrice =
    input.finalPriceEnabled && manualUnitPrice > 0
      ? manualUnitPrice
      : suggestedUnitPrice;
  const profitUnit = roundCurrency(finalUnitPrice - unitCost);
  const margin = finalUnitPrice ? (profitUnit / finalUnitPrice) * 100 : 0;
  const desiredMarginPrice = priceForMargin(unitCost, input.desiredMargin);
  const minimumRecommendedPrice = priceForMargin(
    unitCost,
    input.minimumMargin,
  );
  const marginStatus = classifyMargin(
    margin,
    input.desiredMargin,
    input.minimumMargin,
  );
  const partnerValue =
    finalUnitPrice * quantity * (numberValue(input.partnerPercent) / 100);
  const studioValue = finalUnitPrice * quantity - partnerValue;
  const consignmentProfit = studioValue - totalCost;
  const minimumConsumerPrice =
    numberValue(input.partnerPercent) < 100
      ? totalCost /
        ((1 - numberValue(input.minimumMargin) / 100) *
          (1 - numberValue(input.partnerPercent) / 100))
      : 0;
  return {
    quantity,
    printHours,
    manualHours,
    filaments,
    filamentCost,
    wasteCost,
    printRate,
    printCost,
    manualCost,
    energyCost,
    extrasCost,
    modelingCost,
    fixedCost,
    totalCost,
    unitCost,
    rawUnitPrice,
    suggestedUnitPrice,
    finalUnitPrice,
    profitUnit,
    profitTotal: profitUnit * quantity,
    margin,
    marginStatus,
    baseUnitPrice: finalUnitPrice,
    desiredMarginPrice,
    minimumRecommendedPrice,
    partnerValue,
    studioValue,
    consignmentProfit,
    minimumConsumerPrice,
  };
};

export const calculateTier = (result, tier, desiredMargin, minimumMargin) => {
  const unitPrice = roundCurrency(
    result.baseUnitPrice * (1 - numberValue(tier.discount) / 100),
  );
  const margin = unitPrice
    ? ((unitPrice - result.unitCost) / unitPrice) * 100
    : 0;
  const quantity = numberValue(tier.quantity);
  const profitPerUnit = roundCurrency(unitPrice - result.unitCost);
  const total = roundCurrency(unitPrice * quantity);
  const costTotal = roundCurrency(result.unitCost * quantity);
  const profitTotal = roundCurrency(profitPerUnit * quantity);
  return {
    unitPrice,
    total,
    costTotal,
    profitPerUnit,
    profitTotal,
    margin,
    status: classifyMargin(margin, desiredMargin, minimumMargin),
  };
};


