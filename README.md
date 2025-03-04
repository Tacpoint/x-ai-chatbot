# X AI Chatbot

An AI-powered chatbot that generates content and posts to an X (Twitter) account throughout the day. It can also respond to replies if they warrant engagement, with optional Slack approval flow.

## Features

- 🤖 Uses OpenAI or Grok for content generation
- 📸 Generates images to accompany posts
- 📊 Creates polls to boost engagement
- 📅 Scheduled posting based on configurable frequency
- 💬 Monitors and responds to mentions
- 📈 Evaluates engagement potential before responding
- ✅ Optional Slack approval flow for posts and replies
- 📝 Edit content directly in Slack before approving

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the example environment file and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
4. Build the project:
   ```bash
   npm run build
   ```

## Configuration

Edit the `.env` file to configure the chatbot:

```
# X (Twitter) API credentials
X_API_KEY=your_x_api_key
X_API_SECRET=your_x_api_secret
X_ACCESS_TOKEN=your_x_access_token
X_ACCESS_SECRET=your_x_access_secret

# LLM Provider (openai or grok)
LLM_PROVIDER=openai

# OpenAI API credentials
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4o

# Grok API credentials (if using Grok)
GROK_API_KEY=your_grok_api_key
GROK_MODEL=grok-2

# Slack integration
SLACK_WEBHOOK_URL=your_slack_webhook_url
SLACK_API_TOKEN=your_slack_api_token
SLACK_APPROVAL_CHANNEL=content-approvals
SLACK_NOTIFICATION_CHANNEL=social-media

# Posting schedule (cron expression)
POST_FREQUENCY=0 */4 * * *  # Every 4 hours
REPLY_FREQUENCY=*/15 * * *  # Every 15 minutes

# Reply settings
REPLY_PROBABILITY=0.7       # Chance to evaluate a mention (0-1)
ENGAGEMENT_THRESHOLD=0.6    # Minimum score to reply to a mention (0-1)

# Approval settings
REQUIRE_APPROVAL=true       # Whether posts need to be approved
```

## Usage

### Start the Chatbot

To start the chatbot with scheduled posting and mention monitoring:

```bash
npm run dev
```

or in production:

```bash
npm start
```

### Create a Single Post

To create a post without waiting for the scheduler:

```bash
npm run post -- --topic "Web development tips" --media
```

Options:
- `--topic`: The topic for the post (default: "software development and design")
- `--media`: Include an image with the post (flag)
- `--poll`: Include a poll with the post (flag)

If approval is enabled, the post will be sent to Slack for review before publishing.

### Check Mentions Manually

To check for new mentions and reply if appropriate:

```bash
npm run check-mentions
```

If approval is enabled, any generated replies will be sent to Slack for review before publishing.

### Check Pending Approvals

To manually check and process any pending approvals:

```bash
npm run check-approvals
```

## Slack Integration

When Slack integration is enabled, the system will:

1. Send all generated posts to a designated Slack channel for approval
2. Allow team members to approve, reject, or edit content directly in Slack
3. Automatically publish approved content to X
4. Send notifications of published content to a notification channel

### Setting Up Slack

1. Create a Slack app with the following permissions:
   - `chat:write`
   - `chat:write.public`
   - `incoming-webhook`
   - `commands`
   - `channels:read`

2. Install the app to your workspace
3. Create channels for approvals and notifications
4. Add the app to these channels
5. Configure your webhook URL and OAuth token in `.env`

## Development

### Project Structure

```
src/
  ├── config/         # Configuration and environment variables
  ├── core/           # Core functionality and types
  ├── services/       # Service integrations (OpenAI, Grok, X, Slack)
  ├── utils/          # Utility functions and storage
  └── index.ts        # Main entry point
```

### Adding New Features

To add new features, extend the appropriate service or create a new one in the `services` directory.

## License

ISC