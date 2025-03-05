import { TwitterApi } from 'twitter-api-v2';
import config from '../config/config';
import { Media, Poll, Post, Reply } from '../core/types';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export class XService {
  private client: TwitterApi;
  private lastMentionId: string | null = null;
  private readonly LAST_MENTION_PATH = path.join(os.homedir(), '.x_ai_chatbot_last_mention');

  constructor() {
    this.client = new TwitterApi({
      appKey: config.x.apiKey,
      appSecret: config.x.apiSecret,
      accessToken: config.x.accessToken,
      accessSecret: config.x.accessSecret,
    });
  }

  async initialize(): Promise<void> {
    try {
      const lastMentionData = await fs.readFile(this.LAST_MENTION_PATH, 'utf-8');
      this.lastMentionId = lastMentionData.trim();
      console.log(`Initialized with last mention ID: ${this.lastMentionId}`);
    } catch (error) {
      console.log('No last mention ID found. Starting fresh.');
    }
  }

  private async saveLastMentionId(mentionId: string): Promise<void> {
    this.lastMentionId = mentionId;
    try {
      await fs.writeFile(this.LAST_MENTION_PATH, mentionId);
    } catch (error) {
      console.error('Failed to save last mention ID:', error);
    }
  }

  async createPost(content: { text: string; media?: Media[]; poll?: Poll }): Promise<string> {
    try {
      // Upload media if any
      const mediaIds: string[] = [];
      if (content.media && content.media.length > 0) {
        for (const media of content.media) {
          if (media.data) {
            console.log(`Uploading media of type: ${media.type}, buffer length: ${media.data.length}`);
            
            // Write the buffer to a temporary file first
            const tempDir = path.join(os.tmpdir(), 'x_ai_chatbot');
            await fs.mkdir(tempDir, { recursive: true });
            const tempFile = path.join(tempDir, `image_${Date.now()}.png`);
            await fs.writeFile(tempFile, media.data);
            
            console.log(`Saved media to temporary file: ${tempFile}`);
            
            // Upload the media file
            const mediaId = await this.client.v1.uploadMedia(
              tempFile, 
              {
                mimeType: media.type === 'image' ? 'image/png' : 'video/mp4',
              }
            );
            
            // Set alt text if provided
            if (media.altText) {
              await this.client.v1.createMediaMetadata(mediaId, {
                alt_text: { text: media.altText }
              });
            }
            
            mediaIds.push(mediaId);
          } else if (media.url) {
            // Download the media first, then upload
            // This is a simplification - you'd need to implement the download
            console.log(`Media URL provided: ${media.url} - would need to download first`);
          }
        }
      }

      // Create the tweet with proper structure according to API
      if (mediaIds.length > 0) {
        // With media - convert to the specific tuple type expected by the API
        // Twitter allows max 4 media items
        const mediaIdsArray = mediaIds.slice(0, 4);
        
        // Explicitly create the expected tuple type
        let mediaIdsTuple: [string] | [string, string] | [string, string, string] | [string, string, string, string];
        
        switch (mediaIdsArray.length) {
          case 1:
            mediaIdsTuple = [mediaIdsArray[0]];
            break;
          case 2:
            mediaIdsTuple = [mediaIdsArray[0], mediaIdsArray[1]];
            break;
          case 3:
            mediaIdsTuple = [mediaIdsArray[0], mediaIdsArray[1], mediaIdsArray[2]];
            break;
          case 4:
            mediaIdsTuple = [mediaIdsArray[0], mediaIdsArray[1], mediaIdsArray[2], mediaIdsArray[3]];
            break;
          default:
            mediaIdsTuple = [mediaIdsArray[0]];
        }
        
        const response = await this.client.v2.tweet(content.text, {
          media: { media_ids: mediaIdsTuple }
        });
        
        console.log(`Post with media created with ID: ${response.data.id}`);
        return response.data.id;
      } else if (content.poll) {
        // With poll
        // Note: Twitter API v2 structures polls differently, this is a simplified implementation
        const response = await this.client.v2.tweet(
          `${content.text}\n\nPoll options:\n${content.poll.options.join('\n')}`
        );
        
        console.log(`Post with poll created with ID: ${response.data.id}`);
        return response.data.id;
      } else {
        // Text only
        const response = await this.client.v2.tweet(content.text);
        
        console.log(`Text post created with ID: ${response.data.id}`);
        return response.data.id;
      }
    } catch (error) {
      console.error('Error creating post:', error);
      throw new Error('Failed to create post on X');
    }
  }

  async replyToPost(reply: Reply): Promise<string> {
    try {
      // Upload media if any
      const mediaIds: string[] = [];
      if (reply.media && reply.media.length > 0) {
        for (const media of reply.media) {
          if (media.data) {
            console.log(`Uploading media for reply, type: ${media.type}, buffer length: ${media.data.length}`);
            
            // Write the buffer to a temporary file first
            const tempDir = path.join(os.tmpdir(), 'x_ai_chatbot');
            await fs.mkdir(tempDir, { recursive: true });
            const tempFile = path.join(tempDir, `reply_image_${Date.now()}.png`);
            await fs.writeFile(tempFile, media.data);
            
            console.log(`Saved reply media to temporary file: ${tempFile}`);
            
            // Upload the media file
            const mediaId = await this.client.v1.uploadMedia(
              tempFile, 
              {
                mimeType: media.type === 'image' ? 'image/png' : 'video/mp4',
              }
            );
            
            // Set alt text if provided
            if (media.altText) {
              await this.client.v1.createMediaMetadata(mediaId, {
                alt_text: { text: media.altText }
              });
            }
            
            mediaIds.push(mediaId);
          } else if (media.url) {
            // Download the media first, then upload
            console.log(`Media URL provided: ${media.url} - would need to download first`);
          }
        }
      }

      // Create the reply with proper structure according to API
      if (mediaIds.length > 0) {
        // With media - convert to the specific tuple type expected by the API
        const mediaIdsArray = mediaIds.slice(0, 4);
        
        // Explicitly create the expected tuple type
        let mediaIdsTuple: [string] | [string, string] | [string, string, string] | [string, string, string, string];
        
        switch (mediaIdsArray.length) {
          case 1:
            mediaIdsTuple = [mediaIdsArray[0]];
            break;
          case 2:
            mediaIdsTuple = [mediaIdsArray[0], mediaIdsArray[1]];
            break;
          case 3:
            mediaIdsTuple = [mediaIdsArray[0], mediaIdsArray[1], mediaIdsArray[2]];
            break;
          case 4:
            mediaIdsTuple = [mediaIdsArray[0], mediaIdsArray[1], mediaIdsArray[2], mediaIdsArray[3]];
            break;
          default:
            mediaIdsTuple = [mediaIdsArray[0]];
        }
        
        const response = await this.client.v2.reply(reply.text, reply.inReplyToId, {
          media: { media_ids: mediaIdsTuple }
        });
        
        console.log(`Reply with media created with ID: ${response.data.id} to tweet ${reply.inReplyToId}`);
        return response.data.id;
      } else {
        // Text only
        const response = await this.client.v2.reply(reply.text, reply.inReplyToId);
        
        console.log(`Text reply created with ID: ${response.data.id} to tweet ${reply.inReplyToId}`);
        return response.data.id;
      }
    } catch (error) {
      console.error('Error creating reply:', error);
      throw new Error('Failed to create reply on X');
    }
  }

  async getNewMentions(): Promise<Post[]> {
    try {
      // Get the authenticated user ID first
      const me = await this.client.v2.me();
      const userId = me.data.id;

      // Get mentions since the last checked mention
      const mentions = await this.client.v2.search(
        `@${me.data.username}`,
        {
          since_id: this.lastMentionId || undefined,
          'tweet.fields': ['created_at', 'author_id', 'conversation_id'],
          expansions: ['author_id'],
          'user.fields': ['username', 'name']
        }
      );

      if (mentions.meta.result_count === 0) {
        return [];
      }

      // Save the latest mention ID for next time
      const latestMentionId = mentions.tweets[0].id;
      await this.saveLastMentionId(latestMentionId);

      // Convert to our Post type
      const posts: Post[] = mentions.tweets.map(tweet => ({
        id: tweet.id,
        text: tweet.text,
        createdAt: new Date(tweet.created_at!)
      }));

      return posts;
    } catch (error) {
      console.error('Error fetching mentions:', error);
      return [];
    }
  }
}