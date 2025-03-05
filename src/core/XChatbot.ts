import { LLMService, ContentGenerationPrompt, Post, Reply } from './types';
import { LLMFactory } from '../services/llmFactory';
import { XService } from '../services/xService';
import { SlackService } from '../services/slackService';
import { PostStorage } from '../utils/postStorage';
import config from '../config/config';
import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';

export class XChatbot {
  private llmService: LLMService;
  private xService: XService;
  private slackService: SlackService | null = null;
  private postStorage: PostStorage;
  private postScheduler: cron.ScheduledTask | null = null;
  private mentionCheckerScheduler: cron.ScheduledTask | null = null;
  private approvalCheckerScheduler: cron.ScheduledTask | null = null;

  constructor() {
    this.llmService = LLMFactory.createLLMService();
    this.xService = new XService();
    this.postStorage = new PostStorage();
    
    if (config.slack.webhookUrl && config.slack.apiToken) {
      this.slackService = new SlackService();
    }
  }

  async initialize(): Promise<void> {
    await this.xService.initialize();
    await this.postStorage.initialize();
    console.log('X chatbot initialized');
  }

  startSchedulers(): void {
    // Schedule regular posts
    this.postScheduler = cron.schedule(config.postFrequency, async () => {
      try {
        await this.createScheduledPost();
      } catch (error) {
        console.error('Error creating scheduled post:', error);
      }
    });

    // Check for mentions based on configured frequency
    this.mentionCheckerScheduler = cron.schedule(config.replyFrequency, async () => {
      try {
        await this.checkAndReplyToMentions();
      } catch (error) {
        console.error('Error checking mentions:', error);
      }
    });

    // Check for approved posts that need to be published
    this.approvalCheckerScheduler = cron.schedule('*/5 * * * *', async () => {
      try {
        await this.checkPendingApprovals();
      } catch (error) {
        console.error('Error checking pending approvals:', error);
      }
    });

    console.log(`Post scheduler started with frequency: ${config.postFrequency}`);
    console.log(`Mention checker started with frequency: ${config.replyFrequency}`);
    console.log('Approval checker started with frequency: */5 * * * *');
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

    if (this.approvalCheckerScheduler) {
      this.approvalCheckerScheduler.stop();
      this.approvalCheckerScheduler = null;
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
    
    // Generate an ID for this post
    const postId = uuidv4();
    
    if (config.requireApproval && this.slackService) {
      // Save as a draft and request approval
      await this.postStorage.saveDraft({
        id: postId,
        text: content.text,
        media: content.media,
        poll: content.poll
      });
      
      // Request approval via Slack - pass the post ID to maintain ID consistency
      const { approvalId, messageTs } = await this.slackService.requestApproval(content, postId);
      
      // Log the message timestamp for debugging
      console.log(`Received messageTs: ${messageTs} for approval ID: ${approvalId}`);
      
      // Update the post with the approval ID and message timestamp
      await this.postStorage.updatePostStatus(postId, 'pending', approvalId, messageTs);
      
      console.log(`Created scheduled post with ID: ${postId} (pending approval: ${approvalId})`);
      return postId;
    } else {
      // No approval required, publish immediately
      const xPostId = await this.xService.createPost(content);
      
      // Save the published post
      await this.postStorage.saveDraft({
        id: postId,
        text: content.text,
        media: content.media,
        poll: content.poll
      });
      await this.postStorage.updatePostStatus(postId, 'published');
      
      // Notify via Slack if configured
      if (this.slackService) {
        await this.slackService.notifyNewContent(`New post published: ${content.text.substring(0, 100)}${content.text.length > 100 ? '...' : ''}`);
      }
      
      console.log(`Created and published scheduled post with ID: ${postId} (X post ID: ${xPostId})`);
      return postId;
    }
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
    
    // Generate an ID for this post
    const postId = uuidv4();
    
    if (config.requireApproval && this.slackService) {
      // Save as a draft and request approval
      await this.postStorage.saveDraft({
        id: postId,
        text: content.text,
        media: content.media,
        poll: content.poll
      });
      
      // Request approval via Slack - pass the post ID to maintain ID consistency
      const { approvalId, messageTs } = await this.slackService.requestApproval(content, postId);
      
      // Log the message timestamp for debugging
      console.log(`Received messageTs: ${messageTs} for approval ID: ${approvalId}`);
      
      // Update the post with the approval ID and message timestamp
      await this.postStorage.updatePostStatus(postId, 'pending', approvalId, messageTs);
      
      console.log(`Created custom post with ID: ${postId} (pending approval: ${approvalId})`);
      return postId;
    } else {
      // No approval required, publish immediately
      const xPostId = await this.xService.createPost(content);
      
      // Save the published post
      await this.postStorage.saveDraft({
        id: postId,
        text: content.text,
        media: content.media,
        poll: content.poll
      });
      await this.postStorage.updatePostStatus(postId, 'published');
      
      // Notify via Slack if configured
      if (this.slackService) {
        await this.slackService.notifyNewContent(`New post published: ${content.text.substring(0, 100)}${content.text.length > 100 ? '...' : ''}`);
      }
      
      console.log(`Created and published custom post with ID: ${postId} (X post ID: ${xPostId})`);
      return postId;
    }
  }

  async publishApprovedPost(approvalId: string): Promise<void> {
    if (!this.slackService) {
      throw new Error('Slack service not initialized');
    }
    
    // Get the content that was approved
    const content = await this.slackService.getApprovedContent(approvalId);
    
    if (!content) {
      throw new Error(`No approved content found for approval ID: ${approvalId}`);
    }
    
    // Find the post with this approval ID
    const post = await this.postStorage.getPostByApprovalId(approvalId);
    
    if (!post) {
      throw new Error(`No post found with approval ID: ${approvalId}`);
    }
    
    // Publish to X
    const xPostId = await this.xService.createPost(content);
    
    // Update the post status
    await this.postStorage.updatePostStatus(post.id, 'published');
    
    // Notify that the post was published
    await this.slackService.notifyNewContent(
      `Post approved and published: ${content.text.substring(0, 100)}${content.text.length > 100 ? '...' : ''}`
    );
    
    console.log(`Published approved post with ID: ${post.id} (X post ID: ${xPostId})`);
  }

  async checkPendingApprovals(): Promise<void> {
    if (!this.slackService) {
      return; // No Slack integration, nothing to check
    }
    
    // Get all pending posts
    const pendingPosts = await this.postStorage.getPendingPosts();
    
    for (const post of pendingPosts) {
      if (!post.approvalId) {
        continue;
      }
      
      try {
        // Check the status in Slack
        const status = await this.slackService.checkApprovalStatus(post.approvalId);
        
        if (status === 'approved') {
          // Post was approved, publish it
          await this.publishApprovedPost(post.approvalId);
        } else if (status === 'rejected') {
          // Post was rejected, update its status
          await this.postStorage.updatePostStatus(post.id, 'rejected');
          console.log(`Post ${post.id} was rejected`);
        }
      } catch (error) {
        console.error(`Error checking approval status for post ${post.id}:`, error);
      }
    }
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
        
        if (config.requireApproval && this.slackService) {
          // Request approval for this reply
          const replyId = uuidv4();
          
          await this.postStorage.saveDraft({
            id: replyId,
            text: replyText,
            approvalId: undefined
          });
          
          // Request approval via Slack
          const { approvalId, messageTs } = await this.slackService.requestApproval({
            text: `REPLY to @mention: ${replyText}`
          });
          
          // Update the post with the approval ID
          await this.postStorage.updatePostContent(replyId, {
            text: JSON.stringify({
              replyText,
              inReplyToId: mention.id
            })
          });
          await this.postStorage.updatePostStatus(replyId, 'pending', approvalId, messageTs);
          
          console.log(`Created reply to mention ${mention.id} (pending approval: ${approvalId})`);
        } else {
          // Send reply immediately
          const reply: Reply = {
            inReplyToId: mention.id,
            text: replyText
          };
          
          await this.xService.replyToPost(reply);
          console.log(`Sent reply to mention ${mention.id}`);
        }
      } else {
        console.log(`Not replying to mention ${mention.id} with low engagement score ${engagementScore.score}`);
        console.log(`Reasoning: ${engagementScore.reasoning}`);
      }
    }
  }

  async publishApprovedReply(approvalId: string): Promise<void> {
    if (!this.slackService) {
      throw new Error('Slack service not initialized');
    }
    
    // Get the post with this approval ID
    const post = await this.postStorage.getPostByApprovalId(approvalId);
    
    if (!post) {
      throw new Error(`No post found with approval ID: ${approvalId}`);
    }
    
    try {
      // The text field contains the reply info as JSON
      const replyInfo = JSON.parse(post.text);
      
      // Send the reply
      const reply: Reply = {
        inReplyToId: replyInfo.inReplyToId,
        text: replyInfo.replyText
      };
      
      const replyId = await this.xService.replyToPost(reply);
      
      // Update the post status
      await this.postStorage.updatePostStatus(post.id, 'published');
      
      // Notify that the reply was sent
      if (this.slackService) {
        await this.slackService.notifyNewContent(
          `Reply approved and sent: ${replyInfo.replyText.substring(0, 100)}${replyInfo.replyText.length > 100 ? '...' : ''}`
        );
      }
      
      console.log(`Published approved reply with ID: ${post.id} (X reply ID: ${replyId})`);
    } catch (error) {
      console.error(`Error publishing approved reply: ${error}`);
      throw new Error('Failed to publish approved reply');
    }
  }
}