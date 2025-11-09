// FIX: The aliased import of Request and Response was not sufficient to resolve
// type conflicts with global DOM types. Using namespaced types from the 'express'
// import (e.g., express.Request) is a more robust way to prevent these issues.
import express from 'express';
import cors from 'cors';
import { GoogleGenAI, Type } from '@google/genai';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

app.post('/analyze', async (req: express.Request, res: express.Response) => {
  const { tiktokUrl } = req.body;

  if (!tiktokUrl) {
    return res.status(400).json({ error: 'Missing tiktokUrl in request body' });
  }

  if (!process.env.API_KEY) {
    return res.status(500).json({ error: 'API_KEY is not configured on the server.' });
  }

  try {
    // --- New logic to fetch video metadata for a more accurate prompt ---
    let videoTitle = '';
    let videoAuthor = '';
    let prompt = '';

    try {
      console.log(`Fetching metadata for: ${tiktokUrl}`);
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`;
      const oembedResponse = await fetch(oembedUrl);
      if (oembedResponse.ok) {
        const oembedData = await oembedResponse.json();
        videoTitle = oembedData.title || '';
        videoAuthor = oembedData.author_name || '';
        console.log(`Found metadata: Title - "${videoTitle}", Author - "${videoAuthor}"`);
      } else {
        console.warn(`Could not fetch TikTok oEmbed metadata. Status: ${oembedResponse.status}`);
      }
    } catch (oembedError) {
      console.warn('Failed to fetch or parse TikTok oEmbed data:', oembedError);
    }

    if (videoTitle && videoAuthor) {
      prompt = `From the TikTok video titled "${videoTitle}" by author "${videoAuthor}" (URL: ${tiktokUrl}), please extract the recipe.`;
    } else {
      // Fallback to the original prompt if metadata couldn't be fetched
      console.warn('Falling back to basic prompt.');
      prompt = `From the TikTok video at ${tiktokUrl}, extract the recipe.`;
    }
    // --- End of new logic ---

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
        systemInstruction: "You are an expert recipe bot. Your task is to analyze a TikTok video and extract the recipe from it. Respond only with the recipe in a structured JSON format that adheres to the provided schema. Do not include any other text, greetings, or explanations.",
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