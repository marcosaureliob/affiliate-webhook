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
    console.log("❌ HMAC inválido.");
    return res.status(401).send("invalid");
  }

  console.log("✅ Pedido recebido:", body.name || body.id);

  const attrs = (body.note_attributes || []).reduce((acc, a) => {
    acc[a.name] = a.value;
    return acc;
  }, {});

  const affiliate = attrs.affiliate_id || null;
  const customer = body.customer || null;

  if (affiliate && customer && customer.id) {
    console.log(`➡️ Cliente ${customer.id} | Afiliado ${affiliate}`);

    const metafieldsRes = await fetch(
      `https://${SHOPIFY_STORE}/admin/api/2025-04/customers/${customer.id}/metafields.json`,
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ADMIN_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    const existing = await metafieldsRes.json().catch(() => ({}));
    const has = (existing.metafields || []).some(
      (m) => m.namespace === "aff" && m.key === "partner_id"
    );

    if (!has) {
      console.log("🆕 Criando metafield aff.partner_id...");
      await fetch(
        `https://${SHOPIFY_STORE}/admin/api/2025-04/customers/${customer.id}/metafields.json`,
        {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": SHOPIFY_ADMIN_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            metafield: {
              namespace: "aff",
              key: "partner_id",
              value: affiliate,
              type: "single_line_text_field",
            },
          }),
        }
      );
    } else {
      console.log("ℹ️ Metafield aff.partner_id já existe, não sobrescrevendo.");
    }

    const amount = body.subtotal_price || body.total_price || 0;
    const tuneUrl = `https://aspireiq.go2cloud.org/aff_lsr?offer_id=1&aff_id=${encodeURIComponent(
      affiliate
    )}&amount=${encodeURIComponent(amount)}&adv_unique1=${encodeURIComponent(
      body.id
    )}`;

    console.log("📤 Enviando postback TUNE:", tuneUrl);
    await fetch(tuneUrl);
  } else {
    console.log("⚠️ Pedido sem affiliate_id ou customer.id.");
  }

  return res.status(200).send("ok");
};
