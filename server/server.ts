// FIX: The aliased import of Request and Response was not sufficient to resolve
// type conflicts with global DOM types. Using namespaced types from the 'express'
// import (e.g., express.Request) is a more robust way to prevent these issues.
// FIX: Explicitly import Request and Response types from 'express' to resolve type conflicts with global DOM types, which was causing errors throughout the file.
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

type Platform = 'tiktok' | 'youtube' | 'instagram' | 'unknown';

const getPlatform = (url: string): Platform => {
  if (url.includes('tiktok.com')) return 'tiktok';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('instagram.com')) return 'instagram';
  return 'unknown';
}

// FIX: Use the imported Request and Response types to ensure the handler parameters have the correct Express types.
app.post('/analyze', async (req: Request, res: Response) => {
  const { videoUrl } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ error: 'Missing videoUrl in request body' });
  }

  if (!process.env.API_KEY) {
    return res.status(500).json({ error: 'API_KEY is not configured on the server.' });
  }

  const platform = getPlatform(videoUrl);

  if (platform === 'unknown') {
    return res.status(400).json({ error: 'Unsupported video URL. Please use a valid TikTok, YouTube, or Instagram URL.' });
  }

  try {
    let videoTitle = '';
    let videoAuthor = '';
    let prompt = '';

    // For TikTok and YouTube, we can try to fetch metadata to improve accuracy
    if (platform === 'tiktok' || platform === 'youtube') {
      try {
        const oembedUrl = platform === 'tiktok'
          ? `https://www.tiktok.com/oembed?url=${encodeURIComponent(videoUrl)}`
          : `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}`;
          
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
    }

    // Construct the prompt based on available data
    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
    if (videoTitle && videoAuthor) {
      prompt = `From the ${platformName} video titled "${videoTitle}" by author "${videoAuthor}" (URL: ${videoUrl}), please extract the recipe.`;
    } else {
      // Fallback for Instagram or if metadata fetch fails
      console.warn('Falling back to basic prompt for URL:', videoUrl);
      prompt = `From the ${platformName} video at ${videoUrl}, extract the recipe.`;
    }

    console.log("Using prompt:", prompt);
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const recipeSchema = {
      type: Type.OBJECT,
      properties: {
        recipeName: {
          type: Type.STRING,
          description: "The title or name of the recipe.",
        },
        description: {
          type: Type.STRING,
          description: "A brief, enticing description of the dish.",
        },
        ingredients: {
          type: Type.ARRAY,
          description: "A list of all ingredients with quantities and preparation notes.",
          items: {
            type: Type.STRING,
          },
        },
        instructions: {
          type: Type.ARRAY,
          description: "A step-by-step list of instructions to prepare the dish.",
          items: {
            type: Type.STRING,
          },
        },
      },
      required: ["recipeName", "description", "ingredients", "instructions"],
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are an expert recipe bot. Your task is to analyze a video and extract the recipe from it. Respond only with the recipe in a structured JSON format that adheres to the provided schema. Do not include any other text, greetings, or explanations.",
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
