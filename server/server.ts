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
      systemInstruction = "You are an expert recipe web scraper and formatter. Your task is to extract only the core recipe content from the provided URL's webpage, including any images. Ignore all non-recipe content like headers, footers, navigation bars, ads, and user comments. Respond only with the recipe in a structured JSON format that adheres to the provided schema. Do not include any other text, greetings, or explanations.";
      prompt = `Scrape the recipe from the webpage at this URL: ${sourceUrl}. Extract the following details: the recipe's name, a brief description of the dish, all ingredients with their quantities, the complete step-by-step instructions, the preparation time, the cooking time, the number of servings, and all relevant images. For each image, you must provide its full, direct URL and a concise description of what the image shows.`;
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
        description: "A list of relevant image URLs from the webpage, including the main dish photo and any step-by-step images. For each image, provide its full URL and a brief description of what it depicts.",
        items: { 
          type: Type.OBJECT, 
          properties: {
            url: { type: Type.STRING, description: "The full, direct URL to the image file." },
            description: { type: Type.STRING, description: "A brief description of the image content." }
          },
          required: ["url", "description"]
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

    const imagesHtml = recipe.images?.map(img => `
      <figure class="my-4">
        <img src="${img.url}" alt="${img.description}" class="w-full h-auto rounded-lg shadow-md object-cover" loading="lazy" />
        <figcaption class="text-center text-sm text-gray-400 mt-2">${img.description}</figcaption>
      </figure>
    `).join('') || '';

    const ingredientsHtml = recipe.ingredients.map(item => `<li>${item}</li>`).join('');
    const instructionsHtml = recipe.instructions.map(item => `<li>${item}</li>`).join('');

    const recipeHtml = `
      <div>
        ${imagesHtml.length > 0 ? `<div class="mb-6">${imagesHtml}</div>` : ''}
        <h3 class="text-3xl font-bold !text-purple-300 !mt-0">${recipe.recipeName}</h3>
        <p class="!text-gray-300 italic mt-2">${recipe.description}</p>
        
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