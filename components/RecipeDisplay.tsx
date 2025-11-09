import React from 'react';
import { RecipeData } from '../services/geminiService';

interface RecipeDisplayProps {
  recipe: RecipeData;
}

// Helper to format time in minutes into a readable string like "1h 15m"
const formatTime = (minutes: number) => {
    if (!minutes || minutes <= 0) return null;
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins > 0 ? `${mins}m` : ''}`.trim();
}

const RecipeDisplay: React.FC<RecipeDisplayProps> = ({ recipe }) => {
    const prepTime = formatTime(recipe.prep_time);
    const cookTime = formatTime(recipe.cook_time);
    const totalTime = formatTime(recipe.total_time);
    const yields = recipe.yields > 0 ? `${recipe.yields} servings` : null;

    const summaryItems = [
        { label: 'Prep Time', value: prepTime },
        { label: 'Cook Time', value: cookTime },
        { label: 'Total Time', value: totalTime },
        { label: 'Yields', value: yields },
    ].filter(item => item.value);


    return (
        <div>
            {recipe.image && (
                <figure className="mb-4">
                    <img 
                        src={recipe.image} 
                        alt={recipe.title} 
                        className="w-full h-auto max-h-96 rounded-lg shadow-md object-cover" 
                        loading="lazy" 
                    />
                </figure>
            )}
            <h3 className="text-3xl font-bold text-purple-300 mt-0">{recipe.title}</h3>
            <p className="text-gray-300 italic mt-2">{recipe.description}</p>
            
            {summaryItems.length > 0 && (
                <div className="my-6 p-4 bg-gray-900/70 rounded-lg border border-gray-700">
                    <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-gray-300">
                        {summaryItems.map(item => (
                            <li key={item.label}>
                                <strong className="font-semibold text-indigo-400">{item.label}:</strong> {item.value}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 mt-6">
                <div>
                    <h4 className="text-xl font-bold text-indigo-300 mb-2">Ingredients</h4>
                    <ul className="list-disc list-inside text-gray-300 space-y-1">
                        {recipe.ingredients.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                </div>
                <div>
                    <h4 className="text-xl font-bold text-indigo-300 mb-2">Instructions</h4>
                    <ol className="list-decimal list-inside text-gray-300 space-y-2">
                        {recipe.instructions.map((item, index) => <li key={index}>{item}</li>)}
                    </ol>
                </div>
            </div>
             <div className="mt-8 pt-4 border-t border-gray-700 text-center">
                <a href={recipe.url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                    Original recipe from {recipe.host}
                </a>
            </div>
        </div>
    );
};

export default RecipeDisplay;
