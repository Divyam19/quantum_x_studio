"use client";

import { headers } from "next/dist/client/components/headers";
import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";

type ArticleData = {
  title: string;
  date: string;
  content: string;
  summary: string;
  yfClassData?: string[];
};

type SearchResponse = {
  success: boolean;
  searchUrl?: string;
  yahooFinanceUrl?: string;
  articleData?: ArticleData;
  message?: string;
  error?: string;
};

export default function Home() {
  const [searchPrompt, setSearchPrompt] = useState("");
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    // Concatenate the site search operator to the search prompt
    const modifiedSearchPrompt = `${searchPrompt} site:https://finance.yahoo.com/news/`;

    try {
      const res = await fetch("/api/searchprod", {
        method: "POST",
        body: JSON.stringify({ searchPrompt: modifiedSearchPrompt }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();
      console.log("API Response:", data);

      setSearchResponse(data);
      setSearchPrompt("");
    } catch (err) {
      console.error("Error fetching search results:", err);
      setError("Failed to fetch search results. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className=" max-w-5xl mx-auto flex flex-col mt-5  justify-center">
      <form
        onSubmit={handleSubmit}
        className="flex justify-center space-x-2 my-4"
      >
        <input
          value={searchPrompt}
          onChange={(e) => setSearchPrompt(e.target.value)}
          type="text"
          placeholder="Product to be searched..."
          className="px-2 bg-transparent border rounded-md text-white outline-none"
        />
        <button
          disabled={searchPrompt === ""}
          className="bg-blue-500 text-white px-2 py-1 rounded-md disabled:bg-blue-500/40 disabled:cursor-not-allowed"
        >
          {isLoading ? "Searching..." : "Search"}
        </button>
      </form>

      {isLoading && <p className="text-white">Loading...</p>}

      {error && (
        <div className="mt-4 p-4 bg-red-500/20 border border-red-500 rounded-md text-white">
          {error}
        </div>
      )}

      {searchResponse && !isLoading && (
        <div className="mt-6 w-full">
          {searchResponse.error ? (
            <div className="p-4 bg-red-500/20 border border-red-500 rounded-md text-white">
              <h3 className="text-xl font-bold">Error</h3>
              <p>{searchResponse.error}</p>
              {searchResponse.message && <p>{searchResponse.message}</p>}
            </div>
          ) : searchResponse.success === false ? (
            <div className="p-4 bg-yellow-500/20 border border-yellow-500 rounded-md text-white">
              <h3 className="text-xl font-bold">No Results Found</h3>
              <p>{searchResponse.message}</p>
            </div>
          ) : searchResponse.articleData ? (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg overflow-hidden shadow-xl">
              <div className="p-6">
                <h2 className="text-2xl font-bold text-white mb-2">
                  {searchResponse.articleData.title}
                </h2>
                {searchResponse.articleData.date && (
                  <p className="text-gray-400 mb-4">
                    {searchResponse.articleData.date}
                  </p>
                )}

                {searchResponse.articleData.summary && (
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Summary
                    </h3>
                    <p className="text-gray-300 leading-relaxed">
                      {searchResponse.articleData.summary}
                    </p>
                  </div>
                )}

                {searchResponse.articleData.content && (
                  <div>
                    <h3 className="text-xl font-semibold text-white mb-2">
                      Article Content
                    </h3>
                    <div className="text-gray-300 leading-relaxed max-h-96 overflow-y-auto">
                      {searchResponse.articleData.content
                        .split("\n\n")
                        .map((paragraph, index) => (
                          <p key={index} className="mb-4">
                            {paragraph}
                          </p>
                        ))}
                    </div>
                  </div>
                )}

                {searchResponse.yahooFinanceUrl && (
                  <div className="mt-6">
                    <a
                      href={searchResponse.yahooFinanceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      Read full article on Yahoo Finance
                    </a>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-yellow-500/20 border border-yellow-500 rounded-md text-white">
              <h3 className="text-xl font-bold">No Article Data</h3>
              <p>The search was successful but no article data was found.</p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
