"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notionService = void 0;
const client_1 = require("@notionhq/client");
class NotionService {
    getClient(token) {
        return new client_1.Client({
            auth: token ?? process.env.NOTION_ACCESS_TOKEN,
            logLevel: client_1.LogLevel.WARN,
        });
    }
    async search(query, token) {
        const notion = this.getClient(token);
        const response = await notion.search({ query, filter: { value: 'page', property: 'object' } });
        return response.results;
    }
    async getPage(pageId, token) {
        const notion = this.getClient(token);
        const response = await notion.blocks.children.list({ block_id: pageId });
        return response.results;
    }
    async blocksToMarkdown(blocks) {
        const lines = [];
        for (const block of blocks) {
            const type = block.type;
            const b = block;
            const blockData = b[type];
            if (!blockData)
                continue;
            const richText = blockData['rich_text'] ?? [];
            const text = richText.map((r) => r.plain_text).join('');
            switch (type) {
                case 'heading_1':
                    lines.push(`# ${text}`);
                    break;
                case 'heading_2':
                    lines.push(`## ${text}`);
                    break;
                case 'heading_3':
                    lines.push(`### ${text}`);
                    break;
                case 'paragraph':
                    lines.push(text);
                    break;
                case 'bulleted_list_item':
                    lines.push(`- ${text}`);
                    break;
                case 'numbered_list_item':
                    lines.push(`1. ${text}`);
                    break;
                case 'code':
                    lines.push(`\`\`\`${blockData['language'] ?? ''}\n${text}\n\`\`\``);
                    break;
                case 'quote':
                    lines.push(`> ${text}`);
                    break;
                case 'divider':
                    lines.push('---');
                    break;
                default: if (text)
                    lines.push(text);
            }
        }
        return lines.join('\n\n');
    }
}
exports.notionService = new NotionService();
//# sourceMappingURL=notion.js.map