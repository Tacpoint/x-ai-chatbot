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

### Detailed Slack Integration Instructions

#### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and click "Create New App"
2. Choose "From scratch"
3. Enter a name (e.g., "X Content Approvals") and select your workspace

#### 2. Configure Basic Information

Under "Basic Information":
1. Add a description and app icon
2. Note your "Signing Secret" (needed for webhook verification)

#### 3. Set Up OAuth Permissions

1. Navigate to "OAuth & Permissions" in the sidebar
2. Under "Scopes", add these Bot Token Scopes:
   - `chat:write` (Send messages as the app)
   - `chat:write.public` (Send messages to channels without joining)
   - `incoming-webhook` (Post messages via webhooks)
   - `commands` (Add slash commands)
   - `channels:read` (View basic channel info)
   - `reactions:write` (Add reactions to messages)
   - `files:write` (Upload files for image previews)
   - `users:read` (View basic user info)
   - `views:write` (Create and modify modal dialogs)

3. Click "Install to Workspace" and authorize the app
4. Copy the "Bot User OAuth Token" (for your `.env` file as `SLACK_API_TOKEN`)

#### 4. Create Channels in Slack

1. Create two channels in your Slack workspace:
   - `content-approvals` (private): Where approval requests appear
   - `social-media` (public or private): Where notifications appear

2. Invite your Slack app to both channels: 
   - Type `/invite @YourAppName` in each channel

#### 5. Set Up Incoming Webhooks

1. Go to "Incoming Webhooks" in the sidebar
2. Toggle "Activate Incoming Webhooks" to On
3. Click "Add New Webhook to Workspace"
4. Select the `social-media` channel
5. Copy the Webhook URL (for your `.env` file as `SLACK_WEBHOOK_URL`)

#### 6. Configure Interactive Components

1. Go to "Interactivity & Shortcuts" in the sidebar
2. Toggle "Interactivity" to On
3. Set the Request URL to `https://your-domain.com/api/slack/interactions`
   - For local development, use ngrok to create a public URL

#### 7. Configure Event Subscriptions

1. Go to "Event Subscriptions" in the sidebar
2. Toggle "Enable Events" to On
3. Set the Request URL to `https://your-domain.com/api/slack/events`
4. Under "Subscribe to bot events", add:
   - `app_mention` (When the app is mentioned)
   - `app_home_opened` (When a user opens the app's home tab)

#### 8. Deploy Your Webhook Server

For production:
1. Deploy your app to a server with a public HTTPS URL
2. Ensure your server is configured to receive webhook requests

For local development:
1. Install ngrok: `npm install -g ngrok`
2. Run ngrok: `ngrok http 3000`
3. Copy the HTTPS URL (e.g., `https://a1b2c3d4.ngrok.io`)
4. Update your Slack app's Request URLs with this ngrok URL

#### 9. Update Environment Variables

Add these to your `.env` file:

```
# Slack integration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
SLACK_API_TOKEN=xoxb-your-bot-token
SLACK_APPROVAL_CHANNEL=content-approvals
SLACK_NOTIFICATION_CHANNEL=social-media
REQUIRE_APPROVAL=true
```

#### 10. Configure Your Server

1. Ensure your server is listening on the appropriate port:

```typescript
// In src/index.ts
if (config.slack.webhookUrl && config.slack.apiToken && config.requireApproval) {
  const slackService = new SlackService();
  const slackWebhookServer = new SlackWebhookServer(slackService, chatbot, 3000); // Port 3000
  slackWebhookServer.start();
  console.log(`Slack webhook server started on port 3000`);
}
```

2. If using a reverse proxy (nginx, etc.), ensure it forwards webhook requests correctly

#### 11. Test the Integration

1. Start your server with `npm run dev`
2. Create a test post: `npm run post -- --topic "Test post for Slack approval"`
3. Check the `content-approvals` channel in Slack for the approval request
4. Test the approve/reject/edit functionality
5. Verify that approved content gets posted to X
6. Check the `social-media` channel for notifications

#### 12. Security Considerations

For production, implement Slack's request verification:

1. Add the signing secret to your `.env`:
```
SLACK_SIGNING_SECRET=your-signing-secret
```

2. Add verification middleware to your Express server:

```typescript
import crypto from 'crypto';

// Verify Slack request
app.use('/api/slack', (req, res, next) => {
  const slackSignature = req.headers['x-slack-signature'] as string;
  const timestamp = req.headers['x-slack-request-timestamp'] as string;
  const body = req.rawBody; // You need to preserve the raw body
  
  const baseString = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac('sha256', config.slack.signingSecret);
  const mySignature = `v0=${hmac.update(baseString).digest('hex')}`;
  
  if (crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(slackSignature))) {
    next();
  } else {
    res.status(401).send('Unauthorized');
  }
});
```

#### 13. Troubleshooting

If you encounter issues:

1. Check your server logs for errors
2. Verify webhook URLs are accessible from Slack
3. Ensure your app has the correct permissions
4. Confirm the app is in the required channels
5. Check that environment variables are correctly set
6. Verify your server's clock is correctly synchronized (for signature verification)

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

## Deployment

### Deploying to Amazon EC2 (Amazon Linux)

1. **Connect to your EC2 instance**:
   ```bash
   ssh -i your-key.pem ec2-user@your-ec2-public-dns
   ```

2. **Update the system**:
   ```bash
   sudo yum update -y
   ```

3. **Install Node.js and npm**:
   ```bash
   # Install Node.js 18 (or your preferred version)
   curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
   sudo yum install -y nodejs
   
   # Verify installation
   node -v
   npm -v
   ```

4. **Install Git**:
   ```bash
   sudo yum install -y git
   ```

5. **Install additional dependencies**:
   ```bash
   # Install development tools (needed for some npm packages)
   sudo yum groupinstall "Development Tools" -y
   ```

6. **Clone your repository**:
   ```bash
   git clone https://github.com/yourusername/x_ai_chatbot.git
   cd x_ai_chatbot
   ```

7. **Install project dependencies**:
   ```bash
   npm install
   ```

8. **Set up environment variables**:
   ```bash
   cp .env.example .env
   nano .env  # Edit with your actual API keys and settings
   ```

9. **Build the TypeScript project**:
   ```bash
   npm run build
   ```

10. **Set up a process manager (PM2)**:
    ```bash
    # Install PM2 globally
    sudo npm install -g pm2
    
    # Start your application
    pm2 start dist/index.js --name x-chatbot -- start
    
    # Configure PM2 to start on system boot
    pm2 startup
    # Run the command PM2 outputs
    
    # Save the current PM2 configuration
    pm2 save
    ```

11. **Set up reverse proxy with nginx (if needed for webhooks)**:
    ```bash
    # Install nginx
    sudo yum install -y nginx
    sudo systemctl start nginx
    sudo systemctl enable nginx
    
    # Configure nginx
    sudo mkdir -p /etc/nginx/conf.d/
    sudo nano /etc/nginx/conf.d/x-chatbot.conf
    ```

    Add this configuration:
    ```nginx
    # HTTP - Will redirect to HTTPS after Certbot configuration
    server {
        listen 80;
        server_name your-domain.com;
        
        # This section will redirect all HTTP traffic to HTTPS
        # (Certbot will add this automatically when you run it)
        
        location /api/slack/ {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
    
    # HTTPS - Certbot will add SSL configuration here
    # After running Certbot, your config will include both port 80 and 443 sections
    # This is just a reference - Certbot will modify your config automatically
    # server {
    #     listen 443 ssl;
    #     server_name your-domain.com;
    #     
    #     # SSL certificate configuration (added by Certbot)
    #     
    #     location /api/slack/ {
    #         proxy_pass http://localhost:3000;
    #         proxy_http_version 1.1;
    #         proxy_set_header Upgrade $http_upgrade;
    #         proxy_set_header Connection 'upgrade';
    #         proxy_set_header Host $host;
    #         proxy_cache_bypass $http_upgrade;
    #         proxy_set_header X-Real-IP $remote_addr;
    #         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    #         proxy_set_header X-Forwarded-Proto $scheme;
    #     }
    # }
    ```

    ```bash
    # Test and reload nginx
    sudo nginx -t
    sudo systemctl reload nginx
    ```

12. **Set up SSL with Certbot** (required for Slack webhooks):
    ```bash
    # Install EPEL repository first
    sudo yum install -y epel-release
    
    # If that doesn't work (for Amazon Linux 2023), use this instead:
    sudo dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm
    
    # Install Certbot
    sudo yum install -y certbot python3-certbot-nginx
    
    # Get SSL certificate
    sudo certbot --nginx -d your-domain.com
    
    # Automatic renewal
    sudo certbot renew --dry-run
    ```

13. **Test your deployment**:
    ```bash
    # Check the application logs
    pm2 logs x-chatbot
    
    # Test creating a post
    cd x_ai_chatbot
    npm run post -- --topic "Test from EC2"
    ```

14. **Monitor your application**:
    ```bash
    pm2 monit
    ```

### Troubleshooting EC2 Deployment

#### Common npm install Errors

1. **Python/node-gyp errors**:
   ```bash
   # Install Python and required build tools
   sudo yum install -y python3 gcc gcc-c++ make
   
   # If you need Python 2 for older packages
   sudo yum install -y python2
   
   # Set Python version for npm
   npm config set python python3
   ```

2. **Permission errors**:
   ```bash
   # Fix ownership issues
   sudo chown -R $(whoami) ~/.npm
   sudo chown -R $(whoami) ./node_modules
   
   # Or run with sudo (not recommended for production)
   sudo npm install
   ```

3. **Memory issues** (for t2.micro instances):
   ```bash
   # Create a swap file
   sudo dd if=/dev/zero of=/swapfile bs=1M count=1024
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   
   # To make swap permanent, add to /etc/fstab
   echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
   
   # Install with reduced memory usage
   npm install --no-optional
   # Or
   NODE_OPTIONS=--max_old_space_size=512 npm install
   ```

4. **Package version conflicts**:
   ```bash
   # Clear npm cache
   npm cache clean --force
   
   # Try installing with --force
   npm install --force
   
   # Or use a specific Node.js version
   # Install nvm first
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
   # Source nvm
   export NVM_DIR="$HOME/.nvm"
   [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
   # Install and use Node 16
   nvm install 16
   nvm use 16
   ```

5. **Network/proxy issues**:
   ```bash
   # Check if npm can reach the registry
   npm ping
   
   # Configure npm to use a different registry if needed
   npm config set registry https://registry.npmjs.org/
   ```

#### General Troubleshooting

1. **Check application logs**:
   ```bash
   pm2 logs x-chatbot
   ```

2. **Verify ports are open** in EC2 Security Group:
   - Port 80 (HTTP)
   - Port 443 (HTTPS)
   - Port 3000 (Application)

3. **Check if the application is running**:
   ```bash
   pm2 list
   ```

4. **Restart the application**:
   ```bash
   pm2 restart x-chatbot
   ```

5. **Check system resources**:
   ```bash
   htop  # You may need to install it: sudo yum install htop
   ```

6. **Check for disk space issues**:
   ```bash
   df -h
   du -sh ./node_modules
   ```

## License

ISC