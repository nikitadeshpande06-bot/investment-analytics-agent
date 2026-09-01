#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "investment-analyst-mcp",
  version: "1.0.0",
});

// ============================================================
// Helper Functions
// ============================================================

function formatMoney(value) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getRiskDescription(riskTolerance) {
  switch (riskTolerance) {
    case "conservative":
      return "Focus on capital preservation, lower volatility, high-quality bonds, and cash equivalents.";

    case "moderate":
      return "Balance long-term growth with risk management using diversified equities and bonds.";

    case "aggressive":
      return "Accept higher volatility in exchange for potentially greater long-term growth.";

    default:
      return "Use diversification and appropriate risk controls.";
  }
}

function disclaimer() {
  return `
Disclaimer:
This information is for educational purposes only and is not personalized
financial advice. Past performance does not guarantee future results.
All investing involves risk, including possible loss of principal.
`;
}

// ============================================================
// TOOL 1: Portfolio Builder
// ============================================================

server.tool(
  "portfolio-builder",
  "Build a diversified investment portfolio based on budget, risk tolerance, time horizon, and goals.",

  {
    budget: z
      .number()
      .positive()
      .describe("Total amount available for investment in USD"),

    risk_tolerance: z
      .enum(["conservative", "moderate", "aggressive"])
      .describe("Investor risk tolerance"),

    time_horizon_years: z
      .number()
      .int()
      .positive()
      .describe("Investment time horizon in years"),

    goals: z
      .string()
      .describe("Description of investment goals"),

    existing_holdings: z
      .string()
      .optional()
      .describe("Existing investments, if any"),

    excluded_sectors: z
      .string()
      .optional()
      .describe("Sectors the investor wants to avoid"),
  },

  async ({
    budget,
    risk_tolerance,
    time_horizon_years,
    goals,
    existing_holdings,
    excluded_sectors,
  }) => {
    try {
      let allocation;

      if (risk_tolerance === "conservative") {
        allocation = [
          {
            asset: "Bonds",
            percentage: 50,
            vehicle: "High-quality bond ETF / Treasury ETF",
          },
          {
            asset: "US Equities",
            percentage: 30,
            vehicle: "Broad-market index ETF",
          },
          {
            asset: "International Equities",
            percentage: 10,
            vehicle: "International index ETF",
          },
          {
            asset: "Cash Equivalents",
            percentage: 10,
            vehicle: "Money-market fund / Treasury bills",
          },
        ];
      } else if (risk_tolerance === "moderate") {
        allocation = [
          {
            asset: "US Equities",
            percentage: 45,
            vehicle: "Broad-market index ETF",
          },
          {
            asset: "Bonds",
            percentage: 30,
            vehicle: "Investment-grade bond ETF",
          },
          {
            asset: "International Equities",
            percentage: 15,
            vehicle: "International index ETF",
          },
          {
            asset: "Cash / Alternatives",
            percentage: 10,
            vehicle: "Treasury bills / diversified alternatives",
          },
        ];
      } else {
        allocation = [
          {
            asset: "US Equities",
            percentage: 60,
            vehicle: "Broad-market index ETF",
          },
          {
            asset: "International Equities",
            percentage: 20,
            vehicle: "International / emerging-market ETF",
          },
          {
            asset: "Bonds",
            percentage: 10,
            vehicle: "Investment-grade bond ETF",
          },
          {
            asset: "Alternatives / Cash",
            percentage: 10,
            vehicle: "Diversified alternatives / cash",
          },
        ];
      }

      const allocationRows = allocation
        .map((item) => {
          const amount = budget * (item.percentage / 100);

          return `${item.asset} | ${item.percentage}% | ${formatMoney(
            amount
          )} | ${item.vehicle}`;
        })
        .join("\n");

      const response = `
PORTFOLIO BUILDER
=================

Investor Profile
----------------
Budget: ${formatMoney(budget)}
Risk Tolerance: ${risk_tolerance}
Time Horizon: ${time_horizon_years} years
Goals: ${goals}

Risk Approach
-------------
${getRiskDescription(risk_tolerance)}

Suggested Allocation
--------------------

Asset Class | Allocation | Amount | Suggested Vehicle
-------------------------------------------------------
${allocationRows}

Existing Holdings
-----------------
${existing_holdings || "No existing holdings provided."}

Excluded Sectors
----------------
${excluded_sectors || "No sectors excluded."}

Action Plan
-----------
1. Invest according to the selected asset allocation.
2. Consider dollar-cost averaging if appropriate.
3. Review the portfolio periodically.
4. Rebalance when allocations move significantly from their targets.
5. Maintain an emergency reserve outside the investment portfolio.

Key Risks
---------
1. Market risk
2. Inflation risk
3. Interest-rate risk
4. Liquidity risk
5. Concentration risk

This tool uses local rule-based analysis.
No Groq API or GROQ_API_KEY is required.

${disclaimer()}
`;

      return {
        content: [
          {
            type: "text",
            text: response.trim(),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Portfolio builder error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ============================================================
// TOOL 2: Risk Evaluator
// ============================================================

server.tool(
  "risk-evaluator",
  "Evaluate the risk profile of an investment portfolio.",

  {
    portfolio_description: z
      .string()
      .describe("Description of the portfolio or investment"),

    investor_risk_tolerance: z
      .enum(["conservative", "moderate", "aggressive"])
      .describe("Investor risk tolerance"),

    time_horizon_years: z
      .number()
      .int()
      .positive()
      .describe("Investment horizon in years"),

    market_context: z
      .string()
      .optional()
      .describe("Optional market context"),
  },

  async ({
    portfolio_description,
    investor_risk_tolerance,
    time_horizon_years,
    market_context,
  }) => {
    try {
      let riskScore;
      let riskRating;

      if (investor_risk_tolerance === "conservative") {
        riskScore = 3;
        riskRating = "Low to Moderate";
      } else if (investor_risk_tolerance === "moderate") {
        riskScore = 5;
        riskRating = "Moderate";
      } else {
        riskScore = 7;
        riskRating = "High";
      }

      const response = `
RISK EVALUATOR
==============

Portfolio
---------
${portfolio_description}

Investor Risk Tolerance
-----------------------
${investor_risk_tolerance}

Time Horizon
------------
${time_horizon_years} years

Market Context
--------------
${market_context || "No additional market context provided."}

Overall Risk Assessment
-----------------------
Risk Rating: ${riskRating}
Risk Score: ${riskScore}/10

Key Risk Factors
----------------
1. Concentration Risk
   A portfolio concentrated in one company, sector, or asset class
   can experience larger losses.

2. Market Risk
   Equity investments can decline significantly during market downturns.

3. Liquidity Risk
   Some investments may be difficult to sell quickly.

4. Interest-Rate Risk
   Bond prices can change when interest rates change.

5. Inflation Risk
   Inflation can reduce the real purchasing power of returns.

Stress-Test Scenarios
----------------------
30% Equity Market Decline:
Equity-heavy portfolios could experience significant short-term losses.

200 Basis-Point Interest Rate Increase:
Long-duration bonds may experience price declines.

Stagflation:
High inflation combined with weak economic growth can pressure
both equities and bonds.

Risk-Tolerance Alignment
------------------------
The stated investor risk tolerance is ${investor_risk_tolerance}.

Recommendations
---------------
1. Diversify across asset classes.
2. Avoid excessive concentration.
3. Maintain an emergency reserve.
4. Rebalance periodically.
5. Match investments with financial goals.

This tool uses local rule-based analysis.
No Groq API or GROQ_API_KEY is required.

${disclaimer()}
`;

      return {
        content: [
          {
            type: "text",
            text: response.trim(),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Risk evaluator error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ============================================================
// TOOL 3: Market Screener
// ============================================================

server.tool(
  "market-screener",
  "Screen investment opportunities using rule-based analysis.",

  {
    asset_classes: z
      .array(
        z.enum([
          "US equities",
          "international equities",
          "emerging markets",
          "bonds",
          "REITs",
          "commodities",
          "ETFs",
          "crypto",
          "cash equivalents",
        ])
      )
      .min(1)
      .describe("Asset classes to screen"),

    sectors: z
      .string()
      .optional()
      .describe("Optional sectors of interest"),

    risk_tolerance: z
      .enum(["conservative", "moderate", "aggressive"])
      .describe("Investor risk tolerance"),

    time_horizon_years: z
      .number()
      .int()
      .positive()
      .describe("Investment horizon in years"),

    investment_themes: z
      .string()
      .optional()
      .describe("Optional investment themes"),

    max_results: z
      .number()
      .int()
      .min(1)
      .max(10)
      .default(5)
      .describe("Maximum number of investment ideas"),
  },

  async ({
    asset_classes,
    sectors,
    risk_tolerance,
    time_horizon_years,
    investment_themes,
    max_results,
  }) => {
    try {
      const ideas = [];

      function addIdea(name, category, rationale, risk) {
        if (ideas.length < max_results) {
          ideas.push({
            name,
            category,
            rationale,
            risk,
          });
        }
      }

      for (const assetClass of asset_classes) {
        switch (assetClass) {
          case "US equities":
            addIdea(
              "Broad US Equity Index",
              "US equities",
              "Provides diversified exposure to a broad group of US companies.",
              "Market volatility and equity drawdowns"
            );
            break;

          case "international equities":
            addIdea(
              "International Equity Index",
              "International equities",
              "Provides geographic diversification outside the US.",
              "Currency, geopolitical, and market risk"
            );
            break;

          case "emerging markets":
            addIdea(
              "Emerging Markets Index",
              "Emerging markets",
              "Provides exposure to developing economies and potentially higher long-term growth.",
              "Higher volatility, currency, and political risk"
            );
            break;

          case "bonds":
            addIdea(
              "Investment-Grade Bond Fund",
              "Bonds",
              "Can provide income and diversification relative to equities.",
              "Interest-rate and credit risk"
            );
            break;

          case "REITs":
            addIdea(
              "Diversified REIT Fund",
              "REITs",
              "Provides exposure to real-estate-related assets.",
              "Interest-rate and real-estate market risk"
            );
            break;

          case "commodities":
            addIdea(
              "Broad Commodity Fund",
              "Commodities",
              "Can provide diversification and potential inflation sensitivity.",
              "Commodity price volatility"
            );
            break;

          case "ETFs":
            addIdea(
              "Broad Diversified ETF",
              "ETFs",
              "Provides diversified exposure through an exchange-traded fund.",
              "Underlying asset and market risk"
            );
            break;

          case "crypto":
            addIdea(
              "Major Cryptocurrency Exposure",
              "Crypto",
              "Provides exposure to a highly speculative alternative asset class.",
              "Very high volatility and regulatory risk"
            );
            break;

          case "cash equivalents":
            addIdea(
              "Treasury Bills / Money-Market Fund",
              "Cash equivalents",
              "Useful for liquidity and short-term capital preservation.",
              "Inflation and reinvestment risk"
            );
            break;
        }
      }

      const results = ideas
        .map(
          (idea, index) => `
${index + 1}. ${idea.name}

Category:
${idea.category}

Rationale:
${idea.rationale}

Key Risk:
${idea.risk}

Suggested Approach:
${
  risk_tolerance === "conservative"
    ? "Consider a smaller allocation and prioritize diversification."
    : risk_tolerance === "moderate"
    ? "Consider a diversified allocation appropriate for a balanced portfolio."
    : "Only consider larger allocations if you are comfortable with higher volatility."
}
`
        )
        .join("\n");

      const response = `
MARKET SCREENER
===============

Investor Profile
----------------
Risk Tolerance: ${risk_tolerance}
Time Horizon: ${time_horizon_years} years
Asset Classes: ${asset_classes.join(", ")}
Sectors: ${sectors || "All sectors"}
Investment Themes: ${investment_themes || "None specified"}
Maximum Results: ${max_results}

Investment Ideas
----------------
${
  results ||
  "No matching investment ideas were found for the selected asset classes."
}

Important Notes
---------------
- This screener does not access live market prices.
- It does not perform real-time fundamental analysis.
- Expected returns are not guaranteed.
- Consider valuation, diversification, fees, liquidity, and taxes.

This tool uses local rule-based analysis.
No Groq API or GROQ_API_KEY is required.

${disclaimer()}
`;

      return {
        content: [
          {
            type: "text",
            text: response.trim(),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Market screener error: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ============================================================
// START SERVER
// ============================================================

async function main() {
  const transport = new StdioServerTransport();

  await server.connect(transport);

  console.error(
    "[investment-analyst-mcp] Server running on stdio"
  );
}

main().catch((error) => {
  console.error(
    "[investment-analyst-mcp] Fatal error:",
    error
  );

  process.exit(1);
});