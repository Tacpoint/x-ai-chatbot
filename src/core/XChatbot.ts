import { LLMService, ContentGenerationPrompt, Post, Reply } from './types';
import { LLMFactory } from '../services/llmFactory';
import { XService } from '../services/xService';
import config from '../config/config';
import cron from 'node-cron';

export class XChatbot {
  private llmService: LLMService;
  private xService: XService;
  private postScheduler: cron.ScheduledTask | null = null;
  private mentionCheckerScheduler: cron.ScheduledTask | null = null;

  constructor() {
    this.llmService = LLMFactory.createLLMService();
    this.xService = new XService();
  }

  async initialize(): Promise<void> {
    await this.xService.initialize();
    console.log('X chatbot initialized');
  }

  startPostScheduler(): void {
    // Schedule regular posts
    this.postScheduler = cron.schedule(config.postFrequency, async () => {
      try {
        await this.createScheduledPost();
      } catch (error) {
        console.error('Error creating scheduled post:', error);
      }
    });

    // Check for mentions every 15 minutes
    this.mentionCheckerScheduler = cron.schedule('*/15 * * * *', async () => {
      try {
        await this.checkAndReplyToMentions();
      } catch (error) {
        console.error('Error checking mentions:', error);
      }
    });

    console.log(`Post scheduler started with frequency: ${config.postFrequency}`);
    console.log('Mention checker started with frequency: */15 * * * *');
  }

  stopSchedulers(): void {
    if (this.postScheduler) {
      this.postScheduler.stop();
      this.postScheduler = null;
    }

    if (this.mentionCheckerScheduler) {
      this.mentionCheckerScheduler.stop();
      this.mentionCheckerScheduler = null;
    }

    console.log('All schedulers stopped');
  }

  async createScheduledPost(): Promise<string> {
    console.log('Creating scheduled post...');
    
    // Randomly decide whether to include media and/or polls
    const includeMedia = Math.random() > 0.4; // 60% chance to include media
    const includePoll = !includeMedia && Math.random() > 0.6; // 40% chance to include poll if no media
    
    const prompt: ContentGenerationPrompt = {
      includeMedia,
      includePoll,
      purpose: 'Showcase expertise in software development and design to attract potential clients',
      tone: 'professional yet conversational'
    };
    
    const content = await this.llmService.generateContent(prompt);
    const postId = await this.xService.createPost(content);
    
    console.log(`Created scheduled post with ID: ${postId}`);
    return postId;
  }

  async createCustomPost(topic: string, includeMedia: boolean = false, includePoll: boolean = false): Promise<string> {
    console.log(`Creating custom post about topic: ${topic}`);
    
    const prompt: ContentGenerationPrompt = {
      topic,
      includeMedia,
      includePoll,
      purpose: 'Showcase expertise in software development and design to attract potential clients',
      tone: 'professional yet conversational'
    };
    
    const content = await this.llmService.generateContent(prompt);
    const postId = await this.xService.createPost(content);
    
    console.log(`Created custom post with ID: ${postId}`);
    return postId;
  }

  async checkAndReplyToMentions(): Promise<void> {
    console.log('Checking for new mentions...');
    const mentions = await this.xService.getNewMentions();
    
    if (mentions.length === 0) {
      console.log('No new mentions found');
      return;
    }
    
    console.log(`Found ${mentions.length} new mentions`);
    
    for (const mention of mentions) {
      // Randomly decide whether to evaluate this mention (for rate limiting)
      if (Math.random() > config.replyProbability) {
        console.log(`Skipping mention ${mention.id} due to random probability`);
        continue;
      }
      
      // Evaluate if this mention is worth replying to
      const engagementScore = await this.llmService.shouldReply(mention);
      
      if (engagementScore.score >= config.engagementThreshold) {
        console.log(`Replying to mention ${mention.id} with engagement score ${engagementScore.score}`);
        console.log(`Reasoning: ${engagementScore.reasoning}`);
        
        const replyText = await this.llmService.generateReply(mention);
        
        const reply: Reply = {
          inReplyToId: mention.id,
          text: replyText
        };
        
        await this.xService.replyToPost(reply);
      } else {
        console.log(`Not replying to mention ${mention.id} with low engagement score ${engagementScore.score}`);
        console.log(`Reasoning: ${engagementScore.reasoning}`);
      }
    }
  }
}