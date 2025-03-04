export interface Post {
  id: string;
  text: string;
  media?: Media[];
  poll?: Poll;
  createdAt: Date;
  status?: 'draft' | 'pending' | 'approved' | 'rejected' | 'published';
  approvalId?: string;
}

export interface Reply {
  inReplyToId: string;
  text: string;
  media?: Media[];
}

export type MediaType = 'image' | 'video' | 'gif';

export interface Media {
  type: MediaType;
  url?: string;
  data?: Buffer;
  altText?: string;
}

export interface Poll {
  options: string[];
  durationMinutes: number;
}

export interface EngagementScore {
  score: number;
  reasoning: string;
}

export interface ContentGenerationPrompt {
  topic?: string;
  includeMedia?: boolean;
  includePoll?: boolean;
  contextMessages?: string[];
  purpose: string;
  tone: string;
}

export interface LLMService {
  generateContent(prompt: ContentGenerationPrompt): Promise<{
    text: string;
    media?: Media[];
    poll?: Poll;
  }>;
  
  shouldReply(mention: Post): Promise<EngagementScore>;
  
  generateReply(mention: Post): Promise<string>;
  
  generateImage(prompt: string): Promise<Buffer>;
}