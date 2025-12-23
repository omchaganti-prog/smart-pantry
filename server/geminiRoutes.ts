import { Router } from "express";
import { GoogleGenAI, Type } from "@google/genai";
import { randomUUID } from "crypto";

const router = Router();
const MODEL_NAME = "gemini-2.5-flash";

let ai: GoogleGenAI | null = null;

const getAIClient = (): GoogleGenAI => {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
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

const getSpiceLabel = (tolerance: number): string => {
  if (tolerance <= 25) return 'Mild';
  if (tolerance <= 50) return 'Medium';
  if (tolerance <= 75) return 'Spicy';
  return 'Fiery';
};

router.post("/suggest-recipes", async (req, res) => {
  try {
    const { items, preferences, userProfile } = req.body;
    
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
      ${allergyContext}
      
      Suggest 3 distinct recipes with matchScore, healthScore, costTier. Include spiceLevel field (mild/medium/spicy/fiery).
      
      For each recipe's ingredients:
      - Use clear, beginner-friendly measurements (cups, tablespoons, teaspoons)
      - Include metric equivalent in parentheses after amount (e.g., "1 cup (240ml)")
      - Group ingredients by category: "Dry Ingredients", "Wet Ingredients", "Seasonings & Spices", "Add-ins / Optional"
      - Mark optional ingredients clearly
      - Add cautionNote for ingredients easy to overuse (e.g., salt, spices, hot sauce)
      - Include prepNote for preparation details (e.g., "finely diced", "room temperature", "mashed")
      
      Also provide:
      - yieldNote: Brief cooking yield note (e.g., "Makes about 8-10 pancakes")
      - servingScaleMultipliers: array with scaling info for 1x, 2x, 3x batches
    `;

    const response = await getAIClient().models.generateContent({
      model: MODEL_NAME,
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              imageKeyword: { type: Type.STRING },
              matchScore: { type: Type.NUMBER },
              healthScore: { type: Type.NUMBER },
              spiciness: { type: Type.NUMBER },
              spiceLevel: { type: Type.STRING, enum: ["mild", "medium", "spicy", "fiery"] },
              costTier: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
              difficulty: { type: Type.STRING, enum: ["Easy", "Medium", "Hard", "Expert"] },
              prepTimeMinutes: { type: Type.NUMBER },
              cookTimeMinutes: { type: Type.NUMBER },
              servings: { type: Type.NUMBER },
              allergenWarning: { type: Type.STRING, nullable: true },
              safe: { type: Type.BOOLEAN },
              ingredients: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    amount: { type: Type.STRING },
                    category: { type: Type.STRING, enum: ["Dry Ingredients", "Wet Ingredients", "Seasonings & Spices", "Add-ins / Optional"] },
                    status: { type: Type.STRING, enum: ["Have", "Missing"] },
                    substitute: { type: Type.STRING, nullable: true },
                    isAllergen: { type: Type.BOOLEAN },
                    isOptional: { type: Type.BOOLEAN },
                    prepNote: { type: Type.STRING, nullable: true },
                    cautionNote: { type: Type.STRING, nullable: true }
                  },
                  required: ["name", "amount", "category", "status", "isAllergen", "isOptional"]
                }
              },
              instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
              nutrition: {
                type: Type.OBJECT,
                properties: {
                  calories: { type: Type.NUMBER },
                  protein: { type: Type.STRING },
                  carbs: { type: Type.STRING },
                  fat: { type: Type.STRING }
                },
                required: ["calories", "protein", "carbs", "fat"]
              },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              yieldNote: { type: Type.STRING, nullable: true },
              servingScaleMultipliers: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    multiplier: { type: Type.STRING },
                    servings: { type: Type.NUMBER },
                    yield: { type: Type.STRING }
                  },
                  required: ["multiplier", "servings", "yield"]
                }
              }
            },
            required: ["title", "description", "ingredients", "instructions", "nutrition", "matchScore", "healthScore", "costTier", "safe"]
          }
        }
      }
    });

    const recipes = JSON.parse(response.text || "[]");
    const sampleVideos = [
      "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
      "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4"
    ];
    const result = recipes.map((r: any, i: number) => ({ 
      ...r, 
      id: randomUUID(),
      videoUrl: i < sampleVideos.length ? sampleVideos[i] : undefined
    }));
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
      ${allergyContext}
      
      Generate the recipe with ingredients status (Have/Missing/Partial). Include spiceLevel field (mild/medium/spicy/fiery).
      
      For ingredients:
      - Use clear, beginner-friendly measurements (cups, tablespoons, teaspoons)
      - Include metric equivalent in parentheses after amount (e.g., "1 cup (240ml)", "2 tbsp (30g)")
      - Group ingredients by category: "Dry Ingredients", "Wet Ingredients", "Seasonings & Spices", "Add-ins / Optional"
      - Mark optional ingredients clearly with isOptional: true
      - Add cautionNote for ingredients easy to overuse (e.g., salt, chili, hot sauce)
      - Include prepNote for preparation details (e.g., "finely diced", "room temperature", "mashed", "peeled")
      
      Also provide:
      - yieldNote: Brief cooking yield note (e.g., "Makes about 8-10 pancakes", "Makes 4 portions")
      - servingScaleMultipliers: array with scaling info for 1x, 2x, 3x batches showing multiplier, servings, and yield
    `;

    const response = await getAIClient().models.generateContent({
      model: MODEL_NAME,
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            imageKeyword: { type: Type.STRING },
            matchScore: { type: Type.NUMBER },
            healthScore: { type: Type.NUMBER },
            spiciness: { type: Type.NUMBER },
            spiceLevel: { type: Type.STRING, enum: ["mild", "medium", "spicy", "fiery"] },
            costTier: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
            difficulty: { type: Type.STRING, enum: ["Easy", "Medium", "Hard", "Expert"] },
            prepTimeMinutes: { type: Type.NUMBER },
            cookTimeMinutes: { type: Type.NUMBER },
            servings: { type: Type.NUMBER },
            allergenWarning: { type: Type.STRING, nullable: true },
            safe: { type: Type.BOOLEAN },
            ingredients: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  amount: { type: Type.STRING },
                  category: { type: Type.STRING, enum: ["Dry Ingredients", "Wet Ingredients", "Seasonings & Spices", "Add-ins / Optional"] },
                  status: { type: Type.STRING, enum: ["Have", "Missing", "Partial"] },
                  amountToBuy: { type: Type.STRING, nullable: true },
                  substitute: { type: Type.STRING, nullable: true },
                  isAllergen: { type: Type.BOOLEAN },
                  isOptional: { type: Type.BOOLEAN },
                  prepNote: { type: Type.STRING, nullable: true },
                  cautionNote: { type: Type.STRING, nullable: true }
                },
                required: ["name", "amount", "category", "status", "isAllergen", "isOptional"]
              }
            },
            instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
            nutrition: {
              type: Type.OBJECT,
              properties: {
                calories: { type: Type.NUMBER },
                protein: { type: Type.STRING },
                carbs: { type: Type.STRING },
                fat: { type: Type.STRING }
              },
              required: ["calories", "protein", "carbs", "fat"]
            },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            yieldNote: { type: Type.STRING, nullable: true },
            servingScaleMultipliers: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  multiplier: { type: Type.STRING },
                  servings: { type: Type.NUMBER },
                  yield: { type: Type.STRING }
                },
                required: ["multiplier", "servings", "yield"]
              }
            }
          },
          required: ["title", "description", "ingredients", "instructions", "nutrition", "matchScore", "healthScore", "costTier", "safe"]
        }
      }
    });

    const recipe = JSON.parse(response.text || "{}");
    res.json({ 
      ...recipe, 
      id: randomUUID(),
      videoUrl: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
    });
  } catch (error: any) {
    console.error("Dish Generation Error:", error?.message || error);
    res.status(500).json({ error: "Failed to generate recipe", message: error?.message });
  }
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
      Provide Breakfast, Lunch, Dinner for each day.
    `;

    const response = await getAIClient().models.generateContent({
      model: MODEL_NAME,
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            weekOf: { type: Type.STRING },
            days: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  day: { type: Type.STRING },
                  meals: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        type: { type: Type.STRING, enum: ["Breakfast", "Lunch", "Dinner"] },
                        title: { type: Type.STRING },
                        description: { type: Type.STRING },
                        missingIngredients: { type: Type.ARRAY, items: { type: Type.STRING } }
                      },
                      required: ["type", "title", "missingIngredients"]
                    }
                  }
                },
                required: ["day", "meals"]
              }
            }
          },
          required: ["weekOf", "days"]
        }
      }
    });

    const plan = JSON.parse(response.text || "{}");
    res.json({ ...plan, id: randomUUID() });
  } catch (error: any) {
    console.error("Meal Plan Error:", error?.message || error);
    res.status(500).json({ error: "Failed to generate meal plan", message: error?.message });
  }
});

router.post("/analyze-image", async (req, res) => {
  try {
    const { base64Image } = req.body;
    
    if (!base64Image || base64Image.length < 100) {
      return res.status(400).json({ error: "Invalid image data" });
    }

    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpg|jpeg|webp);base64,/, "");

    const response = await getAIClient().models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: cleanBase64 } },
          { text: "Analyze this image for a food inventory app. Identify the food item, category, and expiration date if visible. Format date as YYYY-MM-DD." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            category: { type: Type.STRING, enum: ["Produce", "Dairy", "Meat", "Pantry", "Snacks", "Beverages", "Frozen", "Other"] },
            expiryDate: { type: Type.STRING, nullable: true },
            confidence: { type: Type.NUMBER }
          },
          required: ["name", "category", "confidence"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    res.json({
      name: result.name || "Unknown Item",
      category: result.category || "Other",
      expiryDate: result.expiryDate || null,
      confidence: result.confidence || 0.5
    });
  } catch (error: any) {
    console.error("Image Analysis Error:", error?.message || error);
    res.status(500).json({ error: "Failed to analyze image", message: error?.message });
  }
});

export default router;
