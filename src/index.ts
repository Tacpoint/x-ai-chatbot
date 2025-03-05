import { XChatbot } from './core/XChatbot';
import { SlackService } from './services/slackService';
import { SlackWebhookServer } from './services/slackWebhookServer';
import config from './config/config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

async function main() {
  const chatbot = new XChatbot();
  await chatbot.initialize();
  
  // Create the SlackService if configured
  let slackService: SlackService | null = null;
  let slackWebhookServer: SlackWebhookServer | null = null;
  
  if (config.slack.webhookUrl && config.slack.apiToken && config.requireApproval) {
    slackService = new SlackService();
  }
  
  const argv = await yargs(hideBin(process.argv))
    .command('start', 'Start the X chatbot with scheduled posting and mention monitoring', {}, async () => {
      // Start the webhook server only in 'start' mode
      if (slackService && config.requireApproval) {
        slackWebhookServer = new SlackWebhookServer(slackService, chatbot);
        slackWebhookServer.start();
        console.log(`Slack webhook server started`);
      }
      
      chatbot.startSchedulers();
      console.log('X chatbot started. Press Ctrl+C to exit.');
    })
    .command('post', 'Create a single post now', {
      topic: { 
        type: 'string', 
        description: 'Topic for the post', 
        default: 'software development and design'
      },
      media: { 
        type: 'boolean', 
        description: 'Include an image with the post', 
        default: false 
      },
      poll: { 
        type: 'boolean', 
        description: 'Include a poll with the post', 
        default: false 
      },
      server: {
        type: 'boolean',
        description: 'Start webhook server to handle approval callbacks',
        default: false
      }
    }, async (argv) => {
      // Only start the server if explicitly requested with --server flag
      if (slackService && config.requireApproval && argv.server) {
        slackWebhookServer = new SlackWebhookServer(slackService, chatbot);
        slackWebhookServer.start();
        console.log(`Slack webhook server started`);
      }
      
      const postId = await chatbot.createCustomPost(
        argv.topic as string, 
        argv.media as boolean, 
        argv.poll as boolean
      );
      console.log(`Created post with ID: ${postId}`);
      
      if (!config.requireApproval) {
        process.exit(0);
      } else if (!argv.server) {
        console.log('Post sent for approval in Slack.');
        console.log('NOTE: You need to have a separate process running in "start" mode');
        console.log('to handle the approval callbacks from Slack.');
        process.exit(0);
      } else {
        console.log('Post sent for approval in Slack. Keep the server running to process approvals.');
        console.log('Press Ctrl+C to exit (this will prevent processing approvals).');
      }
    })
    .command('check-mentions', 'Check for new mentions and reply if appropriate', {
      server: {
        type: 'boolean',
        description: 'Start webhook server to handle approval callbacks',
        default: false
      }
    }, async (argv) => {
      // Only start the server if explicitly requested with --server flag
      if (slackService && config.requireApproval && argv.server) {
        slackWebhookServer = new SlackWebhookServer(slackService, chatbot);
        slackWebhookServer.start();
        console.log(`Slack webhook server started`);
      }
      
      await chatbot.checkAndReplyToMentions();
      console.log('Finished checking mentions.');
      
      if (!config.requireApproval) {
        process.exit(0);
      } else if (!argv.server) {
        console.log('Any replies have been sent for approval in Slack.');
        console.log('NOTE: You need to have a separate process running in "start" mode');
        console.log('to handle the approval callbacks from Slack.');
        process.exit(0);
      } else {
        console.log('Any replies have been sent for approval in Slack. Keep the server running to process approvals.');
        console.log('Press Ctrl+C to exit (this will prevent processing approvals).');
      }
    })
    .command('check-approvals', 'Check for pending approvals and process any that have been approved/rejected', {}, async () => {
      await chatbot.checkPendingApprovals();
      console.log('Finished checking pending approvals.');
      process.exit(0);
    })
    .demandCommand(1, 'You need to specify a command')
    .help()
    .parse();
  
  // Keep process running for commands that need to handle webhooks
  // Only if the server is actually running
  if (slackWebhookServer && 
      (['start'].includes(argv._[0] as string) || 
       (argv._[0] === 'post' && argv.server) ||
       (argv._[0] === 'check-mentions' && argv.server))) {
    
    process.on('SIGINT', () => {
      console.log('Shutting down...');
      chatbot.stopSchedulers();
      process.exit(0);
    });
  }
}

main().catch(error => {
  console.error('Error in main application:', error);
  process.exit(1);
});