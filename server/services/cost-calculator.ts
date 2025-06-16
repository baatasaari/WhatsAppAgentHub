import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

interface ModelCosts {
  prompt_token_cost_per_1k: number;
  completion_token_cost_per_1k: number;
  currency: string;
}

interface ModelConfig {
  id: string;
  cost_profile: ModelCosts;
}

let modelConfigCache: ModelConfig[] | null = null;

function loadModelConfig(): ModelConfig[] {
  if (modelConfigCache) {
    return modelConfigCache;
  }

  try {
    const configPath = path.join(process.cwd(), 'models', 'llm_config.yaml');
    const fileContents = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(fileContents) as any;
    modelConfigCache = config.models;
    return config.models;
  } catch (error) {
    console.error('Error loading model configuration for cost calculation:', error);
    return [];
  }
}

export function calculateTokenCosts(
  modelId: string,
  promptTokens: number,
  completionTokens: number
): {
  promptCost: number;
  completionCost: number;
  totalCost: number;
  currency: string;
} {
  const models = loadModelConfig();
  const model = models.find(m => m.id === modelId);

  if (!model || !model.cost_profile) {
    console.warn(`No cost profile found for model: ${modelId}`);
    return {
      promptCost: 0,
      completionCost: 0,
      totalCost: 0,
      currency: 'USD'
    };
  }

  const { prompt_token_cost_per_1k, completion_token_cost_per_1k, currency } = model.cost_profile;

  const promptCost = (promptTokens / 1000) * prompt_token_cost_per_1k;
  const completionCost = (completionTokens / 1000) * completion_token_cost_per_1k;
  const totalCost = promptCost + completionCost;

  return {
    promptCost: Number(promptCost.toFixed(6)),
    completionCost: Number(completionCost.toFixed(6)),
    totalCost: Number(totalCost.toFixed(6)),
    currency: currency || 'USD'
  };
}

export function aggregateCosts(costEntries: Array<{
  promptCost: number;
  completionCost: number;
  totalCost: number;
  currency: string;
}>): {
  promptCost: number;
  completionCost: number;
  totalCost: number;
  currency: string;
} {
  if (costEntries.length === 0) {
    return {
      promptCost: 0,
      completionCost: 0,
      totalCost: 0,
      currency: 'USD'
    };
  }

  const totals = costEntries.reduce((acc, entry) => ({
    promptCost: acc.promptCost + entry.promptCost,
    completionCost: acc.completionCost + entry.completionCost,
    totalCost: acc.totalCost + entry.totalCost,
    currency: entry.currency || 'USD'
  }), {
    promptCost: 0,
    completionCost: 0,
    totalCost: 0,
    currency: 'USD'
  });

  return {
    promptCost: Number(totals.promptCost.toFixed(6)),
    completionCost: Number(totals.completionCost.toFixed(6)),
    totalCost: Number(totals.totalCost.toFixed(6)),
    currency: totals.currency
  };
}