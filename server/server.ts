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

type Platform = 'tiktok' | 'youtube' | 'instagram' | 'website';

interface Recipe {
  recipeName: string;
  description: string;
  ingredients: string[];
  instructions: string[];
}

const getPlatform = (url: string): Platform => {
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('instagram.com')) return 'instagram';
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

  // Handle unsupported Instagram URLs gracefully before making an API call
  if (platform === 'instagram') {
    return res.status(400).json({ 
      error: "Recipe extraction from Instagram is not supported due to their strict content privacy and access restrictions. Please try a URL from TikTok, YouTube, or a public recipe website." 
    });
  }

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
      if (videoTitle && videoAuthor) {
        prompt = `From the ${platformName} video titled "${videoTitle}" by author "${videoAuthor}" (URL: ${sourceUrl}), please extract the recipe.`;
      } else {
        console.warn('Falling back to basic prompt for URL:', sourceUrl);
        prompt = `From the ${platformName} video at ${sourceUrl}, extract the recipe.`;
      }

    } else {
      systemInstruction = "You are an expert recipe web scraper and formatter. Your task is to extract only the core recipe content from the provided URL's webpage. Ignore all non-recipe content like headers, footers, navigation bars, ads, and user comments. Respond only with the recipe in a structured JSON format that adheres to the provided schema. Do not include any other text, greetings, or explanations.";
      prompt = `Please extract the recipe from the content of the following URL: ${sourceUrl}.`;
    }

    console.log("Using prompt:", prompt);
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const recipeSchema = {
      type: Type.OBJECT,
      properties: {
        recipeName: { type: Type.STRING, description: "The title or name of the recipe." },
        description: { type: Type.STRING, description: "A brief, enticing description of the dish." },
        ingredients: { type: Type.ARRAY, description: "A list of all ingredients with quantities.", items: { type: Type.STRING } },
        instructions: { type: Type.ARRAY, description: "A step-by-step list of instructions.", items: { type: Type.STRING } },
      },
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
    let recipe: Recipe;
    try {
      recipe = JSON.parse(recipeJsonString);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', recipeJsonString, parseError);
      return res.status(500).json({ error: 'Failed to parse recipe data from AI. The format was invalid.' });
    }

    // Generate HTML on the backend
    const ingredientsHtml = recipe.ingredients.map(item => `<li>${item}</li>`).join('');
    const instructionsHtml = recipe.instructions.map(item => `<li>${item}</li>`).join('');

    const recipeHtml = `
      <div>
        <h3 class="text-2xl font-bold !text-purple-300 !mt-0">${recipe.recipeName}</h3>
        <p class="!text-gray-300 italic">${recipe.description}</p>
        
        <h4 class="text-xl font-bold !text-indigo-300 mt-6 mb-2">Ingredients</h4>
        <ul class="list-disc list-inside !text-gray-300 space-y-1">
          ${ingredientsHtml}
        </ul>

        <h4 class="text-xl font-bold !text-indigo-300 mt-6 mb-2">Instructions</h4>
        <ol class="list-decimal list-inside !text-gray-300 space-y-2">
          ${instructionsHtml}
        </ol>
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
