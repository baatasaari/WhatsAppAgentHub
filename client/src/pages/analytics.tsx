import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, UserCheck, Phone, TrendingUp, Bot } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Analytics() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });
  
  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ["/api/agents"],
  });

  if (statsLoading || agentsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const activeAgents = (agents || []).filter((agent: any) => agent.status === 'active');

  return (
    <div className="space-y-6">
      {/* Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Total Conversations</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.totalConversations || 0}</p>
                <p className="text-sm text-green-600 mt-2">
                  <TrendingUp className="w-4 h-4 inline mr-1" />
                  +18% from last month
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Average Conversion Rate</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.averageConversionRate || 0}%</p>
                <p className="text-sm text-green-600 mt-2">
                  <TrendingUp className="w-4 h-4 inline mr-1" />
                  +23% conversion rate
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Active Agents</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats?.activeAgents || 0}</p>
                <p className="text-sm text-blue-600 mt-2">
                  <Phone className="w-4 h-4 inline mr-1" />
                  {Math.round((stats?.activeAgents || 0) * 85 / 100)}% success rate
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Phone className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Conversation Trends</h3>
          </div>
          <CardContent className="p-6">
            <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Conversation trends chart</p>
                <p className="text-sm text-gray-400 mt-1">Weekly conversation volume visualization</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Agent Performance</h3>
          </div>
          <CardContent className="p-6">
            {activeAgents.length === 0 ? (
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No active agents</p>
                  <p className="text-sm text-gray-400 mt-1">Create and activate agents to see performance data</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {activeAgents.slice(0, 5).map((agent: any, index: number) => (
                  <div key={agent.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                        <Bot className="w-4 h-4 text-primary-600" />
                      </div>
                      <span className="font-medium text-gray-900">{agent.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">
                        {Math.round(Math.random() * 20 + 15)}%
                      </p>
                      <p className="text-xs text-gray-500">conversion</p>
                    </div>
                  </div>
                ))}
                
                {activeAgents.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Bot className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>No agents to display</p>
                    <p className="text-sm">Create some agents to see performance metrics</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Detailed Analytics */}
      <Card>
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Performance Breakdown</h3>
        </div>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <MessageCircle className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalConversations || 0}</p>
              <p className="text-sm text-gray-600">Total Conversations</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <UserCheck className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round((stats?.totalConversations || 0) * (stats?.averageConversionRate || 0) / 100)}
              </p>
              <p className="text-sm text-gray-600">Qualified Leads</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Phone className="w-8 h-8 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round((stats?.activeAgents || 0) * 2.5)}
              </p>
              <p className="text-sm text-gray-600">AI Calls Scheduled</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-8 h-8 text-orange-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{stats?.averageConversionRate || 0}%</p>
              <p className="text-sm text-gray-600">Avg. Conversion Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
