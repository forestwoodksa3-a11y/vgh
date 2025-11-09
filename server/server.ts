import express, { Request, Response } from 'express';
import cors from 'cors';
import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// A placeholder function for video processing.
// In a real-world application, this function would download the video from the URL
// and use a library like `ffmpeg` to extract frames into base64 strings.
// This is a complex operation and requires server-side binary dependencies.
async function getVideoFramesFromUrl(url: string): Promise<string[]> {
  console.log(`Simulating download and frame extraction for: ${url}`);
  // This is a mock implementation.
  // A real implementation would involve:
  // 1. Using a library like 'tiktok-scraper' or a similar API to get a direct video download link.
  // 2. Downloading the video buffer.
  // 3. Using 'fluent-ffmpeg' to spawn an ffmpeg process, extract N frames, and save them as temporary files or stream them to buffers.
  // 4. Converting each frame buffer to a base64 string.
  
  // For this example, we'll return an empty array and let Gemini handle the error gracefully.
  // In a real scenario, you'd throw an error if frame extraction fails.
  console.warn("Frame extraction is not implemented in this simulation. The Gemini API call will likely fail without video frames.");
  return [];
}

app.post('/analyze', async (req: Request, res: Response) => {
  const { prompt, tiktokUrl } = req.body;

  if (!prompt || !tiktokUrl) {
    return res.status(400).json({ error: 'Missing prompt or tiktokUrl in request body' });
  }

  if (!process.env.API_KEY) {
    return res.status(500).json({ error: 'API_KEY is not configured on the server.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // In a real implementation, you would extract frames from the downloaded TikTok video.
    // const base64Frames = await getVideoFramesFromUrl(tiktokUrl);
    // if (base64Frames.length === 0) {
    //   throw new Error("Could not extract any frames from the video.");
    // }
    // const imageParts = base64Frames.map(frame => ({
    //   inlineData: {
    //     data: frame,
    //     mimeType: 'image/jpeg',
    //   },
    // }));

    // The current Gemini models do not directly support video URLs for analysis.
    // The prompt is being sent with a textual representation of the request.
    const fullPrompt = `Analyze the content of the TikTok video found at this URL: ${tiktokUrl}. The user's specific request is: "${prompt}"`;

    const textPart = {
      text: fullPrompt,
    };
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [textPart /*, ...imageParts */] }, // imageParts would be included here
    });

    res.json({ analysis: response.text });

  } catch (error) {
    console.error('Error during Gemini API call:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    res.status(500).json({ error: `Failed to analyze video. ${errorMessage}` });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
