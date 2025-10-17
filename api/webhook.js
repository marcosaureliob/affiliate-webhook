const crypto = require("crypto");
const fetch = require("node-fetch");

module.exports = async (req, res) => {
  if (req.method === "GET")
    return res.send("Webhook server is running! Use POST.");

  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const buffers = [];
  for await (const chunk of req) buffers.push(chunk);
  const rawBody = Buffer.concat(buffers).toString("utf8");

  let body;
  try {
    body = JSON.parse(rawBody || "{}");
  } catch {
    body = {};
  }

  const SHOPIFY_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;
  const SHOPIFY_STORE = process.env.SHOPIFY_STORE;
  const SHOPIFY_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

  const hmacHeader = req.headers["x-shopify-hmac-sha256"] || "";
  const hash = crypto
    .createHmac("sha256", SHOPIFY_SECRET)
    .update(rawBody)
    .digest("base64");

  if (hash !== hmacHeader) {
    console.log("HMAC inválido.");
    return res.status(401).send("invalid");
  }

  console.log("✅ Pedido recebido:", body.id || "sem id");

  res.status(200).send("ok");
};
