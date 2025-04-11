import { NextResponse } from "next/server";
import puppeteer from "puppeteer";

function createGoogleSearchUrl(query: string): string {
  // Add site:finance.yahoo.com/news to limit results to Yahoo Finance news
  const modifiedQuery = `${query} site:finance.yahoo.com/news`;
  const encodedQuery = encodeURIComponent(modifiedQuery);
  return `https://www.google.com/search?q=${encodedQuery}`;
}

export async function POST(request: Request) {
  const { searchPrompt: userSearch } = await request.json();
  
  if (!userSearch) {
    return NextResponse.json({ error: "Please provide a search prompt" }, { status: 400 });
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
        "--disable-blink-features=AutomationControlled"
      ]
    });
    
    const page = await browser.newPage();
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    
    // Add additional browser-like properties to avoid detection
    // Fixed TypeScript error by explicitly declaring chrome property
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
      
      // Fix TypeScript error by using proper type declaration
      (window as any).chrome = { runtime: {} };
    });
    
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(googleSearchUrl, { waitUntil: 'networkidle2' });
    
    // Get current URL to check for redirects
    const url = page.url();
    console.log(`Current URL: ${url}`);
    
    if (url.includes('/sorry/')) {
      return NextResponse.json({
        error: "CAPTCHA detected - blocked by Google",
      }, { status: 429 });
    }
    
    // Get the HTML content
    const html = await page.content();
    
    // Extract Yahoo Finance link using regex
    const yahooFinanceUrlMatch = html.match(/href="(https?:\/\/finance\.yahoo\.com\/news[^"]*)"/);
    
    let yahooFinanceUrl = null;
    if (yahooFinanceUrlMatch && yahooFinanceUrlMatch[1]) {
      yahooFinanceUrl = yahooFinanceUrlMatch[1];
      console.log("Found Yahoo Finance URL:", yahooFinanceUrl);
    } else {
      console.log("No Yahoo Finance link found in HTML");
      
      // Try an alternative approach with a more relaxed pattern
      const alternativeMatch = html.match(/https?:\/\/finance\.yahoo\.com\/news[^"'\s<>)]+/);
      if (alternativeMatch) {
        yahooFinanceUrl = alternativeMatch[0];
        console.log("Found Yahoo Finance URL (alternative method):", yahooFinanceUrl);
      }
    }
    
    // If we found a URL, go to that page and extract content
    if (yahooFinanceUrl) {
      await page.goto(yahooFinanceUrl, { waitUntil: 'networkidle2' });
      
      // Extract article info
      const articleData = await page.evaluate(() => {
        return {
          title: document.querySelector('h1')?.textContent?.trim() || '',
          date: document.querySelector('time')?.textContent?.trim() || '',
          content: Array.from(document.querySelectorAll('.caas-body p'))
            .map(p => p.textContent?.trim())
            .filter(text => text && text.length > 0)
            .join('\n\n')
        };
      });
      
      return NextResponse.json({
        success: true,
        searchUrl: googleSearchUrl,
        yahooFinanceUrl: yahooFinanceUrl,
        articleData: articleData
      });
    }
    
    return NextResponse.json({
      success: false,
      message: "No Yahoo Finance news URL found",
      searchUrl: googleSearchUrl
    });
    
  } catch (error) {
    console.error("Error during search scraping:", error);
    return NextResponse.json({ 
      error: "Failed to perform search",
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
