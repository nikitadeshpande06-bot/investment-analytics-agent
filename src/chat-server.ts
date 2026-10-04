import express from "express";

/*
 * Investment-only guard (server side). Mirrors the keyword check in
 * dashboard.js so non-investment questions are refused even if the
 * browser check is bypassed (e.g. direct API calls).
 */
const INVESTMENT_KEYWORDS = [
    "stock", "share", "equity", "bond", "etf", "mutual fund", "index fund",
    "reit", "commodit", "gold", "silver", "crypto", "bitcoin", "ethereum",
    "option", "futures", "forex", "currency", "treasury", "money market",
    "hedge", "portfolio", "diversif", "allocation", "rebalanc", "holding",
    "risk", "volatil", "beta", "sharpe", "drawdown", "return", "roi",
    "cagr", "compound", "interest", "dividend", "yield", "capital gain",
    "invest", "trading", "market", "screener", "valuation", "earnings",
    "saving", "budget", "retirement", "401k", "ira", "pension", "wealth",
    "inflation", "recession", "broker", "liquidity", "leverage", "tax",
    "financial", "finance", "sensex", "nifty", "adr", "gdr", "exchange"
];

const REFUSAL_MESSAGE =
    "I'm the InvestAI Analytics assistant, so I can only help with " +
    "investment-related topics — portfolios, risk, diversification, " +
    "asset classes (stocks, bonds, ETFs, funds, REITs, crypto, " +
    "commodities), market analysis and future projections. " +
    "Please rephrase your question around one of those topics and " +
    "I'll be glad to help.";

function isInvestmentRelated(message: unknown) {
    const normalized = " " + String(message ?? "").toLowerCase() + " ";

    return INVESTMENT_KEYWORDS.some(keyword =>
        normalized.includes(keyword)
    );
}

/*
 * True when the message is a short follow-up that only makes sense
 * in the context of the previous conversation, e.g. "Why is it
 * important?", "Tell me more". These carry no topic of their own,
 * so the guard re-checks them against recent history instead of
 * refusing them outright. Longer, self-contained questions are never
 * treated as follow-ups.
 */
const FOLLOW_UP_PATTERNS = [
    /^(why|how|what)( i|'s| is| are| do| does|'d| would| can| about)?\s+(it|its|this|that|they|them|their|these|those|he|she)\b/,
    /^(tell|say|explain|describe|elaborate|expand|clarify|repeat|continue|go on|more)\b/,
    /^(it|this|that|they|those|these)\b/,
    /^(and|also|again|then)\b/,
    /^(is|are|was|were|can|could|would|should|do|does|did)\s+(it|this|that|they|them|there)\b/,
    /^(what|which)\s+(about|else|next|of (it|that|this|them))\b/,
    /^(please|kindly|thanks?|thank you)\b/,
    /^(give|show)( me)?\s+(an?|some|one|examples?|more)\b/,
    /^(examples?|advantages?|disadvantages?|benefits?|pros|cons)\b/,
    /^(what|which)\s+(are|is)\s+(the\s+)?(benefits?|advantages?|disadvantages?|pros|cons|risks?|examples?)/,
    /\b(benefits?|advantages?|drawbacks?|pros|cons|examples?)\s+of\s+(it|this|that|them)\b/,
    /\b(in more detail|more detail|more about it|explain (it|that|this|more)|why is it|why are they)\b/
];

function isContextualFollowUp(message: unknown) {
    const normalized = String(message ?? "").toLowerCase().trim();

    if (!normalized || normalized.split(/\s+/).length > 25) {
        return false;
    }

    return FOLLOW_UP_PATTERNS.some(pattern =>
        pattern.test(normalized)
    );
}

const app = express();

app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "InvestAI Chat Server",
    ollama: "local",
  });
});

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history, detailed } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required.",
      });
    }

    const historyMessages = Array.isArray(history)
      ? history
          .filter(
            (entry: unknown): entry is { role: string; content: string } =>
              !!entry &&
              typeof (entry as { role?: unknown }).role === "string" &&
              typeof (entry as { content?: unknown }).content === "string"
          )
          .map((entry) => ({
            role: entry.role === "user" ? ("user" as const) : ("assistant" as const),
            content: entry.content.slice(0, 2000),
          }))
          .slice(-8)
      : [];

    /*
     * The question alone is checked first. Short follow-ups such as
     * "Why is it important?" or "Tell me more" carry no topic words,
     * so only those are re-checked against the recent history to see
     * whether they refer to an earlier investment topic. Full-history
     * text is never blended into the question itself — that would let
     * stray investment keywords from old answers make every later
     * off-topic question pass the guard.
     */
    const questionIsFollowUp =
      isContextualFollowUp(message);

    if (
      !isInvestmentRelated(message) &&
      !(
        questionIsFollowUp &&
        historyMessages.some((entry) => isInvestmentRelated(entry.content))
      )
    ) {
      return res.json({
        answer: REFUSAL_MESSAGE,
      });
    }

    const systemPrompt =
      "You are the InvestAI Analytics Assistant, an investment-only assistant. " +
      "Answer ONLY investment and finance-related questions (portfolios, risk, " +
      "diversification, asset classes, markets, projections) clearly and " +
      "helpfully, in simple language. If a question is not related to " +
      "investing, politely refuse and ask the user to rephrase it as an " +
      "investment-related question. Do not answer general knowledge, " +
      "technology, education, programming or other off-topic questions.\n\n" +
      "CONVERSATION RULES: The conversation history is provided for context. " +
      "If the new question is a short follow-up (e.g. \"Why is it important?\", " +
      "\"How does it work?\", \"What are its benefits?\", \"Give an example.\"), " +
      "resolve \"it\"/\"this\"/\"that\" to the most recent investment topic from " +
      "the history and answer the SPECIFIC aspect the user is now asking about. " +
      "ALWAYS answer the CURRENT question directly — never simply repeat, " +
      "restate or rephrase your previous answer. If the previous answer already " +
      "covered part of the topic, add new information relevant to the current " +
      "question only." +
      (detailed
        ? " The user has asked for an in-depth explanation: go beyond the " +
          "basics, use concrete examples and numbers where useful, break the " +
          "answer into short sections, and mention the main risks and trade-offs."
        : " Keep answers concise unless the user asks for more detail.");

    const ollamaResponse = await fetch(
      "http://localhost:11434/api/chat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama3.2",
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            ...historyMessages,
            {
              role: "user",
              content: message,
            },
          ],
          stream: false,
        }),
      }
    );

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text();

      console.error(
        "Ollama error:",
        ollamaResponse.status,
        errorText
      );

      return res.status(500).json({
        error: "Ollama could not process the request.",
      });
    }

    const data = await ollamaResponse.json();

    return res.json({
      answer:
        data?.message?.content ||
        "I could not generate a response.",
    });
  } catch (error) {
    console.error("Chat server error:", error);

    return res.status(500).json({
      error:
        "Unable to connect to Ollama. Please make sure Ollama is running.",
    });
  }
});

const PORT = 4000;

app.listen(PORT, () => {
  console.log(
    `InvestAI Chat Server running on http://localhost:${PORT}`
  );
});