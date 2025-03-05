import { WebClient } from '@slack/web-api';
import { IncomingWebhook } from '@slack/webhook';
import config from '../config/config';
import { Media, Poll, Post } from '../core/types';
import { v4 as uuidv4 } from 'uuid';
import { PostStorage } from '../utils/postStorage';

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
  private postStorage: PostStorage;

  constructor() {
    this.webhook = new IncomingWebhook(config.slack.webhookUrl);
    this.client = new WebClient(config.slack.apiToken);
    this.pendingApprovals = new Map<string, DraftPost>();
    this.postStorage = new PostStorage();
    
    // Initialize storage and load pending approvals
    this.initialize();
  }
  
  private async initialize(): Promise<void> {
    try {
      // Initialize the storage
      await this.postStorage.initialize();
      
      // Load pending posts from storage
      console.log('Loading pending approvals from storage...');
      await this.loadPendingApprovalsFromStorage();
    } catch (error) {
      console.error('Error initializing SlackService:', error);
    }
  }
  
  private async loadPendingApprovalsFromStorage(): Promise<void> {
    try {
      const pendingPosts = await this.postStorage.getPendingPosts();
      
      for (const post of pendingPosts) {
        if (post.approvalId) {
          console.log(`Loading pending approval ${post.approvalId} for post ${post.id}`);
          
          // Convert from Post to DraftPost format
          // Use the post.id for internal ID to maintain consistency with storage
          this.pendingApprovals.set(post.approvalId, {
            id: post.id, // Use the post ID here, not approval ID
            content: {
              text: post.text,
              media: post.media,
              poll: post.poll
            },
            timestamp: post.createdAt.getTime(),
            status: 'pending',
            messageTs: post.messageTs // Include the messageTs if available
          });
        }
      }
      
      console.log(`Loaded ${this.pendingApprovals.size} pending approvals from storage`);
    } catch (error) {
      console.error('Error loading pending approvals from storage:', error);
    }
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
  }, postId?: string): Promise<{ approvalId: string; messageTs: string }> {
    try {
      // Generate a unique ID for this approval request
      const approvalId = uuidv4();
      
      // Create blocks for Slack message with the post content and buttons
      const blocks = await this.createApprovalBlocks(post, approvalId);
      
      // Send message to the approval channel
      const result = await this.client.chat.postMessage({
        channel: config.slack.approvalChannel,
        text: `New content needs approval: "${post.text.substring(0, 50)}${post.text.length > 50 ? '...' : ''}"`,
        blocks,
      });
      
      const messageTs = result.ts as string;
      
      // Store this pending approval
      this.pendingApprovals.set(approvalId, {
        id: postId || approvalId, // Use the post ID if provided, otherwise use approval ID
        content: post,
        timestamp: Date.now(),
        status: 'pending',
        messageTs: messageTs,
      });
      
      console.log(`Created approval request ${approvalId} for post ID: ${postId || 'unknown'}`);
      
      return { 
        approvalId,
        messageTs
      };
    } catch (error) {
      console.error('Error requesting Slack approval:', error);
      throw new Error('Failed to request approval');
    }
  }

  private async createApprovalBlocks(post: {
    text: string;
    media?: Media[];
    poll?: Poll;
  }, approvalId: string): Promise<any[]> {
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
    
    // Add media info and images if present
    if (post.media && post.media.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Includes media:* ${post.media.length} item${post.media.length > 1 ? 's' : ''}`,
        },
      });
      
      // Try to upload and display each media item
      for (const media of post.media) {
        if (media.data && Buffer.isBuffer(media.data)) {
          try {
            // Determine the file type based on media.type
            const fileType = media.type === 'image' ? 'png' : 
                            media.type === 'video' ? 'mp4' : 
                            media.type === 'gif' ? 'gif' : 'png';
            
            const fileExtension = `.${fileType}`;
            
            // Upload the image to Slack using the recommended uploadV2 method
            // Cast response to any since the type definitions may not be up to date
            const uploadResult = await this.client.files.uploadV2({
              channel_id: config.slack.approvalChannel,
              file: media.data,
              filename: `media_${Date.now()}${fileExtension}`,
              title: media.altText || `Post ${media.type}`,
              initial_comment: `Preview of ${media.type} for post approval`
            }) as any;
            
            // Check for file properties in the response
            // uploadV2 response has different structure than the old method
            const fileInfo = uploadResult.files && uploadResult.files[0];
            if (fileInfo && fileInfo.url_private) {
              // Log information for debugging
              console.log(`File uploaded successfully: ${fileInfo.id}, type: ${fileInfo.mimetype}`);
              
              // For images, add an image block
              if (media.type === 'image' || media.type === 'gif') {
                blocks.push({
                  type: 'image',
                  title: {
                    type: 'plain_text',
                    text: media.altText || `Post ${media.type}`,
                  },
                  image_url: fileInfo.url_private,
                  alt_text: media.altText || `Post ${media.type}`
                });
              } else {
                // For videos or other media types, add a link
                blocks.push({
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `*<${fileInfo.permalink}|Click to view ${media.type}>*`
                  }
                });
              }
            } else {
              console.warn('File uploaded but URL not available in response', uploadResult);
            }
          } catch (uploadError) {
            console.error('Error uploading media to Slack:', uploadError);
            // Continue without the image
          }
        }
      }
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
      
      // First check in-memory store
      let post = this.pendingApprovals.get(approvalId);
      
      // If not found in memory, try to load from storage
      if (!post) {
        console.log(`Approval ${approvalId} not found in memory, checking storage...`);
        const storedPost = await this.postStorage.getPostByApprovalId(approvalId);
        
        if (storedPost && storedPost.approvalId) {
          console.log(`Found post with approval ID ${approvalId} in storage`);
          // Convert to DraftPost format and add to in-memory store
          post = {
            id: storedPost.id, // Use the post ID, not the approval ID
            content: {
              text: storedPost.text,
              media: storedPost.media,
              poll: storedPost.poll
            },
            timestamp: storedPost.createdAt.getTime(),
            status: 'pending'
          };
          
          // Add to in-memory store for future use
          this.pendingApprovals.set(approvalId, post);
        }
      }
      
      // If still not found, then it's truly missing
      if (!post) {
        throw new Error(`No pending approval found with ID: ${approvalId}`);
      }
      
      if (actionId === 'approve_post') {
        // If loaded from storage, post may not have messageTs
        if (!post.messageTs) {
          console.log(`Note: Post loaded from storage doesn't have message timestamp. Skipping Slack message update.`);
        } else {
          try {
            // Create updated blocks including the media if present
            const approvedBlocks = [
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
            ];
            
            // Add media back if present
            if (post.content.media && post.content.media.length > 0) {
              approvedBlocks.push({
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Includes media:* ${post.content.media.length} item${post.content.media.length > 1 ? 's' : ''}`,
                },
              });
              
              // Preserve any previously uploaded images
              // Files can't be re-added programmatically, but at least we show the text
            }
            
            // Update the message with approved status and content
            await this.client.chat.update({
              channel: payload.channel.id,
              ts: post.messageTs,
              text: `Content approved: "${post.content.text.substring(0, 50)}${post.content.text.length > 50 ? '...' : ''}"`,
              blocks: approvedBlocks,
            });
            console.log('Successfully updated Slack message after approval');
          } catch (updateError) {
            console.error('Error updating Slack message:', updateError);
            console.log('Continuing with approval process despite message update error');
            // Continue with approval process even if message update fails
          }
        }
        
        // Update our local state
        post.status = 'approved';
        this.pendingApprovals.set(approvalId, post);
        
        // Update status in persistent storage
        try {
          await this.postStorage.updatePostStatus(post.id, 'approved');
          console.log(`Updated post ${post.id} status to approved in storage`);
        } catch (error) {
          console.error(`Error updating post status in storage:`, error);
          // Continue with approval process even if storage update fails
        }
        
        return {
          approvalId,
          status: 'approved',
          content: post.content,
        };
      } else if (actionId === 'reject_post') {
        // If loaded from storage, post may not have messageTs
        if (!post.messageTs) {
          console.log(`Note: Post loaded from storage doesn't have message timestamp. Skipping Slack message update.`);
        } else {
          try {
            // Create updated blocks including the media if present
            const rejectedBlocks = [
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
            ];
            
            // Add media back if present
            if (post.content.media && post.content.media.length > 0) {
              rejectedBlocks.push({
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Includes media:* ${post.content.media.length} item${post.content.media.length > 1 ? 's' : ''}`,
                },
              });
              
              // Preserve any previously uploaded images
              // Files can't be re-added programmatically, but at least we show the text
            }
            
            // Update the message to show it was rejected
            await this.client.chat.update({
              channel: payload.channel.id,
              ts: post.messageTs,
              text: `Content rejected: "${post.content.text.substring(0, 50)}${post.content.text.length > 50 ? '...' : ''}"`,
              blocks: rejectedBlocks,
            });
            console.log('Successfully updated Slack message after rejection');
          } catch (updateError) {
            console.error('Error updating Slack message:', updateError);
            console.log('Continuing with rejection process despite message update error');
            // Continue with rejection process even if message update fails
          }
        }
        
        // Update our local state
        post.status = 'rejected';
        this.pendingApprovals.set(approvalId, post);
        
        // Update status in persistent storage
        try {
          await this.postStorage.updatePostStatus(post.id, 'rejected');
          console.log(`Updated post ${post.id} status to rejected in storage`);
        } catch (error) {
          console.error(`Error updating post status in storage:`, error);
          // Continue with rejection process even if storage update fails
        }
        
        return {
          approvalId,
          status: 'rejected',
        };
      } else if (actionId === 'edit_post') {
        try {
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
          console.log('Successfully opened edit modal');
        } catch (modalError) {
          console.error('Error opening edit modal:', modalError);
          // Continue with returning pending status despite modal error
        }
        
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
      const blocks = await this.createApprovalBlocks(updatedPost.content, approvalId);
      
      await this.client.chat.update({
        channel: config.slack.approvalChannel,
        ts: post.messageTs!,
        text: `Updated content needs approval: "${newText.substring(0, 50)}${newText.length > 50 ? '...' : ''}"`,
        blocks,
      });
      
      // Update content in storage as well
      try {
        // Get the post from storage to ensure we have the correct ID
        const storedPost = await this.postStorage.getPostByApprovalId(approvalId);
        
        if (storedPost) {
          console.log(`Updating edited post ${storedPost.id} content in storage`);
          // Only update the text content in storage
          await this.postStorage.updatePostContent(storedPost.id, {
            text: newText
          });
        } else {
          console.warn(`Could not find post with approval ID ${approvalId} in storage to update edited content`);
        }
      } catch (storageError) {
        console.error('Error updating edited post content in storage:', storageError);
        // Continue despite storage error - we still have the update in memory
      }
      
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
    // First check in-memory store
    let post = this.pendingApprovals.get(approvalId);
    
    // If not found in memory or not approved, try to load from storage
    if (!post || post.status !== 'approved') {
      console.log(`Approved content for ${approvalId} not found in memory, checking storage...`);
      const storedPost = await this.postStorage.getPostByApprovalId(approvalId);
      
      if (storedPost && storedPost.status === 'approved') {
        console.log(`Found approved post with approval ID ${approvalId} in storage`);
        // Convert to DraftPost format and add to in-memory store
        post = {
          id: storedPost.id,
          content: {
            text: storedPost.text,
            media: storedPost.media,
            poll: storedPost.poll
          },
          timestamp: storedPost.createdAt.getTime(),
          status: 'approved'
        };
        
        // Add to in-memory store for future use
        this.pendingApprovals.set(approvalId, post);
        return post.content;
      }
      
      return null;
    }
    
    return post.content;
  }
}