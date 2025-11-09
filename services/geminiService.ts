// This type defines the structured recipe data the frontend will work with.
export interface RecipeData {
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

export async function analyzeVideo(
  videoUrl: string,
): Promise<RecipeData> {
  // This should point to your backend server.
  // For local development, the Express server runs on port 3001.
  const backendUrl = 'http://localhost:3001/analyze';

  try {
    const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sourceUrl: videoUrl }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Request to backend failed');
    }

    if (!data.data) {
        throw new Error("Backend response is missing the recipe data.");
    }
    return data.data;

  } catch(e) {
      console.error(e);
      if (e instanceof Error) {
          // Provide a more user-friendly error message
          if (e.message.includes('Failed to fetch')) {
              throw new Error("Could not connect to the backend server. Is it running?");
          }
          throw new Error(`An error occurred: ${e.message}`);
      }
      throw new Error("An unknown error occurred while communicating with the backend.");
  }
}
