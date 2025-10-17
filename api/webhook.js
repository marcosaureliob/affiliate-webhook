const crypto = require("crypto");
const fetch = require("node-fetch");

module.exports = async (req, res) => {
  if (req.method === "GET")
    return res.send("Webhook server is running! Use POST.");

  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const { SHOPIFY_WEBHOOK_SECRET, SHOPIFY_STORE, SHOPIFY_ADMIN_TOKEN } =
    process.env;

  const hmac = req.headers["x-shopify-hmac-sha256"] || "";
  const hash = crypto
    .createHmac("sha256", SHOPIFY_WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest("base64");

  if (hash !== hmac) return res.status(401).send("invalid");

  console.log("✅ Pedido recebido:", req.body.name || "sem nome");

  return res.status(200).send("ok");
};
