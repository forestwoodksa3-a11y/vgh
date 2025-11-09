import React, { useState, useCallback } from 'react';
import { getRecipeFromUrl } from './services/geminiService';
import { RecipeIcon } from './components/icons';
import Loader from './components/Loader';

interface Recipe {
  recipeName: string;
  description: string;
  ingredients: string[];
  instructions: string[];
}

function App() {
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGetRecipeClick = useCallback(async () => {
    if (!sourceUrl) {
      setError('Please provide a URL.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setRecipe(null);

    try {
      const resultJson = await getRecipeFromUrl(sourceUrl);
      const parsedRecipe: Recipe = JSON.parse(resultJson);
      setRecipe(parsedRecipe);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to get recipe: ${errorMessage}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [sourceUrl]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
            Universal AI Recipe Finder
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Paste any video or website URL to instantly extract the recipe.
          </p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col space-y-6 bg-gray-800 p-6 rounded-2xl shadow-lg">
            <div className="flex flex-col">
              <label htmlFor="sourceUrl" className="mb-2 font-semibold text-gray-300">Recipe URL</label>
              <input
                id="sourceUrl"
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://... (any recipe video or website)"
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                disabled={isLoading}
              />
            </div>

            <button
              onClick={handleGetRecipeClick}
              disabled={isLoading || !sourceUrl}
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
                  <p className="mt-4 text-gray-400">Finding your recipe...</p>
                </div>
              )}
              {error && <p className="text-red-400 whitespace-pre-wrap">{error}</p>}
              {recipe && (
                <div>
                  <h3 className="text-2xl font-bold !text-purple-300 !mt-0">{recipe.recipeName}</h3>
                  <p className="!text-gray-300 italic">{recipe.description}</p>
                  
                  <h4 className="text-xl font-bold !text-indigo-300 mt-6 mb-2">Ingredients</h4>
                  <ul className="list-disc list-inside !text-gray-300 space-y-1">
                    {recipe.ingredients.map((item, index) => (
                      <li key={`ing-${index}`}>{item}</li>
                    ))}
                  </ul>

                  <h4 className="text-xl font-bold !text-indigo-300 mt-6 mb-2">Instructions</h4>
                  <ol className="list-decimal list-inside !text-gray-300 space-y-2">
                     {recipe.instructions.map((item, index) => (
                      <li key={`inst-${index}`}>{item}</li>
                    ))}
                  </ol>
                </div>
              )}
              {!isLoading && !error && !recipe && (
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