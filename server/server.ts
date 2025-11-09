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

interface RecipeImage {
  url: string;
  description: string;
  category: 'main' | 'step' | 'additional';
}

interface Recipe {
  recipeName: string;
  description: string;
  prepTime?: string;
  cookTime?: string;
  servings?: string;
  ingredients: string[];
  instructions: string[];
  images?: RecipeImage[];
}

const getPlatform = (url: string): Platform => {
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  return 'website';
}

// Fix: Use the imported Request and Response types for the route handler.
app.post('/analyze', async (req: Request, res: Response) => {
  const { sourceUrl } = req.body;

  if (!sourceUrl) {
    return res.status(400).json({ error: 'Missing sourceUrl in request body' });
  }

  if (!process.env.API_KEY) {
    return res.status(500).json({ error: 'API_KEY is not configured on the server.' });
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
          
        console.log(`Fetching metadata for ${platform}: ${oembedUrl}`);
        const oembedResponse = await fetch(oembedUrl);
        if (oembedResponse.ok) {
          const oembedData = await oembedResponse.json();
          videoTitle = oembedData.title || '';
          videoAuthor = oembedData.author_name || '';
          console.log(`Found metadata: Title - "${videoTitle}", Author - "${videoAuthor}"`);
        } else {
          console.warn(`Could not fetch ${platform} oEmbed metadata. Status: ${oembedResponse.status}`);
        }
      } catch (oembedError) {
        console.warn(`Failed to fetch or parse ${platform} oEmbed data:`, oembedError);
      }

      const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
      const titleAuthorInfo = (videoTitle && videoAuthor) ? `titled "${videoTitle}" by author "${videoAuthor}"` : '';

      prompt = `Analyze the ${platformName} video ${titleAuthorInfo} available at this URL: ${sourceUrl}. Extract a detailed recipe from the video's content. Your response must include the following details if they are available: ingredients with precise quantities, step-by-step instructions for preparation, the preparation time, the cooking time, and the number of servings this recipe yields.`;

    } else { // 'website'
      systemInstruction = "You are an expert recipe web scraper and formatter. Your task is to extract only the core recipe content from the provided URL's webpage, including all relevant images. You MUST ignore all non-recipe content like headers, footers, navigation bars, ads, user comments, and any sections containing links to other recipes (e.g., 'More Recipes', 'You Might Also Like'). Respond only with the recipe in a structured JSON format that adheres to the provided schema. Do not include any other text, greetings, or explanations.";
      prompt = `Scrape the recipe from the webpage at this URL: ${sourceUrl}. Extract the exact step-by-step instructions and ingredients from the main body of the page. Extract the following details: the recipe's name, a brief description of the dish, the preparation time, the cooking time, the number of servings, and all relevant images. You must categorize each image found: 1. The primary 'main' image of the finished dish (the hero or thumbnail image). 2. Any 'step' images that visually correspond to a specific instruction. 3. Any other 'additional' photos of the dish. For each image, provide its full, direct URL, a concise description, and its category ('main', 'step', or 'additional').`;
    }

    console.log("Using prompt:", prompt);
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const properties: any = {
      recipeName: { type: Type.STRING, description: "The title or name of the recipe." },
      description: { type: Type.STRING, description: "A brief, enticing description of the dish." },
      prepTime: { type: Type.STRING, description: "Preparation time, e.g., '15 minutes'." },
      cookTime: { type: Type.STRING, description: "Cooking time, e.g., '30 minutes'." },
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
      console.error('Gemini API returned an empty response.');
      return res.status(500).json({ error: 'Failed to get recipe data from AI. The response was empty.' });
    }

    let recipe: Recipe;
    try {
      recipe = JSON.parse(recipeJsonString);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', recipeJsonString, parseError);
      return res.status(500).json({ error: 'Failed to parse recipe data from AI. The format was invalid.' });
    }

    // Fix image URLs to be absolute
    if (recipe.images && platform === 'website') {
      recipe.images = recipe.images
        .map(image => {
          if (!image.url) return null; // Filter out images without URLs
          try {
            // Resolve relative URLs against the source URL of the recipe page
            const absoluteUrl = new URL(image.url, sourceUrl).href;
            return { ...image, url: absoluteUrl };
          } catch (e) {
            // If URL is invalid (e.g., malformed), filter it out
            console.warn(`Invalid image URL found and skipped: ${image.url}`);
            return null;
          }
        })
        .filter((image): image is RecipeImage => image !== null);
    }


    // Generate HTML on the backend
    const additionalInfoHtml = [
      recipe.prepTime ? `<li><strong class="font-semibold text-indigo-400">Prep Time:</strong> ${recipe.prepTime}</li>` : '',
      recipe.cookTime ? `<li><strong class="font-semibold text-indigo-400">Cook Time:</strong> ${recipe.cookTime}</li>` : '',
      recipe.servings ? `<li><strong class="font-semibold text-indigo-400">Servings:</strong> ${recipe.servings}</li>` : '',
    ].filter(Boolean).join('');

    const mainImage = recipe.images?.find(img => img.category === 'main');
    const otherImages = recipe.images?.filter(img => img.category !== 'main') || [];

    const mainImageHtml = mainImage ? `
      <figure class="my-4">
        <img src="${mainImage.url}" alt="${mainImage.description}" class="w-full h-auto rounded-lg shadow-md object-cover" loading="lazy" />
        <figcaption class="text-center text-sm text-gray-400 mt-2">${mainImage.description}</figcaption>
      </figure>
    ` : '';
    
    const otherImagesHtml = otherImages.length > 0 ? `
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4 my-4">
        ${otherImages.map(img => `
          <figure>
            <img src="${img.url}" alt="${img.description}" class="w-full h-auto rounded-lg shadow-md object-cover aspect-square" loading="lazy" />
            <figcaption class="text-center text-xs text-gray-400 mt-1">${img.description}</figcaption>
          </figure>
        `).join('')}
      </div>
    ` : '';

    const ingredientsHtml = recipe.ingredients.map(item => `<li>${item}</li>`).join('');
    const instructionsHtml = recipe.instructions.map(item => `<li>${item}</li>`).join('');

    const recipeHtml = `
      <div>
        ${mainImageHtml}
        <h3 class="text-3xl font-bold !text-purple-300 !mt-0">${recipe.recipeName}</h3>
        <p class="!text-gray-300 italic mt-2">${recipe.description}</p>
        
        ${otherImagesHtml}

        ${additionalInfoHtml.length > 0 ? `
          <div class="my-6 p-4 bg-gray-900/70 rounded-lg border border-gray-700">
            <ul class="flex flex-wrap items-center gap-x-6 gap-y-2 !text-gray-300">
              ${additionalInfoHtml}
            </ul>
          </div>
        ` : ''}
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 mt-6">
          <div>
            <h4 class="text-xl font-bold !text-indigo-300 mb-2">Ingredients</h4>
            <ul class="list-disc list-inside !text-gray-300 space-y-1">
              ${ingredientsHtml}
            </ul>
          </div>
          <div>
            <h4 class="text-xl font-bold !text-indigo-300 mb-2">Instructions</h4>
            <ol class="list-decimal list-inside !text-gray-300 space-y-2">
              ${instructionsHtml}
            </ol>
          </div>
        </div>
      </div>
    `;

    res.json({ html: recipeHtml });

  } catch (error) {
    console.error('Error during Gemini API call:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    res.status(500).json({ error: `Failed to get recipe. ${errorMessage}` });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});