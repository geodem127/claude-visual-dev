"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.screenshotUrl = screenshotUrl;
const puppeteer_1 = __importDefault(require("puppeteer"));
async function screenshotUrl(url) {
    const browser = await puppeteer_1.default.launch({ headless: true, args: ['--no-sandbox'] });
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 900 });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        const buffer = await page.screenshot({ type: 'png', fullPage: false });
        return Buffer.from(buffer).toString('base64');
    }
    finally {
        await browser.close();
    }
}
