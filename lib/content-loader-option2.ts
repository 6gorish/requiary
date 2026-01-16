import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';
import type { PageContent } from '@/types/content';

const contentDirectory = path.join(process.cwd(), 'content');

// Helper function to add target="_blank" to all external links
function addTargetBlankToLinks(htmlContent: string): string {
  // Match <a href="..."> tags and add target="_blank" rel="noopener noreferrer"
  return htmlContent.replace(
    /<a href="([^"]+)">/g, 
    '<a href="$1" target="_blank" rel="noopener noreferrer">'
  );
}

export async function getPageContent(filename: string): Promise<PageContent> {
  const fullPath = path.join(contentDirectory, `${filename}.md`);

  // Check if file exists
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Content file not found: ${filename}.md`);
  }

  try {
    const fileContents = fs.readFileSync(fullPath, 'utf8');

    // Parse frontmatter
    const { data, content } = matter(fileContents);

    // Convert markdown to HTML
    const processedContent = await remark()
      .use(html)
      .process(content);
    
    // Add target="_blank" to all links
    const contentHtml = addTargetBlankToLinks(processedContent.toString());

    return {
      metadata: {
        title: data.title || 'House of Mourning',
        description: data.description,
      },
      content: contentHtml,
      rawContent: content,
    };
  } catch (error) {
    throw new Error(`Failed to load content for ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function getAllContentFiles(): string[] {
  const files = fs.readdirSync(contentDirectory);
  return files.filter(file => file.endsWith('.md')).map(file => file.replace(/\.md$/, ''));
}
