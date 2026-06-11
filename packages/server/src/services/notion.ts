import { Client, LogLevel } from '@notionhq/client';
import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints';

class NotionService {
  private getClient(token?: string): Client {
    return new Client({
      auth: token ?? process.env.NOTION_ACCESS_TOKEN,
      logLevel: LogLevel.WARN,
    });
  }

  async search(query: string, token?: string): Promise<unknown[]> {
    const notion = this.getClient(token);
    const response = await notion.search({ query, filter: { value: 'page', property: 'object' } });
    return response.results;
  }

  async getPage(pageId: string, token?: string): Promise<BlockObjectResponse[]> {
    const notion = this.getClient(token);
    const response = await notion.blocks.children.list({ block_id: pageId });
    return response.results as BlockObjectResponse[];
  }

  async blocksToMarkdown(blocks: BlockObjectResponse[]): Promise<string> {
    const lines: string[] = [];
    for (const block of blocks) {
      const type = block.type;
      const b = block as Record<string, unknown>;
      const blockData = b[type] as Record<string, unknown> | undefined;
      if (!blockData) continue;

      const richText = (blockData['rich_text'] as Array<{ plain_text: string }> | undefined) ?? [];
      const text = richText.map((r) => r.plain_text).join('');

      switch (type) {
        case 'heading_1': lines.push(`# ${text}`); break;
        case 'heading_2': lines.push(`## ${text}`); break;
        case 'heading_3': lines.push(`### ${text}`); break;
        case 'paragraph': lines.push(text); break;
        case 'bulleted_list_item': lines.push(`- ${text}`); break;
        case 'numbered_list_item': lines.push(`1. ${text}`); break;
        case 'code':
          lines.push(`\`\`\`${(blockData['language'] as string) ?? ''}\n${text}\n\`\`\``);
          break;
        case 'quote': lines.push(`> ${text}`); break;
        case 'divider': lines.push('---'); break;
        default: if (text) lines.push(text);
      }
    }
    return lines.join('\n\n');
  }
}

export const notionService = new NotionService();
