import { NextResponse } from "next/server";
import puppeteer from "puppeteer";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: "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",
});

function createGoogleSearchUrl(query: string): string {
  // Add site:finance.yahoo.com/news to limit results to Yahoo Finance news
  const modifiedQuery = `${query} site:finance.yahoo.com/news`;
  const encodedQuery = encodeURIComponent(modifiedQuery);
  return `https://www.google.com/search?q=${encodedQuery}`;
}

export async function POST(request: Request) {
  const { searchPrompt: userSearch } = await request.json();

  if (!userSearch) {
    return NextResponse.json(
      { error: "Please provide a search prompt" },
      { status: 400 }
    );
  }

  let browser;
  try {
    const googleSearchUrl = createGoogleSearchUrl(userSearch);
    console.log(`Generated URL: ${googleSearchUrl}`);

    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
    });

    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    );

    // Add additional browser-like properties to avoid detection
    // Fixed TypeScript error by explicitly declaring chrome property
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });

      // Fix TypeScript error by using proper type declaration
      (window as any).chrome = { runtime: {} };
    });

    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(googleSearchUrl, { waitUntil: "networkidle2" });

    // Get current URL to check for redirects
    const url = page.url();
    console.log(`Current URL: ${url}`);

    if (url.includes("/sorry/")) {
      return NextResponse.json(
        {
          error: "CAPTCHA detected - blocked by Google",
        },
        { status: 429 }
      );
    }

    // Get the HTML content
    const html = await page.content();

    // Extract Yahoo Finance link using regex
    const yahooFinanceUrlMatch = html.match(
      /href="(https?:\/\/finance\.yahoo\.com\/news[^"]*)"/
    );

    let yahooFinanceUrl = null;
    if (yahooFinanceUrlMatch && yahooFinanceUrlMatch[1]) {
      yahooFinanceUrl = yahooFinanceUrlMatch[1];
      console.log("Found Yahoo Finance URL:", yahooFinanceUrl);
    } else {
      console.log("No Yahoo Finance link found in HTML");

      // Try an alternative approach with a more relaxed pattern
      const alternativeMatch = html.match(
        /https?:\/\/finance\.yahoo\.com\/news[^"'\s<>)]+/
      );
      if (alternativeMatch) {
        yahooFinanceUrl = alternativeMatch[0];
        console.log(
          "Found Yahoo Finance URL (alternative method):",
          yahooFinanceUrl
        );
      }
    }

    // If we found a URL, go to that page and extract content
    if (yahooFinanceUrl) {
      // Navigate to the Yahoo Finance article
      await page.goto(yahooFinanceUrl, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });
      console.log("Navigated to Yahoo Finance article:", yahooFinanceUrl);

      // Get the full HTML of the page
      const yahooHtml = await page.content();
      console.log("Retrieved Yahoo Finance article HTML");

      // Extract specific data using page.evaluate
      const extractedData = await page.evaluate(() => {
        // Extract the title from cover-title class
        const coverTitle =
          document.querySelector(".cover-title")?.textContent?.trim() || "";
        console.log(coverTitle);

        // Extract data from all elements with class yf-1090901
        const yfClassElements = Array.from(
          document.querySelectorAll(".yf-1090901")
        );
        const yfData = yfClassElements.map((element, index) => {
          return {
            index: index,
            text: element.textContent?.trim() || "",
            html: element.innerHTML,
          };
        });

        // Also get regular article data as backup
        const regularTitle =
          document.querySelector("h1")?.textContent?.trim() || "";
        const date = document.querySelector("time")?.textContent?.trim() || "";
        const articleContent = Array.from(
          document.querySelectorAll(".caas-body p")
        )
          .map((p) => p.textContent?.trim())
          .filter((text) => text && text.length > 0)
          .join("\n\n");

        return {
          coverTitle,
          regularTitle,
          date,
          articleContent,
          yfClassElements: yfData,
        };
      });

      // Log the extracted data to console
      console.log("Cover Title:", extractedData.coverTitle);
      console.log(
        `Found ${extractedData.yfClassElements.length} elements with class yf-1090901`
      );

      let article = "";
      extractedData.yfClassElements.forEach((item) => {
        article =
          article +
          item.text.substring(0, 100) +
          (item.text.length > 100 ? "..." : "");
      });

      console.log(article);

      // Generate summary using Groq
      let summary = "";
      try {
        summary = await getArticleSummary(
          extractedData.articleContent || article
        );
        console.log("Article Summary:", summary);
      } catch (summaryError) {
        console.error("Error generating summary:", summaryError);
        summary = "Failed to generate summary";
      }

      return NextResponse.json({
        success: true,
        searchUrl: googleSearchUrl,
        yahooFinanceUrl: yahooFinanceUrl,
        articleData: {
          title: extractedData.coverTitle || extractedData.regularTitle,
          date: extractedData.date,
          content: extractedData.articleContent,
          yfClassData: extractedData.yfClassElements.map((el) => el.text),
          summary: summary,
        },
        rawHtml: yahooHtml, // Including the full HTML for your reference
      });
    }
    return NextResponse.json({
      success: false,
      message: "No Yahoo Finance news URL found",
      searchUrl: googleSearchUrl,
    });
  } catch (error) {
    console.error("Error during search scraping:", error);
    return NextResponse.json(
      {
        error: "Failed to perform search",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function getArticleSummary(articleContent: string) {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "user",
          content: `Summarize this article in a concise heavy points: ${articleContent.substring(
            0,
            4000
          )}`,
        },
      ],
      model: "llama-3.3-70b-versatile",
    });

    return (
      chatCompletion.choices[0]?.message?.content || "No summary available"
    );
  } catch (error) {
    console.error("Error in Groq API call:", error);
    return "Failed to generate summary";
  }
}
