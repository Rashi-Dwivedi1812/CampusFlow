const express = require("express");
const axios = require("axios");

const router = express.Router();
const AI_SERVICE_BASE_URL = (process.env.AI_SERVICE_URL || "http://localhost:8000/api/ai").replace(/\/$/, "");

router.all(/.*/, async (req, res) => {
  try {
    const targetPath = req.path.replace(/^\/api\/ai/, "");
    const targetUrl = AI_SERVICE_BASE_URL.endsWith("/api/ai")
      ? `${AI_SERVICE_BASE_URL}${targetPath}`
      : `${AI_SERVICE_BASE_URL}/api/ai${targetPath}`;

    const response = await axios({
      method: req.method,
      url: targetUrl,
      params: req.query,
      data: req.body,
      headers: {
        "Content-Type": "application/json",
        "x-session-id": req.headers["x-session-id"] || req.body?.sessionId || "",
      },
      timeout: 30000,
      validateStatus: () => true,
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error("[ai proxy] error:", error.message);
    res.status(502).json({
      success: false,
      message: "AI service unavailable",
      error: error.message,
    });
  }
});

module.exports = router;
