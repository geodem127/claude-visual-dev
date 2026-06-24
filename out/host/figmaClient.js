"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchFigmaScreenshot = fetchFigmaScreenshot;
exports.extractFigmaFileKey = extractFigmaFileKey;
const node_fetch_1 = __importDefault(require("node-fetch"));
const FIGMA_BASE = 'https://api.figma.com/v1';
async function fetchFigmaScreenshot(fileKey, apiKey) {
    const fileRes = await (0, node_fetch_1.default)(`${FIGMA_BASE}/files/${fileKey}`, {
        headers: { 'X-Figma-Token': apiKey },
    });
    if (!fileRes.ok)
        throw new Error(`Figma API error: ${fileRes.status} ${fileRes.statusText}`);
    const file = await fileRes.json();
    const nodeId = file.document.children[0]?.id;
    if (!nodeId)
        throw new Error('No nodes found in Figma file');
    const imgRes = await (0, node_fetch_1.default)(`${FIGMA_BASE}/images/${fileKey}?ids=${nodeId}&format=png&scale=2`, {
        headers: { 'X-Figma-Token': apiKey },
    });
    if (!imgRes.ok)
        throw new Error(`Figma images API error: ${imgRes.status}`);
    const imgData = await imgRes.json();
    const imageUrl = Object.values(imgData.images)[0];
    if (!imageUrl)
        throw new Error('No image URL returned from Figma');
    const download = await (0, node_fetch_1.default)(imageUrl);
    const buffer = await download.buffer();
    return buffer.toString('base64');
}
function extractFigmaFileKey(url) {
    const match = url.match(/figma\.com\/(?:file|design)\/([A-Za-z0-9]+)/);
    if (!match)
        throw new Error('Invalid Figma URL');
    return match[1];
}
