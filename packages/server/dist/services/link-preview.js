"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchLinkPreview = fetchLinkPreview;
const open_graph_scraper_1 = __importDefault(require("open-graph-scraper"));
async function fetchLinkPreview(url) {
    try {
        const { result } = await (0, open_graph_scraper_1.default)({ url, timeout: 5000 });
        return {
            title: result.ogTitle ?? result.twitterTitle,
            description: result.ogDescription ?? result.twitterDescription,
            imageUrl: result.ogImage?.[0]?.url ?? result.twitterImage?.[0]?.url,
            siteName: result.ogSiteName,
        };
    }
    catch {
        return {};
    }
}
//# sourceMappingURL=link-preview.js.map