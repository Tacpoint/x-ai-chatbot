import express from 'express';
import bodyParser from 'body-parser';
import { SlackService } from './slackService';
import { XChatbot } from '../core/XChatbot';
import { Request, Response } from 'express';

export class SlackWebhookServer {
  private app: express.Application;
  private port: number;
  private slackService: SlackService;
  private chatbot: XChatbot;

  constructor(slackService: SlackService, chatbot: XChatbot, port: number = 3000) {
    this.app = express();
    this.port = port;
    this.slackService = slackService;
    this.chatbot = chatbot;

    // Configure Express middleware
    this.app.use(bodyParser.urlencoded({ extended: true }));
    this.app.use(bodyParser.json());

    // Set up routes
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', this.healthCheckHandler.bind(this));

    // Slack events webhook endpoint
    this.app.post('/api/slack/events', this.slackEventsHandler.bind(this));

    // Slack interactions webhook endpoint
    this.app.post('/api/slack/interactions', this.slackInteractionsHandler.bind(this));
  }

  private healthCheckHandler(req: Request, res: Response): void {
    res.status(200).send('OK');
  }

  private slackEventsHandler(req: Request, res: Response): void {
    // Verify Slack signature here in a real implementation
    const payload = req.body;
    
    if (payload.type === 'url_verification') {
      // Respond to Slack's URL verification challenge
      res.status(200).send({ challenge: payload.challenge });
      return;
    }
    
    // Acknowledge receipt immediately (important for Slack)
    res.status(200).send();
    
    // Process the event asynchronously
    this.handleSlackEvent(payload).catch(error => {
      console.error('Error handling Slack event:', error);
    });
  }

  private async slackInteractionsHandler(req: Request, res: Response): Promise<void> {
    try {
      // Parse the payload (Slack sends it as a form-encoded string)
      const payload = JSON.parse(req.body.payload);
      
      // Acknowledge receipt immediately
      res.status(200).send();
      
      // Handle the interaction based on its type
      if (payload.type === 'block_actions') {
        try {
          // Handle button clicks for approval/rejection
          const result = await this.slackService.handleApprovalCallback(payload);
          
          if (result.status === 'approved') {
            // Post was approved, publish it
            console.log(`Approval received for ${result.approvalId}, publishing post...`);
            await this.chatbot.publishApprovedPost(result.approvalId);
          } else if (result.status === 'rejected') {
            console.log(`Post with approval ID ${result.approvalId} was rejected`);
          }
        } catch (error) {
          console.error('Error processing approval action:', error);
        }
      } else if (payload.type === 'view_submission') {
        try {
          // Handle form submissions from modals (e.g., edit post)
          const result = await this.slackService.handleEditSubmission(payload);
          console.log(`Post edited with approval ID ${result.approvalId}`);
        } catch (error) {
          console.error('Error processing edit submission:', error);
        }
      }
    } catch (error) {
      console.error('Error handling Slack interaction:', error);
    }
  }

  private async handleSlackEvent(payload: any): Promise<void> {
    // Handle different types of Slack events here
    if (payload.event && payload.event.type === 'app_home_opened') {
      // Handle when a user opens the app home
      // Could show recent posts, stats, etc.
    } else if (payload.event && payload.event.type === 'app_mention') {
      // Handle when the bot is mentioned
      // Could respond with help info, status, etc.
    }
  }

  public start(): void {
    this.app.listen(this.port, () => {
      console.log(`Slack webhook server listening on port ${this.port}`);
    });
  }
}