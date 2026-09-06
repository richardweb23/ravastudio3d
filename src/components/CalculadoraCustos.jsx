/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from "react";
import { calculatePricing, calculateTier, money } from "../lib/pricing.js";
import { supabase } from "../supabase.js";

const material = () => ({
  id: crypto.randomUUID(),
  name: "",
  type: "PLA",
  color: "",
  rollKg: "1",
  rollPrice: "",
  grams: "",
});
const extra = () => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: "1",
  unitPrice: "",
  scope: "unit",
});
const tiersDefault = [
  { quantity: 1, discount: 0 },
  { quantity: 5, discount: 5 },
  { quantity: 10, discount: 10 },
  { quantity: 20, discount: 15 },
  { quantity: 50, discount: 20 },
];
const initial = {
  projectName: "",
  client: "",
  description: "",
  quantity: "1",
  filaments: [material()],
  wastePercent: "5",
  printHours: "0",
  printMinutes: "0",
  printRate: "3",
  useRanges: false,
  hourRanges: [
    { from: "0", to: "15", rate: "3" },
    { from: "15", to: "20", rate: "4" },
    { from: "20", to: "", rate: "5" },
  ],
  manualHours: "0",
  manualMinutes: "0",
  manualRate: "20",
  extras: [],
  energyEnabled: false,
  energyWatts: "150",
  energyKwh: "1",
  fixedMode: "value",
  fixedValue: "0",
  modelingMode: "fixed",
  modelingFixed: "0",
  modelingHours: "0",
  modelingRate: "30",
  markup: "100",
  desiredMargin: "50",
  minimumMargin: "30",
  roundTo: "1",
  finalPriceEnabled: false,
  finalUnitPrice: "",
  consignmentEnabled: false,
  partnerPercent: "30",
};

function NumberInput({
  value,
  onChange,
  label,
  suffix,
  min = "0",
  step = "0.01",
}) {
  return (
    <label className="calculator-field">
      {label}
      <span className="calculator-input">
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix && <small>{suffix}</small>}
      </span>
    </label>
  );
}
function SummaryLine({ label, value }) {
  return (
    <div className="calculator-summary-line">
      <span>{label}</span>
      <strong>{money(value)}</strong>
    </div>
  );
}

export default function CalculadoraCustos({ materiais, show }) {
  const [form, setForm] = useState(initial);
  const [tiers, setTiers] = useState(tiersDefault);
  const [savedCalculations, setSavedCalculations] = useState([]);
  const [selectedCalculation, setSelectedCalculation] = useState(null);
  const [saving, setSaving] = useState(false);
  const result = useMemo(() => calculatePricing(form), [form]);
  const update = (field, value) =>
    setForm((current) => ({ ...current, [field]: value }));
  const updateList = (list, id, field, value) =>
    setForm((current) => ({
      ...current,
      [list]: current[list].map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    }));
  const removeList = (list, id) =>
    setForm((current) => ({
      ...current,
      [list]: current[list].filter((item) => item.id !== id),
    }));
  const loadCalculations = async () => {
    const { data, error } = await supabase
      .from("calculos_precificacao")
      .select(
        "id, material_id, nome_projeto, cliente, descricao, configuracao, updated_at, materiais(nome)",
      )
      .order("updated_at", { ascending: false });
    if (error)
      return show(
        `Não foi possível carregar simulações: ${error.message}`,
        "error",
      );
    setSavedCalculations(data || []);
  };
  useEffect(() => {
    loadCalculations();
  }, []);
  const startNew = () => {
    setForm(initial);
    setTiers(tiersDefault);
    setSelectedCalculation(null);
  };
  const loadCalculation = (calculation) => {
    const configuration = calculation.configuracao || {};
    setForm({
      ...initial,
      ...configuration,
      projectName: calculation.nome_projeto || configuration.projectName || "",
      client: calculation.cliente || "",
      description: calculation.descricao || "",
      materialId: calculation.material_id || "",
    });
    setTiers(configuration.tiers || tiersDefault);
    setSelectedCalculation(calculation.id);
  };
  const saveCalculation = async () => {
    if (!form.projectName.trim())
      return show("Informe o nome do projeto antes de salvar.", "error");
    setSaving(true);
    const values = {
      material_id: form.materialId || null,
      nome_projeto: form.projectName.trim(),
      cliente: form.client.trim() || null,
      descricao: form.description.trim() || null,
      configuracao: { ...form, tiers },
      resultado: result,
      updated_at: new Date().toISOString(),
    };
    const query = selectedCalculation
      ? supabase
          .from("calculos_precificacao")
          .update(values)
          .eq("id", selectedCalculation)
      : supabase
          .from("calculos_precificacao")
          .insert(values)
          .select("id")
          .single();
    const { data, error } = await query;
    setSaving(false);
    if (error)
      return show(`Não foi possível salvar: ${error.message}`, "error");
    if (!selectedCalculation) setSelectedCalculation(data.id);
    show(selectedCalculation ? "Simulação atualizada." : "Simulação salva.");
    loadCalculations();
  };
  const alerts = [
    result.quantity < 1 && "A quantidade deve ser maior que zero.",
    result.finalUnitPrice < result.unitCost &&
      "O preço final está abaixo do custo unitário.",
    result.marginStatus.tone === "reduced" &&
      "A margem está abaixo da meta desejada, mas ainda acima da margem mínima de segurança.",
    result.marginStatus.tone === "low" &&
      "Atenção: a margem está abaixo do mínimo de segurança configurado.",
  ].filter(Boolean);

  return (
    <div className="calculator-page">
      <div className="page-header">
        <div>
          <h1>Calculadora de custos</h1>
          <p>
            Simule custos e encontre um preço de venda seguro para cada
            impressão.
          </p>
        </div>
        <div className="calculator-actions">
          <button className="secondary-button" onClick={startNew}>
            Nova simulação
          </button>
          <button
            className="primary"
            disabled={saving}
            onClick={saveCalculation}
          >
            {saving
              ? "Salvando…"
              : selectedCalculation
                ? "Atualizar simulação"
                : "Salvar simulação"}
          </button>
        </div>
      </div>
      {savedCalculations.length > 0 && (
        <section className="calculator-saved panel">
          <div>
            <h2>Simulações salvas</h2>
            <p>
              Reabra uma configuração para revisar custos e atualizar valores.
            </p>
          </div>
          <div className="calculator-saved-list">
            {savedCalculations.map((calculation) => (
              <button
                key={calculation.id}
                className={
                  selectedCalculation === calculation.id ? "active" : ""
                }
                onClick={() => loadCalculation(calculation)}
              >
                <strong>{calculation.nome_projeto}</strong>
                <small>{calculation.materiais?.nome || "Projeto livre"}</small>
              </button>
            ))}
          </div>
        </section>
      )}
      <div className="calculator-layout">
        <div className="calculator-form">
          <section className="calculator-section">
            <div className="calculator-section-title">
              <span>01</span>
              <h2>Dados do projeto</h2>
            </div>
            <div className="calculator-grid calculator-grid-project">
              <label className="calculator-field calculator-wide">
                Vincular a produto cadastrado <small>opcional</small>
                <select
                  value={form.materialId || ""}
                  onChange={(event) => {
                    const material = materiais.find(
                      (item) => item.id === event.target.value,
                    );
                    setForm((current) => ({
                      ...current,
                      materialId: event.target.value,
                      projectName:
                        material && !current.projectName
                          ? material.nome
                          : current.projectName,
                    }));
                  }}
                >
                  <option value="">Projeto livre / ainda não cadastrado</option>
                  {materiais.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </label>
              <label className="calculator-field calculator-wide">
                Nome do projeto
                <input
                  value={form.projectName}
                  onChange={(event) =>
                    update("projectName", event.target.value)
                  }
                  placeholder="Ex.: Mascote Sonic 25cm"
                />
              </label>
              <label className="calculator-field">
                Cliente <small>opcional</small>
                <input
                  value={form.client}
                  onChange={(event) => update("client", event.target.value)}
                />
              </label>
              <NumberInput
                label="Quantidade"
                value={form.quantity}
                onChange={(value) => update("quantity", value)}
                step="1"
                min="1"
              />
              <label className="calculator-field calculator-wide">
                Descrição <small>opcional</small>
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    update("description", event.target.value)
                  }
                  rows="2"
                />
              </label>
            </div>
          </section>

          <section className="calculator-section">
            <div className="calculator-section-title">
              <span>02</span>
              <h2>Filamento</h2>
              <button
                className="secondary-button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    filaments: [...current.filaments, material()],
                  }))
                }
              >
                + Adicionar filamento
              </button>
            </div>
            <div className="calculator-list">
              {form.filaments.map((item, index) => (
                <div className="calculator-item" key={item.id}>
                  <div className="calculator-item-head">
                    <strong>Material {index + 1}</strong>
                    {form.filaments.length > 1 && (
                      <button
                        className="remove-button"
                        onClick={() => removeList("filaments", item.id)}
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  <div className="calculator-grid calculator-grid-material">
                    <label className="calculator-field">
                      Nome/descrição
                      <input
                        value={item.name}
                        onChange={(event) =>
                          updateList(
                            "filaments",
                            item.id,
                            "name",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <label className="calculator-field">
                      Material
                      <select
                        value={item.type}
                        onChange={(event) =>
                          updateList(
                            "filaments",
                            item.id,
                            "type",
                            event.target.value,
                          )
                        }
                      >
                        {["PLA", "PETG", "ABS", "TPU", "ASA", "Outro"].map(
                          (type) => (
                            <option key={type}>{type}</option>
                          ),
                        )}
                      </select>
                    </label>
                    <label className="calculator-field">
                      Cor <small>opcional</small>
                      <input
                        value={item.color}
                        onChange={(event) =>
                          updateList(
                            "filaments",
                            item.id,
                            "color",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <NumberInput
                      label="Peso do rolo"
                      suffix="kg"
                      value={item.rollKg}
                      onChange={(value) =>
                        updateList("filaments", item.id, "rollKg", value)
                      }
                    />
                    <NumberInput
                      label="Preço do rolo"
                      suffix="R$"
                      value={item.rollPrice}
                      onChange={(value) =>
                        updateList("filaments", item.id, "rollPrice", value)
                      }
                    />
                    <NumberInput
                      label="Uso na peça"
                      suffix="g"
                      value={item.grams}
                      onChange={(value) =>
                        updateList("filaments", item.id, "grams", value)
                      }
                    />
                    <p className="calculator-calculation">
                      {money(result.filaments[index]?.perGram || 0)}/g ·{" "}
                      <strong>
                        {money(result.filaments[index]?.cost || 0)}
                      </strong>
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="calculator-inline-total">
              <span>Total de filamento</span>
              <strong>{money(result.filamentCost)}</strong>
              <NumberInput
                label="Desperdício"
                suffix="%"
                value={form.wastePercent}
                onChange={(value) => update("wastePercent", value)}
              />
              <span>
                Perda: <strong>{money(result.wasteCost)}</strong>
              </span>
            </div>
          </section>

          <section className="calculator-section">
            <div className="calculator-section-title">
              <span>03</span>
              <h2>Tempo de produção</h2>
            </div>
            <div className="calculator-grid calculator-grid-times">
              <NumberInput
                label="Impressão"
                suffix="horas"
                value={form.printHours}
                onChange={(value) => update("printHours", value)}
                step="1"
              />
              <NumberInput
                label="Minutos"
                suffix="min"
                value={form.printMinutes}
                onChange={(value) => update("printMinutes", value)}
                step="1"
              />
              <label className="calculator-toggle">
                <input
                  type="checkbox"
                  checked={form.useRanges}
                  onChange={(event) =>
                    update("useRanges", event.target.checked)
                  }
                />
                Usar tabela de faixas
              </label>
              {!form.useRanges ? (
                <NumberInput
                  label="Valor da impressora"
                  suffix="R$/h"
                  value={form.printRate}
                  onChange={(value) => update("printRate", value)}
                />
              ) : (
                <div className="calculator-range-list">
                  {form.hourRanges.map((range, index) => (
                    <div key={index}>
                      <NumberInput
                        label="De"
                        suffix="h"
                        value={range.from}
                        onChange={(value) =>
                          update(
                            "hourRanges",
                            form.hourRanges.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, from: value }
                                : item,
                            ),
                          )
                        }
                      />
                      <NumberInput
                        label="Até"
                        suffix="h"
                        value={range.to}
                        onChange={(value) =>
                          update(
                            "hourRanges",
                            form.hourRanges.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, to: value }
                                : item,
                            ),
                          )
                        }
                      />
                      <NumberInput
                        label="Valor"
                        suffix="R$/h"
                        value={range.rate}
                        onChange={(value) =>
                          update(
                            "hourRanges",
                            form.hourRanges.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, rate: value }
                                : item,
                            ),
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
              <NumberInput
                label="Trabalho manual"
                suffix="horas"
                value={form.manualHours}
                onChange={(value) => update("manualHours", value)}
                step="1"
              />
              <NumberInput
                label="Minutos manuais"
                suffix="min"
                value={form.manualMinutes}
                onChange={(value) => update("manualMinutes", value)}
                step="1"
              />
              <NumberInput
                label="Valor mão de obra"
                suffix="R$/h"
                value={form.manualRate}
                onChange={(value) => update("manualRate", value)}
              />
            </div>
          </section>

          <section className="calculator-section">
            <div className="calculator-section-title">
              <span>04</span>
              <h2>Custos extras</h2>
              <button
                className="secondary-button"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    extras: [...current.extras, extra()],
                  }))
                }
              >
                + Adicionar custo
              </button>
            </div>
            {form.extras.length === 0 ? (
              <p className="calculator-empty">
                Adicione itens como ímã, argola, embalagem, NFC ou outro insumo.
              </p>
            ) : (
              <div className="calculator-list">
                {form.extras.map((item) => (
                  <div className="calculator-extra" key={item.id}>
                    <label className="calculator-field">
                      Descrição
                      <input
                        value={item.description}
                        onChange={(event) =>
                          updateList(
                            "extras",
                            item.id,
                            "description",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <NumberInput
                      label="Quantidade"
                      value={item.quantity}
                      onChange={(value) =>
                        updateList("extras", item.id, "quantity", value)
                      }
                    />
                    <NumberInput
                      label="Valor unitário"
                      suffix="R$"
                      value={item.unitPrice}
                      onChange={(value) =>
                        updateList("extras", item.id, "unitPrice", value)
                      }
                    />
                    <label className="calculator-field">
                      Aplicação
                      <select
                        value={item.scope}
                        onChange={(event) =>
                          updateList(
                            "extras",
                            item.id,
                            "scope",
                            event.target.value,
                          )
                        }
                      >
                        <option value="unit">Por unidade</option>
                        <option value="project">Por lote/projeto</option>
                      </select>
                    </label>
                    <button
                      className="remove-button"
                      onClick={() => removeList("extras", item.id)}
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="calculator-section calculator-options">
            <div className="calculator-section-title">
              <span>05</span>
              <h2>Outros custos e preço</h2>
            </div>
            <div className="calculator-grid">
              <label className="calculator-toggle">
                <input
                  type="checkbox"
                  checked={form.energyEnabled}
                  onChange={(event) =>
                    update("energyEnabled", event.target.checked)
                  }
                />
                Incluir energia elétrica
              </label>
              {form.energyEnabled && (
                <>
                  <NumberInput
                    label="Potência média"
                    suffix="W"
                    value={form.energyWatts}
                    onChange={(value) => update("energyWatts", value)}
                  />
                  <NumberInput
                    label="Custo do kWh"
                    suffix="R$"
                    value={form.energyKwh}
                    onChange={(value) => update("energyKwh", value)}
                  />
                </>
              )}
              <label className="calculator-field">
                Rateio de custos fixos
                <select
                  value={form.fixedMode}
                  onChange={(event) => update("fixedMode", event.target.value)}
                >
                  <option value="value">Valor fixo</option>
                  <option value="percent">Percentual sobre custos</option>
                </select>
              </label>
              <NumberInput
                label="Rateio"
                suffix={form.fixedMode === "percent" ? "%" : "R$"}
                value={form.fixedValue}
                onChange={(value) => update("fixedValue", value)}
              />
              <label className="calculator-field">
                Modelagem
                <select
                  value={form.modelingMode}
                  onChange={(event) =>
                    update("modelingMode", event.target.value)
                  }
                >
                  <option value="fixed">Valor fixo</option>
                  <option value="hours">Horas trabalhadas</option>
                </select>
              </label>
              {form.modelingMode === "hours" ? (
                <>
                  <NumberInput
                    label="Horas de modelagem"
                    suffix="h"
                    value={form.modelingHours}
                    onChange={(value) => update("modelingHours", value)}
                  />
                  <NumberInput
                    label="Valor modelagem"
                    suffix="R$/h"
                    value={form.modelingRate}
                    onChange={(value) => update("modelingRate", value)}
                  />
                </>
              ) : (
                <NumberInput
                  label="Valor da modelagem"
                  suffix="R$"
                  value={form.modelingFixed}
                  onChange={(value) => update("modelingFixed", value)}
                />
              )}
              <NumberInput
                label="Acréscimo sobre o custo"
                suffix="%"
                value={form.markup}
                onChange={(value) => update("markup", value)}
              />
              <label className="calculator-field">
                Arredondamento
                <select
                  value={form.roundTo}
                  onChange={(event) => update("roundTo", event.target.value)}
                >
                  <option value="0">Sem arredondar</option>
                  <option value="0.5">Para R$ 0,50</option>
                  <option value="1">Para R$ 1,00</option>
                  <option value="5">Para R$ 5,00</option>
                </select>
              </label>
              <label className="calculator-toggle">
                <input
                  type="checkbox"
                  checked={form.finalPriceEnabled}
                  onChange={(event) =>
                    update("finalPriceEnabled", event.target.checked)
                  }
                />
                Definir preço final manualmente
              </label>
              {form.finalPriceEnabled && (
                <NumberInput
                  label="Preço final unitário"
                  suffix="R$"
                  value={form.finalUnitPrice}
                  onChange={(value) => update("finalUnitPrice", value)}
                />
              )}
            </div>
          </section>

          <section className="calculator-section">
            <div className="calculator-section-title">
              <span>06</span>
              <h2>Sugestão de preço por quantidade</h2>
            </div>
            <div className="calculator-tier-settings">
              <NumberInput
                label="Margem desejada"
                suffix="%"
                value={form.desiredMargin}
                onChange={(value) => update("desiredMargin", value)}
              />
              <NumberInput
                label="Margem mínima de segurança"
                suffix="%"
                value={form.minimumMargin}
                onChange={(value) => update("minimumMargin", value)}
              />
              <p>
                A margem desejada é uma referência comercial. A margem mínima
                gera alertas, mas não altera o preço ou o desconto informado.
              </p>
            </div>
            <div className="calculator-tier-list">
              <div className="calculator-tier-head" aria-hidden="true">
                <span>Quantidade</span>
                <span>Desconto</span>
                <span></span>
              </div>
              {tiers.map((tier, index) => (
                <div className="calculator-tier-edit" key={index}>
                  <NumberInput
                    label="Quantidade"
                    value={tier.quantity}
                    onChange={(value) =>
                      setTiers((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, quantity: value }
                            : item,
                        ),
                      )
                    }
                    step="1"
                  />
                  <NumberInput
                    label="Desconto"
                    suffix="%"
                    value={tier.discount}
                    onChange={(value) =>
                      setTiers((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, discount: value }
                            : item,
                        ),
                      )
                    }
                  />
                  <button
                    className="remove-button"
                    onClick={() =>
                      setTiers((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                className="secondary-button"
                onClick={() =>
                  setTiers((current) => [
                    ...current,
                    { quantity: "", discount: "" },
                  ])
                }
              >
                + Faixa
              </button>
            </div>
            <div className="calculator-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Quantidade</th>
                    <th>Desconto</th>
                    <th>Preço unitário</th>
                    <th>Total</th>
                    <th>Custo total</th>
                    <th>Lucro por peça</th>
                    <th>Lucro total</th>
                    <th>Margem</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((tier, index) => {
                    const tierResult = calculatePricing({
                      ...form,
                      quantity: tier.quantity,
                    });
                    const calculated = calculateTier(
                      tierResult,
                      tier,
                      form.desiredMargin,
                      form.minimumMargin,
                    );
                    return (
                      <tr key={index}>
                        <td>{tier.quantity} un.</td>
                        <td>{tier.discount || 0}%</td>
                        <td>{money(calculated.unitPrice)}</td>
                        <td>{money(calculated.total)}</td>
                        <td>{money(calculated.costTotal)}</td>
                        <td>{money(calculated.profitPerUnit)}</td>
                        <td>{money(calculated.profitTotal)}</td>
                        <td>{calculated.margin.toFixed(1)}%</td>
                        <td>
                          <span
                            className={`calculator-margin-status ${calculated.status.tone}`}
                          >
                            {calculated.status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="calculator-section">
            <div className="calculator-section-title">
              <span>07</span>
              <h2>Venda consignada</h2>
            </div>
            <div className="calculator-grid">
              <label className="calculator-toggle">
                <input
                  type="checkbox"
                  checked={form.consignmentEnabled}
                  onChange={(event) =>
                    update("consignmentEnabled", event.target.checked)
                  }
                />
                Simular consignação
              </label>
              {form.consignmentEnabled && (
                <NumberInput
                  label="Percentual do parceiro"
                  suffix="%"
                  value={form.partnerPercent}
                  onChange={(value) => update("partnerPercent", value)}
                />
              )}
            </div>
            {form.consignmentEnabled && (
              <p className="calculator-consignment">
                Parceiro: <strong>{money(result.partnerValue)}</strong> ·
                RAVA recebe: <strong>{money(result.studioValue)}</strong> ·
                Lucro: <strong>{money(result.consignmentProfit)}</strong> ·
                Preço mínimo ao consumidor:{" "}
                <strong>{money(result.minimumConsumerPrice)}</strong>
              </p>
            )}
          </section>
        </div>
        <aside className="calculator-summary">
          <p>Resumo em tempo real</p>
          <h2>{form.projectName || "Novo orçamento"}</h2>
          {alerts.length > 0 && (
            <div className="calculator-alerts">
              {alerts.map((alert) => (
                <p key={alert}>{alert}</p>
              ))}
            </div>
          )}
          <SummaryLine label="Filamento" value={result.filamentCost} />
          <SummaryLine label="Desperdício" value={result.wasteCost} />
          <SummaryLine label="Impressora" value={result.printCost} />
          <SummaryLine label="Trabalho manual" value={result.manualCost} />
          <SummaryLine label="Energia" value={result.energyCost} />
          <SummaryLine label="Extras" value={result.extrasCost} />
          <SummaryLine label="Modelagem" value={result.modelingCost} />
          <SummaryLine label="Rateio" value={result.fixedCost} />
          <div className="calculator-total">
            <span>Custo bruto total</span>
            <strong>{money(result.totalCost)}</strong>
          </div>
          <div className="calculator-key">
            <span>Custo por unidade</span>
            <strong>{money(result.unitCost)}</strong>
            <span>Preço sugerido</span>
            <strong>{money(result.suggestedUnitPrice)}</strong>
            <span>Preço final</span>
            <strong>{money(result.finalUnitPrice)}</strong>
            <span>Lucro bruto</span>
            <strong>{money(result.profitTotal)}</strong>
            <span>Margem sobre a venda</span>
            <strong>{result.margin.toFixed(1)}%</strong>
            <span>Margem desejada</span>
            <strong>{form.desiredMargin}%</strong>
            <span>Margem mínima</span>
            <strong>{form.minimumMargin}%</strong>
            <span>Preço para margem desejada</span>
            <strong>{money(result.desiredMarginPrice)}</strong>
            <span>Preço mínimo recomendado</span>
            <strong>{money(result.minimumRecommendedPrice)}</strong>
          </div>
          <p
            className={`calculator-margin-summary ${result.marginStatus.tone}`}
          >
            {result.marginStatus.label}
          </p>
          <p className="calculator-footnote">
            Acréscimo sobre o custo: {form.markup}%
          </p>
        </aside>
      </div>
    </div>
  );
}


