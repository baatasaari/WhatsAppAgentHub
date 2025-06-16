import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, Zap, DollarSign, Clock, Shield, Star } from "lucide-react";

export default function ModelConfig() {
  const { data: models, isLoading, error } = useQuery({
    queryKey: ["/api/models"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <Bot className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Configuration Error</h3>
        <p className="text-gray-500">Unable to load model configuration</p>
      </div>
    );
  }

  const modelsList = Array.isArray(models) ? models : [];

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-xl">
        <h1 className="text-2xl font-bold">LLM Model Configuration</h1>
        <p className="text-blue-100 mt-1">Compare capabilities, costs, and performance metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modelsList.map((model: any) => (
          <Card key={model.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{model.name}</CardTitle>
                <Badge 
                  variant="secondary" 
                  className={`${model.badge_color} bg-opacity-10`}
                >
                  {model.badge}
                </Badge>
              </div>
              <p className="text-sm text-gray-600">{model.description}</p>
              <div className="flex items-center space-x-2 text-xs text-gray-500">
                <span>{model.provider}</span>
                <span>•</span>
                <span>{model.version}</span>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Cost Information */}
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <DollarSign className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-green-900">Cost Profile</span>
                </div>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Input:</span>
                    <span>${model.cost_profile?.prompt_token_cost_per_1k?.toFixed(4)}/1K tokens</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Output:</span>
                    <span>${model.cost_profile?.completion_token_cost_per_1k?.toFixed(4)}/1K tokens</span>
                  </div>
                </div>
              </div>

              {/* Performance */}
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-blue-900">Performance</span>
                </div>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Avg Latency:</span>
                    <span>{model.latency_profile?.avg_latency_ms}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Tokens:</span>
                    <span>{model.input?.max_tokens?.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Capabilities */}
              <div className="bg-purple-50 p-3 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Zap className="w-4 h-4 text-purple-600" />
                  <span className="font-medium text-purple-900">Capabilities</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(model.capabilities || []).slice(0, 4).map((capability: string) => (
                    <Badge key={capability} variant="outline" className="text-xs">
                      {capability.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                  {model.capabilities?.length > 4 && (
                    <Badge variant="outline" className="text-xs">
                      +{model.capabilities.length - 4} more
                    </Badge>
                  )}
                </div>
              </div>

              {/* Safety & Compliance */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <Shield className="w-4 h-4 text-gray-600" />
                  <span className="font-medium text-gray-900">Security</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(model.compliance || []).map((item: string) => (
                    <Badge key={item} variant="outline" className="text-xs">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Usage Limits */}
              <div className="text-xs text-gray-500 border-t pt-3">
                <div className="flex justify-between">
                  <span>Rate Limit:</span>
                  <span>{model.usage_limits?.rate_limit_rpm} RPM</span>
                </div>
                <div className="flex justify-between">
                  <span>Fine-tuning:</span>
                  <span>{model.fine_tuning?.supported ? 'Available' : 'Not Available'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {modelsList.length === 0 && (
        <div className="text-center py-12">
          <Bot className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Models Available</h3>
          <p className="text-gray-500">No LLM models found in configuration</p>
        </div>
      )}
    </div>
  );
}