import React, { useState, useCallback } from 'react';
import { analyzeVideo } from './services/geminiService';
import { RecipeIcon } from './components/icons';
import Loader from './components/Loader';

function App() {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [recipeHtml, setRecipeHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyzeClick = useCallback(async () => {
    if (!videoUrl) {
      setError('Please provide a video URL.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setRecipeHtml(null);

    try {
      const html = await analyzeVideo(videoUrl);
      setRecipeHtml(html);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to get recipe: ${errorMessage}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [videoUrl]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
            Video Recipe Finder
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Paste a video or recipe URL from TikTok, YouTube, or a public website to extract the recipe.
          </p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col space-y-6 bg-gray-800 p-6 rounded-2xl shadow-lg">
            <div className="flex flex-col">
              <label htmlFor="videoUrl" className="mb-2 font-semibold text-gray-300">Video URL</label>
              <input
                id="videoUrl"
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.tiktok.com/... or https://youtube.com/..."
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                disabled={isLoading}
              />
            </div>

            <button
              onClick={handleAnalyzeClick}
              disabled={isLoading || !videoUrl}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-200"
            >
              {isLoading ? (
                <>
                  <Loader />
                  <span>Getting Recipe...</span>
                </>
              ) : (
                <>
                  <RecipeIcon />
                  <span>Get Recipe</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-gray-800 p-6 rounded-2xl shadow-lg flex flex-col">
            <h2 className="text-2xl font-bold mb-4 text-gray-200">Your Recipe</h2>
            <div className="flex-grow w-full h-96 overflow-y-auto p-4 bg-gray-900/50 rounded-lg prose prose-invert max-w-none prose-p:text-gray-300 prose-headings:text-gray-100">
              {isLoading && (
                <div className="flex flex-col items-center justify-center h-full">
                  <Loader />
                  <p className="mt-4 text-gray-400">Finding recipe in video...</p>
                </div>
              )}
              {error && <p className="text-red-400 whitespace-pre-wrap">{error}</p>}
              {recipeHtml && (
                <div dangerouslySetInnerHTML={{ __html: recipeHtml }} />
              )}
              {!isLoading && !error && !recipeHtml && (
                <div className="flex items-center justify-center h-full text-center text-gray-500">
                  <p>Your recipe will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;