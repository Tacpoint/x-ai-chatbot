import { WebClient } from '@slack/web-api';
import { IncomingWebhook } from '@slack/webhook';
import config from '../config/config';
import { Media, Poll, Post } from '../core/types';
import { v4 as uuidv4 } from 'uuid';

interface DraftPost {
  id: string;
  content: {
    text: string;
    media?: Media[];
    poll?: Poll;
  };
  timestamp: number;
  status: 'pending' | 'approved' | 'rejected';
  messageTs?: string; // Slack message timestamp for updating
}

export class SlackService {
  private webhook: IncomingWebhook;
  private client: WebClient;
  private pendingApprovals: Map<string, DraftPost>;

  constructor() {
    this.webhook = new IncomingWebhook(config.slack.webhookUrl);
    this.client = new WebClient(config.slack.apiToken);
    this.pendingApprovals = new Map<string, DraftPost>();
  }

  async notifyNewContent(message: string): Promise<void> {
    try {
      await this.webhook.send({
        text: message,
        channel: config.slack.notificationChannel,
      });
    } catch (error) {
      console.error('Error sending Slack notification:', error);
    }
  }

  async requestApproval(post: {
    text: string;
    media?: Media[];
    poll?: Poll;
  }): Promise<string> {
    try {
      // Generate a unique ID for this approval request
      const approvalId = uuidv4();
      
      // Create blocks for Slack message with the post content and buttons
      const blocks = this.createApprovalBlocks(post, approvalId);
      
      // Send message to the approval channel
      const result = await this.client.chat.postMessage({
        channel: config.slack.approvalChannel,
        text: `New content needs approval: "${post.text.substring(0, 50)}${post.text.length > 50 ? '...' : ''}"`,
        blocks,
      });
      
      // Store this pending approval
      this.pendingApprovals.set(approvalId, {
        id: approvalId,
        content: post,
        timestamp: Date.now(),
        status: 'pending',
        messageTs: result.ts as string,
      });
      
      return approvalId;
    } catch (error) {
      console.error('Error requesting Slack approval:', error);
      throw new Error('Failed to request approval');
    }
  }

  private createApprovalBlocks(post: {
    text: string;
    media?: Media[];
    poll?: Poll;
  }, approvalId: string): any[] {
    const blocks: any[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*A new post requires your approval:*',
        },
      },
      {
        type: 'section',
        text: {
          type: 'plain_text',
          text: post.text,
        },
      }
    ];
    
    // Add media info if present
    if (post.media && post.media.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Includes media:* ${post.media.length} item${post.media.length > 1 ? 's' : ''}`,
        },
      });
    }
    
    // Add poll info if present
    if (post.poll) {
      const pollOptionsText = post.poll.options.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n');
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Includes poll:*\n${pollOptionsText}`,
        },
      });
    }
    
    // Add approval buttons
    blocks.push({
      type: 'actions',
      block_id: `approval_${approvalId}`,
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Approve',
            emoji: true,
          },
          style: 'primary',
          value: approvalId,
          action_id: 'approve_post',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Reject',
            emoji: true,
          },
          style: 'danger',
          value: approvalId,
          action_id: 'reject_post',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Edit',
            emoji: true,
          },
          value: approvalId,
          action_id: 'edit_post',
        },
      ],
    });
    
    return blocks;
  }

  async handleApprovalCallback(payload: any): Promise<{
    approvalId: string;
    status: 'approved' | 'rejected' | 'pending';
    content?: {
      text: string;
      media?: Media[];
      poll?: Poll;
    };
  }> {
    try {
      const actionId = payload.actions[0].action_id;
      const approvalId = payload.actions[0].value;
      
      const post = this.pendingApprovals.get(approvalId);
      
      if (!post) {
        throw new Error(`No pending approval found with ID: ${approvalId}`);
      }
      
      if (actionId === 'approve_post') {
        // Update the message to show it was approved
        await this.client.chat.update({
          channel: payload.channel.id,
          ts: post.messageTs!,
          text: `Content approved: "${post.content.text.substring(0, 50)}${post.content.text.length > 50 ? '...' : ''}"`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Content approved by <@${payload.user.id}>*`,
              },
            },
            {
              type: 'section',
              text: {
                type: 'plain_text',
                text: post.content.text,
              },
            },
          ],
        });
        
        // Update our local state
        post.status = 'approved';
        this.pendingApprovals.set(approvalId, post);
        
        return {
          approvalId,
          status: 'approved',
          content: post.content,
        };
      } else if (actionId === 'reject_post') {
        // Update the message to show it was rejected
        await this.client.chat.update({
          channel: payload.channel.id,
          ts: post.messageTs!,
          text: `Content rejected: "${post.content.text.substring(0, 50)}${post.content.text.length > 50 ? '...' : ''}"`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Content rejected by <@${payload.user.id}>*`,
              },
            },
            {
              type: 'section',
              text: {
                type: 'plain_text',
                text: post.content.text,
              },
            },
          ],
        });
        
        // Update our local state
        post.status = 'rejected';
        this.pendingApprovals.set(approvalId, post);
        
        return {
          approvalId,
          status: 'rejected',
        };
      } else if (actionId === 'edit_post') {
        // Open a modal for editing
        await this.client.views.open({
          trigger_id: payload.trigger_id,
          view: {
            type: 'modal',
            callback_id: `edit_post_${approvalId}`,
            title: {
              type: 'plain_text',
              text: 'Edit Post',
            },
            blocks: [
              {
                type: 'input',
                block_id: 'post_text',
                label: {
                  type: 'plain_text',
                  text: 'Edit post content',
                },
                element: {
                  type: 'plain_text_input',
                  action_id: 'post_text_input',
                  multiline: true,
                  initial_value: post.content.text,
                },
              },
            ],
            submit: {
              type: 'plain_text',
              text: 'Save Changes',
            },
          },
        });
        
        // Return without changing status yet
        return {
          approvalId,
          status: 'pending',
        };
      }
      
      throw new Error(`Unknown action ID: ${actionId}`);
    } catch (error) {
      console.error('Error handling approval callback:', error);
      throw new Error('Failed to process approval');
    }
  }

  async handleEditSubmission(payload: any): Promise<{
    approvalId: string;
    content: {
      text: string;
      media?: Media[];
      poll?: Poll;
    };
  }> {
    try {
      const callbackId = payload.view.callback_id;
      const approvalId = callbackId.replace('edit_post_', '');
      
      const post = this.pendingApprovals.get(approvalId);
      
      if (!post) {
        throw new Error(`No pending approval found with ID: ${approvalId}`);
      }
      
      // Get the updated text
      const newText = payload.view.state.values.post_text.post_text_input.value;
      
      // Update the content
      const updatedPost = {
        ...post,
        content: {
          ...post.content,
          text: newText,
        },
      };
      
      this.pendingApprovals.set(approvalId, updatedPost);
      
      // Update the original message with the new content
      const blocks = this.createApprovalBlocks(updatedPost.content, approvalId);
      
      await this.client.chat.update({
        channel: config.slack.approvalChannel,
        ts: post.messageTs!,
        text: `Updated content needs approval: "${newText.substring(0, 50)}${newText.length > 50 ? '...' : ''}"`,
        blocks,
      });
      
      return {
        approvalId,
        content: updatedPost.content,
      };
    } catch (error) {
      console.error('Error handling edit submission:', error);
      throw new Error('Failed to process edit');
    }
  }

  async checkApprovalStatus(approvalId: string): Promise<'pending' | 'approved' | 'rejected'> {
    const post = this.pendingApprovals.get(approvalId);
    
    if (!post) {
      throw new Error(`No pending approval found with ID: ${approvalId}`);
    }
    
    return post.status;
  }

  async getApprovedContent(approvalId: string): Promise<{
    text: string;
    media?: Media[];
    poll?: Poll;
  } | null> {
    const post = this.pendingApprovals.get(approvalId);
    
    if (!post || post.status !== 'approved') {
      return null;
    }
    
    return post.content;
  }
}