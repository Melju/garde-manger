// Fichier généré par scripts/build-api.mjs : ne pas éditer.

// server/push-digest.ts
import webpush from "web-push";

// src/lib/dryStaple.ts
var WORDS = [
  "pates",
  "pate seche",
  "spaghetti",
  "spaghettis",
  "fusilli",
  "penne",
  "macaroni",
  "macaronis",
  "tagliatelle",
  "tagliatelles",
  "farfalle",
  "coquillettes",
  "linguine",
  "capellini",
  "torsades",
  "coquillages",
  "vermicelle",
  "vermicelles",
  "lasagne seche",
  "nouilles",
  "noodles",
  "ramen",
  "udon",
  "soba",
  "riz",
  "semoule",
  "couscous",
  "quinoa",
  "boulgour",
  "ebly",
  "polenta",
  "lentilles",
  "pois casses",
  "haricots secs",
  "farine",
  "sucre",
  "cassonade",
  "sel",
  "gros sel",
  "flocons d avoine",
  "avoine",
  "maizena",
  "fecule",
  "chapelure",
  "tapioca"
];
var norm = (s) => " " + s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() + " ";
function isDryStaple(name, category) {
  if (category === "conserves") return true;
  if (category && category !== "epicerie") return false;
  const n = norm(name);
  if (/ (feuillet|bris|sabl|pizza|a tartiner|fraiche)/.test(n)) return false;
  return WORDS.some((w) => n.includes(` ${w} `));
}

// src/lib/productIcon.ts
function normalize(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/[^a-z0-9]+/g, " ").trim();
}

// src/lib/expiry.ts
var MS_PER_DAY = 1e3 * 60 * 60 * 24;
var FROZEN_GRACE_DAYS = 30;
var GRACE_VEGETAL = ["vegan", "veggie", "tofu", "seitan", "tempeh", "falafel", "falafels", "soja"];
var GRACE_PREPARED = ["hache", "hachee", "marine", "marines", "nugget", "nuggets", "pane", "panes", "cordon", "saucisse", "saucisses", "merguez", "chipolata", "burger", "boulette", "boulettes", "tex", "plat", "pizza", "lasagne", "lasagnes", "quiche", "gratin", "cuisine", "cuisinee"];
function frozenGraceDays(product) {
  const words = normalize(product.name).split(/[^a-z0-9]+/).filter(Boolean);
  const has = (list) => words.some((w) => list.includes(w));
  if (has(GRACE_VEGETAL) || words.some((w) => w.startsWith("veget"))) return 90;
  if (has(GRACE_PREPARED)) return 30;
  switch (product.category) {
    case "viandes":
    case "viandes-vg":
      return 90;
    case "poissons":
      return 60;
    case "legumes":
    case "fruits":
      return 180;
    default:
      return FROZEN_GRACE_DAYS;
  }
}
function isFrozen(product) {
  return product.location === "Cong\xE9lateur" || product.category === "surgeles";
}
function daysUntilExpiry(product, now = /* @__PURE__ */ new Date()) {
  if (!product.expiryDate) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expiry = /* @__PURE__ */ new Date(product.expiryDate + "T00:00:00");
  return Math.round((expiry.getTime() - today.getTime()) / MS_PER_DAY);
}
function expiryStatus(product, now = /* @__PURE__ */ new Date()) {
  const days = daysUntilExpiry(product, now);
  if (days === null) return "none";
  if (isFrozen(product)) {
    if (days < -frozenGraceDays(product)) return "expired";
    if (days < 0) return "still-good";
    if (days <= 14) return "soon";
    return "ok";
  }
  if (product.dateType !== "dlc" && days < 0 && isDryStaple(product.name, product.category)) return "none";
  if (product.dateType === "ddm") {
    if (days < 0) return "still-good";
    if (days <= 3) return "soon";
    if (days <= 14) return "soon";
    return "ok";
  }
  if (days < 0) return "expired";
  if (days <= 3) return "urgent";
  if (days <= 14) return "soon";
  return "ok";
}

// src/lib/pushDigest.ts
function buildDigest(products, settings) {
  const urgent = [];
  if (settings.notifExpiry) {
    for (const p of products) {
      const st = expiryStatus(p);
      const d = daysUntilExpiry(p);
      if (d == null) continue;
      if (st === "urgent" && d >= 0 || st === "expired" && d >= -2) urgent.push({ name: p.name, days: d });
    }
    urgent.sort((a, b) => a.days - b.days);
  }
  const low = settings.notifLowStock ? products.filter((p) => p.quantity <= settings.lowStockThreshold).length : 0;
  if (!urgent.length && !low) return null;
  const when = (d) => d < 0 ? "p\xE9rim\xE9" : d === 0 ? "aujourd'hui" : d === 1 ? "demain" : `dans ${d} j`;
  const parts = [];
  if (urgent.length) {
    const shown = urgent.slice(0, 3).map((u) => `${u.name} (${when(u.days)})`);
    const more = urgent.length - shown.length;
    parts.push(shown.join(", ") + (more > 0 ? ` et ${more} autre${more > 1 ? "s" : ""}` : ""));
  }
  if (low) parts.push(`${low} produit${low > 1 ? "s" : ""} en stock bas`);
  return {
    title: urgent.length ? `${urgent.length} produit${urgent.length > 1 ? "s" : ""} \xE0 consommer vite` : "Stock bas",
    body: parts.join(" \xB7 ")
  };
}

// server/push-digest.ts
var env = (k) => process.env[k] ?? "";
async function rpc(fn, body) {
  const base = env("VITE_SUPABASE_URL") || env("SUPABASE_URL");
  const anon = env("VITE_SUPABASE_ANON_KEY") || env("SUPABASE_ANON_KEY");
  const r = await fetch(`${base}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: anon, authorization: `Bearer ${anon}`, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`${fn} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return await r.json();
}
async function handler(req, res) {
  const cron = env("CRON_SECRET");
  if (!cron || req.headers?.authorization !== `Bearer ${cron}`) return res.status(401).json({ error: "unauthorized" });
  if (!env("VAPID_PRIVATE_KEY") || !env("VAPID_PUBLIC_KEY") || !env("PUSH_SECRET")) return res.status(500).json({ error: "config manquante" });
  webpush.setVapidDetails(env("VAPID_SUBJECT") || "https://food.graphikeo.com", env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));
  const rows = await rpc("push_pending", { p_secret: env("PUSH_SECRET") });
  let sent = 0, removed = 0, skipped = 0, failed = 0;
  for (const row of rows) {
    const settings = {
      notifExpiry: row.settings?.notif_expiry ?? true,
      notifLowStock: row.settings?.notif_low_stock ?? true,
      lowStockThreshold: row.settings?.low_stock_threshold ?? 1
    };
    const products = row.products.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      category: r.category,
      quantity: Number(r.quantity),
      unit: r.unit ?? void 0,
      size: r.size ?? void 0,
      expiryDate: r.expiry_date ?? void 0,
      dateType: r.date_type ?? void 0,
      location: r.location ?? void 0,
      conservation: r.conservation ?? void 0
    }));
    const digest = buildDigest(products, settings);
    if (!digest) {
      skipped++;
      continue;
    }
    const payload = JSON.stringify({ ...digest, tag: "miamm-digest", url: "./" });
    for (const s of row.subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 12 });
        sent++;
      } catch (e) {
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          removed++;
          await rpc("push_forget", { p_secret: env("PUSH_SECRET"), p_endpoint: s.endpoint }).catch(() => {
          });
        } else failed++;
      }
    }
  }
  return res.status(200).json({ households: rows.length, sent, removed, skipped, failed });
}
export {
  handler as default
};
