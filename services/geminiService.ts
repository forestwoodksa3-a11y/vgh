export async function getRecipeFromUrl(
  sourceUrl: string,
): Promise<string> {
  const backendUrl = 'http://localhost:3001/analyze';

  try {
    const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sourceUrl }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Request to backend failed');
    }

    const data = await response.json();
    return data.recipe;
  } catch(e) {
      console.error(e);
      if (e instanceof Error) {
          if (e.message.includes('Failed to fetch')) {
              throw new Error("Could not connect to the backend server. Is it running?");
          }
          throw new Error(`An error occurred: ${e.message}`);
      }
      throw new Error("An unknown error occurred while communicating with the backend.");
  }
}