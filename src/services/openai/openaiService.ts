import OpenAI from 'openai';
import config from '../../config/config';
import {
  ContentGenerationPrompt,
  EngagementScore,
  LLMService,
  Media,
  Poll,
  Post
} from '../../core/types';

export class OpenAIService implements LLMService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey
    });
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
      const response = await this.client.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...(prompt.contextMessages?.map(msg => ({ role: 'user' as const, content: msg })) || []),
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' }
      });

      const content = JSON.parse(response.choices[0].message.content || '{}');
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
      console.error('Error generating content with OpenAI:', error);
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
      const response = await this.client.chat.completions.create({
        model: config.openai.model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return {
        score: result.score,
        reasoning: result.reasoning
      };
    } catch (error) {
      console.error('Error evaluating reply with OpenAI:', error);
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
      const response = await this.client.chat.completions.create({
        model: config.openai.model,
        messages: [{ role: 'user', content: prompt }]
      });

      return response.choices[0].message.content || '';
    } catch (error) {
      console.error('Error generating reply with OpenAI:', error);
      throw new Error('Failed to generate reply');
    }
  }

  async generateImage(prompt: string): Promise<Buffer> {
    try {
      const response = await this.client.images.generate({
        model: 'dall-e-3',
        prompt: `${prompt} - Create a professional, high-quality image suitable for a software development and design agency.`,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json'
      });

      const base64Data = response.data[0].b64_json;
      if (!base64Data) {
        throw new Error('No image data returned');
      }
      
      return Buffer.from(base64Data, 'base64');
    } catch (error) {
      console.error('Error generating image with OpenAI:', error);
      throw new Error('Failed to generate image');
    }
  }
}