import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Register MCP prompt templates for common FSB workflows.
 * Prompts provide pre-built instruction patterns that agents
 * can use to accomplish common browser automation tasks.
 */
export function registerPrompts(server: McpServer): void {
  // 1. Search and Extract Data
  server.registerPrompt(
    'search-and-extract',
    {
      title: 'Search and Extract Data',
      description:
        'Navigate to a site, search for information, and extract structured data. Provide the site URL, search query, and fields to extract.',
      argsSchema: {
        site: z.string().describe('Website URL or name to search on'),
        query: z.string().describe('What to search for'),
        fields: z.string().describe('Comma-separated list of data fields to extract'),
      },
    },
    ({ site, query, fields }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Use FSB's browser automation to:\n1. Navigate to ${site}\n2. Search for: ${query}\n3. Extract these fields: ${fields}\n\nUse the navigate tool to go to the site, then read_page or get_dom_snapshot to find search functionality, then interact with it using click/type_text tools. Extract the requested data and return it as structured JSON.`,
          },
        },
      ],
    }),
  );

  // 2. Fill Out a Form
  server.registerPrompt(
    'fill-form',
    {
      title: 'Fill Out a Form',
      description:
        'Navigate to a page and fill out a form with provided data. Provide the page URL and field-value pairs.',
      argsSchema: {
        url: z.string().describe('URL of the page with the form'),
        formData: z.string().describe("Field-value pairs in 'field: value' format, one per line"),
      },
    },
    ({ url, formData }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Use FSB's browser automation to:\n1. Navigate to ${url}\n2. Read the page to identify form fields using get_dom_snapshot\n3. Fill in each field using type_text:\n${formData}\n4. Submit the form using press_enter or clicking the submit button\n\nVerify each field is filled correctly before submitting.`,
          },
        },
      ],
    }),
  );

  // 3. Monitor Page for Changes
  server.registerPrompt(
    'monitor-page',
    {
      title: 'Monitor Page for Changes',
      description:
        'Watch a page for specific content changes and report when they occur. Provide the URL and what to watch for.',
      argsSchema: {
        url: z.string().describe('URL of the page to monitor'),
        watchFor: z.string().describe('Description of the change to watch for'),
        interval: z.string().optional().describe("Check interval like '30s', '1m', '5m' (default: '30s')"),
      },
    },
    ({ url, watchFor, interval }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Use FSB's browser automation to monitor a page:\n1. Navigate to ${url}\n2. Read the current page content using read_page\n3. Watch for: ${watchFor}\n4. Check the page periodically (every ${interval || '30s'}) using refresh followed by read_page\n5. When the watched condition is detected, report what changed\n\nUse get_dom_snapshot for structured content analysis if needed.`,
          },
        },
      ],
    }),
  );

  // 4. Navigate and Read
  server.registerPrompt(
    'navigate-and-read',
    {
      title: 'Navigate and Read',
      description:
        'Go to a URL and read its content, returning structured information. Provide the URL and what information to extract.',
      argsSchema: {
        url: z.string().describe('URL to navigate to'),
        extract: z.string().describe('What information to extract from the page'),
      },
    },
    ({ url, extract }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `Use FSB's browser automation to:\n1. Navigate to ${url}\n2. Read the page content using read_page\n3. Extract: ${extract}\n4. If the information spans multiple pages, use scroll or click to navigate\n5. Return the extracted information as structured data\n\nUse get_dom_snapshot for detailed element analysis if read_page doesn't capture enough.`,
          },
        },
      ],
    }),
  );
}
