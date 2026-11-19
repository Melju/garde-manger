// @ts-nocheck
// Fichier généré par scripts/build-alexa.mjs : ne pas éditer.

// server/alexa-edge.ts
import { X509Certificate, createHmac, verify as cryptoVerify, randomUUID } from "node:crypto";
import { createClient } from "npm:@supabase/supabase-js@2";

// src/data/repository.ts
function newId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// src/data/supabaseRepository.ts
function toProduct(r) {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    quantity: Number(r.quantity),
    unit: r.unit ?? void 0,
    size: r.size ?? void 0,
    brand: r.brand ?? void 0,
    expiryDate: r.expiry_date ?? void 0,
    price: r.price != null ? Number(r.price) : void 0,
    barcode: r.barcode ?? void 0,
    conservation: r.conservation ?? void 0,
    dateType: r.date_type ?? void 0,
    location: r.location ?? void 0,
    openedAt: r.opened_at ?? void 0,
    createdBy: r.created_by ?? void 0,
    imageUrl: r.image_url ?? void 0,
    nutriscore: r.nutriscore ?? void 0,
    nova: r.nova ?? void 0,
    kcal: r.kcal != null ? Number(r.kcal) : void 0,
    allergens: r.allergens ?? void 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}
function toShopping(r) {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    quantity: Number(r.quantity),
    unit: r.unit ?? void 0,
    checked: r.checked,
    source: r.source,
    createdAt: r.created_at
  };
}
function toRecipe(r) {
  return {
    id: r.id,
    title: r.title,
    timeMin: r.time_min,
    cuisine: r.cuisine ?? void 0,
    tags: r.tags ?? [],
    favorite: r.favorite,
    ingredients: r.ingredients ?? [],
    steps: r.steps ?? [],
    servings: r.servings ?? void 0,
    servingsUnit: r.servings_unit ?? void 0,
    icon: r.icon ?? void 0,
    notes: r.notes ?? void 0
  };
}
function toMember(r) {
  return {
    id: r.id,
    name: r.name,
    diet: r.diet,
    restrictions: r.restrictions ?? [],
    aversions: r.aversions ?? void 0,
    color: r.color,
    avatar: r.avatar ?? void 0
  };
}
var SupabaseRepository = class {
  constructor(sb, householdId) {
    this.sb = sb;
    this.householdId = householdId;
  }
  get hid() {
    return this.householdId;
  }
  // ---------- Produits ----------
  async listProducts() {
    const { data, error } = await this.sb.from("products").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toProduct);
  }
  async addProduct(input) {
    const { data, error } = await this.sb.from("products").insert({
      household_id: this.hid,
      name: input.name,
      category: input.category,
      quantity: input.quantity,
      unit: input.unit ?? null,
      size: input.size ?? null,
      brand: input.brand ?? null,
      expiry_date: input.expiryDate ?? null,
      price: input.price ?? null,
      barcode: input.barcode ?? null,
      conservation: input.conservation ?? null,
      date_type: input.dateType ?? null,
      location: input.location ?? null,
      opened_at: input.openedAt ?? null,
      image_url: input.imageUrl ?? null,
      nutriscore: input.nutriscore ?? null,
      nova: input.nova ?? null,
      kcal: input.kcal ?? null,
      allergens: input.allergens ?? null
    }).select().single();
    if (error) throw error;
    return toProduct(data);
  }
  async updateProduct(id, patch) {
    const row = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
    const has = (k) => Object.prototype.hasOwnProperty.call(patch, k);
    if (has("name") && patch.name !== void 0) row.name = patch.name;
    if (has("category") && patch.category !== void 0) row.category = patch.category;
    if (has("quantity") && patch.quantity !== void 0) row.quantity = patch.quantity;
    if (has("unit")) row.unit = patch.unit ?? null;
    if (has("size")) row.size = patch.size ?? null;
    if (has("brand")) row.brand = patch.brand ?? null;
    if (has("expiryDate")) row.expiry_date = patch.expiryDate ?? null;
    if (has("price")) row.price = patch.price ?? null;
    if (has("barcode")) row.barcode = patch.barcode ?? null;
    if (has("conservation")) row.conservation = patch.conservation ?? null;
    if (has("dateType")) row.date_type = patch.dateType ?? null;
    if (has("location")) row.location = patch.location ?? null;
    if (has("openedAt")) row.opened_at = patch.openedAt ?? null;
    if (has("imageUrl")) row.image_url = patch.imageUrl ?? null;
    if (has("nutriscore")) row.nutriscore = patch.nutriscore ?? null;
    if (has("nova")) row.nova = patch.nova ?? null;
    if (has("kcal")) row.kcal = patch.kcal ?? null;
    if (has("allergens")) row.allergens = patch.allergens ?? null;
    const { data, error } = await this.sb.from("products").update(row).eq("id", id).select().single();
    if (error) throw error;
    return toProduct(data);
  }
  async adjustQuantity(id, delta) {
    const { data: cur } = await this.sb.from("products").select("quantity").eq("id", id).maybeSingle();
    if (!cur) return null;
    const next = Number(cur.quantity) + delta;
    if (next <= 0) {
      await this.removeProduct(id);
      return null;
    }
    return this.updateProduct(id, { quantity: next });
  }
  async removeProduct(id) {
    const { error } = await this.sb.from("products").delete().eq("id", id);
    if (error) throw error;
  }
  // ---------- Courses ----------
  async listShopping() {
    const { data, error } = await this.sb.from("shopping_items").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(toShopping);
  }
  async addShoppingItem(input) {
    const { data, error } = await this.sb.from("shopping_items").insert({
      household_id: this.hid,
      name: input.name,
      category: input.category,
      quantity: input.quantity,
      unit: input.unit ?? null,
      source: input.source,
      checked: false
    }).select().single();
    if (error) throw error;
    return toShopping(data);
  }
  async updateShoppingItem(id, patch) {
    const row = {};
    if (patch.name !== void 0) row.name = patch.name;
    if (patch.category !== void 0) row.category = patch.category;
    if (patch.quantity !== void 0) row.quantity = patch.quantity;
    if (patch.unit !== void 0) row.unit = patch.unit ?? null;
    if (patch.source !== void 0) row.source = patch.source;
    const { error } = await this.sb.from("shopping_items").update(row).eq("id", id).eq("household_id", this.hid);
    if (error) throw error;
  }
  async toggleShoppingItem(id) {
    const { data: cur } = await this.sb.from("shopping_items").select("checked").eq("id", id).maybeSingle();
    if (!cur) return null;
    const { data, error } = await this.sb.from("shopping_items").update({ checked: !cur.checked }).eq("id", id).select().single();
    if (error) throw error;
    return toShopping(data);
  }
  async removeShoppingItem(id) {
    const { error } = await this.sb.from("shopping_items").delete().eq("id", id);
    if (error) throw error;
  }
  async clearCheckedShopping() {
    const { error } = await this.sb.from("shopping_items").delete().eq("checked", true);
    if (error) throw error;
  }
  // ---------- Recettes ----------
  async getRecipes() {
    const { data, error } = await this.sb.from("recipes").select("*").order("title");
    if (error) throw error;
    return (data ?? []).map(toRecipe);
  }
  async saveRecipes(recipes) {
    await this.syncCollection(
      "recipes",
      recipes.map((r) => ({
        id: r.id,
        household_id: this.hid,
        title: r.title,
        time_min: r.timeMin,
        cuisine: r.cuisine ?? null,
        tags: r.tags,
        favorite: r.favorite,
        ingredients: r.ingredients,
        steps: r.steps ?? [],
        servings: r.servings ?? null,
        servings_unit: r.servingsUnit ?? null,
        icon: r.icon ?? null,
        notes: r.notes ?? null
      }))
    );
  }
  // ---------- Famille ----------
  async getFamily() {
    const { data, error } = await this.sb.from("family_members").select("*");
    if (error) throw error;
    return (data ?? []).map(toMember);
  }
  async saveFamily(members) {
    await this.syncCollection(
      "family_members",
      members.map((m) => ({
        id: m.id,
        household_id: this.hid,
        name: m.name,
        diet: m.diet,
        restrictions: m.restrictions,
        aversions: m.aversions ?? null,
        avatar: m.avatar ?? null,
        color: m.color
      }))
    );
  }
  // ---------- Planning ----------
  async getMealPlan() {
    const { data, error } = await this.sb.from("meals").select("*");
    if (error) throw error;
    const plan = {};
    for (const r of data ?? []) plan[`${r.meal_date}_${r.slot}`] = r.label;
    return plan;
  }
  async saveMealPlan(plan) {
    await this.sb.from("meals").delete().eq("household_id", this.hid);
    const rows = Object.entries(plan).map(([key, label]) => {
      const i = key.lastIndexOf("_");
      return { household_id: this.hid, meal_date: key.slice(0, i), slot: key.slice(i + 1), label };
    });
    if (rows.length) {
      const { error } = await this.sb.from("meals").insert(rows);
      if (error) throw error;
    }
  }
  // ---------- Historique ----------
  async getHistory() {
    const rows = [];
    for (let from = 0; ; from += 1e3) {
      const { data, error } = await this.sb.from("history").select("*").order("at", { ascending: false }).range(from, from + 999);
      if (error) throw error;
      rows.push(...data ?? []);
      if (!data || data.length < 1e3) break;
    }
    return rows.map((r) => ({
      id: r.id,
      date: r.entry_date,
      at: r.at,
      kind: r.kind,
      label: r.label,
      amount: r.amount != null ? Number(r.amount) : void 0,
      meta: r.meta ?? void 0
    }));
  }
  async saveHistory(entries) {
    await this.syncCollection(
      "history",
      entries.map((h) => ({
        id: h.id && h.id.length > 20 ? h.id : newId(),
        household_id: this.hid,
        entry_date: h.date,
        at: h.at,
        kind: h.kind,
        label: h.label,
        amount: h.amount ?? null,
        meta: h.meta ?? null
      })),
      false
      // historique : on n'efface pas (append-only)
    );
  }
  async removeHistory(id) {
    const { error } = await this.sb.from("history").delete().eq("id", id).eq("household_id", this.hid);
    if (error) throw error;
  }
  // ---------- Dépenses ----------
  async getExpenses() {
    const { data, error } = await this.sb.from("expenses").select("*").order("expense_date", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      date: r.expense_date,
      category: r.category,
      label: r.label,
      amount: Number(r.amount)
    }));
  }
  async saveExpenses(expenses) {
    await this.syncCollection(
      "expenses",
      expenses.map((e) => ({
        id: e.id,
        household_id: this.hid,
        expense_date: e.date,
        category: e.category,
        label: e.label,
        amount: e.amount
      })),
      false
    );
  }
  // ---------- Budget ----------
  async getBudget() {
    const { data } = await this.sb.from("budget").select("monthly_limit").eq("household_id", this.hid).maybeSingle();
    return { monthlyLimit: data ? Number(data.monthly_limit) : 400 };
  }
  async saveBudget(config) {
    const { error } = await this.sb.from("budget").upsert({ household_id: this.hid, monthly_limit: config.monthlyLimit });
    if (error) throw error;
  }
  // ---------- Paramètres ----------
  async getSettings() {
    const { data } = await this.sb.from("settings").select("*").eq("household_id", this.hid).maybeSingle();
    return {
      notifExpiry: data?.notif_expiry ?? true,
      notifLowStock: data?.notif_low_stock ?? true,
      lowStockThreshold: data?.low_stock_threshold ?? 1
    };
  }
  async saveSettings(settings) {
    const { error } = await this.sb.from("settings").upsert({
      household_id: this.hid,
      notif_expiry: settings.notifExpiry,
      notif_low_stock: settings.notifLowStock,
      low_stock_threshold: settings.lowStockThreshold
    });
    if (error) throw error;
  }
  // ---------- Catalogue d'apprentissage des courses ----------
  async getShopCatalog() {
    const { data, error } = await this.sb.from("shop_catalog").select("*");
    if (error) throw error;
    return (data ?? []).map((r) => ({
      name: r.name,
      category: r.category,
      unit: r.unit ?? "",
      qty: Number(r.qty),
      count: r.count ?? 0,
      at: r.at
    }));
  }
  async saveShopCatalog(entries) {
    if (!entries.length) return;
    const rows = entries.map((e) => ({
      household_id: this.hid,
      name_key: e.name.trim().toLowerCase(),
      name: e.name,
      category: e.category,
      unit: e.unit,
      qty: e.qty,
      count: e.count,
      at: e.at
    }));
    const { error } = await this.sb.from("shop_catalog").upsert(rows);
    if (error) throw error;
  }
  // En cloud, la réinitialisation démo n'a pas de sens (no-op).
  async resetDemo() {
  }
  /**
   * Synchronise une collection : upsert de toutes les lignes fournies, et
   * (si removeMissing) suppression des lignes du foyer absentes de la liste.
   */
  async syncCollection(table, rows, removeMissing = true) {
    if (rows.length) {
      const { error } = await this.sb.from(table).upsert(rows);
      if (error) throw error;
    }
    if (removeMissing) {
      const ids = rows.map((r) => r.id);
      let q = this.sb.from(table).delete().eq("household_id", this.hid);
      if (ids.length) q = q.not("id", "in", `(${ids.join(",")})`);
      const { error } = await q;
      if (error) throw error;
    }
  }
};

// src/lib/contenance.ts
var COUNT_ALIASES = {
  sachet: "sachet",
  sachets: "sachet",
  sach: "sachet",
  sct: "sachet",
  piece: "pi\xE8ce",
  pieces: "pi\xE8ce",
  "pi\xE8ce": "pi\xE8ce",
  "pi\xE8ces": "pi\xE8ce",
  pc: "pi\xE8ce",
  pcs: "pi\xE8ce",
  pack: "pack",
  packs: "pack",
  boite: "bo\xEEte",
  boites: "bo\xEEte",
  "bo\xEEte": "bo\xEEte",
  "bo\xEEtes": "bo\xEEte",
  pot: "pot",
  pots: "pot",
  tranche: "tranche",
  tranches: "tranche"
};
function countUnit(unit) {
  if (!unit) return null;
  return COUNT_ALIASES[unit.trim().toLowerCase().replace(/\.$/, "")] ?? null;
}
function countLabel(value, unit) {
  const u = countUnit(unit) ?? unit;
  return `${value} ${u}${value > 1 ? "s" : ""}`;
}
function splitSize(size) {
  if (!size) return { current: "" };
  const i = size.indexOf("/");
  if (i < 0) return { current: size.trim() };
  return { current: size.slice(0, i).trim(), full: size.slice(i + 1).trim() || void 0 };
}
function parseContenance(size) {
  if (!size) return null;
  const m = splitSize(size).current.match(/^([\d.,]+)\s*(.+)$/);
  if (!m) return null;
  const value = Number(m[1].replace(",", "."));
  if (!isFinite(value) || value <= 0) return null;
  return { value, unit: m[2].trim() };
}
function family(unit) {
  const u = unit.toLowerCase();
  if (countUnit(u)) return "count";
  if (u === "g" || u === "kg") return "mass";
  if (u === "ml" || u === "cl" || u === "l") return "volume";
  return null;
}
function toBase(value, unit) {
  const u = unit.toLowerCase();
  if (u === "kg" || u === "l") return value * 1e3;
  if (u === "cl") return value * 10;
  return value;
}
function formatContenance(value, unit) {
  const u = unit.toLowerCase();
  const round = (n) => Math.round(n * 100) / 100;
  if (countUnit(u)) return countLabel(round(value), unit);
  if (u === "g" && value >= 1e3) return `${round(value / 1e3)} kg`;
  if (u === "ml" && value >= 1e3) return `${round(value / 1e3)} L`;
  if (u === "kg" && value < 1) return `${Math.round(value * 1e3)} g`;
  if (u === "l" && value < 1) return `${Math.round(value * 1e3)} mL`;
  return `${round(value)} ${unit}`;
}
function consumeAmount(size, amount, amountUnit) {
  const p = parseContenance(size);
  if (!p) return null;
  if (family(p.unit) !== family(amountUnit)) return null;
  const remainingBase = toBase(p.value, p.unit) - toBase(amount, amountUnit);
  if (remainingBase <= toBase(p.value, p.unit) * 0.02) return null;
  const factor = toBase(1, p.unit);
  return withFull(formatContenance(remainingBase / factor, p.unit), size, p);
}
function withFull(remaining, oldSize, p) {
  const full = splitSize(oldSize).full ?? formatContenance(p.value, p.unit);
  return `${remaining}/${full}`;
}

// src/lib/productIcon.ts
function normalize(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/[^a-z0-9]+/g, " ").trim();
}

// src/lib/openShelf.ts
var OPEN_ROWS = [
  [["creme fraiche"], 7],
  [["creme liquide", "creme entiere", "creme legere", "creme uht", "creme fleurette"], 4],
  [["creme dessert", "creme anglaise"], 3],
  [["creme"], 5],
  [["mascarpone"], 5],
  [["ricotta"], 4],
  [["fromage frais", "fromage blanc", "cottage", "petit suisse"], 4],
  [["faisselle"], 3],
  [["yaourt", "yogourt", "skyr", "dessert lacte"], 3],
  [["lait de coco", "lait de soja", "lait d amande", "lait d avoine", "lait vegetal", "boisson vegetale"], 4],
  [["lait"], 3],
  [["rape"], 5],
  [["mozzarella"], 4],
  [["feta"], 7],
  [["saumon fume"], 3],
  [["jambon", "charcuterie", "lardon", "blanc de poulet", "blanc de dinde"], 4],
  [["bacon"], 5],
  [["rillettes", "foie gras", "terrine"], 5],
  [["houmous", "hummus"], 5],
  [["tzatziki", "taboule", "salade composee"], 3],
  [["guacamole"], 2],
  [["pesto", "tapenade"], 7],
  [["bechamel", "sauce blanche", "bolognaise", "sauce carbonara"], 4],
  [["sauce tomate", "coulis", "passata", "concentre de tomate"], 5],
  [["ketchup", "mayonnaise", "moutarde", "sauce soja", "sauce"], 60],
  [["cornichon", "oignons au vinaigre", "oignon au vinaigre", "vinaigre", "olive", "capres"], 30],
  [["confiture", "gelee", "miel"], 30],
  [["compote"], 5],
  [["jus", "smoothie"], 4],
  [["soupe", "bouillon", "veloute"], 4],
  [["tofu", "seitan", "tempeh"], 4],
  [["thon", "sardine", "maquereau"], 2],
  [["haricot", "mais", "petits pois", "macedoine", "champignon", "legumes", "poivron", "artichaut", "conserve"], 3],
  [["bocal", "pot"], 7]
];
function openShelfDays(name, _category) {
  const padded = ` ${normalize(name)} `;
  for (const [words, days] of OPEN_ROWS) {
    for (const w of words) {
      if (padded.includes(` ${w} `) || padded.includes(` ${w}s `) || padded.includes(` ${w}x `) || w === "rape" && padded.includes(" rape")) {
        return { days, known: true };
      }
    }
  }
  return { days: 7, known: false };
}

// src/types.ts
var CATEGORIES = [
  { id: "fruits", label: "Fruits" },
  { id: "legumes", label: "L\xE9gumes" },
  { id: "viandes", label: "Viandes" },
  { id: "viandes-vg", label: "Viandes VG" },
  { id: "poissons", label: "Poissons" },
  { id: "laitiers", label: "Laitiers" },
  { id: "epicerie", label: "\xC9picerie" },
  { id: "huiles", label: "Huiles" },
  { id: "conserves", label: "Conserves" },
  { id: "sucreries", label: "Sucreries" },
  { id: "patisserie", label: "P\xE2tisserie" },
  { id: "apero", label: "Ap\xE9ro" },
  { id: "boissons", label: "Boissons" },
  { id: "surgeles", label: "Surgel\xE9s" },
  { id: "maison", label: "Maison" },
  { id: "autre", label: "Autre" }
];
var CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
function defaultConservation(category) {
  if (category === "surgeles") return "congele";
  if (["viandes", "viandes-vg", "poissons", "laitiers", "fruits", "legumes"].includes(category)) return "refrigere";
  return "frais";
}

// server/alexa-edge.ts
var env = (k) => Deno.env.get(k) ?? "";
var certCache = /* @__PURE__ */ new Map();
function validCertUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === "https:" && url.hostname.toLowerCase() === "s3.amazonaws.com" && (url.port === "" || url.port === "443") && url.pathname.startsWith("/echo.api/") && !url.pathname.includes("/../");
  } catch {
    return false;
  }
}
async function verifyAmazon(req, raw) {
  const certUrl = req.headers.get("signaturecertchainurl") ?? "";
  const sig = req.headers.get("signature-256") ?? "";
  if (!certUrl || !sig) return "en-t\xEAtes de signature absents";
  if (!validCertUrl(certUrl)) return "URL de certificat invalide";
  let pem = certCache.get(certUrl);
  if (!pem || Date.now() - pem.at > 36e5) {
    const r = await fetch(certUrl);
    if (!r.ok) return "certificat introuvable";
    pem = { pem: await r.text(), at: Date.now() };
    certCache.set(certUrl, pem);
  }
  const parts = pem.pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
  if (!parts.length) return "certificat vide";
  const chain = parts.map((p) => new X509Certificate(p));
  const leaf = chain[0];
  const now = Date.now();
  if (now < Date.parse(leaf.validFrom) || now > Date.parse(leaf.validTo)) return "certificat expir\xE9";
  const hostOk = /CN=echo-api\.amazon\.com/.test(String(leaf.subject)) && /O=Amazon/.test(String(leaf.issuer));
  if (!hostOk) return "certificat non Amazon";
  const ok = cryptoVerify("sha256", new TextEncoder().encode(raw), leaf.publicKey, Uint8Array.from(atob(sig), (c) => c.charCodeAt(0)));
  return ok ? null : "signature invalide";
}
var esc = (t) => t.replace(/&/g, "et").replace(/[<>]/g, "");
function say(text, opts = {}) {
  return {
    version: "1.0",
    sessionAttributes: opts.attrs ?? {},
    response: {
      outputSpeech: { type: "SSML", ssml: `<speak>${esc(text)}</speak>` },
      ...opts.reprompt ? { reprompt: { outputSpeech: { type: "PlainText", text: opts.reprompt } } } : {},
      ...opts.card ? { card: { type: "Simple", title: "Miam miam", content: opts.card } } : {},
      shouldEndSession: opts.end ?? true
    }
  };
}
var pushSecret = "";
async function secret() {
  if (pushSecret) return pushSecret;
  const k = env("SUPABASE_SERVICE_ROLE_KEY");
  const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/push_config?key=eq.secret&select=value`, {
    headers: { apikey: k, authorization: `Bearer ${k}` }
  });
  pushSecret = (await r.json())[0]?.value ?? "";
  return pushSecret;
}
async function note(msg) {
  try {
    const k = env("SUPABASE_SERVICE_ROLE_KEY");
    await fetch(`${env("SUPABASE_URL")}/rest/v1/push_config`, {
      method: "POST",
      headers: {
        apikey: k,
        authorization: `Bearer ${k}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates"
      },
      body: JSON.stringify({ key: "alexa_last_error", value: `${(/* @__PURE__ */ new Date()).toISOString()} ${msg}`.slice(0, 900) })
    });
  } catch {
  }
}
var skillId = null;
async function allowedSkill() {
  if (skillId !== null) return skillId;
  const k = env("SUPABASE_SERVICE_ROLE_KEY");
  const r = await fetch(`${env("SUPABASE_URL")}/rest/v1/push_config?key=eq.alexa_skill_id&select=value`, {
    headers: { apikey: k, authorization: `Bearer ${k}` }
  });
  skillId = (await r.json())[0]?.value ?? "";
  return skillId;
}
async function rpc(name, args) {
  const base = env("SUPABASE_URL");
  const anon = env("SUPABASE_ANON_KEY");
  const r = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: anon, authorization: `Bearer ${anon}`, "content-type": "application/json" },
    body: JSON.stringify({ p_secret: await secret(), ...args })
  });
  if (!r.ok) throw new Error(`${name} ${r.status}`);
  return r.json();
}
function userJwt(userId) {
  const b64 = (o) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o)))).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const now = Math.floor(Date.now() / 1e3);
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ sub: userId, role: "authenticated", aud: "authenticated", iat: now, exp: now + 300 });
  const s = createHmac("sha256", env("JWT_SECRET")).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${s}`;
}
var toBase2 = (v, u) => {
  const l = u.toLowerCase();
  return l === "kg" || l === "l" ? v * 1e3 : l === "cl" ? v * 10 : v;
};
var baseUnit = (u) => {
  const l = u.toLowerCase();
  return l === "kg" || l === "g" ? "g" : l === "l" || l === "cl" || l === "ml" ? "mL" : "";
};
async function handleCommand(text, link, alexaUser) {
  const jwt = userJwt(link.user_id);
  const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const repo = new SupabaseRepository(sb, link.household_id);
  const [products, shopping] = await Promise.all([repo.listProducts(), repo.listShopping()]);
  const r = await fetch(`${env("SUPABASE_URL")}/functions/v1/voice`, {
    method: "POST",
    headers: { apikey: env("SUPABASE_ANON_KEY"), authorization: `Bearer ${jwt}`, "content-type": "application/json" },
    body: JSON.stringify({
      text,
      stock: products.slice(0, 400).map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand || void 0,
        qty: p.quantity,
        size: p.size || void 0,
        opened: !!p.openedAt || void 0,
        exp: p.expiryDate || void 0,
        place: p.location || void 0
      })),
      shopping: shopping.filter((s) => !s.checked).map((s) => ({ id: s.id, name: s.name, qty: s.unit ? `${s.quantity} ${s.unit}` : `\xD7${s.quantity}` }))
    })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return say(data?.error ? `D\xE9sol\xE9, ${data.error}` : "D\xE9sol\xE9, je n\u2019ai pas pu comprendre pour l\u2019instant.");
  const reply = data.reply || "";
  const actions = Array.isArray(data.actions) ? data.actions : [];
  if (!actions.length) return say(reply || "Je n\u2019ai pas compris. Tu peux reformuler ?", { end: false, reprompt: "Que veux-tu faire ?" });
  const ask = actions.find((a) => a.type === "ask");
  if (ask) {
    const names = ask.options.map((o) => o.label).join(", ou ");
    return say(`${ask.question} ${names} ?`, {
      end: false,
      reprompt: ask.question,
      attrs: { pending: ask }
    });
  }
  const undo = [];
  for (const a of actions) {
    try {
      await applyOne(a, repo, sb, products, shopping, undo);
    } catch {
    }
  }
  await rpc("alexa_set_undo", { p_alexa: alexaUser, p_undo: { at: Date.now(), ops: undo } }).catch(() => {
  });
  return say(reply || "C\u2019est fait.", { card: actions.map((a) => a.label).join("\n") });
}
async function logHistory(sb, hid, kind, label, meta) {
  const now = /* @__PURE__ */ new Date();
  await sb.from("history").insert({
    id: randomUUID(),
    household_id: hid,
    entry_date: now.toISOString().slice(0, 10),
    at: now.toISOString(),
    kind,
    label,
    meta
  });
}
async function applyOne(a, repo, sb, products, shopping, undo) {
  const hid = repo.householdId;
  if (a.type === "shop_add") {
    const unit = baseUnit(a.unit || "");
    const quantity = a.unit ? Math.round(toBase2(a.quantity, a.unit)) : Math.max(1, Math.round(a.quantity));
    const it = await repo.addShoppingItem({ name: a.name, category: a.category, quantity, unit: unit || void 0, source: "manuel" });
    undo.push({ t: "shop_del", ids: [it.id] });
    return;
  }
  if (a.type === "shop_remove") {
    const it = shopping.find((s) => s.id === a.id);
    if (!it) return;
    await repo.removeShoppingItem(it.id);
    undo.push({ t: "shop_add", item: { name: it.name, category: it.category, quantity: it.quantity, unit: it.unit } });
    return;
  }
  if (a.type === "stock_add") {
    const withSize = !!a.unit;
    const p2 = await repo.addProduct({
      name: a.name,
      category: a.category,
      quantity: withSize ? 1 : Math.max(1, Math.round(a.quantity)),
      size: withSize ? `${a.quantity} ${a.unit}` : void 0,
      conservation: defaultConservation(a.category)
    });
    undo.push({ t: "prod_del", id: p2.id });
    return;
  }
  const p = products.find((x) => x.id === a.id);
  if (!p) return;
  undo.push({ t: "prod_restore", snap: { ...p } });
  const meta = { name: p.name, category: p.category, conservation: p.conservation };
  if (a.type === "stock_finish") {
    await repo.removeProduct(p.id);
    await logHistory(sb, hid, "consomme", `${p.name} consomm\xE9 (\xD7${p.quantity})`, { ...meta, qty: p.quantity });
    return;
  }
  if (a.type === "stock_waste") {
    await repo.removeProduct(p.id);
    await logHistory(sb, hid, "jete", `${p.name} jet\xE9 (p\xE9rim\xE9)`, { ...meta, qty: p.quantity });
    return;
  }
  if (a.type === "stock_open") {
    const days = openShelfDays(p.name, p.category).days;
    const exp = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
    const keep = p.expiryDate && p.expiryDate < exp ? p.expiryDate : exp;
    await repo.updateProduct(p.id, { openedAt: (/* @__PURE__ */ new Date()).toISOString(), expiryDate: keep });
    return;
  }
  if (a.type === "stock_remove") {
    const parsed = parseContenance(p.size);
    if (!a.unit || !parsed) {
      const n = Math.min(a.unit ? 1 : Math.max(1, Math.round(a.amount)), p.quantity);
      await repo.adjustQuantity(p.id, -n);
      await logHistory(sb, hid, "consomme", `${p.name} consomm\xE9 (\xD7${n})`, { ...meta, qty: n });
      return;
    }
    const newSize = consumeAmount(p.size, a.amount, a.unit);
    if (newSize === null) {
      await repo.adjustQuantity(p.id, -1);
      await logHistory(sb, hid, "consomme", `${p.name} consomm\xE9 (\xD71)`, { ...meta, qty: 1 });
      return;
    }
    if (p.quantity > 1) {
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = p;
      await repo.updateProduct(p.id, { quantity: p.quantity - 1 });
      const np = await repo.addProduct({ ...rest, quantity: 1, size: newSize });
      undo.push({ t: "prod_del", id: np.id });
      return;
    }
    await repo.updateProduct(p.id, { size: newSize });
  }
}
async function handleUndo(link, alexaUser) {
  const u = link.last_undo;
  if (!u?.ops?.length || Date.now() - (u.at ?? 0) > 36e5) return say("Il n\u2019y a rien \xE0 annuler.");
  const jwt = userJwt(link.user_id);
  const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const repo = new SupabaseRepository(sb, link.household_id);
  const products = await repo.listProducts();
  for (const op of [...u.ops].reverse()) {
    try {
      if (op.t === "shop_del") for (const id of op.ids) await repo.removeShoppingItem(id);
      else if (op.t === "shop_add") await repo.addShoppingItem({ ...op.item, category: op.item.category, source: "manuel" });
      else if (op.t === "prod_del") await repo.removeProduct(op.id);
      else if (op.t === "prod_restore") {
        const { id, createdAt: _c, updatedAt: _u, ...rest } = op.snap;
        if (products.some((p) => p.id === id)) await repo.updateProduct(id, rest);
        else await repo.addProduct(rest);
      }
    } catch {
    }
  }
  await rpc("alexa_set_undo", { p_alexa: alexaUser, p_undo: null }).catch(() => {
  });
  return say("C\u2019est annul\xE9, tout est revenu comme avant.");
}
var VERBS = {
  AjouterIntent: "ajoute",
  EnleverIntent: "enl\xE8ve",
  JaiIntent: "j\u2019ai",
  QuestionIntent: "",
  CommandeIntent: ""
};
var out = (status, o) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json;charset=UTF-8" } });
Deno.serve(async (req) => {
  if (req.method !== "POST") return out(405, { error: "m\xE9thode" });
  const raw = await req.text();
  const bad = await verifyAmazon(req, raw).catch((e) => String(e));
  if (bad) {
    await note(`v\xE9rification : ${bad}`);
    return out(400, { error: bad });
  }
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return out(400, { error: "json" });
  }
  const ts = Date.parse(body?.request?.timestamp ?? "");
  if (!ts || Math.abs(Date.now() - ts) > 15e4) {
    await note("horodatage");
    return out(400, { error: "horodatage" });
  }
  const appId = body?.session?.application?.applicationId ?? body?.context?.System?.application?.applicationId;
  const want = await allowedSkill();
  if (want && appId !== want) {
    await note(`skill inconnue ${appId}`);
    return out(400, { error: "skill inconnue" });
  }
  const send = (o) => out(200, o);
  const rq = body.request ?? {};
  const alexaUser = body?.session?.user?.userId ?? body?.context?.System?.user?.userId ?? "";
  try {
    if (rq.type === "SessionEndedRequest") return send({ version: "1.0", response: {} });
    const intent = rq.intent?.name ?? "";
    if (intent === "AssocierIntent") {
      const code = await rpc("alexa_new_code", { p_alexa: alexaUser });
      const spaced = code.split("").join(" ");
      return send(
        say(`Voici ton code : ${spaced}. Je r\xE9p\xE8te : ${spaced}. Saisis-le dans l\u2019app Miam miam, dans Param\xE8tres, rubrique Alexa. Il est valable dix minutes.`, {
          card: `Code d'association : ${code} (valable 10 minutes)`
        })
      );
    }
    const link = await rpc("alexa_lookup", { p_alexa: alexaUser });
    if (!link) {
      return send(
        say("Je ne connais pas encore ton foyer. Dis : Alexa, demande \xE0 Miam miam de m\u2019associer, puis saisis le code dans l\u2019app.", {
          end: true
        })
      );
    }
    if (rq.type === "LaunchRequest")
      return send(
        say(`Salut ${link.name ? link.name.split(/[.\s]/)[0] : ""} ! Qu\u2019est-ce que je fais ? Par exemple : ajoute du lait aux courses.`, {
          end: false,
          reprompt: "Que veux-tu faire ?"
        })
      );
    if (intent === "AMAZON.HelpIntent")
      return send(
        say(
          "Tu peux me dire : ajoute du pain aux courses, enl\xE8ve deux cents grammes de comt\xE9, j\u2019ai fini les yaourts, ou est-ce qu\u2019il reste du beurre. Pour revenir en arri\xE8re, dis : annule.",
          { end: false, reprompt: "Que veux-tu faire ?" }
        )
      );
    if (intent === "AMAZON.StopIntent" || intent === "AMAZON.CancelIntent" || intent === "AMAZON.NoIntent") return send(say("\xC0 plus tard !"));
    if (intent === "AnnulerIntent") return send(await handleUndo(link, alexaUser));
    const pending = body?.session?.attributes?.pending;
    const phrase = rq.intent?.slots?.phrase?.value ?? "";
    if (pending && phrase) {
      const text = `${pending.question} R\xE9ponse : ${phrase}. (Action : ${pending.then}${pending.then === "stock_remove" ? ` ${pending.amount} ${pending.unit}` : ""})`;
      return send(await handleCommand(text, link, alexaUser));
    }
    if (intent in VERBS && phrase) {
      const verb = VERBS[intent];
      return send(await handleCommand(verb ? `${verb} ${phrase}` : phrase, link, alexaUser));
    }
    if (intent === "AMAZON.FallbackIntent" || intent in VERBS)
      return send(say("Je n\u2019ai pas bien compris. Tu peux r\xE9p\xE9ter ?", { end: false, reprompt: "Que veux-tu faire ?" }));
    return send(say("Je n\u2019ai pas compris.", { end: false, reprompt: "Que veux-tu faire ?" }));
  } catch (e) {
    await note(`erreur : ${e instanceof Error ? `${e.message} ${e.stack ?? ""}` : String(e)}`);
    return send(say("Oups, Miam miam a eu un souci. R\xE9essaie dans un instant."));
  }
});
