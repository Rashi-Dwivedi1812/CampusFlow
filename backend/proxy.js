const http = require("http");
const { URL } = require("url");
const axios = require("axios");
const https = require("https");

const TARGET = "https://webportal.jiit.ac.in:6011/StudentPortalAPI";
const PORT = 5002;

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const incoming = new URL(req.url, "http://localhost");
    const targetPath = incoming.pathname.replace(/^\/proxy/, "");
    const targetUrl = TARGET + targetPath + incoming.search;

    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);

    console.log("[proxy] in:", req.method, incoming.pathname + incoming.search, body.length ? body.toString("hex").slice(0, 120) : "(no body)");

    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers: req.headers,
      data: body.length > 0 ? body : undefined,
      responseType: "text",
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: () => true,
      timeout: 30000,
      httpsAgent: new https.Agent({ 
        rejectUnauthorized: false,
        keepAlive: true
      }),
      proxy: false
    });

    console.log("[proxy] out:", response.status, response.data?.slice?.(0, 200) ?? "(empty)");

    if (response.data && response.data.length > 0) {
      res.writeHead(response.status, response.headers);
      res.end(response.data);
    } else {
      console.warn("[proxy] empty response from target for", targetPath);
      res.writeHead(response.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "error", message: "Empty response from upstream" }));
    }

  } catch (error) {
    console.error("[proxy] error:", error.message, error.code, error.response?.status, error.response?.data?.slice?.(0, 200));
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ 
      error: "Bad Gateway", 
      message: error.message, 
      code: error.code,
      status: error.response?.status
    }));
  }
});

server.listen(PORT, () => {
  console.log(`JIIT proxy listening on http://localhost:${PORT}`);
});
