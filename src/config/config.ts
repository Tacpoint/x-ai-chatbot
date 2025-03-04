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
  llmProvider: 'openai' | 'grok';
  postFrequency: string; // cron expression
  replyProbability: number; // 0-1 chance of replying to a mention
  engagementThreshold: number; // minimum score to trigger a reply
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
  llmProvider: (process.env.LLM_PROVIDER as 'openai' | 'grok') || 'openai',
  postFrequency: process.env.POST_FREQUENCY || '0 */4 * * *', // Every 4 hours by default
  replyProbability: Number(process.env.REPLY_PROBABILITY) || 0.7,
  engagementThreshold: Number(process.env.ENGAGEMENT_THRESHOLD) || 0.6,
};

export default config;