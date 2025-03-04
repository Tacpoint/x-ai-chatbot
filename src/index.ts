import { XChatbot } from './core/XChatbot';
import { SlackService } from './services/slackService';
import { SlackWebhookServer } from './services/slackWebhookServer';
import config from './config/config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

async function main() {
  const chatbot = new XChatbot();
  await chatbot.initialize();
  
  // Start Slack webhook server if configured
  let slackWebhookServer: SlackWebhookServer | null = null;
  
  if (config.slack.webhookUrl && config.slack.apiToken && config.requireApproval) {
    const slackService = new SlackService();
    slackWebhookServer = new SlackWebhookServer(slackService, chatbot);
    slackWebhookServer.start();
    console.log(`Slack webhook server started`);
  }
  
  const argv = await yargs(hideBin(process.argv))
    .command('start', 'Start the X chatbot with scheduled posting and mention monitoring', {}, async () => {
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
      }
    }, async (argv) => {
      const postId = await chatbot.createCustomPost(
        argv.topic as string, 
        argv.media as boolean, 
        argv.poll as boolean
      );
      console.log(`Created post with ID: ${postId}`);
      
      if (!config.requireApproval) {
        process.exit(0);
      } else {
        console.log('Post sent for approval in Slack. Keep the server running to process approvals.');
        console.log('Press Ctrl+C to exit (this will prevent processing approvals).');
      }
    })
    .command('check-mentions', 'Check for new mentions and reply if appropriate', {}, async () => {
      await chatbot.checkAndReplyToMentions();
      console.log('Finished checking mentions.');
      
      if (!config.requireApproval) {
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
  if (['start', 'post', 'check-mentions'].includes(argv._[0] as string) && config.requireApproval) {
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