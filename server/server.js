import express from "express";
import cors from "cors";

const app = express();

const PORT = 4000;

app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "http://127.0.0.1:5173"
        ]
    })
);

app.use(express.json());

/* Test route */
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Investment Analytics Server is running."
    });
});


/* ============================================================
   CHAT API
   ============================================================ */

app.post("/api/chat", (req, res) => {

    try {

        const question =
            String(req.body.question || "").trim();

        if (!question) {
            return res.status(400).json({
                success: false,
                message: "Question is required."
            });
        }

        const q = question.toLowerCase();

        let answer;


        /* EDUCATION */

        if (
            q.includes("education") ||
            q.includes("college") ||
            q.includes("university") ||
            q.includes("study")
        ) {

            answer =
                "For short-term education planning, the main priority is usually protecting the money you will need soon. Consider keeping a large portion in relatively stable and liquid options rather than depending heavily on volatile investments. The appropriate choice depends on your time horizon, required amount and risk tolerance.";

        }


        /* SHORT TERM */

        else if (
            q.includes("short term") ||
            q.includes("short-term")
        ) {

            answer =
                "For a short-term financial goal, capital preservation and liquidity are usually more important than aggressive growth. Consider relatively stable and accessible investment options. The shorter your time horizon, the less you generally want to depend on highly volatile investments.";

        }


        /* LONG TERM */

        else if (
            q.includes("long term") ||
            q.includes("long-term")
        ) {

            answer =
                "For a long-term goal, you generally have more time to tolerate market fluctuations. A diversified portfolio containing growth and stabilizing assets can be considered according to your risk tolerance, time horizon and financial goal.";

        }


        /* DIVERSIFICATION */

        else if (
            q.includes("diversif") ||
            q.includes("diversify")
        ) {

            answer =
                "Diversification means spreading investments across different asset classes, sectors, regions and securities. It reduces dependence on any single investment and can help manage portfolio risk.";

        }


        /* RISK */

        else if (
            q.includes("risk") ||
            q.includes("risky")
        ) {

            answer =
                "Investment risk is the possibility that actual results differ from expected results. Common risks include market risk, concentration risk, liquidity risk, inflation risk and interest-rate risk.";

        }


        /* BONDS */

        else if (
            q.includes("bond") ||
            q.includes("bonds")
        ) {

            answer =
                "Bonds are debt investments. An investor lends money to a government, company or other issuer and may receive interest. Bonds can provide income and diversification, although their prices can change when interest rates and market conditions change.";

        }


        /* ETF */

        else if (
            q.includes("etf") ||
            q.includes("exchange traded fund")
        ) {

            answer =
                "An ETF, or exchange-traded fund, is a fund that holds a collection of investments and trades on an exchange. ETFs can make diversification easier because one ETF may provide exposure to many securities.";

        }


        /* COMPOUNDING */

        else if (
            q.includes("compound") ||
            q.includes("compounding")
        ) {

            answer =
                "Compound growth occurs when investment returns are added to the accumulated investment and future returns are calculated on the larger amount. Time, contribution size and return rate all influence the effect of compounding.";

        }


        /* PORTFOLIO */

        else if (
            q.includes("portfolio") ||
            q.includes("allocation")
        ) {

            answer =
                "A portfolio is a collection of investments. Portfolio allocation describes how money is divided among assets such as equities, bonds and cash. The appropriate allocation depends on your goal, time horizon, risk tolerance and liquidity requirements.";

        }


        /* RETIREMENT */

        else if (
            q.includes("retirement") ||
            q.includes("pension")
        ) {

            answer =
                "Retirement planning should consider your required retirement amount, years until retirement, expected expenses, inflation and risk tolerance. A longer time horizon may allow greater exposure to growth assets, while the allocation can become more conservative as retirement approaches.";

        }


        /* EMERGENCY FUND */

        else if (
            q.includes("emergency fund") ||
            q.includes("emergency savings")
        ) {

            answer =
                "An emergency fund is money kept available for unexpected expenses. It is generally intended to be liquid and relatively stable rather than aggressively invested. The appropriate amount depends on your expenses and financial situation.";

        }


        /* MARKET */

        else if (
            q.includes("market") ||
            q.includes("stock") ||
            q.includes("share")
        ) {

            answer =
                "Investment markets can move because of economic conditions, company performance, interest rates, inflation, investor expectations and many other factors. Short-term market movements can be difficult to predict.";

        }


        /* DASHBOARD */

        else if (
            q.includes("dashboard") ||
            q.includes("how to use") ||
            q.includes("help")
        ) {

            answer =
                "You can use the dashboard to build a portfolio, evaluate risk, explore investment categories, generate future projections and create reports.";

        }


        /* DEFAULT */

        else {

            answer =
                "Your question is related to investment or financial planning. Consider your financial goal, required amount, time horizon, risk tolerance, liquidity requirements and diversification before making an investment decision. You can provide more details about your situation for a more specific educational explanation.";

        }


        res.json({
            success: true,
            question: question,
            answer: answer
        });

    } catch (error) {

        console.error("Chat API error:", error);

        res.status(500).json({
            success: false,
            message: "Internal analytics server error."
        });

    }

});


/* START SERVER */

app.listen(PORT, () => {

    console.log(
        `Investment Analytics Server running on http://localhost:${PORT}`
    );

});