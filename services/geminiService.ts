export async function analyzeTiktokVideo(
  prompt: string,
  tiktokUrl: string,
): Promise<string> {
  // This should point to your backend server.
  // For local development, the Express server runs on port 3001.
  const backendUrl = 'http://localhost:3001/analyze';

  try {
    const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, tiktokUrl }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Request to backend failed');
    }

    const data = await response.json();
    return data.analysis;
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
