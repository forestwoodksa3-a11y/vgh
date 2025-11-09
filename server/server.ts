// Fix: Correctly import Request and Response types from express.
import express, { Request, Response } from 'express';
import cors from 'cors';
import { GoogleGenAI, Type } from '@google/genai';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

type Platform = 'tiktok' | 'youtube' | 'website';

// This is the internal representation from Gemini
interface RecipeImage {
  url: string;
  description: string;
  category: 'main' | 'step' | 'additional';
}

interface Recipe {
  recipeName: string;
  description: string;
  prepTime?: string; // e.g., "15 minutes"
  cookTime?: string; // e.g., "30 minutes"
  totalTime?: string; // e.g., "45 minutes"
  servings?: string; // e.g., "4 servings"
  ingredients: string[];
  instructions: string[];
  images?: RecipeImage[];
}

// This is the structure for the final API response data
interface RecipeAPIResponseData {
  title: string;
  description: string;
  prep_time: number;
  cook_time: number;
  total_time: number;
  yields: number;
  ingredients: string[];
  instructions: string[];
  image: string | null;
  url: string;
  host: string;
}

const getPlatform = (url: string): Platform => {
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  return 'website';
}

// Helper to parse strings like "15 minutes" into a number
const parseNumericValue = (text?: string): number => {
    if (!text) return 0;
    const match = text.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
};

// Fix: Use the imported Request and Response types for the route handler.
app.post('/analyze', async (req: Request, res: Response) => {
  // Fix: Replaced process.hrtime() with Date.now() for better portability.
  const startTime = Date.now();
  const { sourceUrl } = req.body;

  if (!sourceUrl) {
    return res.status(400).json({ success: false, error: 'Missing sourceUrl in request body' });
  }

  if (!process.env.API_KEY) {
    return res.status(500).json({ success: false, error: 'API_KEY is not configured on the server.' });
  }

  const platform = getPlatform(sourceUrl);

  try {
    let prompt = '';
    let systemInstruction = '';

    if (platform === 'tiktok' || platform === 'youtube') {
      systemInstruction = "You are an expert recipe bot. Your task is to analyze a video and extract the recipe from it. Respond only with the recipe in a structured JSON format that adheres to the provided schema. Do not include any other text, greetings, or explanations.";
      
      let videoTitle = '';
      let videoAuthor = '';
      
      try {
        const oembedUrl = platform === 'tiktok'
          ? `https://www.tiktok.com/oembed?url=${encodeURIComponent(sourceUrl)}`
          : `https://www.youtube.com/oembed?url=${encodeURIComponent(sourceUrl)}`;
          
        const oembedResponse = await fetch(oembedUrl);
        if (oembedResponse.ok) {
          const oembedData = await oembedResponse.json();
          videoTitle = oembedData.title || '';
          videoAuthor = oembedData.author_name || '';
        }
      } catch (oembedError) {
        console.warn(`Failed to fetch or parse ${platform} oEmbed data:`, oembedError);
      }

      const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
      const titleAuthorInfo = (videoTitle && videoAuthor) ? `titled "${videoTitle}" by author "${videoAuthor}"` : '';

      prompt = `Your primary task is to extract a recipe from the ${platformName} video located at the URL: ${sourceUrl}. The video is reportedly ${titleAuthorInfo}.

Carefully analyze the video's content from beginning to end. Your analysis must be based *only* on the visual and audio information present in the video itself. Do not infer or guess details not shown or mentioned.

From the video, extract the following information with the highest possible accuracy:
1.  **Recipe Name:** The name of the dish being made.
2.  **Description:** A short summary of the final dish.
3.  **Ingredients:** A complete list of all ingredients shown or mentioned, including precise quantities and measurements (e.g., "1 cup flour", "2 tbsp olive oil").
4.  **Instructions:** A step-by-step guide on how to make the recipe, as demonstrated in the video.
5.  **Prep Time:** The preparation time, if mentioned (e.g., "15 minutes").
6.  **Cook Time:** The cooking time, if mentioned (e.g., "30 minutes").
7.  **Total Time:** The total time (prep + cook) to make the recipe, if mentioned.
8.  **Servings:** The number of servings the recipe makes, if mentioned (e.g., "4 servings").`;

    } else { // 'website'
      systemInstruction = "You are an expert recipe web scraper and formatter. Your task is to extract only the core recipe content from the provided URL's webpage, including all relevant images. You MUST ignore all non-recipe content like headers, footers, navigation bars, ads, user comments, and any sections containing links to other recipes (e.g., 'More Recipes', 'You Might Also Like'). Respond only with the recipe in a structured JSON format that adheres to the provided schema. Do not include any other text, greetings, or explanations.";
      prompt = `Scrape the recipe from the webpage at this URL: ${sourceUrl}. Extract the exact step-by-step instructions and ingredients from the main body of the page. Extract the following details: the recipe's name, a brief description of the dish, the preparation time, the cooking time, the total time, the number of servings, and all relevant images. You must categorize each image found: 1. The primary 'main' image of the finished dish (the hero or thumbnail image). 2. Any 'step' images that visually correspond to a specific instruction. 3. Any other 'additional' photos of the dish. For each image, provide its full, direct URL, a concise description, and its category ('main', 'step', or 'additional').`;
    }
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const properties: any = {
      recipeName: { type: Type.STRING, description: "The title or name of the recipe." },
      description: { type: Type.STRING, description: "A brief, enticing description of the dish." },
      prepTime: { type: Type.STRING, description: "Preparation time, e.g., '15 minutes'." },
      cookTime: { type: Type.STRING, description: "Cooking time, e.g., '30 minutes'." },
      totalTime: { type: Type.STRING, description: "Total time (prep + cook), e.g., '45 minutes'." },
      servings: { type: Type.STRING, description: "Number of servings the recipe makes, e.g., '4 servings'." },
      ingredients: { type: Type.ARRAY, description: "A list of all ingredients with quantities.", items: { type: Type.STRING } },
      instructions: { type: Type.ARRAY, description: "A step-by-step list of instructions.", items: { type: Type.STRING } },
    };

    if (platform === 'website') {
      properties.images = { 
        type: Type.ARRAY, 
        description: "A list of relevant images from the webpage. Each image must be categorized as 'main', 'step', or 'additional'.",
        items: { 
          type: Type.OBJECT, 
          properties: {
            url: { type: Type.STRING, description: "The full, direct URL to the image file." },
            description: { type: Type.STRING, description: "A brief description of the image content." },
            category: { 
              type: Type.STRING, 
              description: "The category of the image: 'main' for the primary dish photo, 'step' for an instructional photo, or 'additional' for other relevant photos.",
              enum: ['main', 'step', 'additional']
            }
          },
          required: ["url", "description", "category"]
        } 
      };
    }

    const recipeSchema = {
      type: Type.OBJECT,
      properties,
      required: ["recipeName", "description", "ingredients", "instructions"],
    };

    const genAIResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: recipeSchema,
      },
    });

    const recipeJsonString = genAIResponse.text;
    
    if (!recipeJsonString) {
      throw new Error('Failed to get recipe data from AI. The response was empty.');
    }

    let recipe: Recipe;
    try {
      recipe = JSON.parse(recipeJsonString);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', recipeJsonString, parseError);
      throw new Error('Failed to parse recipe data from AI. The format was invalid.');
    }

    if (recipe.images && platform === 'website') {
      recipe.images = recipe.images
        .map(image => {
          if (!image.url) return null;
          try {
            const absoluteUrl = new URL(image.url, sourceUrl).href;
            return { ...image, url: absoluteUrl };
          } catch (e) {
            console.warn(`Invalid image URL found and skipped: ${image.url}`);
            return null;
          }
        })
        .filter((image): image is RecipeImage => image !== null);
    }

    // Fix: Replaced process.hrtime() with Date.now() and updated calculation.
    const endTime = Date.now();
    const processingTime = parseFloat(((endTime - startTime) / 1000).toFixed(3));

    const mainImage = recipe.images?.find(img => img.category === 'main') || recipe.images?.[0] || null;

    const data: RecipeAPIResponseData = {
      title: recipe.recipeName,
      description: recipe.description,
      prep_time: parseNumericValue(recipe.prepTime),
      cook_time: parseNumericValue(recipe.cookTime),
      total_time: parseNumericValue(recipe.totalTime),
      yields: parseNumericValue(recipe.servings),
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      image: mainImage?.url || null,
      url: sourceUrl,
      host: new URL(sourceUrl).hostname,
    };

    res.json({
      success: true,
      source: platform,
      processing_time: processingTime,
      data: data,
    });

  } catch (error) {
    console.error('Error during Gemini API call:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    res.status(500).json({ success: false, error: `Failed to get recipe. ${errorMessage}` });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});