import { Router } from "express";
import OpenAI from "openai";
import { randomUUID } from "crypto";

const router = Router();
const MODEL_NAME = "gpt-4o-mini";

let openai: OpenAI | null = null;

const getAIClient = (): OpenAI => {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
};

const SKILL_DIFFICULTY_MAP: Record<string, string[]> = {
  'Beginner': ['Easy'],
  'Intermediate': ['Easy', 'Medium'],
  'Expert': ['Medium', 'Hard'],
  'Professional': ['Easy', 'Medium', 'Hard', 'Expert']
};

const getSpiceLevelFromTolerance = (tolerance: number): string[] => {
  if (tolerance <= 25) return ['mild'];
  if (tolerance <= 50) return ['mild', 'medium'];
  if (tolerance <= 75) return ['mild', 'medium', 'spicy'];
  return ['mild', 'medium', 'spicy', 'fiery'];
};

// Models sometimes emit the STRING "null"/"none" for nullable fields, which is truthy
// in the UI and renders as literal "Sub: null". Coerce those back to a real null.
const cleanNullable = (v: any): string | null => {
  if (typeof v !== "string") return v ?? null;
  const s = v.trim();
  return s === "" || /^(null|none|n\/a|undefined)$/i.test(s) ? null : s;
};

/**
 * The model does not reliably use the `name`/`quantity` keys we ask for — it also emits
 * `ingredient`/`amount`, or a plain string like "3 ripe bananas". Anything it produced
 * that we didn't recognise rendered as a blank row with a lone "Missing" underneath, so
 * accept the common variants and drop whatever still has no name.
 */
// only treat a trailing word as a unit if it really is one — otherwise "3 ripe bananas"
// parses as quantity "3 ripe"
const UNIT_WORDS =
  'g|kg|mg|ml|l|oz|lb|lbs|cup|cups|tbsp|tbs|tsp|tablespoons?|teaspoons?|cloves?|pcs|pieces?|cans?|slices?|pinch|dash|sticks?|bunch|handful|packets?|bags?';
const INGREDIENT_STRING = new RegExp(`^\\s*([\\d./½¼¾⅓⅔]+(?:\\s*(?:${UNIT_WORDS})\\b)?)?\\s*(.*)$`, 'i');

const normalizeIngredient = (raw: any) => {
  // "2 tbsp olive oil" -> { quantity: "2 tbsp", name: "olive oil" }
  if (typeof raw === "string") {
    const match = raw.trim().match(INGREDIENT_STRING);
    const quantity = (match?.[1] ?? "").trim();
    const name = (match?.[2] ?? raw).trim();
    return { name, quantity, status: "Missing", substitute: null, isAllergen: false, isOptional: false };
  }

  const i = raw ?? {};
  // `title` is deliberately excluded — it belongs to sections, and reading it as an
  // ingredient name is what collapsed a nested "Cake Ingredients" group into one row.
  const name = [i.name, i.ingredient, i.item, i.label]
    .find((v: any) => typeof v === "string" && v.trim())?.trim() ?? "";
  const quantity = [i.quantity, i.amount, i.qty, i.measure]
    .find((v: any) => (typeof v === "string" && v.trim()) || typeof v === "number");
  const status = cleanNullable(i.status) ?? "Missing";

  return {
    ...i,
    name,
    quantity: quantity === undefined ? "" : String(quantity).trim(),
    unit: typeof i.unit === "string" ? i.unit : undefined,
    status,
    substitute: cleanNullable(i.substitute),
    // an item we already have needs no shopping amount
    amountToBuy: status === "Have" ? undefined : cleanNullable(i.amountToBuy) ?? undefined,
    isAllergen: i.isAllergen === true,
    isOptional: i.isOptional === true,
  };
};

/**
 * The model sometimes nests a section inside a section — an "item" that is really
 * { title: "Cake Ingredients", items: [...] }. Promote those to real sections so the
 * sub-recipe headings survive instead of collapsing into one nameless row.
 */
const expandNestedSections = (sections: any): any[] => {
  if (!Array.isArray(sections)) return [];
  return sections.flatMap((section: any) => {
    const items: any[] = Array.isArray(section?.items) ? section.items : [];
    const groups = items.filter(i => i && Array.isArray(i.items));
    if (groups.length === 0) return [section];

    const loose = items.filter(i => !(i && Array.isArray(i.items)));
    return [
      ...(loose.length > 0 ? [{ title: section.title, items: loose }] : []),
      ...groups.map((g: any) => ({ title: g.title ?? g.name ?? section.title, items: g.items })),
    ];
  });
};

const toNumber = (v: any, fallback: number): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

// Ensure `ingredientSections` exists and per-item fields are sane, whichever shape came back.
// The recipe card renders title/instructions/nutrition directly, so anything missing here
// used to blow up the page — json_object mode in particular loves wrapping the object
// under a "recipe" key and calling the title "name".
const normalizeRecipe = (r: any) => {
  const unwrapped = r?.recipe ?? r?.Recipe ?? r ?? {};
  const copy = { ...unwrapped };

  copy.title = [copy.title, copy.name, copy.dish, copy.dishName]
    .find((t: any) => typeof t === "string" && t.trim()) ?? "Untitled Recipe";
  copy.description = typeof copy.description === "string" ? copy.description : "";

  copy.instructions = Array.isArray(copy.instructions)
    ? copy.instructions
        .map((s: any) => (typeof s === "string" ? s : s?.step ?? s?.text ?? s?.instruction ?? ""))
        .filter((s: string) => typeof s === "string" && s.trim())
    : [];

  copy.tags = Array.isArray(copy.tags) ? copy.tags.filter((t: any) => typeof t === "string") : [];

  const n = copy.nutrition ?? {};
  copy.nutrition = {
    calories: toNumber(n.calories, 0),
    protein: String(n.protein ?? "—"),
    carbs: String(n.carbs ?? "—"),
    fat: String(n.fat ?? "—"),
  };

  copy.servings = Math.max(1, Math.round(toNumber(copy.servings, 4)));
  copy.prepTimeMinutes = Math.round(toNumber(copy.prepTimeMinutes, 0));
  copy.cookTimeMinutes = Math.round(toNumber(copy.cookTimeMinutes, 0));
  copy.matchScore = Math.round(toNumber(copy.matchScore, 0));
  copy.healthScore = Math.round(toNumber(copy.healthScore, 0));
  copy.difficulty = typeof copy.difficulty === "string" ? copy.difficulty : "Medium";
  copy.costTier = typeof copy.costTier === "string" ? copy.costTier : "Medium";
  copy.servingScaleMultipliers = Array.isArray(copy.servingScaleMultipliers) ? copy.servingScaleMultipliers : [];

  if (!Array.isArray(copy.ingredientSections) || copy.ingredientSections.length === 0) {
    copy.ingredientSections = Array.isArray(copy.ingredients) && copy.ingredients.length > 0
      ? [{ title: "Ingredients", items: copy.ingredients }]
      : [];
  }
  copy.ingredientSections = expandNestedSections(copy.ingredientSections)
    .filter((s: any) => Array.isArray(s.items) && s.items.length > 0)
    .map((s: any) => ({
      ...s,
      title: typeof s.title === "string" && s.title.trim() ? s.title : "Ingredients",
      items: s.items.map(normalizeIngredient).filter((i: any) => i.name),
    }))
    // a section whose items were all nameless would render as an empty heading
    .filter((s: any) => s.items.length > 0);
  copy.allergenWarning = cleanNullable(copy.allergenWarning);
  // the image prompt reads better as words than as a slug
  if (typeof copy.imageKeyword === "string") copy.imageKeyword = copy.imageKeyword.replace(/[-_]+/g, " ").trim();
  return copy;
};

// --- Settings the user picked in Settings → these were being saved and then ignored.
// The whole profile already arrives with every request; these turn it into prompt text.

const getMeasurementInstruction = (userProfile: any): string =>
  userProfile?.settings?.measurements === 'imperial'
    ? `UNITS: Use IMPERIAL measurements first (cups, tablespoons, ounces, °F), with the metric equivalent in parentheses.`
    : `UNITS: Use METRIC measurements first (grams, millilitres, °C), with the cup/spoon equivalent in parentheses.`;

const getHouseholdInstruction = (userProfile: any): string => {
  const adults = Number(userProfile?.settings?.household?.adults ?? 0);
  const children = Number(userProfile?.settings?.household?.children ?? 0);
  const people = adults + children;
  if (people <= 0) return '';
  const who = [
    adults > 0 ? `${adults} adult${adults === 1 ? '' : 's'}` : null,
    children > 0 ? `${children} child${children === 1 ? '' : 'ren'}` : null,
  ].filter(Boolean).join(' and ');
  const kidNote = children > 0 ? ' Keep at least one option child-friendly and not too spicy.' : '';
  return `HOUSEHOLD: Cooking for ${who}. Set "servings" to ${people} and size the ingredient amounts for ${people} people.${kidNote}`;
};

const getMealStyleInstruction = (userProfile: any): string => {
  switch (userProfile?.settings?.aiPersona?.mealStyle) {
    case 'Quick':    return `STYLE: The user prefers quick, low-effort cooking — few steps and minimal prep.`;
    case 'Gourmet':  return `STYLE: The user prefers gourmet cooking — refined techniques and restaurant-quality results are welcome.`;
    case 'Healthy':  return `STYLE: The user prefers healthy meals — lean protein, vegetables, minimal added sugar and fat.`;
    case 'Budget':   return `STYLE: The user prefers budget cooking — cheap, common ingredients and little waste.`;
    default:         return '';
  }
};

const getSpiceLabel = (tolerance: number): string => {
  if (tolerance <= 25) return 'Mild';
  if (tolerance <= 50) return 'Medium';
  if (tolerance <= 75) return 'Spicy';
  return 'Fiery';
};

router.post("/suggest-recipes", async (req, res) => {
  try {
    const { items, preferences, userProfile, excludeTitles } = req.body;

    // "Generate more" sends what's already on screen so we get fresh dishes back.
    const excludeInstruction = Array.isArray(excludeTitles) && excludeTitles.length > 0
      ? `ALREADY SUGGESTED — do NOT repeat these or close variations of them: ${excludeTitles.slice(0, 30).join(", ")}. Suggest genuinely different dishes.`
      : '';

    const today = new Date().getTime();
    const expiringItems = items.filter((i: any) => {
      if (!i.expiryDate) return false;
      const diff = new Date(i.expiryDate).getTime() - today;
      return diff < 5 * 24 * 60 * 60 * 1000;
    });

    const inventoryList = items.map((i: any) => `${i.name} (${i.quantity} ${i.unit})`).join(", ");
    const expiringList = expiringItems.map((i: any) => i.name).join(", ");

    const dietaryConstraint = preferences?.diet !== 'None' ? `Strictly follow ${preferences?.diet} diet.` : '';
    const cuisineConstraint = preferences?.cuisine !== 'Any' ? `Prefer ${preferences?.cuisine} cuisine.` : '';
    
    const allergyContext = userProfile?.allergies && userProfile.allergies.length > 0
      ? `CRITICAL SAFETY ALERT: User has severe allergies to: ${userProfile.allergies.join(", ")}. Check EVERY ingredient.`
      : `User has no known allergies.`;

    const skillLevel = userProfile?.settings?.skillLevel || 'Intermediate';
    const allowedDifficulties = SKILL_DIFFICULTY_MAP[skillLevel] || ['Easy', 'Medium'];
    const skillInstruction = `SKILL LEVEL: User is ${skillLevel}. Only suggest recipes with difficulty: ${allowedDifficulties.join(' or ')}.`;

    const bucketToTolerance = [12, 37, 62, 87];
    const spiceBucket = userProfile?.settings?.spicinessLevel ?? 1;
    const spiceTolerance = bucketToTolerance[Math.min(spiceBucket, 3)] ?? 50;
    const allowedSpice = getSpiceLevelFromTolerance(spiceTolerance);
    const spiceInstruction = `SPICE TOLERANCE: User prefers ${getSpiceLabel(spiceTolerance)} spice. Only suggest recipes with spiceLevel: ${allowedSpice.join(' or ')}. Set spiciness (1-5) accordingly.`;

    let modeInstruction = "";
    switch (preferences?.mode) {
      case 'Quick': modeInstruction = "Recipes MUST be ready in under 30 minutes."; break;
      case 'Healthy': modeInstruction = "Prioritize high protein, low sugar."; break;
      case 'PantryHero': modeInstruction = "Use as many expiring ingredients as possible."; break;
      case 'Budget': modeInstruction = "Focus on lowest cost per serving."; break;
      default: modeInstruction = "Balance taste, time, and pantry usage.";
    }

    const prompt = `
      Act as an expert chef and nutritionist.
      I have these ingredients: ${inventoryList || "No items"}.
      Expiring soon: ${expiringList || "None"}.
      Diet: ${dietaryConstraint}
      Cuisine: ${cuisineConstraint}
      Mode: ${modeInstruction}
      ${skillInstruction}
      ${spiceInstruction}
      ${getMeasurementInstruction(userProfile)}
      ${getHouseholdInstruction(userProfile)}
      ${getMealStyleInstruction(userProfile)}
      ${allergyContext}
      ${excludeInstruction}

      Suggest 3 distinct recipes with matchScore (0-100), healthScore (0-100), costTier (Low/Medium/High). Include spiceLevel field (mild/medium/spicy/fiery).
      
      For each recipe's ingredients:
      - Use clear, beginner-friendly measurements (cups, tablespoons, teaspoons)
      - Include metric equivalent in parentheses after amount (e.g., "1 cup (240ml)")
      - Return ingredient sections under the key 'ingredientSections' with the shape:
        [{ title: string, items: [{ name: string, quantity: string, unit?: string }] ]
      - Sections MUST be specific to the recipe (do NOT use fixed categories)
      - MY PANTRY (above) is the source of truth for what I already have. On EVERY item set:
        - status: "Have" if my pantry covers it, "Partial" if I have some but not enough, "Missing" if I have none
        - amountToBuy: for "Partial"/"Missing" only, the amount I still need to buy (omit when status is "Have")
        - substitute: a common swap using what I already have, or null
        - isAllergen: true if the ingredient hits any of my listed allergies
      - If the recipe is simple, return a single section titled "Ingredients"
      - Never return empty sections
      - Mark optional ingredients clearly (e.g., include 'isOptional: true' on item objects)
      - Add cautionNote for ingredients easy to overuse (e.g., salt, spices, hot sauce)
      - Include prepNote for preparation details (e.g., "finely diced", "room temperature", "mashed")
      
      NUTRITION — the numbers above are placeholder zeros, NOT values to copy:
      - Work out "nutrition" from the actual ingredients and quantities of THIS recipe.
      - Report it PER SERVING, not for the whole batch.
      - Every recipe must get its own realistic figures; a rich cake and a green salad
        must not come back with the same numbers.

      TAGS — the client filters on these, so they must be accurate:
      - Include the diet you followed as a tag when one was requested (e.g. "Vegan").
      - Include the cuisine as a tag when one was requested (e.g. "Italian").
      - Then a few descriptive tags of your own.

      Also provide:
      - yieldNote: Brief cooking yield note (e.g., "Makes about 8-10 pancakes")
      - servingScaleMultipliers: array with scaling info for 1x, 2x, 3x batches
      
      Return ONLY valid JSON. Each recipe should include 'ingredientSections' (not a fixed category list).
      Example snippet for a recipe object:
      {
        "title": "Recipe Name",
        "description": "Brief description",
        "imageKeyword": "keyword for image search",
        "matchScore": 85,
        "healthScore": 70,
        "spiciness": 3,
        "spiceLevel": "medium",
        "costTier": "Medium",
        "difficulty": "Easy",
        "prepTimeMinutes": 15,
        "cookTimeMinutes": 30,
        "servings": 4,
        "allergenWarning": null,
        "safe": true,
        "ingredientSections": [{ "title": "Ingredients", "items": [{ "name": "flour", "quantity": "1 cup (120g)", "unit": "cup", "status": "Have", "isAllergen": false, "isOptional": false }, { "name": "buttermilk", "quantity": "1 cup (240ml)", "unit": "cup", "status": "Missing", "amountToBuy": "1 cup", "substitute": "milk + 1 tbsp lemon juice", "isAllergen": false, "isOptional": false }] }],
        "instructions": [],
        "nutrition": {"calories": 0, "protein": "0g", "carbs": "0g", "fat": "0g"},
        "tags": [],
        "yieldNote": "Makes 4 servings",
        "servingScaleMultipliers": []
      }
    `;

    const response = await getAIClient().chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || '{"recipes":[]}';
    const parsed = JSON.parse(content);
    // the model doesn't always use the "recipes" key — take whatever array came back
    const recipes: any[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.recipes)
        ? parsed.recipes
        : (Object.values(parsed ?? {}).find(v => Array.isArray(v)) as any[] | undefined) ?? [];
    // Pin the video now, once, and store it on the recipe. Looking it up each time a
    // card was opened meant the same dish could show a different video on every view.
    const result = await Promise.all(
      recipes.map(async (r: any) => {
        const recipe = normalizeRecipe(r);
        return { ...recipe, id: randomUUID(), ...(await resolveRecipeVideo(recipe.title)) };
      })
    );
    res.json(result);
  } catch (error: any) {
    console.error("Recipe Generation Error:", error?.message || error);
    res.status(500).json({ error: "Failed to generate recipes", message: error?.message });
  }
});

router.post("/generate-recipe", async (req, res) => {
  try {
    const { dishName, items, servings, userProfile } = req.body;
    
    const inventoryList = items.map((i: any) => `${i.name} (${i.quantity} ${i.unit})`).join(", ");
    
    const allergyContext = userProfile?.allergies && userProfile.allergies.length > 0
      ? `CRITICAL: User allergic to: ${userProfile.allergies.join(", ")}.`
      : `User has no known allergies.`;

    const skillLevel = userProfile?.settings?.skillLevel || 'Intermediate';
    const allowedDifficulties = SKILL_DIFFICULTY_MAP[skillLevel] || ['Easy', 'Medium'];
    const skillInstruction = `SKILL LEVEL: User is ${skillLevel}. Set recipe difficulty to match their skill (${allowedDifficulties.join(' or ')}).`;

    const bucketToTolerance = [12, 37, 62, 87];
    const spiceBucket = userProfile?.settings?.spicinessLevel ?? 1;
    const spiceTolerance = bucketToTolerance[Math.min(spiceBucket, 3)] ?? 50;
    const allowedSpice = getSpiceLevelFromTolerance(spiceTolerance);
    const spiceInstruction = `SPICE TOLERANCE: User prefers ${getSpiceLabel(spiceTolerance)} spice. Set spiceLevel to one of: ${allowedSpice.join(' or ')}.`;

    const prompt = `
      I want to cook "${dishName}" for ${servings || 4} people.
      MY PANTRY: ${inventoryList || "Empty pantry."}
      ${skillInstruction}
      ${spiceInstruction}
      ${getMeasurementInstruction(userProfile)}
      ${getMealStyleInstruction(userProfile)}
      ${allergyContext}

      Generate the recipe with ingredients status (Have/Missing/Partial). Include spiceLevel field (mild/medium/spicy/fiery).
      
      For ingredients:
      - Use clear, beginner-friendly measurements (cups, tablespoons, teaspoons)
      - Include metric equivalent in parentheses after amount (e.g., "1 cup (240ml)", "2 tbsp (30g)")
      - Return 'ingredientSections' with the shape: [{ title: string, items: [{ name: string, quantity: string, unit?: string }] }]
      - Sections MUST be specific to the recipe. Do NOT use fixed categories like "Dry Ingredients" or "Wet Ingredients"
      - MY PANTRY (above) is the source of truth for what I already have. On EVERY item set:
        - status: "Have" if my pantry covers it, "Partial" if I have some but not enough, "Missing" if I have none
        - amountToBuy: for "Partial"/"Missing" only, the amount I still need to buy (omit when status is "Have")
        - substitute: a common swap using what I already have, or null
        - isAllergen: true if the ingredient hits any of my listed allergies
      - If the recipe is simple, return a single section titled "Ingredients"
      - Never return empty sections
      - Mark optional ingredients clearly with isOptional: true
      - Add cautionNote for ingredients easy to overuse (e.g., salt, chili, hot sauce)
      - Include prepNote for preparation details (e.g., "finely diced", "room temperature", "mashed", "peeled")
      
      Also provide:
      - yieldNote: Brief cooking yield note (e.g., "Makes about 8-10 pancakes", "Makes 4 portions")
      - servingScaleMultipliers: array with scaling info for 1x, 2x, 3x batches showing multiplier, servings, and yield
      
      Return ONE JSON recipe object at the TOP LEVEL — do NOT nest it under a "recipe" key.
      It MUST include: "title" (the dish name — not "name"), "description", "imageKeyword",
      "servings", "prepTimeMinutes", "cookTimeMinutes", "difficulty", "costTier",
      "instructions" (array of plain step strings), "tags",
      and "nutrition" as {"calories": number, "protein": "0g", "carbs": "0g", "fat": "0g"}.
      Work the nutrition out from THIS recipe's actual ingredients and report it PER
      SERVING. The zeros above are placeholders — do not copy them back.
    `;

    const response = await getAIClient().chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const raw = response.choices[0]?.message?.content || "{}";
    const recipe = JSON.parse(raw);

    const normalized = normalizeRecipe(recipe);
    res.json({
      ...normalized,
      id: randomUUID(),
      ...(await resolveRecipeVideo(normalized.title)),
    });
  } catch (error: any) {
    console.error("Dish Generation Error:", error?.message || error);
    res.status(500).json({ error: "Failed to generate recipe", message: error?.message });
  }
});

// The meal planner renders plan.days[].meals[].missingIngredients directly, so a
// response missing any of those layers used to white-screen the page — and because the
// plan is cached in localStorage, it stayed broken on every later visit. Force the
// shape here no matter what the model returns.
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner"];

const normalizeMealPlan = (raw: any) => {
  const source = raw?.days ? raw : (raw?.mealPlan ?? raw?.plan ?? raw ?? {});
  const rawDays = Array.isArray(source?.days) ? source.days : [];

  const days = rawDays.map((d: any, i: number) => {
    let meals: any[] = Array.isArray(d?.meals) ? d.meals : [];

    // some responses hang breakfast/lunch/dinner straight off the day object
    if (meals.length === 0) {
      meals = MEAL_TYPES
        .map(type => {
          const entry = d?.[type.toLowerCase()];
          if (!entry) return null;
          return typeof entry === "string" ? { type, title: entry } : { type, ...entry };
        })
        .filter(Boolean) as any[];
    }

    return {
      day: typeof d?.day === "string" && d.day.trim() ? d.day : `Day ${i + 1}`,
      meals: meals.map((m: any, j: number) => ({
        type: typeof m?.type === "string" && m.type.trim() ? m.type : (MEAL_TYPES[j] ?? "Meal"),
        title: typeof m?.title === "string" ? m.title : "Untitled",
        description: typeof m?.description === "string" ? m.description : "",
        missingIngredients: Array.isArray(m?.missingIngredients)
          ? m.missingIngredients.filter((x: any) => typeof x === "string" && x.trim())
          : [],
      })),
    };
  });

  return {
    weekOf: typeof source?.weekOf === "string" ? source.weekOf : "This week",
    days,
  };
};

// --- Cooking videos -------------------------------------------------------------
// Resolves a dish name to a real YouTube cooking video. YouTube's Data API needs a
// key, so this reads the public search page and pulls the first video id out of it.
// Results are cached because that page is ~1.2MB per lookup.
const videoCache = new Map<string, { videoId: string; title: string | null }>();
const VIDEO_CACHE_MAX = 300;

const decodeJsonText = (s: string): string => {
  try { return JSON.parse(`"${s}"`); } catch { return s; }
};

const searchCookingVideo = async (query: string) => {
  const key = query.trim().toLowerCase();
  if (videoCache.has(key)) return videoCache.get(key)!;

  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`; // sp = filter to videos
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const page = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!page.ok) return null;
    const html = await page.text();

    const idMatch = html.match(/"videoId":"([A-Za-z0-9_-]{11})"/);
    if (!idMatch) return null;
    const titleMatch = html.match(/"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/);

    const found = { videoId: idMatch[1], title: titleMatch ? decodeJsonText(titleMatch[1]) : null };
    if (videoCache.size >= VIDEO_CACHE_MAX) videoCache.delete(videoCache.keys().next().value as string);
    videoCache.set(key, found);
    return found;
  } catch (err: any) {
    console.error("Video search error:", err?.message || err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Resolves the cooking video for a dish once, at recipe-generation time, so it can be
 * stored on the recipe. Search results shift over time, so looking it up on every open
 * meant the same recipe could show a different video each view — this pins it.
 * A failure here must never fail the recipe, so it degrades to no video.
 */
const resolveRecipeVideo = async (
  title: string
): Promise<{ videoUrl?: string; videoTitle?: string }> => {
  if (!title || title === "Untitled Recipe") return {};
  try {
    const found = await searchCookingVideo(`${title} recipe how to make`);
    if (!found) return {};
    return {
      videoUrl: `https://www.youtube-nocookie.com/embed/${found.videoId}?rel=0&modestbranding=1`,
      videoTitle: found.title ?? undefined,
    };
  } catch {
    return {};
  }
};

router.post("/find-video", async (req, res) => {
  const { dishName } = req.body ?? {};
  if (typeof dishName !== "string" || !dishName.trim()) {
    return res.status(400).json({ error: "dishName is required" });
  }
  const query = `${dishName.trim()} recipe how to make`;
  const found = await searchCookingVideo(query);
  // The watch link always works, so the client can offer it even when no id resolved.
  const watchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  if (!found) return res.json({ videoId: null, title: null, embedUrl: null, watchUrl });
  res.json({
    videoId: found.videoId,
    title: found.title,
    embedUrl: `https://www.youtube-nocookie.com/embed/${found.videoId}?rel=0&modestbranding=1`,
    watchUrl: `https://www.youtube.com/watch?v=${found.videoId}`,
  });
});

router.post("/generate-meal-plan", async (req, res) => {
  try {
    const { items, userProfile } = req.body;
    
    const inventoryList = items.map((i: any) => i.name).join(", ");
    const today = new Date().getTime();
    const expiringList = items
      .filter((i: any) => i.expiryDate && (new Date(i.expiryDate).getTime() - today < 5 * 24 * 3600 * 1000))
      .map((i: any) => i.name)
      .join(", ");

    const skillLevel = userProfile?.settings?.skillLevel || 'Intermediate';
    const allowedDifficulties = SKILL_DIFFICULTY_MAP[skillLevel] || ['Easy', 'Medium'];
    const skillInstruction = `User skill: ${skillLevel}. Suggest meals appropriate for ${allowedDifficulties.join(' or ')} difficulty level.`;

    const prompt = `
      Create a 7-day meal plan (Mon-Sun).
      Inventory: ${inventoryList}.
      Expiring Soon (use early): ${expiringList}.
      ${skillInstruction}
      ${getHouseholdInstruction(userProfile)}
      ${getMealStyleInstruction(userProfile)}
      Provide Breakfast, Lunch, Dinner for each day.

      Return ONLY valid JSON in exactly this shape:
      {
        "weekOf": "Week of June 3",
        "days": [
          {
            "day": "Monday",
            "meals": [
              { "type": "Breakfast", "title": "Dish name", "description": "One line.", "missingIngredients": ["item"] },
              { "type": "Lunch", "title": "...", "description": "...", "missingIngredients": [] },
              { "type": "Dinner", "title": "...", "description": "...", "missingIngredients": [] }
            ]
          }
        ]
      }
      "days" MUST be an array of 7 objects. Every day MUST have a "meals" array.
      "missingIngredients" MUST always be an array (use [] when nothing is missing).
    `;

    const response = await getAIClient().chat.completions.create({
      model: MODEL_NAME,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const plan = JSON.parse(response.choices[0]?.message?.content || "{}");
    res.json({ ...normalizeMealPlan(plan), id: randomUUID() });
  } catch (error: any) {
    console.error("Meal Plan Error:", error?.message || error);
    res.status(500).json({ error: "Failed to generate meal plan", message: error?.message });
  }
});

const FOOD_CATEGORIES = ["Produce", "Dairy", "Meat", "Pantry", "Snacks", "Beverages", "Frozen", "Other"];

const toCategory = (raw: any): string => {
  const match = FOOD_CATEGORIES.find(c => c.toLowerCase() === String(raw ?? "").trim().toLowerCase());
  return match ?? "Other";
};

/**
 * One photo of a fridge shelf should yield the whole shelf, so this returns an array.
 * The model is not reliable about the shape it returns, so accept the variants and drop
 * anything unusable rather than surfacing blank rows.
 */
const normalizeScanItems = (raw: any): any[] => {
  const list: any[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.items)
      ? raw.items
      // a single item returned bare, or under some other key
      : (Object.values(raw ?? {}).find(v => Array.isArray(v)) as any[] | undefined)
        ?? (raw && typeof raw === "object" && (raw.name || raw.item) ? [raw] : []);

  const seen = new Set<string>();
  const items: any[] = [];

  for (const entry of list) {
    const source = typeof entry === "string" ? { name: entry } : entry ?? {};
    const name = [source.name, source.item, source.food, source.label]
      .find((v: any) => typeof v === "string" && v.trim())?.trim();
    if (!name) continue;                       // a nameless row is worse than no row

    const key = name.toLowerCase();
    if (seen.has(key)) {                       // models repeat items within one reply
      const existing = items.find(i => i.name.toLowerCase() === key);
      if (existing) existing.quantity += toNumber(source.quantity, 1);
      continue;
    }
    seen.add(key);

    items.push({
      name,
      category: toCategory(source.category),
      quantity: Math.max(1, Math.round(toNumber(source.quantity, 1))),
      unit: typeof source.unit === "string" && source.unit.trim() ? source.unit.trim() : "pcs",
      expiryDate: cleanNullable(source.expiryDate),
      confidence: Math.min(1, Math.max(0, toNumber(source.confidence, 0.5))),
    });
  }

  return items;
};

router.post("/analyze-image", async (req, res) => {
  try {
    const { base64Image } = req.body;

    if (!base64Image || base64Image.length < 100) {
      return res.status(400).json({ error: "Invalid image data" });
    }

    const response = await getAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are cataloguing food for a pantry app. The photo may show a whole
fridge shelf, a cupboard, or a single item.

List EVERY distinct food or drink item you can see. Rules:
- Ignore anything that isn't food: shelves, containers, hands, packaging with no food in it.
- One row per product. A six-pack of eggs is ONE row with quantity 6, not six rows.
- Name items specifically ("semi-skimmed milk", not "drink"). Use the name on the label.
- Only set expiryDate if a date is genuinely legible in the photo. Never guess or invent
  one. Format it YYYY-MM-DD.
- confidence is how sure you are of the identification, 0 to 1. Be honest — a blurry item
  at the back of a shelf should score low.
- If you truly cannot see any food, return an empty items array.

Return JSON: { "items": [ { "name": string, "category": one of
${FOOD_CATEGORIES.join(" | ")}, "quantity": number, "unit": string (pcs, g, kg, ml, L,
bag, can, bottle, pack), "expiryDate": string|null, "confidence": number } ] }`
            },
            {
              type: "image_url",
              image_url: {
                url: base64Image,
                // the default downsamples, which is what loses small printed expiry dates
                // and items toward the back of a shelf
                detail: "high",
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      // 500 was roughly one item; a shelf can be 15+, and a truncated reply is invalid JSON
      max_tokens: 2000
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
    res.json({ items: normalizeScanItems(parsed) });
  } catch (error: any) {
    console.error("Image Analysis Error:", error?.message || error);
    res.status(500).json({ error: "Failed to analyze image", message: error?.message });
  }
});

export default router;
