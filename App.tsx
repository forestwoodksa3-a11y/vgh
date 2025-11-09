import React, { useState, useCallback } from 'react';
import { analyzeTiktokVideo } from './services/geminiService';
import { SparklesIcon } from './components/icons';
import Loader from './components/Loader';

function App() {
  const [tiktokUrl, setTiktokUrl] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const [analysis, setAnalysis] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyzeClick = useCallback(async () => {
    if (!tiktokUrl || !prompt) {
      setError('Please provide a TikTok URL and enter a prompt.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysis('');

    try {
      const result = await analyzeTiktokVideo(prompt, tiktokUrl);
      setAnalysis(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Analysis failed: ${errorMessage}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [tiktokUrl, prompt]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-6xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">
            Gemini Video Analyzer
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Enter a TikTok URL, ask a question, and let AI do the rest.
          </p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="flex flex-col space-y-6 bg-gray-800 p-6 rounded-2xl shadow-lg">
            <div className="flex flex-col">
              <label htmlFor="tiktokUrl" className="mb-2 font-semibold text-gray-300">TikTok URL</label>
              <input
                id="tiktokUrl"
                type="url"
                value={tiktokUrl}
                onChange={(e) => setTiktokUrl(e.target.value)}
                placeholder="https://www.tiktok.com/@user/video/123..."
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                disabled={isLoading}
              />
            </div>
            
            <div className="flex flex-col">
              <label htmlFor="prompt" className="mb-2 font-semibold text-gray-300">Your Prompt</label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., 'Summarize this video', 'What is the main object of interest?', 'Count the number of times a person appears.'"
                className="w-full h-32 p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                disabled={isLoading}
              />
            </div>

            <button
              onClick={handleAnalyzeClick}
              disabled={isLoading || !tiktokUrl || !prompt}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity duration-200"
            >
              {isLoading ? (
                <>
                  <Loader />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <SparklesIcon />
                  <span>Analyze Video</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-gray-800 p-6 rounded-2xl shadow-lg flex flex-col">
            <h2 className="text-2xl font-bold mb-4 text-gray-200">Analysis Result</h2>
            <div className="flex-grow w-full h-96 overflow-y-auto p-4 bg-gray-900/50 rounded-lg prose prose-invert max-w-none prose-p:text-gray-300 prose-headings:text-gray-100">
              {isLoading && (
                <div className="flex flex-col items-center justify-center h-full">
                  <Loader />
                  <p className="mt-4 text-gray-400">Contacting backend and analyzing video...</p>
                </div>
              )}
              {error && <p className="text-red-400 whitespace-pre-wrap">{error}</p>}
              {analysis && <p className="text-gray-300 whitespace-pre-wrap">{analysis}</p>}
              {!isLoading && !error && !analysis && (
                <div className="flex items-center justify-center h-full text-center text-gray-500">
                  <p>Your video analysis will appear here.</p>
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
