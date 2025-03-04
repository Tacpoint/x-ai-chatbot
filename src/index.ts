import { XChatbot } from './core/XChatbot';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

async function main() {
  const chatbot = new XChatbot();
  await chatbot.initialize();
  
  const argv = await yargs(hideBin(process.argv))
    .command('start', 'Start the X chatbot with scheduled posting and mention monitoring', {}, async () => {
      chatbot.startPostScheduler();
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
      process.exit(0);
    })
    .command('check-mentions', 'Check for new mentions and reply if appropriate', {}, async () => {
      await chatbot.checkAndReplyToMentions();
      console.log('Finished checking mentions.');
      process.exit(0);
    })
    .demandCommand(1, 'You need to specify a command')
    .help()
    .parse();
  
  // Keep process running for 'start' command
  if (argv._[0] === 'start') {
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