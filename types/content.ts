export interface ContentMetadata {
  title: string;
  description?: string;
}

export interface PageContent {
  metadata: ContentMetadata;
  content: string;
  rawContent: string;
}
