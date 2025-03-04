import axios from 'axios';
import config from '../../config/config';
import {
  ContentGenerationPrompt,
  EngagementScore,
  LLMService,
  Media,
  Poll,
  Post
} from '../../core/types';

export class GrokService implements LLMService {
  private apiKey: string;
  private baseUrl = 'https://api.xai.com/v1'; // Assuming this endpoint, update as needed

  constructor() {
    this.apiKey = config.grok.apiKey;
  }

  async generateContent(prompt: ContentGenerationPrompt): Promise<{
    text: string;
    media?: Media[];
    poll?: Poll;
  }> {
    const systemPrompt = `You are an AI assistant for a software development and design agency.
Your purpose is to create engaging content for the agency's X (Twitter) account that will attract potential clients.
${prompt.purpose}
Use a ${prompt.tone} tone.`;

    const includeMediaPrompt = prompt.includeMedia
      ? 'Also generate a detailed prompt for an image that would complement your post.'
      : '';
      
    const includePollPrompt = prompt.includePoll
      ? 'Also include a poll with 2-4 options related to your post topic.'
      : '';

    const userPrompt = `Generate a tweet about ${prompt.topic || 'software development, design, or technology trends'}.
The tweet should be engaging, informative, and showcase our expertise.
${includeMediaPrompt}
${includePollPrompt}
Format your response as JSON with the following structure:
{
  "text": "Your tweet text",
  "imagePrompt": "Detailed image generation prompt" (only if image was requested),
  "poll": { "options": ["Option 1", "Option 2", ...], "durationMinutes": 1440 } (only if poll was requested)
}`;

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...(prompt.contextMessages?.map(msg => ({ role: 'user', content: msg })) || []),
        { role: 'user', content: userPrompt }
      ];

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: config.grok.model,
          messages,
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      const content = JSON.parse(response.data.choices[0].message.content || '{}');
      const result: {
        text: string;
        media?: Media[];
        poll?: Poll;
      } = {
        text: content.text
      };

      if (content.imagePrompt && prompt.includeMedia) {
        const imageData = await this.generateImage(content.imagePrompt);
        result.media = [
          {
            type: 'image',
            data: imageData,
            altText: content.imagePrompt.substring(0, 100)
          }
        ];
      }

      if (content.poll && prompt.includePoll) {
        result.poll = {
          options: content.poll.options,
          durationMinutes: content.poll.durationMinutes
        };
      }

      return result;
    } catch (error) {
      console.error('Error generating content with Grok:', error);
      throw new Error('Failed to generate content');
    }
  }

  async shouldReply(mention: Post): Promise<EngagementScore> {
    const prompt = `You are an AI assistant evaluating whether to respond to a mention on X (Twitter).
Analyze the following mention and determine if responding would drive engagement for a software development and design agency.
Score from 0.0 to 1.0, where:
- 0.0-0.3: Low engagement potential (spam, trolling, or generic comments)
- 0.4-0.6: Moderate engagement potential (casual questions or comments)
- 0.7-1.0: High engagement potential (specific questions, business inquiries, technical discussions)

Mention: "${mention.text}"

Respond in JSON format:
{
  "score": 0.0-1.0,
  "reasoning": "Brief explanation of your score"
}`;

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: config.grok.model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      const result = JSON.parse(response.data.choices[0].message.content || '{}');
      return {
        score: result.score,
        reasoning: result.reasoning
      };
    } catch (error) {
      console.error('Error evaluating reply with Grok:', error);
      return { score: 0, reasoning: 'Error evaluating engagement potential' };
    }
  }

  async generateReply(mention: Post): Promise<string> {
    const prompt = `You are an AI assistant for a software development and design agency.
You're responding to a mention on X (Twitter).
Craft a helpful, engaging reply that positions the agency as knowledgeable and approachable.
Keep it concise (max 280 characters) and professional.

Mention: "${mention.text}"

Generate only the reply text without any additional formatting or explanation.`;

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: config.grok.model,
          messages: [{ role: 'user', content: prompt }]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data.choices[0].message.content || '';
    } catch (error) {
      console.error('Error generating reply with Grok:', error);
      throw new Error('Failed to generate reply');
    }
  }

  async generateImage(prompt: string): Promise<Buffer> {
    try {
      // Note: This is a placeholder implementation as Grok may not have direct image generation
      // We would typically integrate with another service like DALL-E or Midjourney here
      // For now, we'll create a simple implementation that could be replaced later
      
      const response = await axios.post(
        `${this.baseUrl}/images/generate`,
        {
          prompt: `${prompt} - Create a professional, high-quality image suitable for a software development and design agency.`,
          n: 1,
          size: '1024x1024',
          response_format: 'b64_json'
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          responseType: 'arraybuffer'
        }
      );

      // If the API doesn't return base64 but returns binary data instead
      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error generating image with Grok:', error);
      throw new Error('Failed to generate image');
    }
  }
}