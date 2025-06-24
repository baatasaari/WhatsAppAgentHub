import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  Brain, 
  DollarSign, 
  Clock, 
  TrendingUp, 
  Activity, 
  RefreshCw,
  Zap,
  Target,
  BarChart3,
  AlertCircle
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface ModelMetrics {
  id: string;
  name: string;
  provider: string;
  totalRequests: number;
  successRate: number;
  avgResponseTime: number;
  totalCost: number;
  costPer1k: number;
  lastUsed: string;
}

interface UsageStats {
  totalRequests: number;
  totalCost: number;
  avgResponseTime: number;
  successRate: number;
  topModels: ModelMetrics[];
  dailyUsage: Array<{
    date: string;
    requests: number;
    cost: number;
  }>;
}

interface ModelRecommendation {
  modelId: string;
  reasons: string[];
  potentialSavings?: number;
  confidenceScore: number;
}

export default function LiteLLMDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');

  // Fetch usage statistics
  const { data: usageStats, isLoading: loadingStats } = useQuery({
    queryKey: ['/api/litellm/usage-stats', selectedTimeRange],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch model recommendations
  const { data: recommendations, isLoading: loadingRecommendations } = useQuery({
    queryKey: ['/api/litellm/recommendations'],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  // Fetch available models
  const { data: availableModels, isLoading: loadingModels } = useQuery({
    queryKey: ['/api/litellm/models'],
  });

  // Sync models mutation
  const syncModelsMutation = useMutation({
    mutationFn: () => apiRequest('/api/litellm/sync-models', { method: 'POST' }),
    onSuccess: () => {
      toast({
        title: "Models Synced",
        description: "Model catalog has been updated with latest available models.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/litellm/models'] });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error.message || "Failed to sync models from LiteLLM.",
        variant: "destructive",
      });
    },
  });

  // Test model mutation
  const testModelMutation = useMutation({
    mutationFn: (modelId: string) => apiRequest(`/api/litellm/test-model/${modelId}`, { method: 'POST' }),
    onSuccess: (data: any, modelId: string) => {
      toast({
        title: "Model Test Complete",
        description: `${modelId} responded in ${data.responseTime}ms with ${data.success ? 'success' : 'failure'}.`,
        variant: data.success ? "default" : "destructive",
      });
    },
  });

  const stats: UsageStats = usageStats || {
    totalRequests: 0,
    totalCost: 0,
    avgResponseTime: 0,
    successRate: 0,
    topModels: [],
    dailyUsage: [],
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">LiteLLM Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Unified LLM management and analytics across all providers
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => syncModelsMutation.mutate()}
            disabled={syncModelsMutation.isPending}
            variant="outline"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncModelsMutation.isPending ? 'animate-spin' : ''}`} />
            Sync Models
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Last {selectedTimeRange === '7d' ? '7 days' : selectedTimeRange === '30d' ? '30 days' : '24 hours'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalCost.toFixed(4)}</div>
            <p className="text-xs text-muted-foreground">
              ${(stats.totalCost / Math.max(1, stats.totalRequests) * 1000).toFixed(4)} per 1K requests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgResponseTime.toFixed(0)}ms</div>
            <p className="text-xs text-muted-foreground">
              Average across all models
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</div>
            <Progress value={stats.successRate} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="models" className="space-y-6">
        <TabsList>
          <TabsTrigger value="models">Model Management</TabsTrigger>
          <TabsTrigger value="analytics">Usage Analytics</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="testing">Model Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="models" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Available Models</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage and monitor all available LLM models across providers
              </p>
            </CardHeader>
            <CardContent>
              {loadingModels ? (
                <div className="flex items-center justify-center p-6">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableModels?.map((model: any) => (
                    <Card key={model.id} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium truncate">{model.name}</h3>
                        <Badge variant="outline">{model.provider}</Badge>
                      </div>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div>Input: ${model.inputCostPer1k}/1K tokens</div>
                        <div>Output: ${model.outputCostPer1k}/1K tokens</div>
                        <div>Max Tokens: {model.maxTokens.toLocaleString()}</div>
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => testModelMutation.mutate(model.id)}
                          disabled={testModelMutation.isPending}
                        >
                          <Zap className="w-3 h-3 mr-1" />
                          Test
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Usage Analytics</h2>
            <div className="flex gap-2">
              {['24h', '7d', '30d'].map((range) => (
                <Button
                  key={range}
                  variant={selectedTimeRange === range ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTimeRange(range)}
                >
                  {range}
                </Button>
              ))}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Top Performing Models</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.topModels.map((model, index) => (
                  <div key={model.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{model.name}</div>
                        <div className="text-sm text-muted-foreground">{model.provider}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{model.totalRequests} requests</div>
                      <div className="text-sm text-muted-foreground">
                        ${model.totalCost.toFixed(4)} • {model.avgResponseTime}ms
                      </div>
                    </div>
                  </div>
                ))}
                {stats.topModels.length === 0 && (
                  <div className="text-center text-muted-foreground py-6">
                    No usage data available for the selected time range
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Model Recommendations</CardTitle>
              <p className="text-sm text-muted-foreground">
                AI-powered suggestions to optimize your model usage and reduce costs
              </p>
            </CardHeader>
            <CardContent>
              {loadingRecommendations ? (
                <div className="flex items-center justify-center p-6">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
              ) : recommendations?.recommended?.length > 0 ? (
                <div className="space-y-4">
                  {recommendations.recommended.map((modelId: string) => (
                    <Alert key={modelId}>
                      <Target className="h-4 w-4" />
                      <AlertDescription>
                        <div className="font-medium mb-2">Recommended: {modelId}</div>
                        <ul className="text-sm space-y-1">
                          {recommendations.reasons[modelId]?.map((reason: string, i: number) => (
                            <li key={i} className="flex items-center gap-2">
                              <div className="w-1 h-1 bg-current rounded-full" />
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-6">
                  <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No recommendations available yet.</p>
                  <p className="text-sm">Use the platform more to get personalized suggestions.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Model Performance Testing</CardTitle>
              <p className="text-sm text-muted-foreground">
                Test model latency and quality across different providers
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableModels?.slice(0, 6).map((model: any) => (
                  <Card key={model.id} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-medium">{model.name}</h3>
                        <p className="text-sm text-muted-foreground">{model.provider}</p>
                      </div>
                      <Badge variant={model.status === 'active' ? 'default' : 'secondary'}>
                        {model.status}
                      </Badge>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => testModelMutation.mutate(model.id)}
                      disabled={testModelMutation.isPending}
                    >
                      {testModelMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Zap className="w-4 h-4 mr-2" />
                      )}
                      Test Performance
                    </Button>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}