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
    const row2 = { updated_at: (/* @__PURE__ */ new Date()).toISOString() };
    const has = (k) => Object.prototype.hasOwnProperty.call(patch, k);
    if (has("name") && patch.name !== void 0) row2.name = patch.name;
    if (has("category") && patch.category !== void 0) row2.category = patch.category;
    if (has("quantity") && patch.quantity !== void 0) row2.quantity = patch.quantity;
    if (has("unit")) row2.unit = patch.unit ?? null;
    if (has("size")) row2.size = patch.size ?? null;
    if (has("brand")) row2.brand = patch.brand ?? null;
    if (has("expiryDate")) row2.expiry_date = patch.expiryDate ?? null;
    if (has("price")) row2.price = patch.price ?? null;
    if (has("barcode")) row2.barcode = patch.barcode ?? null;
    if (has("conservation")) row2.conservation = patch.conservation ?? null;
    if (has("dateType")) row2.date_type = patch.dateType ?? null;
    if (has("location")) row2.location = patch.location ?? null;
    if (has("openedAt")) row2.opened_at = patch.openedAt ?? null;
    if (has("imageUrl")) row2.image_url = patch.imageUrl ?? null;
    if (has("nutriscore")) row2.nutriscore = patch.nutriscore ?? null;
    if (has("nova")) row2.nova = patch.nova ?? null;
    if (has("kcal")) row2.kcal = patch.kcal ?? null;
    if (has("allergens")) row2.allergens = patch.allergens ?? null;
    const { data, error } = await this.sb.from("products").update(row2).eq("id", id).select().single();
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
    const row2 = {};
    if (patch.name !== void 0) row2.name = patch.name;
    if (patch.category !== void 0) row2.category = patch.category;
    if (patch.quantity !== void 0) row2.quantity = patch.quantity;
    if (patch.unit !== void 0) row2.unit = patch.unit ?? null;
    if (patch.source !== void 0) row2.source = patch.source;
    const { error } = await this.sb.from("shopping_items").update(row2).eq("id", id).eq("household_id", this.hid);
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

// src/lib/productImage.ts
var RULES = [
  [["gousse de vanille", "gousses de vanille", "gousse vanille", "vanille en gousse", "vanille bourbon gousse"], "gousses-vanille"],
  [["arome vanille", "arome de vanille", "extrait de vanille", "vanille liquide", "essence de vanille", "arome naturel vanille"], "arome-vanille"],
  [["bicarbonate", "bicarbonate de soude", "bicarbonate alimentaire", "bicarbonate de sodium"], "bicarbonate"],
  [["levure chimique", "levure boulangere", "levure de boulanger", "levure patissiere", "sachet de levure", "sachets de levure", "levure en sachet", "levure seche"], "levure-sachets"],
  [["freeze pop", "freeze pops", "freezer pops", "freezer pop", "mocktails freeze", "glacons a sucer", "ice pops", "ice pop"], "freeze-pops"],
  [["the glace peche", "the glace a la peche", "ice tea peche", "fuzete", "fuze tea", "pesca e rosa", "the pesche", "eistee pfirsich"], "the-glace-peche"],
  [["gelatine", "gelatine alimentaire", "gelatine en feuilles", "feuilles de gelatine", "feuille de gelatine"], "gelatine-feuilles"],
  [["mini canape", "mini canapes", "canape", "canapes", "toasts apero", "mini toasts"], "mini-canapes"],
  [["peches en conserve", "peche en conserve", "peches au sirop", "peche au sirop", "peches en boite", "pfirsich", "pfirsiche", "demi peches", "moities de peches"], "peches-conserve"],
  [["gingembre marine", "gingembre confit", "gingembre rose", "sushi ginger", "gari", "ginger", "mindestens ginger"], "gingembre-pot"],
  [["liant", "liant pour sauces", "liant sauces blanches", "liant sauce blanche", "epaississant sauce", "roux instantane", "sauce binder"], "liant-sauces"],
  [["feuille de brick", "feuilles de brick", "pate de brick", "pates de brick", "galette de brick", "galettes de brick", "brick pastry"], "feuilles-brick"],
  [["wasabi", "pate de wasabi", "raifort japonais"], "wasabi"],
  [["oignon frit", "oignons frits", "oignons fris", "oignon fris", "oignons croustillants", "oignons crispy", "oignons crispys", "crispy onions", "oignons rissoles"], "oignons-frits"],
  [["oignon au vinaigre", "oignons au vinaigre", "oignon vinaigre", "oignons vinaigre", "oignon grelot", "oignons grelots", "petits oignons au vinaigre", "petit oignon au vinaigre", "petits oignons vinaigre", "oignons blancs au vinaigre", "pickles oignons"], "oignons-vinaigre"],
  [["supreme de tomate", "supreme de potiron", "supreme de legumes", "supreme de champignons", "supreme de poireaux", "supreme de carottes", "supreme de courgettes", "cup a soup", "soupe en sachet", "soupes en sachet", "soupe sachet", "sachet de soupe", "sachets de soupe", "soupe instantanee", "soupe deshydratee", "soupe minute"], "soupe-sachet"],
  [["banana bread", "cake banane", "cake a la banane", "gateau banane"], "banana-bread"],
  [["bowl cake", "mug cake", "gateau mug", "gateau tasse"], "mug-cake"],
  [["cake sale", "cakes sales", "cake tomates", "cakes tomates", "cake aux olives", "cake jambon olives", "cake lardons"], "cake-sale"],
  [["quatre quarts", "quatre-quarts"], "quatre-quarts"],
  [["overnight oats", "overnight porridge"], "overnight-oats"],
  [["granola maison", "bol de granola", "bowl granola"], "granola-bol"],
  [["poelee tex mex", "poelee texmex", "poelee mexicaine"], "poelee-tex-mex"],
  [["burrito bowl", "bowl mexicain", "buddha bowl mexicain"], "burrito-bowl"],
  [["fajitas", "fajita"], "fajitas"],
  [["tarte aux pommes", "tarte pommes", "tarte normande", "tarte tatin", "apple pie"], "tarte-pommes"],
  [["tarte au citron", "tarte citron", "tarte au citron meringuee"], "tarte-citron"],
  [["crumble", "crumble aux pommes", "crumble aux fruits", "crumble aux fruits rouges"], "crumble"],
  [["mousse au chocolat", "mousse chocolat"], "mousse-chocolat"],
  [["tiramisu"], "tiramisu"],
  [["panna cotta", "pannacotta"], "panna-cotta"],
  [["creme brulee"], "creme-brulee"],
  [["riz au lait"], "riz-au-lait"],
  [["gateau au chocolat", "gateau chocolat", "fondant au chocolat", "moelleux au chocolat"], "gateau-chocolat"],
  [["cheesecake", "cheese cake"], "cheesecake"],
  [["clafoutis"], "clafoutis"],
  [["ile flottante", "oeufs a la neige"], "ile-flottante"],
  [["mac and cheese", "mac n cheese", "macaroni and cheese", "macaroni au fromage", "mac cheese"], "mac-cheese"],
  [["riz cantonais", "riz saute", "riz frit", "nasi goreng"], "riz-cantonais"],
  [["pates aux legumes", "pates legumes", "pates primavera"], "pates-legumes"],
  [["tortilla espagnole", "tortilla de patatas", "omelette espagnole"], "tortilla"],
  [["oeufs brouilles", "oeuf brouille"], "oeufs-brouilles"],
  [["gratin de chou fleur", "gratin chou fleur", "chou fleur gratine"], "gratin-chou-fleur"],
  [["galette complete", "galette de sarrasin", "galette sarrasin", "crepe de sarrasin"], "galette-complete"],
  [["tarte aux legumes", "tarte salee", "tarte salee aux legumes", "tarte legumes", "tarte provencale"], "tarte-salee-legumes"],
  [["soupe de legumes", "soupe aux legumes", "soupe legumes", "minestrone"], "soupe-legumes"],
  [["veloute de legumes", "veloute de potiron", "veloute de champignons", "veloute de carottes", "veloute de courgettes", "veloute maison", "creme de legumes", "soupe de potiron", "soupe de courge"], "veloute"],
  [["salade de pates"], "salade-pates"],
  [["legumes rotis", "legumes roti", "legumes au four", "roasted vegetables"], "legumes-rotis"],
  [["couscous royal", "couscous merguez", "couscous poulet", "couscous complet"], "couscous-royal"],
  [["osso buco", "ossobuco", "osso bucco", "jarret de veau"], "osso-buco"],
  [["roti de porc", "roti de porc aux legumes", "roti de porc au four", "filet de porc roti"], "roti-porc"],
  [["boeuf stroganoff", "beef stroganoff", "stroganoff"], "stroganoff"],
  [["saucisses aux lentilles", "saucisses lentilles", "saucisse lentilles", "petit sale aux lentilles"], "saucisses-lentilles"],
  [["poulet au curry", "poulet curry", "curry de poulet", "chicken curry", "butter chicken", "poulet tikka"], "poulet-curry-riz"],
  [["poisson en papillote", "papillote de poisson", "papillote", "saumon en papillote", "cabillaud en papillote"], "poisson-papillote"],
  [["saumon grille", "saumon poele", "saumon et legumes"], "saumon-grille"],
  [["gambas a l ail", "gambas ail", "crevettes a l ail", "crevettes ail"], "gambas-ail"],
  [["fish and chips", "fish n chips", "fish chips"], "fish-and-chips"],
  [["cabillaud sauce", "cabillaud a la creme", "cabillaud beurre blanc", "poisson sauce blanche"], "cabillaud-sauce"],
  [["bar au four", "bar entier", "dorade au four", "dorade entiere", "daurade", "poisson entier", "poisson au four", "loup de mer au four", "truite au four"], "bar-four"],
  [["soupe en brique", "soupe brique", "brique de soupe", "briques de soupe", "veloute en brique", "veloute brique"], "soupe-brique"],
  [["soupe en conserve", "soupe en boite", "soupe boite", "soupe conserve", "conserve de soupe", "boite de soupe"], "soupe-conserve"],
  [["parmesan rape", "parmesan en poudre", "parmigiano rape", "grana padano rape", "parmesan rap\xE9"], "parmesan-rape"],
  [["pain pita", "pain pitta", "pains pita", "pains pitta", "pita", "pitta"], "pain-pitta"],
  [["naan", "naans", "pain naan", "garlic naan", "pain indien"], "pain-naan"],
  [["pain burger", "pains burger", "pain hamburger", "pains hamburger", "pain a burger", "pains a burger", "bun", "buns", "burger buns"], "pain-burger"],
  [["pain hot dog", "pains hot dog", "pain hotdog", "pains hotdog", "pain a hot dog", "pains a hot dog", "pain pour hot dog", "pains pour hot dog", "pain pour hot dogs"], "pain-hotdog"],
  [["fraises surgelees", "fraise surgelee", "fraises congelees", "fraise congelee", "sachet de fraises"], "fraises-surgelees"],
  [["fruits rouges surgeles", "fruit rouge surgele", "fruits rouges congeles", "fruits rouges", "fruits des bois", "fruits surgeles", "fruit surgele", "fruits congeles", "fruit congele", "sachet de fruits", "framboises surgelees", "framboises congelees", "myrtilles surgelees", "melange de fruits rouges"], "fruits-rouges-surgeles"],
  [["glace vanille", "glace a la vanille", "pot de glace", "pots de glace", "creme glacee vanille", "glace vanille bac"], "glace-vanille"],
  [["fricadelle", "fricadelles", "frikadelle", "fricadel"], "fricadelle"],
  [["curly fries", "curly"], "frites-surgelees"],
  [["fruit des bois", "fruit rouge", "fruits rouges"], "fruits-rouges-surgeles"],
  [["padano", "grand padano", "padano dop"], "parmesan-rape"],
  [["latte macchiato", "macchiato"], "cafe-froid"],
  [["mozarella", "mozzarela"], "mozzarella"],
  [["cereal", "cereals", "multigrain cereal"], "cereales"],
  [["orzo", "risoni"], "pates"],
  [["panache", "panaches"], "biere"],
  [["pick up", "pickup"], "biscuit-chocolat"],
  [["popz"], "pop-corn"],
  [["ringlings", "ring lings"], "chips"],
  [["tonno", "tonijn", "tonijnfilets", "thunfisch"], "thon"],
  [["salsina", "salsa", "pomodoro"], "sauce-tomate"],
  [["stokbroodje", "stokbroodjes", "stokbrood", "witte stokbroodjes"], "baguette"],
  [["bruschetta", "bruschetta spread"], "olive"],
  [["poivre noir", "poivre moulu", "poivre en grains", "grains de poivre", "poivre blanc", "moulin a poivre", "poivre du moulin", "poivre mignonnette", "poivre sauvage"], "poivre-noir-pot"],
  [["5 baies", "cinq baies", "poivre 5 baies", "melange 5 baies"], "cinq-baies-pot"],
  [["paprika fume", "paprika fumee", "pimenton fume"], "paprika-fume-pot"],
  [["paprika", "paprika doux", "paprika moulu", "pimenton"], "paprika-pot"],
  [["cumin", "cumin moulu", "cumin en grains", "graines de cumin"], "cumin-pot"],
  [["curcuma", "turmeric"], "curcuma-pot"],
  [["cannelle", "cannelle moulue", "baton de cannelle", "batons de cannelle"], "cannelle-pot"],
  [["muscade", "noix de muscade"], "muscade-pot"],
  [["piment en poudre", "piment moulu", "piment d espelette", "piment espelette", "espelette", "cayenne", "piment de cayenne", "poivre de cayenne"], "piment-poudre-pot"],
  [["curry en poudre", "poudre de curry", "curry madras", "curry doux", "curry fort", "curry moulu"], "curry-pot"],
  [["gingembre moulu", "gingembre en poudre", "poudre de gingembre"], "gingembre-moulu-pot"],
  [["ail en poudre", "ail semoule", "ail granule", "ail granules", "ail deshydrate", "poudre d ail"], "ail-poudre-pot"],
  [["oignon en poudre", "oignon deshydrate", "oignons deshydrates", "oignon granule", "poudre d oignon"], "oignon-poudre-pot"],
  [["herbes de provence"], "herbes-provence-pot"],
  [["thym", "thym seche", "thym sechee"], "thym-pot"],
  [["origan", "oregan", "oregano", "origan seche"], "origan-pot"],
  [["basilic seche", "basilic sechee", "basilic deshydrate"], "basilic-pot"],
  [["persil seche", "persil sechee", "persil deshydrate"], "persil-pot"],
  [["ciboulette sechee", "ciboulette seche", "ciboulette deshydratee"], "ciboulette-pot"],
  [["laurier", "feuille de laurier", "feuilles de laurier"], "laurier-pot"],
  [["romarin", "romarin seche"], "romarin-pot"],
  [["coriandre moulue", "coriandre sechee", "coriandre seche", "graines de coriandre"], "coriandre-pot"],
  [["estragon", "estragon seche"], "estragon-pot"],
  [["sauge", "sauge sechee"], "sauge-pot"],
  [["aneth", "aneth seche"], "aneth-pot"],
  [["menthe", "menthe sechee", "menthe seche"], "menthe-pot"],
  [["cardamome", "cardamome verte"], "cardamome-pot"],
  [["clou de girofle", "clous de girofle", "girofle", "girofles"], "girofle-pot"],
  [["safran", "filaments de safran"], "safran-pot"],
  [["garam masala"], "garam-masala-pot"],
  [["ras el hanout", "ras el-hanout"], "ras-el-hanout-pot"],
  [["graines de fenouil", "fenouil graines", "fenouil en graines"], "fenouil-pot"],
  [["graines de moutarde", "moutarde en graines"], "moutarde-grains-pot"],
  [["graines de sesame", "sesame grille", "sesame blanc"], "sesame-pot"],
  [["old bay", "cajun", "slap ya mama", "epices barbecue", "mix barbecue", "bbq rub", "rub barbecue", "assaisonnement barbecue", "assaisonnement cajun"], "barbecue-pot"],
  [["sel fin", "sel de table"], "sel-pot"],
  [["seasoning", "old bay", "slap ya mama", "assaisonnement", "cajun"], "epices"],
  [["estragon"], "coriandre"],
  [["frites surgelees", "frite surgelee", "frites congelees", "sachet de frites", "frites au four", "frites four"], "frites-surgelees"],
  [["gaufre de pomme de terre", "gaufres de pomme de terre", "gaufres de pommes de terre", "gaufre pomme de terre", "gaufres pomme de terre", "gaufres pommes de terre", "gaufre de patate", "gaufres de patate", "pomme de terre gaufre", "pommes de terre gaufres"], "gaufres-pdt"],
  [["puree surgelee", "puree congelee", "puree en barquette", "galets de puree", "boulettes de puree", "palets de puree"], "puree-surgelee"],
  [["croquette de pomme de terre", "croquette de pommes de terre", "croquette pomme de terre", "croquette pommes de terre", "croquette pdt", "croquettes surgelees", "croquette surgelee", "croquettes de patate"], "croquettes-pdt"],
  [["pomme dauphine", "pommes dauphines", "dauphine", "dauphines"], "pommes-dauphines"],
  [["rosti", "roesti", "galette de rosti"], "rosti"],
  [["noisette de pomme de terre", "noisettes de pomme de terre", "noisettes de pommes de terre", "pomme noisette", "pommes noisette", "pommes noisettes"], "noisettes-pdt"],
  [["pomme duchesse", "pommes duchesse", "duchesse de pomme de terre"], "pommes-duchesse"],
  [["quartier de pomme de terre", "quartiers de pomme de terre", "quartiers de pommes de terre", "quartiers de patate", "pommes quartiers", "pomme quartier", "potatoes", "potato wedges", "wedges", "pommes wedges", "pomme wedges"], "quartiers-pdt"],
  [["grenaille", "grenailles", "pomme de terre grenaille", "pommes de terre grenailles", "pommes grenailles", "pomme grenaille"], "grenailles"],
  [["puree de pomme de terre", "puree de pommes de terre", "puree de patate", "puree maison", "mousline", "flocons de puree", "puree en flocons"], "puree"],
  [["hash brown", "hash browns", "hashbrown", "hashbrowns", "galette de pomme de terre", "galettes de pomme de terre", "galettes de pommes de terre", "galette pomme de terre", "galette de patate"], "hash-brown"],
  [["liquide vaisselle", "produit vaisselle", "lave vaisselle", "tablettes lave vaisselle", "pastilles lave vaisselle"], "liquide-vaisselle"],
  [["lessive", "lessives", "adoucissant", "detachant", "capsules lessive"], "lessive"],
  [["javel", "eau de javel", "desinfectant", "destop", "deboucheur"], "javel"],
  [["nettoyant", "nettoyant multi usage", "multi usage", "multi surfaces", "nettoyant vitres", "produit vitres", "mr propre", "degraissant", "detartrant", "antical", "desodorisant", "produit menager"], "nettoyant-multi-usage"],
  [["eponge", "eponges", "grattoir", "tampon a recurer"], "eponge"],
  [["sac poubelle", "sacs poubelle", "sac a dechets", "sacs a dechets"], "sacs-poubelle"],
  [["papier toilette", "papier wc", "papier hygienique"], "papier-toilette"],
  [["essuie tout", "sopalin", "papier absorbant", "rouleaux de cuisine"], "essuie-tout"],
  [["film alimentaire", "film etirable", "film plastique", "scellofrais"], "film-alimentaire"],
  [["papier alu", "papier aluminium", "feuille alu", "rouleau alu"], "papier-alu"],
  [["papier cuisson", "papier sulfurise", "papier four"], "papier-cuisson"],
  [["mouchoir", "mouchoirs", "kleenex", "boite de mouchoirs"], "mouchoirs"],
  [["savon", "savons"], "savon"],
  [["gel douche", "gels douche", "creme de douche", "bain moussant", "lait corporel"], "gel-douche"],
  [["shampoing", "shampooing", "apres shampoing", "savon liquide", "savon main", "savon mains", "lotion"], "shampoing"],
  [["dentifrice", "brosse a dents", "brosse dents", "bain de bouche", "fil dentaire"], "dentifrice"],
  [["deodorant", "deodorants", "anti transpirant", "antitranspirant"], "deodorant"],
  [["coton", "cotons", "disques demaquillants", "demaquillant", "coton tige", "cotons tiges"], "coton"],
  [["couche", "couches", "couche culotte", "couches culottes", "change bebe"], "couches"],
  [["croquettes chien", "croquette chien", "croquettes pour chien", "nourriture chien", "pate chien", "friandises chien", "os a macher"], "croquettes-chien"],
  [["croquettes chat", "croquette chat", "croquettes pour chat", "nourriture chat", "pate chat", "friandises chat", "sachets chat"], "croquettes-chat"],
  [["croquette", "croquettes"], "croquettes-pdt"],
  [["litiere", "litieres"], "litiere"],
  [["pile", "piles", "pile aa", "piles aa", "piles aaa", "pile bouton"], "piles"],
  [["ampoule", "ampoules"], "ampoule"],
  [["cracottes au chocolat", "cracotte au chocolat", "cracottes chocolat", "cracotte chocolat", "cracotte", "cracottes", "craquottes"], "cracottes-chocolat"],
  [["biscotte", "biscottes"], "biscottes"],
  [["pate feuilletee", "pates feuilletees", "feuilletee", "feuilletees"], "pate-feuilletee"],
  [["pate brisee", "pates brisees", "pate sablee", "pates sablees", "pate a tarte", "pates a tarte"], "pate-brisee"],
  [["beurre en barquette", "beurre barquette", "beurre tendre", "beurre tartinable", "beurre doux tendre", "margarine"], "beurre-barquette"],
  [["cassoulet en conserve", "cassoulet en boite", "cassoulet boite", "boite de cassoulet", "conserve de cassoulet", "cassoulet conserve"], "cassoulet-conserve"],
  [["petit suisse", "petits suisses", "dessert lacte", "desserts lactes", "creme dessert", "danette", "danonino"], "dessert-lacte"],
  [["flan", "flans", "flan patissier", "flan nature"], "flan"],
  [["chapelure", "panure", "pain rape"], "chapelure"],
  [["herbes de provence", "herbes aromatiques", "herbes sechees", "herbes seches"], "herbes-provence"],
  [["anchois", "filets d anchois", "filet d anchois"], "anchois"],
  [["chorizo", "chorizos"], "chorizo"],
  [["terrine", "pate de campagne", "foie gras", "rillettes", "pate de foie", "mousse de canard", "bloc de foie gras"], "terrine"],
  [["chantilly", "creme chantilly", "bombe chantilly", "creme en bombe"], "chantilly"],
  [["cidre", "cidres", "cidre brut", "cidre doux"], "cidre"],
  [["guacamole", "guacamoles"], "guacamole"],
  [["coriandre", "menthe", "aneth", "cerfeuil", "herbes fraiches"], "coriandre"],
  [["tortilla", "tortillas"], "tortillas"],
  [["filet de poulet marine", "filets de poulet marines", "filet poulet marine", "filets poulet marines", "poulet marine", "poulets marines", "blanc de poulet marine", "blancs de poulet marines"], "filet-poulet-marine"],
  [["emince tex mex", "eminces tex mex", "emince de poulet tex mex", "eminces de poulet tex mex", "poulet tex mex", "tex mex", "texmex"], "emince-tex-mex"],
  [["boulettes vegetales", "boulette vegetale", "boulettes vegetariennes", "boulette vegetarienne", "boulettes vegan", "boulettes veggie", "boulettes vege", "falafel", "falafels"], "boulettes-vegetales"],
  [["emince de poulet", "eminces de poulet", "emince poulet", "eminces poulet", "emince de volaille", "eminces de volaille", "aiguillettes de poulet", "aiguillette de poulet"], "emince-poulet"],
  [["ministars", "mini stars", "ministar", "biscuit etoile", "biscuits etoiles", "etoiles chocolat"], "biscuit-etoile"],
  [["dinosaurus", "dinosaure", "dinosaures", "biscuit dinosaure"], "biscuit-dinosaure"],
  [["biscuit animaux", "biscuits animaux", "animaux biscuit"], "biscuit-animaux"],
  [["prince", "prince chocolat", "mini biscuit chocolat", "mini biscuits chocolat", "pims", "pim s", "chocolat au lait biscuit"], "biscuit-mini-chocolat"],
  [["speculoos", "biscuit caramelise", "biscoff"], "speculoos"],
  [["petit beurre", "petits beurre", "petit-beurre", "biscuit sec", "biscuits secs"], "petit-beurre"],
  [["cookie", "cookies"], "cookie"],
  [["pepites de chocolat", "pepite de chocolat", "pepites chocolat", "pepites", "chocolate chips", "chocolate chip", "chocolat chips", "choc chips", "drops chocolat", "chunks", "gouttes de chocolat", "perles de chocolat"], "pepites-chocolat"],
  [["oreo", "biscuit fourre", "biscuits fourres", "biscuit creme", "sandwich cookie"], "biscuit-fourre"],
  [["palet breton", "palets bretons", "galette bretonne"], "palet-breton"],
  [["confiture sable", "sable confiture", "sable fourre", "biscuit confiture", "linzer"], "sable-confiture"],
  [["sable", "sables", "shortbread"], "sable"],
  [["madeleine", "madeleines"], "madeleine"],
  [["gaufrette", "gaufrettes", "wafer"], "gaufrette"],
  [["biscuit chocolat", "biscuits chocolat", "barre chocolatee", "kitkat", "kit kat", "twix", "bounty", "snickers"], "biscuit-chocolat"],
  [["macaron", "macarons"], "macaron"],
  [["cigarette russe", "cigarettes russes", "cigarette", "tuile", "tuiles", "langue de chat", "langues de chat"], "cigarettes-russes"],
  [["gaufre", "gaufres", "gaufre de liege"], "gaufre-liege"],
  [["pain d epices", "pain depices", "speculaas"], "pain-epices"],
  [["financier", "financiers"], "financier"],
  [["canele", "caneles", "cannele", "canneles"], "caneles"],
  [["brownie", "brownies"], "brownie"],
  [["muffin", "muffins", "cupcake"], "muffin"],
  [["barre de cereales", "barres de cereales", "barre cereales", "barre muesli", "barre proteinee"], "barre-cereales"],
  [["boite metal", "boite de biscuits metal", "biscuits danois", "danish cookies", "butter cookies"], "boite-biscuits-metal"],
  [["sachets de biscuits", "biscuits sachets", "sachet de biscuits", "boite de sachets", "boite sachets", "biscuits en sachets"], "boite-sachets"],
  [["sachet biscuit", "biscuit individuel", "biscuits individuels"], "sachet-biscuit"],
  [["assortiment", "assortiment de biscuits", "biscuits assortis", "mixed biscuits"], "assortiment-biscuits"],
  [["boite biscuits", "boite de biscuits", "coffret biscuits"], "boite-biscuits-carton"],
  [["cracker sesame", "crackers sesame", "ritz", "tuc", "biscuit aperitif", "biscuits aperitif"], "cracker-sesame"],
  [["pates pesto", "pates au pesto"], "pates-pesto"],
  // Viandes précises
  [["blanc de poulet", "blancs de poulet", "filet de poulet", "filets de poulet", "poitrine de poulet"], "blanc-poulet"],
  [["cuisse de poulet", "cuisses de poulet", "pilon", "pilons", "hauts de cuisse"], "cuisse-poulet"],
  [["poulet entier", "poulet fermier", "chapon", "dinde entiere"], "poulet-entier"],
  [["escalope de dinde", "escalopes de dinde", "escalope de poulet", "escalopes de poulet", "escalope de veau", "escalope"], "escalope-dinde"],
  [["escalope panee", "escalopes panees", "poulet pane", "schnitzel"], "escalope-panee"],
  [["cordon bleu", "cordons bleus"], "cordon-bleu"],
  [["jurassienne", "jurasienne", "jurassiennes"], "jurassienne"],
  [["roulade ardennaise", "roulades ardennaises", "roulade", "roulades"], "roulade-ardennaise"],
  [["chipolata", "chipolatas", "saucisses chipolata", "saucisse chipolata"], "chipolata"],
  [["merguez"], "merguez"],
  [["saucisse de toulouse", "saucisses de toulouse", "saucisse toulouse", "saucisse a rouler"], "saucisse-toulouse"],
  [["boudin blanc", "boudins blancs"], "boudin-blanc"],
  [["steak hache", "steaks haches", "hamburger", "hamburgers", "burger boeuf"], "steak-hache"],
  [["viande hachee", "hache", "boeuf hache", "porc hache", "hach\xE9 pur boeuf"], "viande-hachee"],
  [["brochette", "brochettes"], "brochette"],
  [["cote de porc", "cotes de porc", "cotelette de porc", "cotelettes de porc", "carre de porc", "cote de veau"], "cote-porc"],
  [["cote de boeuf", "cotes de boeuf", "entrecote", "entrecotes", "cote a l os"], "cote-boeuf"],
  [["roti de boeuf", "roti de porc", "roti de veau", "rosbif", "rumsteck", "bavette", "onglet"], "roti-boeuf"],
  [["filet mignon", "filets mignons", "medaillon", "medaillons", "tournedos"], "filet-mignon"],
  [["gigot", "gigot d agneau", "epaule d agneau", "souris d agneau"], "gigot-agneau"],
  [["cotelette d agneau", "cotelettes d agneau", "cotelettes agneau", "carre d agneau"], "cotelettes-agneau"],
  [["paupiette", "paupiettes"], "paupiette"],
  [["poitrine de porc", "poitrine fraiche", "lard", "poitrine salee"], "poitrine-porc"],
  [["magret", "magrets", "canard", "cuisse de canard", "confit de canard"], "magret-canard"],
  [["viande a bourguignon", "blanquette", "saut\xE9 de boeuf", "saute de boeuf", "saute de veau", "viande a ragout", "cubes de boeuf", "osso buco"], "viande-cubes"],
  // Boissons précises
  [["bombonne", "bonbonne", "fontaine a eau", "eau 8l", "eau 8 l", "eau 10l", "eau 19l"], "bombonne-eau"],
  [["cafe froid", "cafe glace", "iced coffee", "cafe frappe", "latte glace"], "cafe-froid"],
  [["eau petillante", "eau gazeuse", "eau p\xE9tillante", "badoit", "perrier", "san pellegrino"], "eau-petillante"],
  [["lait brique", "brique de lait", "lait uht", "lait demi ecreme", "lait ecreme", "lait entier"], "lait-brique"],
  [["coca zero", "cola zero", "pepsi max", "soda zero", "coca cola zero", "coca sans sucre"], "soda-zero"],
  [["cola canette", "coca canette", "canette de cola", "canette de coca"], "cola"],
  [["coca", "coca cola", "cola", "pepsi"], "cola-bouteille"],
  [["soda orange", "orangina", "fanta"], "soda-orange"],
  [["the glace", "ice tea", "icetea", "lipton"], "the-glace"],
  [["tonic", "schweppes", "ginger ale", "ginger beer"], "tonic"],
  [["energisante", "red bull", "redbull", "monster"], "energisante"],
  [["pack d eau", "pack eau", "pack de bouteilles d eau", "eau 6x"], "pack-eau"],
  [["eau aromatisee", "eau citron", "eau a la menthe"], "eau-aromatisee"],
  [["grande bouteille d eau", "eau 1 5l", "eau 1 5 l"], "eau-grande"],
  [["jus d orange", "jus orange"], "jus-orange"],
  [["jus de pomme", "jus pomme"], "jus-pomme"],
  [["jus multifruits", "jus multifruit", "multifruits", "multifruit", "jus de fruits"], "jus-multifruits"],
  [["jus de raisin", "jus raisin"], "jus-raisin"],
  [["jus de tomate", "jus tomate"], "jus-tomate"],
  [["jus d ananas", "jus ananas"], "jus-ananas"],
  [["smoothie", "smoothies"], "smoothie"],
  [["milkshake", "milk shake"], "milkshake"],
  [["lait chocolate", "lait au chocolat", "chocolat au lait boisson", "cacolac", "candia choco"], "lait-chocolate"],
  [["chocolat chaud", "cacao", "nesquik", "ovomaltine", "poudre chocolatee"], "chocolat-chaud"],
  [["cafe moulu", "cafe moulue", "cafe en poudre"], "cafe-moulu"],
  [["cafe en grains", "cafe grains", "grains de cafe"], "cafe-grains"],
  [["capsule", "capsules", "dosette", "dosettes", "nespresso", "senseo"], "capsules-cafe"],
  [["tisane", "tisanes", "infusion", "infusions", "verveine", "camomille"], "tisane"],
  // Condiments et sauces
  [["mayonnaise tube", "tube de mayonnaise"], "mayonnaise"],
  [["mayonnaise", "mayo"], "mayonnaise-pot"],
  [["sauce cocktail", "cocktail sauce"], "sauce-cocktail"],
  [["sauce barbecue", "barbecue", "bbq"], "sauce-barbecue"],
  [["sauce samourai", "samourai"], "sauce-samourai"],
  [["sauce andalouse", "andalouse"], "sauce-andalouse"],
  [["sauce algerienne", "algerienne"], "sauce-algerienne"],
  [["sauce curry"], "sauce-curry"],
  [["sauce tartare", "tartare"], "sauce-tartare"],
  [["sauce blanche", "sauce a l ail", "sauce ail"], "sauce-blanche"],
  [["sauce burger"], "sauce-burger"],
  [["sauce piquante", "tabasco"], "sauce-piquante"],
  [["sriracha"], "sriracha"],
  [["sauce soja", "kikkoman"], "sauce-soja"],
  [["worcestershire", "worcester"], "worcestershire"],
  [["sauce tomate", "coulis", "passata", "sauce napolitaine"], "sauce-tomate"],
  [["pesto"], "pesto"],
  [["vinaigrette", "sauce salade"], "vinaigrette"],
  [["moutarde a l ancienne", "moutarde ancienne", "moutarde en grains", "moutarde grains"], "moutarde-ancienne"],
  [["cornichon", "cornichons"], "cornichons"],
  [["capre", "capres"], "capres"],
  [["tapenade"], "tapenade"],
  [["harissa"], "harissa"],
  [["concentre de tomate", "concentre tomate", "double concentre"], "concentre-tomate"],
  [["bouillon cube", "bouillon cubes", "cube de bouillon", "cubes de bouillon", "knorr", "maggi"], "bouillon-cube"],
  [["tzatziki"], "tzatziki"],
  // Plats
  [["feuilles de lasagne", "feuille de lasagne", "plaques de lasagne", "plaque de lasagne", "pates a lasagne"], "lasagne-feuilles"],
  [["lasagne legumes", "lasagnes legumes", "lasagnes aux legumes", "lasagne aux legumes"], "lasagnes-legumes"],
  [["burger vegetarien", "burger veggie", "burger vegetal", "burger vegan"], "burger-vegetarien"],
  [["pates pesto", "pates au pesto"], "pates-pesto"],
  [["pates saumon", "pates au saumon"], "pates-saumon"],
  [["gnocchi sauce tomate", "gnocchis sauce tomate", "gnocchi tomate"], "gnocchi-tomate"],
  [["curry de legumes", "curry legumes", "curry vegetarien"], "curry-legumes"],
  [["wrap falafel"], "wrap-falafel"],
  [["steak frites"], "steak-frites"],
  [["moules frites"], "moules-frites"],
  [["saucisse puree", "saucisses puree"], "saucisse-puree"],
  [["boeuf bourguignon", "bourguignon"], "boeuf-bourguignon"],
  [["blanquette"], "blanquette"],
  [["pot au feu"], "pot-au-feu"],
  [["hachis parmentier", "parmentier"], "hachis-parmentier"],
  [["tartiflette"], "tartiflette"],
  [["cassoulet"], "cassoulet"],
  [["gratin dauphinois", "dauphinois"], "gratin-dauphinois"],
  [["choucroute"], "choucroute"],
  [["welsh"], "welsh"],
  [["poule au pot"], "poule-au-pot"],
  [["endives au jambon", "endive au jambon"], "endives-jambon"],
  [["quenelle", "quenelles"], "quenelles"],
  [["pate en croute"], "pate-en-croute"],
  [["crepe jambon fromage", "crepe jambon"], "crepe-jambon-fromage"],
  [["galette bretonne", "galette complete", "galette sarrasin"], "galette-bretonne"],
  [["flammekueche", "flammekuche", "tarte flambee"], "flammekueche"],
  [["brandade"], "brandade"],
  [["poulet basquaise", "basquaise"], "poulet-basquaise"],
  [["soupe a l oignon", "soupe oignon"], "soupe-oignon"],
  [["salade de chevre", "salade chevre chaud", "chevre chaud"], "salade-chevre-chaud"],
  [["tomate farcie", "tomates farcies"], "tomates-farcies"],
  [["pad thai"], "pad-thai"],
  [["ramen"], "ramen"],
  [["paella"], "paella"],
  [["nem", "nems"], "nems"],
  [["bo bun", "bobun"], "bo-bun"],
  [["poke bowl", "poke"], "poke-bowl"],
  [["buddha bowl"], "buddha-bowl"],
  [["shakshuka", "chakchouka"], "shakshuka"],
  [["dal", "dahl", "daal"], "dal"],
  [["chili con carne", "chili"], "chili-con-carne"],
  [["tajine"], "tajine"],
  [["taboule", "tabouleh"], "taboule"],
  [["gyoza", "gyozas"], "gyoza"],
  [["pho"], "pho"],
  [["bibimbap"], "bibimbap"],
  [["enchiladas", "enchilada"], "enchiladas"],
  [["nachos"], "nachos"],
  [["quesadilla", "quesadillas"], "quesadilla"],
  [["nuggets vegetaux", "nuggets vegetariens", "nuggets vegetal", "nuggets vegan"], "nuggets-vegetaux"],
  [["saucisse vegetale", "saucisses vegetales", "saucisse vegetarienne", "saucisse vegan"], "saucisse-vegetale"],
  [["steak vegetal", "steak de soja", "steak vegetarien", "steak vegan", "galette de soja"], "steak-vegetal"],
  [["galette de legumes", "galettes de legumes", "galette legumes", "galette veggie"], "galette-legumes"],
  [["tofu"], "tofu"],
  [["tempeh"], "tempeh"],
  [["seitan"], "seitan"],
  [["falafel", "falafels"], "falafel"],
  [["houmous", "hummus"], "houmous"],
  [["proteines de soja", "proteine de soja", "soja texture", "pvt"], "proteines-soja"],
  [["edamame", "edamames"], "edamame"],
  [["carbonara"], "carbonara"],
  [["bolognaise", "bolo"], "bolognaise"],
  [["lasagne", "lasagnes"], "lasagnes"],
  [["pizza"], "pizza"],
  [["burger", "hamburger", "cheeseburger"], "burger"],
  [["croque madame"], "croque-madame"],
  [["croque monsieur"], "croque-monsieur"],
  [["hot dog", "hotdog"], "hot-dog"],
  [["sandwich", "panini"], "sandwich"],
  [["wrap"], "wrap"],
  [["tacos", "taco", "fajita"], "tacos"],
  [["kebab", "doner", "gyros"], "kebab"],
  [["sushi", "maki"], "sushi"],
  [["quiche"], "quiche"],
  [["tarte", "tourte"], "tarte"],
  [["soupe", "potage", "veloute", "bouillon"], "soupe"],
  [["salade composee", "salade mixte", "salade repas"], "salade-composee"],
  [["gratin"], "gratin"],
  [["omelette"], "omelette"],
  [["risotto"], "risotto"],
  [["curry"], "curry"],
  [["poulet roti", "poulet rotie"], "poulet-roti"],
  [["frite", "frites"], "frites"],
  [["nuggets", "nugget"], "nuggets"],
  [["raclette"], "raclette"],
  [["fondue"], "fondue"],
  [["ratatouille"], "ratatouille"],
  [["couscous"], "couscous"],
  [["boulette", "boulettes", "kefta"], "boulettes"],
  [["pancake", "pancakes"], "pancakes"],
  [["crepe", "crepes"], "crepes"],
  // Surgelés
  [["poisson pane", "poissons panes", "fish sticks"], "poisson-pane"],
  [["legumes surgeles", "legume surgele", "poelee"], "legumes-surgeles"],
  [["glace en bac", "glace bac", "creme glacee bac"], "glace-bac"],
  // Boissons
  [["lait d avoine", "lait avoine", "boisson avoine", "boisson a l avoine"], "lait-avoine"],
  [["lait de soja", "lait soja", "boisson soja", "boisson au soja"], "lait-soja"],
  [["lait d amande", "lait amande", "boisson amande", "boisson a l amande"], "lait-amande"],
  [["lait vegetal", "lait de coco", "lait de riz", "lait de noisette", "boisson vegetale"], "lait-vegetal"],
  [["eau gazeuse", "perrier", "badoit", "san pellegrino", "saint yorre"], "eau-gazeuse"],
  [["eau", "evian", "volvic", "vittel", "cristaline"], "eau"],
  [["jus", "smoothie"], "jus"],
  [["sirop", "grenadine"], "sirop"],
  [["soda", "cola", "limonade", "orangina", "fanta", "sprite", "ice tea"], "soda"],
  [["biere", "bieres"], "biere"],
  [["champagne", "cremant", "prosecco"], "champagne"],
  [["vin", "vins", "rose", "ros\xE9"], "vin"],
  [["whisky", "rhum", "vodka", "gin", "cognac", "pastis", "tequila", "digestif"], "whisky"],
  [["cafe", "espresso"], "cafe"],
  [["the"], "the"],
  // Laitiers et oeufs
  [["yaourt vegetal", "yaourt soja", "yaourt coco", "yaourt amande", "dessert vegetal", "yaourt vegan"], "yaourt-vegetal"],
  [["yaourt", "yaourts", "yogourt", "skyr", "fromage blanc", "danette"], "yaourt"],
  [["lait"], "lait"],
  [["creme vegetale", "creme de soja", "creme d avoine", "creme de coco", "creme de riz"], "creme-vegetale"],
  [["creme", "creme fraiche"], "creme"],
  [["beurre de cacahuete", "beurre cacahuete", "peanut butter", "puree de cacahuete"], "beurre-cacahuete"],
  [["beurre", "margarine"], "beurre"],
  [["oeuf", "oeufs"], "oeuf"],
  [["fromage vegetal", "fromage vegan", "fromage vegetalien"], "fromage-vegetal"],
  [["mozzarella", "burrata"], "mozzarella"],
  [["fromage", "comte", "emmental", "chevre", "camembert", "brie", "parmesan", "gruyere", "feta", "cheddar", "roquefort", "boursin", "maroilles"], "fromage"],
  // Viandes et poissons
  [["saucisson"], "saucisson"],
  [["poulet", "dinde", "volaille", "canard", "cuisse", "cuisses", "pilon", "pilons"], "poulet"],
  [["steak", "boeuf", "viande", "hache", "porc", "veau", "cote", "escalope", "rosbif"], "steak"],
  [["jambon", "agneau", "roti", "charcuterie", "rillettes"], "jambon"],
  [["lardon", "lardons", "bacon"], "lardons"],
  [["saucisse", "saucisses", "merguez", "chipolata", "knacki"], "saucisse"],
  [["crevette", "crevettes", "gambas", "homard", "langoustine", "crabe"], "crevettes"],
  [["moule", "moules", "huitre", "huitres", "coquillage", "coquillages"], "moules"],
  [["saumon"], "saumon"],
  [["thon"], "thon"],
  [["poisson", "cabillaud", "colin", "sardine", "sardines", "truite", "maquereau", "dorade", "merlu", "surimi"], "poisson"],
  // Féculents et épicerie
  [["farfalle", "farfalles"], "farfalle"],
  [["fusilli", "torsade", "torsades", "spirale", "spirales"], "fusilli"],
  [["capellini", "cheveux d ange"], "capellini"],
  [["penne"], "penne"],
  [["spaghetti", "spaghettis"], "spaghetti"],
  [["tagliatelle", "tagliatelles", "tagliolini", "fettuccine"], "tagliatelles"],
  [["macaroni", "macaronis"], "macaroni"],
  [["coquillette", "coquillettes"], "coquillettes"],
  [["ravioli", "raviolis"], "ravioli"],
  [["gnocchi", "gnocchis"], "gnocchi"],
  [["rigatoni"], "rigatoni"],
  [["linguine", "linguines"], "linguine"],
  [["orecchiette", "orecchiettes"], "orecchiette"],
  [["vermicelle de riz", "vermicelles de riz", "nouilles de riz", "nouille de riz"], "nouilles-riz"],
  [["vermicelle", "vermicelles"], "vermicelles"],
  [["conchiglie", "conchiglioni", "coquillage pates"], "conchiglie"],
  [["tortellini", "tortellinis"], "tortellini"],
  [["pates a soupe", "pates etoiles", "etoiles", "alphabet", "lettres"], "pates-etoiles"],
  [["soba"], "soba"],
  [["udon"], "udon"],
  [["nouille", "nouilles", "noodles", "ramen nouilles"], "nouilles"],
  [["pates", "pasta"], "pates"],
  [["semoule"], "semoule"],
  [["quinoa"], "quinoa"],
  [["polenta"], "polenta"],
  [["riz", "basmati", "boulgour", "ble"], "riz"],
  [["cereales", "muesli", "granola", "flocons", "avoine"], "cereales"],
  [["levure nutritionnelle", "levure maltee"], "levure-nutritionnelle"],
  [["farine", "maizena", "levure"], "farine"],
  [["pain de mie", "brioche", "biscotte", "biscottes", "toast", "toasts"], "pain-de-mie"],
  [["baguette"], "baguette"],
  [["croissant", "croissants", "pain au chocolat", "viennoiserie"], "croissant"],
  [["pain"], "pain"],
  [["patate douce", "patates douces"], "patate-douce"],
  [["pomme de terre", "pommes de terre", "patate", "patates"], "pomme-de-terre"],
  [["chips"], "chips"],
  [["tahini", "tahin", "puree de sesame"], "tahini"],
  [["puree"], "puree"],
  [["noix de cajou", "cajou", "cajous"], "noix-cajou"],
  [["graine", "graines", "chia", "sesame", "lin", "tournesol"], "graines"],
  [["pistache", "pistaches", "pistachio", "pistachios"], "pistaches"],
  [["cacahuete", "cacahuetes", "noix", "amande", "amandes", "noisette", "noisettes", "cajou"], "cacahuetes"],
  [["cracker", "crackers", "bretzel", "bretzels"], "crackers"],
  [["pop corn", "popcorn"], "pop-corn"],
  [["compote"], "compote"],
  [["gateau", "gateaux", "cake", "fondant", "brownie", "muffin"], "gateau"],
  [["donut", "beignet"], "donut"],
  [["biscuit", "biscuits", "cookie", "cookies", "sable", "speculoos"], "biscuits"],
  [["pate a tartiner", "nutella"], "pate-a-tartiner"],
  [["chocolat", "chocolats"], "chocolat"],
  [["bonbon", "bonbons", "sucette", "guimauve", "haribo"], "bonbons"],
  [["creme glacee", "glace", "sorbet"], "glace"],
  [["confiture"], "confiture"],
  [["miel"], "miel"],
  [["sucre", "sucres"], "sucre"],
  [["sel", "poivre"], "sel"],
  [["huile", "huile d olive"], "huile"],
  [["vinaigre"], "vinaigre"],
  [["ketchup"], "ketchup"],
  [["moutarde"], "moutarde"],
  [["mayonnaise"], "mayonnaise"],
  [["epice", "epices", "paprika", "cumin", "cannelle"], "epices"],
  [["lentille", "lentilles"], "lentilles"],
  [["haricot rouge", "haricots rouges"], "haricots-rouges"],
  [["haricot blanc", "haricots blancs", "lingot", "lingots", "coco de paimpol"], "haricots-blancs"],
  [["feve", "feves"], "feves"],
  [["pois chiche", "pois chiches"], "pois-chiches"],
  [["bocal", "bocaux"], "bocal"],
  [["conserve", "conserves", "boite"], "conserve"],
  [["surgele", "surgeles", "congele", "congeles"], "sac-surgele"],
  // Légumes
  [["tomate", "tomates"], "tomate"],
  [["carotte", "carottes"], "carotte"],
  [["chou fleur"], "chou-fleur"],
  [["chou rouge"], "chou-rouge"],
  [["chou de bruxelles", "choux de bruxelles"], "chou-de-bruxelles"],
  [["chou", "choux", "chou blanc", "chou vert"], "chou"],
  [["brocoli", "brocolis"], "brocoli"],
  [["salade", "laitue", "mache", "roquette", "batavia"], "salade"],
  [["epinard", "epinards"], "epinards"],
  [["poireau", "poireaux"], "poireau"],
  [["courgette", "courgettes"], "courgette"],
  [["concombre", "concombres"], "concombre"],
  [["oignon", "oignons", "echalote", "echalotes"], "oignon"],
  [["ail"], "ail"],
  [["poivron", "poivrons"], "poivron"],
  [["champignon", "champignons", "cepe", "cepes"], "champignon"],
  [["mais"], "mais"],
  [["aubergine", "aubergines"], "aubergine"],
  [["avocat", "avocats"], "avocat"],
  [["potiron", "courge", "citrouille", "butternut"], "potiron"],
  [["haricot vert", "haricots verts"], "haricots-verts"],
  [["petit pois", "petits pois"], "petits-pois"],
  [["olive", "olives"], "olive"],
  [["radis"], "radis"],
  [["betterave", "betteraves"], "betterave"],
  [["celeri", "celeri rave"], "celeri"],
  [["asperge", "asperges"], "asperge"],
  [["fenouil"], "fenouil"],
  [["navet", "navets"], "navet"],
  [["endive", "endives"], "endive"],
  [["artichaut", "artichauts"], "artichaut"],
  [["gingembre"], "gingembre"],
  [["persil"], "persil"],
  [["basilic"], "basilic"],
  [["ciboulette"], "ciboulette"],
  [["piment", "piments"], "piment"],
  // Fruits
  [["pomme", "pommes"], "pomme"],
  [["poire", "poires"], "poire"],
  [["banane", "bananes"], "banane"],
  [["clementine", "clementines", "mandarine", "mandarines", "satsuma"], "clementine"],
  [["pamplemousse", "pamplemousses"], "pamplemousse"],
  [["orange", "oranges"], "orange"],
  [["citron vert", "citrons verts", "lime", "limes"], "citron-vert"],
  [["citron", "citrons"], "citron"],
  [["fraise", "fraises"], "fraise"],
  [["framboise", "framboises"], "framboise"],
  [["myrtille", "myrtilles", "mure", "mures", "cassis"], "myrtille"],
  [["raisin", "raisins"], "raisin"],
  [["peche", "peches", "nectarine", "nectarines"], "peche"],
  [["abricot", "abricots"], "abricot"],
  [["prune", "prunes"], "prune"],
  [["figue", "figues"], "figue"],
  [["datte", "dattes"], "datte"],
  [["grenade", "grenades"], "grenade"],
  [["cerise", "cerises"], "cerise"],
  [["ananas"], "ananas"],
  [["mangue", "mangues"], "mangue"],
  [["kiwi", "kiwis"], "kiwi"],
  [["melon", "melons"], "melon"],
  [["pasteque", "pasteques"], "pasteque"],
  [["noix de coco", "coco"], "coco"]
];
function productImageSlug(name) {
  const padded = ` ${normalize(name)} `;
  if (padded.trim() === "") return null;
  for (const [words, slug] of RULES) {
    for (const w of words) {
      if (padded.includes(` ${w} `) || padded.includes(` ${w}s `) || padded.includes(` ${w}x `)) return slug;
    }
  }
  return null;
}
var CHOSEN = "icon:";
function chosenIconSlug(imageUrl) {
  return imageUrl && imageUrl.startsWith(CHOSEN) ? imageUrl.slice(CHOSEN.length) : null;
}

// server/alexa-apl.ts
var SITE = "https://food.graphikeo.com";
var C = {
  bg: "#f3f8f9",
  surface: "#ffffff",
  fg: "#142226",
  muted: "#7b8588",
  border: "#dfe6e8",
  brand: "#009d9e",
  strong: "#008183",
  soft: "#d1f7f7",
  warn: "#c9861a",
  danger: "#e23439",
  dangerSoft: "#fdeeee"
};
var today = () => (/* @__PURE__ */ new Date()).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
var dayDiff = (iso) => Math.round((Date.parse(iso) - Date.parse(today())) / 864e5);
function imageFor(name, imageUrl, _category) {
  const slug = chosenIconSlug(imageUrl) ?? productImageSlug(name);
  return slug ? `${SITE}/icons-png/${slug}.png` : void 0;
}
function expiryText(iso) {
  if (!iso) return { tone: "ok" };
  const d = dayDiff(iso);
  if (d < 0) return { sub: "P\xE9rim\xE9", tone: "expired" };
  if (d === 0) return { sub: "Aujourd\u2019hui", tone: "soon" };
  if (d === 1) return { sub: "Demain", tone: "soon" };
  if (d <= 3) return { sub: `Dans ${d} jours`, tone: "soon" };
  const s = (/* @__PURE__ */ new Date(iso + "T12:00:00")).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });
  return { sub: s, tone: "ok" };
}
function productTile(p) {
  const e = expiryText(p.expiryDate);
  const qty = p.quantity > 1 ? `\xD7${p.quantity}` : p.size || "";
  return {
    id: p.id,
    name: p.name,
    sub: [e.sub, qty].filter(Boolean).join(" \xB7 ") || void 0,
    img: imageFor(p.name, p.imageUrl, p.category),
    initial: p.name.trim().charAt(0).toUpperCase() || "?",
    tone: e.tone
  };
}
function nameTile(name, sub) {
  return { name, sub, img: imageFor(name), initial: name.trim().charAt(0).toUpperCase() || "?", tone: "ok" };
}
function byExpiry(products) {
  return [...products].sort((a, b) => (a.expiryDate ?? "9999").localeCompare(b.expiryDate ?? "9999") || a.name.localeCompare(b.name));
}
function urgent(products, n = 8) {
  return byExpiry(products.filter((p) => p.expiryDate)).slice(0, n);
}
var norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe");
function matching(products, query) {
  const stop = /* @__PURE__ */ new Set(["reste", "encore", "combien", "quoi", "dans", "avec", "est-ce", "quil", "cest", "question", "avons", "tout", "tous", "quelle", "quelles", "quel", "quels"]);
  const words = norm(query).split(/[^a-z0-9]+/).map((w) => w.replace(/s$/, "")).filter((w) => w.length >= 4 && !stop.has(w));
  if (!words.length) return [];
  return byExpiry(products.filter((p) => words.some((w) => norm(p.name).includes(w)))).slice(0, 12);
}
var check = {
  type: "AVG",
  version: "1.2",
  width: 24,
  height: 24,
  parameters: ["color"],
  items: [{ type: "path", pathData: "M5 12.5l4.5 4.5L19 7.5", stroke: "${color}", strokeWidth: 3, strokeLineCap: "round", strokeLineJoin: "round", fill: "transparent" }]
};
var NAV = [
  { key: "home", label: "Accueil" },
  { key: "stock", label: "Stock" },
  { key: "urgent", label: "\xC0 consommer vite" },
  { key: "frigo", label: "Frigo" },
  { key: "congel", label: "Cong\xE9lateur" },
  { key: "list", label: "Courses" },
  { key: "recipe", label: "Id\xE9es repas" }
];
var layouts = {
  Header: {
    parameters: ["title", "hint"],
    item: {
      type: "Container",
      direction: "row",
      alignItems: "center",
      width: "100%",
      items: [
        { type: "Image", source: `${SITE}/logo.png`, width: 72, height: 72, scale: "best-fit" },
        { type: "Text", text: "Miam miam", fontSize: 38, fontWeight: "800", color: C.strong, spacing: 18 },
        { type: "Text", when: "${title}", text: "${title}", fontSize: 34, fontWeight: "600", color: C.fg, spacing: 28, grow: 1, maxLines: 1 },
        { type: "Text", when: "${!title}", text: " ", grow: 1 },
        { type: "Text", text: "${hint}", fontSize: 24, color: C.muted, textAlign: "right" }
      ]
    }
  },
  Tile: {
    parameters: ["tile", { name: "w", type: "number", default: 260 }, { name: "h", type: "number", default: 290 }],
    item: {
      type: "Container",
      width: "${w}",
      height: "${h}",
      items: [
        {
          type: "TouchWrapper",
          width: "${w - 20}",
          height: "${h - 20}",
          onPress: [{ type: "SendEvent", arguments: ["product", "${tile.id}"] }],
          item: {
            type: "Frame",
            width: "${w - 20}",
            height: "${h - 20}",
            borderRadius: 28,
            borderWidth: 2,
            backgroundColor: `\${tile.tone == 'expired' ? '${C.dangerSoft}' : '${C.surface}'}`,
            borderColor: `\${tile.tone == 'expired' ? '#f4b8b8' : '${C.border}'}`,
            item: {
              type: "Container",
              width: "${w - 24}",
              height: "${h - 24}",
              alignItems: "center",
              justifyContent: "center",
              paddingLeft: 16,
              paddingRight: 16,
              items: [
                { type: "Image", when: "${tile.img}", source: "${tile.img}", width: "${Math.floor((h - 20) * 0.5)}", height: "${Math.floor((h - 20) * 0.5)}", scale: "best-fit" },
                {
                  type: "Frame",
                  when: "${!tile.img}",
                  width: 110,
                  height: 110,
                  borderRadius: 55,
                  backgroundColor: C.soft,
                  item: { type: "Text", text: "${tile.initial}", width: 110, height: 110, textAlign: "center", textAlignVertical: "center", fontSize: 52, fontWeight: "800", color: C.strong }
                },
                { type: "Text", text: "${tile.name}", spacing: 12, fontSize: 26, fontWeight: "700", color: C.fg, textAlign: "center", maxLines: 2 },
                {
                  type: "Text",
                  when: "${tile.sub}",
                  text: "${tile.sub}",
                  spacing: 4,
                  fontSize: 22,
                  fontWeight: "600",
                  textAlign: "center",
                  maxLines: 1,
                  color: `\${tile.tone == 'expired' ? '${C.danger}' : tile.tone == 'soon' ? '${C.warn}' : '${C.muted}'}`
                }
              ]
            }
          }
        }
      ]
    }
  },
  NavBar: {
    parameters: ["current"],
    item: {
      type: "Container",
      direction: "row",
      width: "100%",
      height: 96,
      spacing: 16,
      justifyContent: "center",
      data: NAV,
      item: {
        type: "TouchWrapper",
        spacing: 14,
        onPress: [{ type: "SendEvent", arguments: ["nav", "${data.key}"] }],
        item: {
          type: "Frame",
          height: 80,
          borderRadius: 40,
          paddingLeft: 34,
          paddingRight: 34,
          backgroundColor: `\${data.key == current ? '${C.brand}' : '${C.surface}'}`,
          borderWidth: 2,
          borderColor: `\${data.key == current ? '${C.brand}' : '${C.border}'}`,
          item: {
            type: "Text",
            text: "${data.label}",
            height: 76,
            textAlignVertical: "center",
            fontSize: 28,
            fontWeight: "700",
            color: `\${data.key == current ? '#ffffff' : '${C.fg}'}`
          }
        }
      }
    }
  },
  BigButton: {
    parameters: ["label", "action", "pid", "danger"],
    item: {
      type: "TouchWrapper",
      onPress: [{ type: "SendEvent", arguments: ["act", "${action}", "${pid}"] }],
      item: {
        type: "Frame",
        height: 110,
        borderRadius: 30,
        backgroundColor: `\${danger ? '${C.dangerSoft}' : '${C.brand}'}`,
        borderWidth: 2,
        borderColor: `\${danger ? '#f4b8b8' : '${C.brand}'}`,
        item: {
          type: "Text",
          text: "${label}",
          height: 106,
          paddingLeft: 20,
          paddingRight: 20,
          textAlign: "center",
          textAlignVertical: "center",
          fontSize: 32,
          fontWeight: "800",
          color: `\${danger ? '${C.danger}' : '#ffffff'}`
        }
      }
    }
  },
  Chip: {
    parameters: ["label"],
    item: {
      type: "Frame",
      backgroundColor: C.soft,
      borderRadius: 40,
      paddingLeft: 26,
      paddingRight: 26,
      paddingTop: 12,
      paddingBottom: 12,
      item: { type: "Text", text: "${label}", fontSize: 25, fontWeight: "600", color: C.strong }
    }
  }
};
var PADX = "(viewport.width >= 1500 ? 128 : 64)";
var tileW = `\${Math.floor((viewport.width - ${PADX}) / (viewport.width >= 1500 ? 6 : viewport.width >= 1000 ? 5 : 3))}`;
var tileH = "${viewport.width >= 1500 ? 290 : 230}";
var rowW = "${viewport.width >= 1500 ? 260 : 210}";
function grid(dataPath, extra = {}) {
  return {
    type: "GridSequence",
    width: "100%",
    grow: 1,
    shrink: 1,
    spacing: 24,
    childWidth: tileW,
    childHeight: tileH,
    data: dataPath,
    item: { type: "Tile", tile: "${data}", w: tileW, h: tileH },
    ...extra
  };
}
function row(dataPath) {
  return {
    type: "Sequence",
    scrollDirection: "horizontal",
    width: "100%",
    height: tileH,
    spacing: 24,
    data: dataPath,
    item: { type: "Tile", tile: "${data}", w: rowW, h: tileH }
  };
}
function page(items, nav = "") {
  return {
    type: "APL",
    version: "2023.3",
    theme: "light",
    settings: { idleTimeout: 18e4 },
    graphics: { check },
    layouts,
    mainTemplate: {
      parameters: ["miam"],
      item: {
        type: "Frame",
        width: "100vw",
        height: "100vh",
        backgroundColor: C.bg,
        item: {
          type: "Container",
          width: "100vw",
          height: "100vh",
          paddingLeft: "${viewport.width >= 1500 ? 64 : 32}",
          paddingRight: "${viewport.width >= 1500 ? 64 : 32}",
          paddingTop: "${viewport.width >= 1500 ? 44 : 24}",
          paddingBottom: 20,
          items: [
            { type: "Container", width: "100%", grow: 1, shrink: 1, items },
            { type: "NavBar", current: nav }
          ]
        }
      }
    }
  };
}
var hintDefault = "Dis \xAB Alexa, \u2026 \xBB pour me parler";
function homeScreen(o) {
  const stat = (value, label, color, nav) => ({
    type: "TouchWrapper",
    grow: 1,
    spacing: 24,
    onPress: [{ type: "SendEvent", arguments: ["nav", nav] }],
    item: {
      type: "Frame",
      backgroundColor: C.surface,
      borderRadius: 28,
      borderWidth: 2,
      borderColor: C.border,
      item: {
        type: "Container",
        paddingLeft: 32,
        paddingTop: 24,
        paddingBottom: 24,
        items: [
          { type: "Text", text: value, fontSize: 68, fontWeight: "800", color },
          { type: "Text", text: label, fontSize: 26, color: C.muted, fontWeight: "600" }
        ]
      }
    }
  });
  return {
    document: page([
      { type: "Header", title: "", hint: "${miam.date}" },
      { type: "Text", text: "${miam.hello}", spacing: 28, fontSize: 60, fontWeight: "800", color: C.fg },
      {
        type: "Container",
        direction: "row",
        spacing: 24,
        width: "100%",
        items: [
          stat("${miam.total}", "produits en stock  \u203A", C.strong, "stock"),
          stat("${miam.soon}", "\xE0 consommer vite  \u203A", o.soon ? C.warn : C.strong, "urgent"),
          stat("${miam.shop}", "articles \xE0 acheter  \u203A", C.strong, "list")
        ]
      },
      { type: "Text", when: "${miam.urgent.length > 0}", text: "\xC0 consommer en priorit\xE9", spacing: 32, fontSize: 32, fontWeight: "800", color: C.fg },
      { type: "Container", when: "${miam.urgent.length > 0}", spacing: 16, width: "100%", items: [row("${miam.urgent}")] },
      {
        type: "Container",
        direction: "row",
        wrap: "wrap",
        spacing: 28,
        alignItems: "center",
        items: [
          { type: "Text", text: "\xC0 dire :", fontSize: 25, color: C.muted, fontWeight: "600" },
          { type: "Chip", spacing: 16, label: "\xAB Alexa, ajoute du lait \xBB" },
          { type: "Chip", spacing: 16, label: "\xAB Alexa, j\u2019ai fini le beurre \xBB" },
          { type: "Chip", spacing: 16, label: "\xAB Alexa, il reste des \u0153ufs ? \xBB" },
          { type: "Text", text: "Touche un produit pour agir dessus.", fontSize: 25, color: C.muted, spacing: 24 }
        ]
      }
    ], "home"),
    data: {
      miam: {
        hello: o.name ? `Salut ${o.name} !` : "Salut !",
        date: (/* @__PURE__ */ new Date()).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }),
        total: String(o.total),
        soon: String(o.soon),
        shop: String(o.shop),
        urgent: o.urgent
      }
    }
  };
}
function gridScreen(title, count, tiles, nav = "stock") {
  return {
    document: page([
      { type: "Header", title: "${miam.title}", hint: "${miam.count}" },
      tiles.length ? { type: "Container", spacing: 28, width: "100%", grow: 1, shrink: 1, items: [grid("${miam.tiles}")] } : { type: "Text", text: "Rien ici pour l\u2019instant.", spacing: 60, fontSize: 40, color: C.muted, textAlign: "center", width: "100%" }
    ], nav),
    data: { miam: { title, count, tiles } }
  };
}
function listScreen(items) {
  const sorted = [...items].sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name));
  const rows = sorted.map((s) => ({
    id: s.id,
    name: s.name,
    qty: s.unit ? `${s.quantity} ${s.unit}` : s.quantity > 1 ? `\xD7${s.quantity}` : "",
    img: imageFor(s.name, void 0, s.category) ?? "",
    initial: s.name.trim().charAt(0).toUpperCase() || "?",
    checked: s.checked
  }));
  const left = items.filter((s) => !s.checked).length;
  const listW = `\${Math.floor((viewport.width - ${PADX}) / (viewport.width >= 1500 ? 3 : 2))}`;
  const inner = `\${Math.floor((viewport.width - ${PADX}) / (viewport.width >= 1500 ? 3 : 2)) - 20}`;
  const rowItem = {
    type: "Container",
    width: listW,
    height: 116,
    items: [
      {
        type: "TouchWrapper",
        width: inner,
        height: 98,
        onPress: [{ type: "SendEvent", arguments: ["toggle", "${data.id}"] }],
        item: {
          type: "Frame",
          width: inner,
          height: 98,
          borderRadius: 24,
          borderWidth: 2,
          borderColor: C.border,
          backgroundColor: `\${data.checked ? '${C.bg}' : '${C.surface}'}`,
          item: {
            type: "Container",
            direction: "row",
            alignItems: "center",
            width: inner,
            height: 94,
            paddingLeft: 24,
            paddingRight: 24,
            opacity: "${data.checked ? 0.5 : 1}",
            items: [
              {
                type: "Frame",
                width: 48,
                height: 48,
                borderRadius: 24,
                borderWidth: 3,
                borderColor: C.brand,
                backgroundColor: `\${data.checked ? '${C.brand}' : 'transparent'}`,
                item: { type: "VectorGraphic", when: "${data.checked}", source: "check", color: "#ffffff", width: 42, height: 42, scale: "best-fit" }
              },
              { type: "Image", when: "${data.img}", source: "${data.img}", width: 72, height: 72, scale: "best-fit", spacing: 20 },
              {
                type: "Frame",
                when: "${!data.img}",
                width: 72,
                height: 72,
                borderRadius: 36,
                spacing: 20,
                backgroundColor: C.soft,
                item: { type: "Text", text: "${data.initial}", width: 72, height: 72, textAlign: "center", textAlignVertical: "center", fontSize: 34, fontWeight: "800", color: C.strong }
              },
              { type: "Text", text: "${data.name}", spacing: 20, grow: 1, shrink: 1, fontSize: 30, fontWeight: "700", color: C.fg, maxLines: 1 },
              { type: "Text", text: "${data.qty}", fontSize: 24, color: C.muted, fontWeight: "600" }
            ]
          }
        }
      }
    ]
  };
  return {
    document: page([
      { type: "Header", title: "Liste de courses", hint: "${miam.count}" },
      rows.length ? {
        type: "GridSequence",
        spacing: 28,
        width: "100%",
        grow: 1,
        shrink: 1,
        childWidth: listW,
        childHeight: 116,
        data: "${miam.rows}",
        item: rowItem
      } : { type: "Text", text: "La liste est vide. Dis \xAB Alexa, ajoute du pain \xBB.", spacing: 60, fontSize: 40, color: C.muted, textAlign: "center", width: "100%" },
      {
        type: "Container",
        when: "${miam.rows.length > 0}",
        direction: "row",
        alignItems: "center",
        spacing: 8,
        width: "100%",
        items: [
          { type: "Text", text: "Touche un article pour le cocher.", fontSize: 24, color: C.muted, grow: 1 },
          {
            type: "TouchWrapper",
            when: "${miam.checked > 0}",
            onPress: [{ type: "SendEvent", arguments: ["clear"] }],
            item: { type: "Chip", label: "${miam.clearLabel}" }
          }
        ]
      }
    ], "list"),
    data: {
      miam: {
        rows,
        count: left ? `${left} \xE0 acheter` : "Tout est pris",
        checked: items.length - left,
        clearLabel: `Retirer les ${items.length - left} coch\xE9s`
      }
    }
  };
}
function doneScreen(text, tiles, undoHint = true) {
  return {
    document: page([
      { type: "Header", title: "", hint: "" },
      {
        type: "Container",
        grow: 1,
        width: "100%",
        alignItems: "center",
        justifyContent: "center",
        items: [
          {
            type: "Frame",
            width: 128,
            height: 128,
            borderRadius: 64,
            backgroundColor: C.brand,
            item: { type: "VectorGraphic", source: "check", color: "#ffffff", width: 128, height: 128, scale: "best-fit" }
          },
          { type: "Text", text: "${miam.text}", spacing: 28, fontSize: 44, fontWeight: "800", color: C.fg, textAlign: "center", width: "80%", maxLines: 3 },
          {
            type: "Container",
            when: "${miam.tiles.length > 0}",
            spacing: 36,
            direction: "row",
            justifyContent: "center",
            width: "100%",
            height: tileH,
            data: "${miam.tiles}",
            item: { type: "Tile", tile: "${data}", w: rowW, h: tileH }
          },
          { type: "Text", when: "${miam.undo}", text: "Pour revenir en arri\xE8re : \xAB Alexa, annule \xBB", spacing: 28, fontSize: 25, color: C.muted }
        ]
      }
    ], ""),
    data: { miam: { text, tiles: tiles.slice(0, 6), undo: undoHint } }
  };
}
function answerScreen(text, o = {}) {
  const tiles = o.tiles ?? [];
  return {
    document: page([
      { type: "Header", title: "${miam.title}", hint: hintDefault },
      {
        type: "Frame",
        spacing: 28,
        width: "100%",
        backgroundColor: C.surface,
        borderRadius: 32,
        borderWidth: 2,
        borderColor: C.border,
        item: {
          type: "Container",
          paddingLeft: 40,
          paddingRight: 40,
          paddingTop: 32,
          paddingBottom: 32,
          items: [
            { type: "Text", text: "${miam.text}", fontSize: 36, fontWeight: "600", color: C.fg, lineHeight: 1.3, maxLines: 7 },
            {
              type: "Container",
              when: "${miam.options.length > 0}",
              direction: "row",
              wrap: "wrap",
              spacing: 24,
              data: "${miam.options}",
              item: {
                type: "TouchWrapper",
                spacing: 16,
                onPress: [{ type: "SendEvent", arguments: ["answer", "${data}"] }],
                item: { type: "Chip", label: "${data}" }
              }
            }
          ]
        }
      },
      { type: "Text", when: "${miam.tiles.length > 0}", text: "${miam.tilesTitle}", spacing: 32, fontSize: 30, fontWeight: "800", color: C.fg },
      { type: "Container", when: "${miam.tiles.length > 0}", spacing: 16, width: "100%", grow: 1, shrink: 1, items: [grid("${miam.tiles}")] }
    ], o.nav ?? ""),
    data: { miam: { text, title: o.title ?? "", tiles, tilesTitle: o.tilesTitle ?? "", options: o.options ?? [] } }
  };
}
function productScreen(p) {
  const t = productTile(p);
  const exp = p.expiryDate ? (/* @__PURE__ */ new Date(p.expiryDate + "T12:00:00")).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }) : "";
  const lines = [
    p.brand ? p.brand : "",
    p.location ? `Emplacement : ${p.location}` : "",
    `Quantit\xE9 : \xD7${p.quantity}${p.size ? ` \xB7 ${p.size}` : ""}`,
    p.openedAt ? `Entam\xE9 le ${new Date(p.openedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "Europe/Paris" })}` : ""
  ].filter(Boolean);
  const line = (text) => ({ type: "Text", text, fontSize: 30, color: C.fg, spacing: 10, maxLines: 1 });
  return {
    document: page(
      [
        { type: "Header", title: "", hint: "" },
        {
          type: "Container",
          direction: "row",
          spacing: 32,
          width: "100%",
          grow: 1,
          shrink: 1,
          alignItems: "center",
          items: [
            {
              type: "Frame",
              width: "${viewport.width >= 1500 ? 440 : 300}",
              height: "${viewport.width >= 1500 ? 440 : 300}",
              borderRadius: 40,
              backgroundColor: `\${miam.tone == 'expired' ? '${C.dangerSoft}' : '${C.surface}'}`,
              borderWidth: 2,
              borderColor: C.border,
              item: {
                type: "Container",
                width: "${viewport.width >= 1500 ? 436 : 296}",
                height: "${viewport.width >= 1500 ? 436 : 296}",
                alignItems: "center",
                justifyContent: "center",
                items: [
                  { type: "Image", when: "${miam.img}", source: "${miam.img}", width: "${viewport.width >= 1500 ? 340 : 230}", height: "${viewport.width >= 1500 ? 340 : 230}", scale: "best-fit" },
                  { type: "Text", when: "${!miam.img}", text: "${miam.initial}", fontSize: 160, fontWeight: "800", color: C.strong }
                ]
              }
            },
            {
              type: "Container",
              grow: 1,
              shrink: 1,
              spacing: 48,
              items: [
                { type: "Text", text: "${miam.name}", fontSize: 54, fontWeight: "800", color: C.fg, maxLines: 2 },
                {
                  type: "Text",
                  when: "${miam.exp}",
                  text: "${miam.exp}",
                  spacing: 14,
                  fontSize: 32,
                  fontWeight: "700",
                  color: `\${miam.tone == 'expired' ? '${C.danger}' : miam.tone == 'soon' ? '${C.warn}' : '${C.strong}'}`
                },
                ...lines.map(line)
              ]
            }
          ]
        },
        {
          type: "Container",
          direction: "row",
          width: "100%",
          spacing: 24,
          items: [
            { type: "BigButton", label: "J\u2019ai fini", action: "finish", pid: p.id, danger: false, grow: 1 },
            { type: "BigButton", label: p.openedAt ? "D\xE9j\xE0 entam\xE9" : "Entam\xE9", action: "open", pid: p.id, grow: 1, spacing: 20, danger: false },
            { type: "BigButton", label: "Ajouter aux courses", action: "shop", pid: p.id, grow: 1, spacing: 20, danger: false },
            { type: "BigButton", label: "Jet\xE9", action: "waste", pid: p.id, grow: 1, spacing: 20, danger: true }
          ]
        }
      ],
      ""
    ),
    data: {
      miam: {
        name: p.name,
        img: t.img ?? "",
        initial: t.initial,
        tone: t.tone,
        exp: p.expiryDate ? t.tone === "expired" ? `P\xE9rim\xE9 depuis le ${exp}` : `\xC0 consommer avant le ${exp}` : ""
      }
    }
  };
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
function attach(r, screen, apl) {
  if (!apl || !screen) return r;
  r.response.directives = [
    { type: "Alexa.Presentation.APL.RenderDocument", token: "miam", document: screen.document, datasources: screen.data }
  ];
  if (r.response.shouldEndSession === true) delete r.response.shouldEndSession;
  return r;
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
function open(link) {
  const jwt = userJwt(link.user_id);
  const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return { jwt, sb, repo: new SupabaseRepository(sb, link.household_id) };
}
var firstName = (n) => {
  const w = (n ?? "").split(/[.\s@_\d]/)[0];
  return w.length >= 3 ? w.charAt(0).toUpperCase() + w.slice(1) : "";
};
async function displayName(link, repo) {
  const f = firstName(link.name);
  if (f) return f;
  const initial = (link.name ?? "").trim().charAt(0).toLowerCase();
  if (!initial) return "";
  const fam = await repo.getFamily().catch(() => []);
  const hits = fam.filter((m) => (m.name ?? "").trim().toLowerCase().startsWith(initial));
  return hits.length === 1 ? String(hits[0].name).split(" ")[0] : "";
}
async function handleHome(link, apl, text) {
  const { repo } = open(link);
  const name = await displayName(link, repo);
  const r = text ? say(text(name), { end: false, reprompt: "Que veux-tu faire ?" }) : { version: "1.0", response: {} };
  if (!apl) return r;
  const [products, shopping] = await Promise.all([repo.listProducts(), repo.listShopping()]);
  const limit = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  return attach(
    r,
    homeScreen({
      name,
      total: products.length,
      soon: products.filter((p) => p.expiryDate && p.expiryDate <= limit).length,
      shop: shopping.filter((s) => !s.checked).length,
      urgent: urgent(products).map(productTile)
    }),
    apl
  );
}
async function handleList(link, apl) {
  const { repo } = open(link);
  const shopping = await repo.listShopping();
  const left = shopping.filter((s) => !s.checked);
  const names = left.map((s) => s.name);
  const speech = !names.length ? "La liste de courses est vide." : names.length <= 12 ? `Sur la liste : ${names.slice(0, -1).join(", ")}${names.length > 1 ? " et " : ""}${names[names.length - 1]}.` : `Il y a ${names.length} articles, dont ${names.slice(0, 8).join(", ")}.`;
  return attach(say(speech), listScreen(shopping), apl);
}
async function handleCommand(text, link, alexaUser, ui = { apl: false }) {
  const { jwt, sb, repo } = open(link);
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
  if (!actions.length) {
    const r2 = say(reply || "Je n\u2019ai pas compris. Tu peux reformuler ?", { end: false, reprompt: "Que veux-tu faire ?" });
    if (!ui.apl || !reply) return r2;
    if (ui.view === "grid") {
      const l = ui.lieu ? norm2(ui.lieu) : "";
      const list = byExpiry(l ? products.filter((p) => norm2(p.location ?? "").includes(l)) : products);
      const title = ui.lieu ? ui.lieu.charAt(0).toUpperCase() + ui.lieu.slice(1) : "Tout le stock";
      const nav = l.startsWith("refri") ? "frigo" : l.startsWith("congel") ? "congel" : l ? "" : "stock";
      return attach(r2, gridScreen(title, `${list.length} produit${list.length > 1 ? "s" : ""}`, list.slice(0, 90).map(productTile), nav), true);
    }
    if (ui.view === "recipe")
      return attach(r2, answerScreen(reply, { title: "Id\xE9es de repas", tiles: urgent(products, 12).map(productTile), tilesTitle: "\xC0 utiliser en priorit\xE9", nav: "recipe" }), true);
    return attach(r2, answerScreen(reply, { tiles: matching(products, ui.query || text).map(productTile), tilesTitle: "Dans ton stock" }), true);
  }
  const ask = actions.find((a) => a.type === "ask");
  if (ask) {
    const names = ask.options.map((o) => o.label).join(", ou ");
    const r2 = say(`${ask.question} ${names} ?`, {
      end: false,
      reprompt: ask.question,
      attrs: { pending: ask }
    });
    const labels = ask.options.map((o) => o.label);
    return attach(r2, answerScreen(ask.question, { title: "Une pr\xE9cision", options: labels }), ui.apl);
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
  const tiles = [];
  for (const a of actions) {
    if (a.type === "shop_add") tiles.push(nameTile(a.name, "Ajout\xE9 aux courses"));
    else if (a.type === "stock_add") tiles.push(nameTile(a.name, "Ajout\xE9 au stock"));
    else if (a.type === "shop_remove") {
      const it = shopping.find((s) => s.id === a.id);
      if (it) tiles.push(nameTile(it.name, "Retir\xE9 des courses"));
    } else {
      const p = products.find((x) => x.id === a.id);
      const verb = { stock_finish: "Termin\xE9", stock_waste: "Jet\xE9", stock_open: "Ouvert", stock_remove: "Entam\xE9" }[a.type];
      if (p) tiles.push({ ...productTile(p), sub: verb ?? productTile(p).sub, tone: "ok" });
    }
  }
  return attach(say(reply || "C\u2019est fait.", { card: actions.map((a) => a.label).join("\n") }), doneScreen(reply || "C\u2019est fait.", tiles), ui.apl);
}
var norm2 = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
var quiet = (screen, apl, attrs = {}) => attach({ version: "1.0", sessionAttributes: attrs, response: {} }, screen, apl);
async function handleNav(key, link, alexaUser, apl) {
  if (key === "home") return handleHome(link, apl, null);
  if (key === "recipe") return handleCommand(FIXED.RecetteIntent(), link, alexaUser, { apl, view: "recipe" });
  const { repo } = open(link);
  if (key === "list") return quiet(listScreen(await repo.listShopping()), apl);
  const products = await repo.listProducts();
  const count = (n) => `${n} produit${n > 1 ? "s" : ""}`;
  if (key === "urgent") {
    const limit = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const list2 = byExpiry(products.filter((p) => p.expiryDate && p.expiryDate <= limit));
    return quiet(gridScreen("\xC0 consommer vite", count(list2.length), list2.map(productTile), "urgent"), apl);
  }
  if (key === "frigo" || key === "congel") {
    const want = key === "frigo" ? ["refrigerateur", "frigo"] : ["congel"];
    const list2 = byExpiry(products.filter((p) => want.some((w) => norm2(p.location ?? "").includes(w))));
    return quiet(gridScreen(key === "frigo" ? "R\xE9frig\xE9rateur" : "Cong\xE9lateur", count(list2.length), list2.slice(0, 90).map(productTile), key), apl);
  }
  const list = byExpiry(products);
  const label = list.length > 120 ? `${list.length} produits, les 120 plus urgents` : count(list.length);
  return quiet(gridScreen("Tout le stock", label, list.slice(0, 120).map(productTile), "stock"), apl);
}
async function handleAct(kind, id, link, alexaUser, apl) {
  const { sb, repo } = open(link);
  const [products, shopping] = await Promise.all([repo.listProducts(), repo.listShopping()]);
  const p = products.find((x) => x.id === id);
  if (!p) return attach(say("Ce produit n\u2019est plus dans le stock."), doneScreen("Ce produit n\u2019est plus dans le stock.", [], false), apl);
  const a = kind === "shop" ? { type: "shop_add", name: p.name, category: p.category, quantity: 1 } : { type: { finish: "stock_finish", open: "stock_open", waste: "stock_waste" }[kind] ?? "", id: p.id };
  if (!a.type) return quiet(null, apl);
  const undo = [];
  await applyOne(a, repo, sb, products, shopping, undo);
  await rpc("alexa_set_undo", { p_alexa: alexaUser, p_undo: { at: Date.now(), ops: undo } }).catch(() => {
  });
  const text = kind === "finish" ? `${p.name} : termin\xE9, je le retire du stock.` : kind === "waste" ? `${p.name} : not\xE9 comme jet\xE9.` : kind === "open" ? `${p.name} : not\xE9 comme entam\xE9.` : `${p.name} ajout\xE9 aux courses.`;
  const sub = { finish: "Termin\xE9", waste: "Jet\xE9", open: "Entam\xE9", shop: "Ajout\xE9 aux courses" }[kind] ?? "";
  return attach(say(text), doneScreen(text, [{ ...productTile(p), sub, tone: "ok" }]), apl);
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
async function handleUndo(link, alexaUser, apl = false) {
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
  return attach(say("C\u2019est annul\xE9, tout est revenu comme avant."), doneScreen("C\u2019est annul\xE9, tout est revenu comme avant.", [], false), apl);
}
var VERBS = {
  AjouterIntent: "ajoute",
  EnleverIntent: "enl\xE8ve",
  JaiIntent: "j\u2019ai",
  QuestionIntent: "Question :",
  PlusIntent: "on n\u2019a plus",
  CommandeIntent: ""
};
var FIXED = {
  ContenuIntent: (lieu) => lieu ? `Qu\u2019est-ce qu\u2019il y a dans le ${lieu} ? Ne cite que les produits dont l\u2019emplacement est \xAB ${lieu} \xBB (sans tenir compte des majuscules), et r\xE9sume en quelques mots.` : "Qu\u2019est-ce que j\u2019ai en stock ? R\xE9sume en quelques mots, en citant d\u2019abord ce qui p\xE9rime bient\xF4t.",
  RecetteIntent: () => "Qu\u2019est-ce que je peux cuisiner avec ce que j\u2019ai, en priorit\xE9 ce qui p\xE9rime bient\xF4t ? Propose une ou deux id\xE9es courtes.",
  ListeIntent: () => "Qu\u2019est-ce qu\u2019il y a sur la liste de courses ? Lis-la simplement."
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
  const apl = !!body?.context?.System?.device?.supportedInterfaces?.["Alexa.Presentation.APL"];
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
      return send(await handleHome(link, apl, (n) => `Salut${n ? ` ${n}` : ""} ! Qu\u2019est-ce que je fais ?`));
    if (intent === "AMAZON.HelpIntent" || intent === "AMAZON.NavigateHomeIntent")
      return send(
        await handleHome(
          link,
          apl,
          () => "Tu peux me dire : ajoute du pain aux courses, enl\xE8ve deux cents grammes de comt\xE9, j\u2019ai fini les yaourts, ou est-ce qu\u2019il reste du beurre. Pour revenir en arri\xE8re, dis : annule."
        )
      );
    if (intent === "AMAZON.StopIntent" || intent === "AMAZON.CancelIntent" || intent === "AMAZON.NoIntent") return send(say("\xC0 plus tard !"));
    if (intent === "AnnulerIntent") return send(await handleUndo(link, alexaUser, apl));
    if (rq.type === "Alexa.Presentation.APL.UserEvent") {
      const [kind, value] = rq.arguments ?? [];
      if (kind === "toggle" && value) {
        const { repo } = open(link);
        await repo.toggleShoppingItem(value);
        const shopping = await repo.listShopping();
        return send(attach({ version: "1.0", sessionAttributes: body?.session?.attributes ?? {}, response: {} }, listScreen(shopping), apl));
      }
      if (kind === "nav" && value) return send(await handleNav(value, link, alexaUser, apl));
      if (kind === "product" && value) {
        const { repo } = open(link);
        const p = (await repo.listProducts()).find((x) => x.id === value);
        return send(p ? quiet(productScreen(p), apl) : await handleNav("stock", link, alexaUser, apl));
      }
      if (kind === "act" && value && rq.arguments?.[2]) return send(await handleAct(value, String(rq.arguments[2]), link, alexaUser, apl));
      if (kind === "clear") {
        const { repo } = open(link);
        const done = (await repo.listShopping()).filter((s) => s.checked);
        await repo.clearCheckedShopping();
        const undo = done.map((it) => ({ t: "shop_add", item: { name: it.name, category: it.category, quantity: it.quantity, unit: it.unit } }));
        await rpc("alexa_set_undo", { p_alexa: alexaUser, p_undo: { at: Date.now(), ops: undo } }).catch(() => {
        });
        return send(quiet(listScreen(await repo.listShopping()), apl));
      }
      if (kind === "answer" && value) {
        const pend = body?.session?.attributes?.pending;
        const text = pend ? `${pend.question} R\xE9ponse : ${value}. (Action : ${pend.then}${pend.then === "stock_remove" ? ` ${pend.amount} ${pend.unit}` : ""})` : value;
        return send(await handleCommand(text, link, alexaUser, { apl }));
      }
      return send({ version: "1.0", response: {} });
    }
    const pending = body?.session?.attributes?.pending;
    const phrase = rq.intent?.slots?.phrase?.value ?? "";
    if (pending && phrase) {
      const text = `${pending.question} R\xE9ponse : ${phrase}. (Action : ${pending.then}${pending.then === "stock_remove" ? ` ${pending.amount} ${pending.unit}` : ""})`;
      return send(await handleCommand(text, link, alexaUser, { apl, query: phrase }));
    }
    if (intent === "ListeIntent") return send(await handleList(link, apl));
    if (intent in FIXED) {
      const lieu = rq.intent?.slots?.lieu?.resolutions?.resolutionsPerAuthority?.[0]?.values?.[0]?.value?.name ?? rq.intent?.slots?.lieu?.value;
      const view = intent === "ContenuIntent" ? "grid" : intent === "RecetteIntent" ? "recipe" : void 0;
      return send(await handleCommand(FIXED[intent](lieu), link, alexaUser, { apl, view, lieu }));
    }
    if (intent in VERBS && phrase) {
      const verb = VERBS[intent];
      return send(await handleCommand(verb ? `${verb} ${phrase}` : phrase, link, alexaUser, { apl, query: phrase }));
    }
    if (intent === "AMAZON.FallbackIntent" || intent in VERBS)
      return send(
        say("Je n\u2019ai pas saisi. Commence par un verbe, par exemple : ajoute du lait, j\u2019ai fini le beurre, ou est-ce qu\u2019il reste des \u0153ufs.", {
          end: false,
          reprompt: "Que veux-tu faire ?"
        })
      );
    return send(say("Je n\u2019ai pas compris.", { end: false, reprompt: "Que veux-tu faire ?" }));
  } catch (e) {
    await note(`erreur : ${e instanceof Error ? `${e.message} ${e.stack ?? ""}` : String(e)}`);
    return send(say("Oups, Miam miam a eu un souci. R\xE9essaie dans un instant."));
  }
});
