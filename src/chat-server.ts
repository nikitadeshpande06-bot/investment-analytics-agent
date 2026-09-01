import express from "express";

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
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required.",
      });
    }

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
              content:
                "You are the InvestAI Analytics Assistant. Answer all normal user questions clearly and helpfully. You can answer investment, finance, technology, education, programming, general knowledge, and other topics. Explain difficult concepts in simple language.",
            },
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