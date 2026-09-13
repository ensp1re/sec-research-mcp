import { METRIC_ID } from "@sec-research/domain";
import type { MetricId } from "@sec-research/domain";

export interface MetricSpec {
  id: MetricId;
  tags: readonly string[];
  additive: boolean;
  period: "duration" | "instant";
  unit: string;
  definition: string;
}

function usdDuration(id: MetricId, tags: readonly string[], definition: string, additive = true): MetricSpec {
  return { id, tags, additive, period: "duration", unit: "USD", definition };
}
function usdInstant(id: MetricId, tags: readonly string[], definition: string): MetricSpec {
  return { id, tags, additive: false, period: "instant", unit: "USD", definition };
}

export const METRICS: Record<MetricId, MetricSpec> = {
  [METRIC_ID.REVENUE]: usdDuration(METRIC_ID.REVENUE, ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"], "Reported revenue"),
  [METRIC_ID.GROSS_PROFIT]: usdDuration(METRIC_ID.GROSS_PROFIT, ["GrossProfit"], "Gross profit"),
  [METRIC_ID.GROSS_MARGIN]: { id: METRIC_ID.GROSS_MARGIN, tags: [], additive: false, period: "duration", unit: "ratio", definition: "Gross profit / revenue" },
  [METRIC_ID.OPERATING_INCOME]: usdDuration(METRIC_ID.OPERATING_INCOME, ["OperatingIncomeLoss"], "Operating income"),
  [METRIC_ID.NET_INCOME]: usdDuration(METRIC_ID.NET_INCOME, ["NetIncomeLoss"], "Net income"),
  [METRIC_ID.OPERATING_CASH_FLOW]: usdDuration(METRIC_ID.OPERATING_CASH_FLOW, ["NetCashProvidedByUsedInOperatingActivities"], "Operating cash flow"),
  [METRIC_ID.INVESTING_CASH_FLOW]: usdDuration(METRIC_ID.INVESTING_CASH_FLOW, ["NetCashProvidedByUsedInInvestingActivities"], "Investing cash flow"),
  [METRIC_ID.FINANCING_CASH_FLOW]: usdDuration(METRIC_ID.FINANCING_CASH_FLOW, ["NetCashProvidedByUsedInFinancingActivities"], "Financing cash flow"),
  [METRIC_ID.CAPEX]: usdDuration(METRIC_ID.CAPEX, ["PaymentsToAcquirePropertyPlantAndEquipment"], "Capital expenditure (cash outflow)"),
  [METRIC_ID.CASH]: usdInstant(METRIC_ID.CASH, ["CashAndCashEquivalentsAtCarryingValue"], "Cash and equivalents"),
  [METRIC_ID.DEBT]: usdInstant(METRIC_ID.DEBT, ["LongTermDebt", "LongTermDebtNoncurrent"], "Long-term debt (incomplete if other components missing)"),
  [METRIC_ID.CURRENT_ASSETS]: usdInstant(METRIC_ID.CURRENT_ASSETS, ["AssetsCurrent"], "Current assets"),
  [METRIC_ID.CURRENT_LIABILITIES]: usdInstant(METRIC_ID.CURRENT_LIABILITIES, ["LiabilitiesCurrent"], "Current liabilities"),
  [METRIC_ID.INVENTORY]: usdInstant(METRIC_ID.INVENTORY, ["InventoryNet"], "Inventory"),
  [METRIC_ID.SHARES]: { id: METRIC_ID.SHARES, tags: ["WeightedAverageNumberOfDilutedSharesOutstanding"], additive: false, period: "duration", unit: "shares", definition: "Diluted weighted-average shares" },
  [METRIC_ID.EPS_DILUTED]: { id: METRIC_ID.EPS_DILUTED, tags: ["EarningsPerShareDiluted"], additive: false, period: "duration", unit: "USD_per_share", definition: "Diluted EPS (not derived by subtraction)" },
  [METRIC_ID.DIVIDENDS]: usdDuration(METRIC_ID.DIVIDENDS, ["PaymentsOfDividends"], "Dividends paid"),
  [METRIC_ID.RD_EXPENSE]: usdDuration(METRIC_ID.RD_EXPENSE, ["ResearchAndDevelopmentExpense"], "R&D expense"),
  [METRIC_ID.SGA_EXPENSE]: usdDuration(METRIC_ID.SGA_EXPENSE, ["SellingGeneralAndAdministrativeExpense"], "SG&A"),
  [METRIC_ID.INTEREST_EXPENSE]: usdDuration(METRIC_ID.INTEREST_EXPENSE, ["InterestExpense"], "Interest expense"),
  [METRIC_ID.TAX_EXPENSE]: usdDuration(METRIC_ID.TAX_EXPENSE, ["IncomeTaxExpenseBenefit"], "Income tax expense"),
  [METRIC_ID.STOCK_BASED_COMPENSATION]: usdDuration(METRIC_ID.STOCK_BASED_COMPENSATION, ["ShareBasedCompensation"], "Stock-based compensation"),
  [METRIC_ID.GOODWILL]: usdInstant(METRIC_ID.GOODWILL, ["Goodwill"], "Goodwill"),
  [METRIC_ID.COGS]: usdDuration(METRIC_ID.COGS, ["CostOfGoodsAndServicesSold", "CostOfRevenue"], "Cost of revenue"),
  [METRIC_ID.ACCOUNTS_RECEIVABLE]: usdInstant(METRIC_ID.ACCOUNTS_RECEIVABLE, ["AccountsReceivableNetCurrent"], "Accounts receivable"),
};

export function parseMetricId(value: string): MetricId {
  const found = Object.values(METRIC_ID).find((id) => id === value);
  if (!found) throw new Error(`metric_unavailable: ${value}`);
  return found;
}

export function listMetrics(): MetricSpec[] {
  return Object.values(METRICS);
}
