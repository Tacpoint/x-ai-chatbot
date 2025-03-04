import config from '../config/config';
import { LLMService } from '../core/types';
import { OpenAIService } from './openai/openaiService';
import { GrokService } from './grok/grokService';

export class LLMFactory {
  static createLLMService(): LLMService {
    if (config.llmProvider === 'openai') {
      return new OpenAIService();
    } else if (config.llmProvider === 'grok') {
      return new GrokService();
    } else {
      console.warn(`Unknown LLM provider: ${config.llmProvider}, defaulting to OpenAI`);
      return new OpenAIService();
    }
  }
}