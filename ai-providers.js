/**
 * AI Provider implementations for FSB v0.1
 * This module contains provider-specific implementations for different AI models
 */

/**
 * Base AI Provider class - defines the interface for all providers
 * @class
 */
class AIProvider {
  constructor(settings) {
    this.settings = settings;
    this.model = settings.modelName;
  }
  
  /**
   * Convert task and DOM state to provider-specific prompt format
   * @abstract
   */
  async buildRequest(prompt, domState) {
    throw new Error('buildRequest must be implemented by provider');
  }
  
  /**
   * Send request to provider API
   * @abstract
   */
  async sendRequest(requestBody) {
    throw new Error('sendRequest must be implemented by provider');
  }
  
  /**
   * Parse provider response to standard format
   * @abstract
   */
  parseResponse(response) {
    throw new Error('parseResponse must be implemented by provider');
  }
  
  /**
   * Test API connection
   * @abstract
   */
  async testConnection() {
    throw new Error('testConnection must be implemented by provider');
  }
}

/**
 * xAI Provider implementation for Grok models
 * @class
 */
class XAIProvider extends AIProvider {
  constructor(settings) {
    super(settings);
    this.apiEndpoint = 'https://api.x.ai/v1/chat/completions';
  }
  
  async buildRequest(prompt, domState) {
    return {
      model: this.model,
      messages: [
        {
          role: "system",
          content: prompt.systemPrompt
        },
        {
          role: "user",
          content: prompt.userPrompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.7,
      top_p: 0.9,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
      stream: false
    };
  }
  
  async sendRequest(requestBody) {
    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.settings.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`xAI API error: ${response.status} - ${error}`);
    }
    
    return await response.json();
  }
  
  parseResponse(response) {
    if (!response.choices || response.choices.length === 0) {
      throw new Error('No response from xAI API');
    }
    
    const content = response.choices[0].message.content;
    const usage = response.usage || {};
    
    return {
      content,
      usage: {
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      },
      model: response.model || this.model
    };
  }
  
  async testConnection() {
    const testRequest = {
      model: this.model,
      messages: [
        {
          role: "user",
          content: "Test connection. Respond with 'Connected successfully!'"
        }
      ],
      max_tokens: 50,
      temperature: 0
    };
    
    try {
      const response = await this.sendRequest(testRequest);
      const parsed = this.parseResponse(response);
      return {
        success: true,
        message: parsed.content,
        model: parsed.model
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

/**
 * Google Gemini Provider implementation
 * @class
 */
class GeminiProvider extends AIProvider {
  constructor(settings) {
    super(settings);
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  }
  
  get apiEndpoint() {
    return `${this.baseUrl}/models/${this.model}:generateContent?key=${this.settings.geminiApiKey}`;
  }
  
  async buildRequest(prompt, domState) {
    // Convert xAI prompt format to Gemini format
    // Add extra JSON-only instructions for Gemini
    const enhancedSystemPrompt = prompt.systemPrompt + '\n\nCRITICAL INSTRUCTION FOR GEMINI: You MUST respond with ONLY raw JSON. Do NOT use markdown code blocks. Do NOT add any explanatory text before or after the JSON. Do NOT wrap the JSON in ```json``` tags. Return ONLY the JSON object itself.';
    
    const systemInstruction = {
      role: "user",
      parts: [{ text: enhancedSystemPrompt }]
    };
    
    const userMessage = {
      role: "user", 
      parts: [{ text: prompt.userPrompt + '\n\nREMEMBER: Respond with ONLY raw JSON, no markdown, no explanations.' }]
    };
    
    return {
      contents: [userMessage],
      systemInstruction: {
        parts: [{ text: prompt.systemPrompt }]
      },
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 2000,
        responseMimeType: "text/plain"
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_NONE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_NONE"
        }
      ]
    };
  }
  
  async sendRequest(requestBody) {
    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }
    
    return await response.json();
  }
  
  parseResponse(response) {
    console.log('Gemini parseResponse - full response:', JSON.stringify(response, null, 2));
    
    if (!response.candidates || response.candidates.length === 0) {
      throw new Error('No response from Gemini API');
    }
    
    const candidate = response.candidates[0];
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      throw new Error('Invalid response format from Gemini API');
    }
    
    let content = candidate.content.parts[0].text;
    console.log('Gemini raw content:', content);
    
    // Extract JSON from the response
    // Gemini often wraps JSON in markdown code blocks or adds explanatory text
    
    // First, try to remove markdown code blocks
    content = content.replace(/```json\s*\n?/gi, '').replace(/```\s*\n?/g, '').trim();
    
    // Then extract JSON object
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
      console.log('Extracted JSON from Gemini response:', content);
    }
    
    const usage = response.usageMetadata || {};
    
    return {
      content,
      usage: {
        inputTokens: usage.promptTokenCount || 0,
        outputTokens: usage.candidatesTokenCount || 0,
        totalTokens: usage.totalTokenCount || 0
      },
      model: this.model
    };
  }
  
  async testConnection() {
    const testRequest = {
      contents: [{
        role: "user",
        parts: [{ text: "Test connection. Respond with 'Connected successfully!'" }]
      }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 50
      }
    };
    
    try {
      const response = await this.sendRequest(testRequest);
      const parsed = this.parseResponse(response);
      return {
        success: true,
        message: parsed.content,
        model: parsed.model
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

/**
 * Factory function to create appropriate provider instance
 * @param {Object} settings - Configuration settings
 * @returns {AIProvider} Provider instance
 */
function createAIProvider(settings) {
  switch (settings.modelProvider) {
    case 'gemini':
      return new GeminiProvider(settings);
    case 'xai':
    default:
      return new XAIProvider(settings);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AIProvider, XAIProvider, GeminiProvider, createAIProvider };
}