import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key" 
});

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function generateChatResponse(
  messages: ChatMessage[],
  llmProvider: string = "gpt-4o"
): Promise<string> {
  try {
    let model = "gpt-4o";
    
    // Map different LLM providers to available models
    switch (llmProvider) {
      case "gpt-4o":
        model = "gpt-4o";
        break;
      case "gpt-3.5-turbo":
        model = "gpt-3.5-turbo";
        break;
      case "claude-3":
        // For now, use GPT-4o as fallback since we don't have Claude integration
        model = "gpt-4o";
        break;
      default:
        model = "gpt-4o";
    }

    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    return response.choices[0].message.content || "I'm having trouble responding right now. Please try again.";
  } catch (error) {
    console.error("OpenAI API Error:", error);
    return "I'm experiencing technical difficulties. Please try again in a moment.";
  }
}

export async function qualifyLead(
  conversation: string,
  qualificationQuestions: string[]
): Promise<{
  score: number;
  extractedData: Record<string, any>;
  recommendation: 'convert' | 'call' | 'nurture';
}> {
  try {
    const prompt = `Analyze this conversation and extract lead qualification data based on these questions: ${qualificationQuestions.join(', ')}
    
    Conversation: ${conversation}
    
    Please respond with JSON containing:
    - score: number from 0-100 indicating lead quality
    - extractedData: object with any information gathered
    - recommendation: "convert", "call", or "nurture"`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a lead qualification expert. Analyze conversations and provide structured lead scoring data."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      score: Math.max(0, Math.min(100, result.score || 0)),
      extractedData: result.extractedData || {},
      recommendation: ['convert', 'call', 'nurture'].includes(result.recommendation) 
        ? result.recommendation 
        : 'nurture'
    };
  } catch (error) {
    console.error("Lead qualification error:", error);
    return {
      score: 0,
      extractedData: {},
      recommendation: 'nurture'
    };
  }
}
