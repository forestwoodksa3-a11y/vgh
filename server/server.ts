
// Fix: Changed express import and type annotations to resolve type errors with Request and Response objects.
// Fix: Correctly import Request and Response types from express.
import express, { Request, Response } from 'express';
import cors from 'cors';
import { GoogleGenAI, Type } from '@google/genai';
import { config } from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables from .env file
config();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// --- Helper Functions ---

const getUrlType = (url: string): 'youtube' | 'tiktok' | 'instagram' | 'website' | 'unknown' => {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/tiktok\.com/.test(url)) return 'tiktok';
  if (/instagram\.com/.test(url)) return 'instagram';
  const urlRegex = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
  if (urlRegex.test(url)) return 'website';
  return 'unknown';
}

const getOembedData = async (url: string, endpoint: string): Promise<{ title: string, author_name: string } | null> => {
  try {
    const response = await fetch(`${endpoint}?url=${encodeURIComponent(url)}&format=json`);
    if (!response.ok) return null;
    return await response.json() as { title: string, author_name: string };
  } catch (error) {
    console.error('Failed to fetch oEmbed data:', error);
    return null;
  }
}


// Fix: Use imported Request and Response types for handler parameters.
app.post('/analyze', async (req: Request, res: Response) => {
  const { sourceUrl } = req.body;

  if (!sourceUrl) {
    return res.status(400).json({ error: 'Missing sourceUrl in request body' });
  }

  if (!process.env.API_KEY) {
    return res.status(500).json({ error: 'API_KEY is not configured on the server.' });
  }

  const urlType = getUrlType(sourceUrl);

  if (urlType === 'unknown') {
    return res.status(400).json({ error: 'Invalid or unsupported URL format provided.' });
  }

  try {
    let prompt: string;
    let systemInstruction: string;
    
    // --- Prompt Generation Logic ---
    if (urlType === 'website') {
      systemInstruction = "You are an expert web scraping AI specializing in recipes. Your task is to visit a given URL, parse the HTML to find the core recipe, and then extract and structure the recipe information into a precise JSON format. You must ignore all non-recipe content on the page like ads, comments, and navigation elements. Respond only with the recipe in the specified JSON format.";
      prompt = `Please visit the following URL: ${sourceUrl}. Analyze the webpage to find the main recipe content. Scrape and extract only the essential recipe information. From the core recipe, please provide the recipe name, a brief description, a list of all ingredients, and the step-by-step instructions. Format this information into a clean JSON object that adheres to the schema provided.`;
    } else { // Video logic
      systemInstruction = "You are an AI assistant skilled at analyzing video content to extract recipes. Your task is to determine the recipe being prepared in a given video and structure its information into a precise JSON format. Respond only with the recipe in the specified JSON format.";
      let videoInfo = `the video at this URL: ${sourceUrl}`;
      
      if(urlType === 'youtube') {
          const data = await getOembedData(sourceUrl, 'https://www.youtube.com/oembed');
          if (data) videoInfo = `the YouTube video titled "${data.title}" by "${data.author_name}"`;
      } else if (urlType === 'tiktok') {
          const data = await getOembedData(sourceUrl, 'https://www.tiktok.com/oembed');
          if (data) videoInfo = `the TikTok video titled "${data.title}" by "${data.author_name}"`;
      }
      
      prompt = `From the content of ${videoInfo}, please extract the recipe being made. Provide the recipe name, a brief description, a list of all ingredients, and the step-by-step instructions. Format this information into a clean JSON object that adheres to the schema provided.`;
    }


    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const recipeSchema = {
      type: Type.OBJECT,
      properties: {
        recipeName: { type: Type.STRING, description: "The title or name of the recipe." },
        description: { type: Type.STRING, description: "A brief, enticing description of the dish." },
        ingredients: { type: Type.ARRAY, description: "A list of all ingredients with quantities.", items: { type: Type.STRING } },
        instructions: { type: Type.ARRAY, description: "Step-by-step instructions to prepare the dish.", items: { type: Type.STRING } },
      },
      required: ["recipeName", "description", "ingredients", "instructions"],
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: recipeSchema,
      },
    });

    res.json({ recipe: response.text });

  } catch (error) {
    console.error('Error during Gemini API call:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    res.status(500).json({ error: `Failed to get recipe. ${errorMessage}` });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});