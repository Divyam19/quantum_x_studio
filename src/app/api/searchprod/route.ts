import { NextResponse } from "next/server";
import puppeteer from "puppeteer";

function createGoogleSearchUrl(query: string): string {
  const encodedQuery = encodeURIComponent(query);
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
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
      window.chrome = { runtime: {} };
    });
    
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(googleSearchUrl, { waitUntil: 'networkidle2' });
    
    // Get current URL to check for redirects
    const url = page.url();
    console.log(`Current URL: ${url}`);
    
    // Get the HTML content and log it
    const html = await page.content();
    console.log("Page HTML content:");
    console.log(html);
    
    if (url.includes('/sorry/')) {
      return NextResponse.json({ 
        error: "CAPTCHA detected - blocked by Google",
        html: html  // Optionally include the HTML in the response
      }, { status: 429 });
    }
    
    return NextResponse.json({ 
      success: true,
      url: url,
      html: html
    });
    
  } catch (error) {
    console.error("Error during search scraping:", error);
    return NextResponse.json({ error: "Failed to perform search" }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
