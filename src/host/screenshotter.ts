import puppeteer from 'puppeteer';

export async function screenshotUrl(url: string): Promise<string> {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    const buffer = await page.screenshot({ type: 'png', fullPage: false });
    return Buffer.from(buffer).toString('base64');
  } finally {
    await browser.close();
  }
}
