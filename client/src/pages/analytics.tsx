import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, UserCheck, Phone, TrendingUp, Bot, DollarSign, Clock, Zap, Calculator } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

export default function Analytics() {
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });
  
  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ["/api/agents"],
  });

  const { data: costAnalytics, isLoading: costsLoading } = useQuery({
    queryKey: ["/api/analytics/agent", selectedAgent, "costs"],
    enabled: !!selectedAgent,
  });

  if (statsLoading || agentsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const agentsList = Array.isArray(agents) ? agents : [];
  const statsData = stats || { totalAgents: 0, activeAgents: 0, totalConversations: 0, averageConversionRate: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-xl">
        <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
        <p className="text-blue-100 mt-1">Monitor agent performance, costs, and conversions</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Agents</p>
                <p className="text-2xl font-bold text-gray-900">{statsData.totalAgents}</p>
              </div>
              <Bot className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Agents</p>
                <p className="text-2xl font-bold text-green-600">{statsData.activeAgents}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Conversations</p>
                <p className="text-2xl font-bold text-blue-600">{statsData.totalConversations}</p>
              </div>
              <MessageCircle className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Conversion Rate</p>
                <p className="text-2xl font-bold text-purple-600">{statsData.averageConversionRate}%</p>
              </div>
              <UserCheck className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost Analytics Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5 text-green-600" />
            <span>LLM Cost Analytics</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Agent Selector */}
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Select Agent:</label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Choose an agent to analyze" />
              </SelectTrigger>
              <SelectContent>
                {agentsList.map((agent: any) => (
                  <SelectItem key={agent.id} value={agent.id.toString()}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cost Breakdown */}
          {selectedAgent && (
            <div className="space-y-4">
              {costsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : costAnalytics ? (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <Card className="bg-red-50 border-red-200">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <Clock className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium text-red-900">Hourly</span>
                      </div>
                      <p className="text-lg font-bold text-red-700">
                        ${costAnalytics.hourly?.toFixed(4) || '0.0000'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-orange-50 border-orange-200">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <Zap className="w-4 h-4 text-orange-600" />
                        <span className="text-sm font-medium text-orange-900">Daily</span>
                      </div>
                      <p className="text-lg font-bold text-orange-700">
                        ${costAnalytics.daily?.toFixed(4) || '0.0000'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-yellow-50 border-yellow-200">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm font-medium text-yellow-900">Weekly</span>
                      </div>
                      <p className="text-lg font-bold text-yellow-700">
                        ${costAnalytics.weekly?.toFixed(4) || '0.0000'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <Calculator className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">Monthly</span>
                      </div>
                      <p className="text-lg font-bold text-blue-700">
                        ${costAnalytics.monthly?.toFixed(4) || '0.0000'}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2 mb-2">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-900">All Time</span>
                      </div>
                      <p className="text-lg font-bold text-green-700">
                        ${costAnalytics.allTime?.toFixed(4) || '0.0000'}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calculator className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500">No cost data available for this agent</p>
                </div>
              )}
            </div>
          )}

          {!selectedAgent && (
            <div className="text-center py-8">
              <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">Select an agent to view detailed cost analytics</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agents List with Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Performance Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {agentsList.length === 0 ? (
              <div className="text-center py-8">
                <Bot className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">No agents found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {agentsList.map((agent: any) => (
                  <Card key={agent.id} className="bg-gray-50">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-gray-900">{agent.name}</h4>
                          <Badge 
                            variant={agent.status === 'active' ? 'default' : 'secondary'}
                            className={agent.status === 'active' ? 'bg-green-100 text-green-800' : ''}
                          >
                            {agent.status}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Business:</span>
                          <span className="font-medium">{agent.businessCategory || 'General'}</span>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">LLM Model:</span>
                          <Badge variant="outline" className={`text-xs ${
                            agent.llmProvider?.includes('gpt-4o') 
                              ? 'bg-green-100 text-green-800'
                              : agent.llmProvider?.includes('claude')
                              ? 'bg-purple-100 text-purple-800'
                              : agent.llmProvider?.includes('gemini')
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {agent.llmProvider?.includes('gpt-4o') ? 'GPT-4o' :
                             agent.llmProvider?.includes('claude-sonnet-4') ? 'Claude 4' :
                             agent.llmProvider?.includes('claude-3-7') ? 'Claude 3.7' :
                             agent.llmProvider?.includes('gemini-1.5') ? 'Gemini 1.5' :
                             agent.llmProvider?.includes('gpt-3.5') ? 'GPT-3.5' :
                             agent.llmProvider || 'Unknown'}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Created:</span>
                          <span className="font-medium">{new Date(agent.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}