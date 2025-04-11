"use client";

import { headers } from "next/dist/client/components/headers";
import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";

type WSResults = {
  price: string;
  title: string;
  review: string;
  imageUrl: string;
};

export default function Home() {
  const [searchPrompt, setSearchPrompt] = useState("");
  const [searchResults, setSearchResults] = useState<WSResults[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    // Concatenate the site search operator to the search prompt
    const modifiedSearchPrompt = `${searchPrompt} site:https://finance.yahoo.com/news/`;

    const res = await fetch("/api/searchprod", {
      method: "POST",
      body: JSON.stringify({ searchPrompt: modifiedSearchPrompt }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const { products } = await res.json();
    console.log(products);
    setSearchResults(products);
    console.log(searchResults);
    setSearchPrompt("");
    setIsLoading(false);
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

    </main>
  );
}
