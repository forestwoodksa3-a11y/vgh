// FIX: Alias Request and Response to ExpressRequest and ExpressResponse to prevent
// potential type conflicts with global DOM types that can cause compilation errors.
import express, { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import cors from 'cors';
import { GoogleGenAI, Type } from '@google/genai';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

app.post('/analyze', async (req: ExpressRequest, res: ExpressResponse) => {
  const { tiktokUrl } = req.body;

  if (!tiktokUrl) {
    return res.status(400).json({ error: 'Missing tiktokUrl in request body' });
  }

  if (!process.env.API_KEY) {
    return res.status(500).json({ error: 'API_KEY is not configured on the server.' });
  }

  try {
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

    const prompt = `From the TikTok video at ${tiktokUrl}, extract the recipe.`;

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
