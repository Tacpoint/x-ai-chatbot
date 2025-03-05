import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Media, Poll, Post } from '../core/types';

interface StoredPost {
  id: string;
  text: string;
  media?: Media[];
  poll?: Poll;
  createdAt: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'published';
  approvalId?: string;
  messageTs?: string; // Slack message timestamp for updating
}

export class PostStorage {
  private readonly STORAGE_DIR: string;
  private readonly POSTS_FILE: string;

  constructor() {
    this.STORAGE_DIR = path.join(os.homedir(), '.x_ai_chatbot');
    this.POSTS_FILE = path.join(this.STORAGE_DIR, 'posts.json');
  }

  async initialize(): Promise<void> {
    try {
      // Ensure storage directory exists
      await fs.mkdir(this.STORAGE_DIR, { recursive: true });
      
      // Check if posts file exists, create if it doesn't
      try {
        await fs.access(this.POSTS_FILE);
      } catch {
        await fs.writeFile(this.POSTS_FILE, JSON.stringify([]));
      }
    } catch (error) {
      console.error('Error initializing post storage:', error);
      throw new Error('Failed to initialize post storage');
    }
  }

  async saveDraft(post: {
    id: string;
    text: string;
    media?: Media[];
    poll?: Poll;
    approvalId?: string;
    messageTs?: string;
  }): Promise<void> {
    try {
      const posts = await this.getAllPosts();
      
      const storedPost: StoredPost = {
        id: post.id,
        text: post.text,
        media: post.media,
        poll: post.poll,
        createdAt: new Date().toISOString(),
        status: 'draft',
        approvalId: post.approvalId,
        messageTs: post.messageTs,
      };
      
      posts.push(storedPost);
      
      await fs.writeFile(this.POSTS_FILE, JSON.stringify(posts, null, 2));
    } catch (error) {
      console.error('Error saving draft post:', error);
      throw new Error('Failed to save draft post');
    }
  }

  async updatePostStatus(
    id: string,
    status: 'draft' | 'pending' | 'approved' | 'rejected' | 'published',
    approvalId?: string,
    messageTs?: string
  ): Promise<void> {
    try {
      const posts = await this.getAllPosts();
      const postIndex = posts.findIndex(p => p.id === id);
      
      if (postIndex === -1) {
        throw new Error(`Post with ID ${id} not found`);
      }
      
      posts[postIndex].status = status;
      
      if (approvalId) {
        posts[postIndex].approvalId = approvalId;
      }
      
      if (messageTs) {
        console.log(`Storing messageTs ${messageTs} for post ${id}`);
        posts[postIndex].messageTs = messageTs;
      }
      
      await fs.writeFile(this.POSTS_FILE, JSON.stringify(posts, null, 2));
      
      // Debug: verify what was written
      const updatedPost = posts[postIndex];
      console.log(`Post ${id} updated with status: ${status}, approvalId: ${updatedPost.approvalId}, messageTs: ${updatedPost.messageTs}`);
    } catch (error) {
      console.error('Error updating post status:', error);
      throw new Error('Failed to update post status');
    }
  }

  async updatePostContent(
    id: string,
    content: {
      text?: string;
      media?: Media[];
      poll?: Poll;
    }
  ): Promise<void> {
    try {
      const posts = await this.getAllPosts();
      const postIndex = posts.findIndex(p => p.id === id);
      
      if (postIndex === -1) {
        throw new Error(`Post with ID ${id} not found`);
      }
      
      if (content.text) {
        posts[postIndex].text = content.text;
      }
      
      if (content.media) {
        posts[postIndex].media = content.media;
      }
      
      if (content.poll) {
        posts[postIndex].poll = content.poll;
      }
      
      await fs.writeFile(this.POSTS_FILE, JSON.stringify(posts, null, 2));
    } catch (error) {
      console.error('Error updating post content:', error);
      throw new Error('Failed to update post content');
    }
  }

  async getPostById(id: string): Promise<Post | null> {
    try {
      const posts = await this.getAllPosts();
      const post = posts.find(p => p.id === id);
      
      if (!post) {
        return null;
      }
      
      // Convert post.media.data back to Buffer if it exists
      const convertedMedia = post.media?.map(media => {
        if (media.data && typeof media.data === 'object' && 'type' in media.data) {
          // Need to handle the serialized Buffer object
          const bufferData = media.data as unknown as { type: string; data: number[] };
          if (bufferData.type === 'Buffer' && Array.isArray(bufferData.data)) {
            return {
              ...media,
              data: Buffer.from(bufferData.data)
            };
          }
        }
        return media;
      });
      
      return {
        id: post.id,
        text: post.text,
        media: convertedMedia,
        poll: post.poll,
        createdAt: new Date(post.createdAt),
        status: post.status,
        approvalId: post.approvalId,
        messageTs: post.messageTs,
      };
    } catch (error) {
      console.error('Error getting post by ID:', error);
      return null;
    }
  }

  async getPostByApprovalId(approvalId: string): Promise<Post | null> {
    try {
      const posts = await this.getAllPosts();
      const post = posts.find(p => p.approvalId === approvalId);
      
      if (!post) {
        return null;
      }
      
      // Convert post.media.data back to Buffer if it exists
      const convertedMedia = post.media?.map(media => {
        if (media.data && typeof media.data === 'object' && 'type' in media.data) {
          // Need to handle the serialized Buffer object
          const bufferData = media.data as unknown as { type: string; data: number[] };
          if (bufferData.type === 'Buffer' && Array.isArray(bufferData.data)) {
            return {
              ...media,
              data: Buffer.from(bufferData.data)
            };
          }
        }
        return media;
      });
      
      return {
        id: post.id,
        text: post.text,
        media: convertedMedia,
        poll: post.poll,
        createdAt: new Date(post.createdAt),
        status: post.status,
        approvalId: post.approvalId,
        messageTs: post.messageTs,
      };
    } catch (error) {
      console.error('Error getting post by approval ID:', error);
      return null;
    }
  }

  async getDraftPosts(): Promise<Post[]> {
    try {
      const posts = await this.getAllPosts();
      
      return posts
        .filter(p => p.status === 'draft')
        .map(p => {
          // Convert post.media.data back to Buffer if it exists
          const convertedMedia = p.media?.map(media => {
            if (media.data && typeof media.data === 'object' && 'type' in media.data) {
              // Need to handle the serialized Buffer object
              const bufferData = media.data as unknown as { type: string; data: number[] };
              if (bufferData.type === 'Buffer' && Array.isArray(bufferData.data)) {
                return {
                  ...media,
                  data: Buffer.from(bufferData.data)
                };
              }
            }
            return media;
          });
          
          return {
            id: p.id,
            text: p.text,
            media: convertedMedia,
            poll: p.poll,
            createdAt: new Date(p.createdAt),
            status: p.status,
            approvalId: p.approvalId,
            messageTs: p.messageTs,
          };
        });
    } catch (error) {
      console.error('Error getting draft posts:', error);
      return [];
    }
  }

  async getPendingPosts(): Promise<Post[]> {
    try {
      const posts = await this.getAllPosts();
      
      return posts
        .filter(p => p.status === 'pending')
        .map(p => {
          // Convert post.media.data back to Buffer if it exists
          const convertedMedia = p.media?.map(media => {
            if (media.data && typeof media.data === 'object' && 'type' in media.data) {
              // Need to handle the serialized Buffer object
              const bufferData = media.data as unknown as { type: string; data: number[] };
              if (bufferData.type === 'Buffer' && Array.isArray(bufferData.data)) {
                return {
                  ...media,
                  data: Buffer.from(bufferData.data)
                };
              }
            }
            return media;
          });
          
          return {
            id: p.id,
            text: p.text,
            media: convertedMedia,
            poll: p.poll,
            createdAt: new Date(p.createdAt),
            status: p.status,
            approvalId: p.approvalId,
            messageTs: p.messageTs,
          };
        });
    } catch (error) {
      console.error('Error getting pending posts:', error);
      return [];
    }
  }

  private async getAllPosts(): Promise<StoredPost[]> {
    try {
      const data = await fs.readFile(this.POSTS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading posts file:', error);
      return [];
    }
  }
}