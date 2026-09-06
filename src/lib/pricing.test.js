import test from "node:test";
import assert from "node:assert/strict";
import { calculatePricing, calculateTier, classifyMargin, priceForMargin } from "./pricing.js";

const baseInput = {
  quantity: 1, filaments: [], wastePercent: 0, printHours: 0, printMinutes: 0,
  printRate: 0, manualHours: 0, manualMinutes: 0, manualRate: 0, extras: [],
  energyEnabled: false, modelingMode: "fixed", modelingFixed: 0, fixedMode: "value",
  fixedValue: 0, markup: 0, roundTo: 0, hourRanges: [], useRanges: false,
  partnerPercent: 0, desiredMargin: 50, minimumMargin: 30,
};

test("calcula custo de filamento, desperdício e acréscimo", () => {
  const result = calculatePricing({ ...baseInput, filaments: [{ rollKg: 1, rollPrice: 100, grams: 120 }], wastePercent: 5, markup: 100 });
  assert.equal(result.filamentCost, 12);
  assert.equal(result.wasteCost, 0.6);
  assert.equal(result.suggestedUnitPrice, 25.2);
});

test("separa preço de margem desejada, preço mínimo e margem real", () => {
  const result = calculatePricing({ ...baseInput, modelingFixed: 8.25, finalPriceEnabled: true, finalUnitPrice: 17 });
  assert.equal(result.margin.toFixed(2), "51.47");
  assert.equal(result.minimumRecommendedPrice, 11.79);
  assert.equal(result.desiredMarginPrice, 16.5);
  assert.equal(result.marginStatus.label, "Margem saudável");
});

test("aplica desconto de lote sem forçar preço pela margem mínima", () => {
  const result = calculatePricing({ ...baseInput, modelingFixed: 8.25, finalPriceEnabled: true, finalUnitPrice: 17 });
  const tier = calculateTier(result, { quantity: 10, discount: 10 }, 50, 30);
  assert.equal(tier.unitPrice, 15.3);
  assert.equal(tier.profitPerUnit, 7.05);
  assert.equal(tier.margin.toFixed(2), "46.08");
  assert.equal(tier.status.label, "Margem reduzida");
});

test("classifica margem abaixo do mínimo sem bloquear a venda", () => {
  assert.equal(classifyMargin(25, 50, 30).label, "Margem abaixo do mínimo");
  assert.equal(priceForMargin(8.25, 30), 11.79);
});

