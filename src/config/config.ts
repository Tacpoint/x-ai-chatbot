import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  x: {
    apiKey: string;
    apiSecret: string;
    accessToken: string;
    accessSecret: string;
  };
  openai: {
    apiKey: string;
    model: string;
  };
  grok: {
    apiKey: string;
    model: string;
  };
  slack: {
    webhookUrl: string;
    apiToken: string;
    approvalChannel: string;
    notificationChannel: string;
  };
  llmProvider: 'openai' | 'grok';
  postFrequency: string; // cron expression
  replyFrequency: string; // cron expression for checking replies
  replyProbability: number; // 0-1 chance of replying to a mention
  engagementThreshold: number; // minimum score to trigger a reply
  requireApproval: boolean; // whether posts need to be approved
}

const config: Config = {
  x: {
    apiKey: process.env.X_API_KEY || '',
    apiSecret: process.env.X_API_SECRET || '',
    accessToken: process.env.X_ACCESS_TOKEN || '',
    accessSecret: process.env.X_ACCESS_SECRET || '',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o',
  },
  grok: {
    apiKey: process.env.GROK_API_KEY || '',
    model: process.env.GROK_MODEL || 'grok-2',
  },
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
    apiToken: process.env.SLACK_API_TOKEN || '',
    approvalChannel: process.env.SLACK_APPROVAL_CHANNEL || 'content-approvals',
    notificationChannel: process.env.SLACK_NOTIFICATION_CHANNEL || 'social-media',
  },
  llmProvider: (process.env.LLM_PROVIDER as 'openai' | 'grok') || 'openai',
  postFrequency: process.env.POST_FREQUENCY || '0 */4 * * *', // Every 4 hours by default
  replyFrequency: process.env.REPLY_FREQUENCY || '*/15 * * * *', // Every 15 minutes by default
  replyProbability: Number(process.env.REPLY_PROBABILITY) || 0.7,
  engagementThreshold: Number(process.env.ENGAGEMENT_THRESHOLD) || 0.6,
  requireApproval: process.env.REQUIRE_APPROVAL === 'true' || true,
};

export default config;