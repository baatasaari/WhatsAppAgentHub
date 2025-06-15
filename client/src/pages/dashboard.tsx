import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Bot, CheckCircle, MessageCircle, TrendingUp, ArrowUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ["/api/agents"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
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

  const recentAgents = (agents || []).slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="stats-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Total Agents</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.totalAgents || 0}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Bot className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <ArrowUp className="w-4 h-4 text-green-600 mr-1" />
            <span className="text-green-600 font-medium">+23%</span>
            <span className="text-gray-500 ml-2">from last month</span>
          </div>
        </Card>
        
        <Card className="stats-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Active Agents</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.activeAgents || 0}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <ArrowUp className="w-4 h-4 text-green-600 mr-1" />
            <span className="text-green-600 font-medium">+12%</span>
            <span className="text-gray-500 ml-2">from last week</span>
          </div>
        </Card>
        
        <Card className="stats-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Conversations</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.totalConversations || 0}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <ArrowUp className="w-4 h-4 text-green-600 mr-1" />
            <span className="text-green-600 font-medium">+18%</span>
            <span className="text-gray-500 ml-2">this week</span>
          </div>
        </Card>
        
        <Card className="stats-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Conversion Rate</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{stats?.averageConversionRate || 0}%</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <ArrowUp className="w-4 h-4 text-green-600 mr-1" />
            <span className="text-green-600 font-medium">+5.3%</span>
            <span className="text-gray-500 ml-2">improvement</span>
          </div>
        </Card>
      </div>
      
      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Agents</h3>
          </div>
          <div className="p-6 space-y-4">
            {agentsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))
            ) : recentAgents.length > 0 ? (
              recentAgents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <Bot className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{agent.name}</p>
                      <p className="text-sm text-gray-500">
                        Created {new Date(agent.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                    agent.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : agent.status === 'paused'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Bot className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No agents created yet.</p>
                <p className="text-sm">Create your first agent to get started!</p>
              </div>
            )}
          </div>
        </Card>
        
        <Card>
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Performance Overview</h3>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">WhatsApp Conversations</span>
              <span className="font-semibold text-gray-900">{stats?.totalConversations || 0}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${Math.min(100, (stats?.totalConversations || 0) / 10)}%` }}
              ></div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Active Agents</span>
              <span className="font-semibold text-gray-900">{stats?.activeAgents || 0}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${Math.min(100, (stats?.activeAgents || 0) * 10)}%` }}
              ></div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Conversion Rate</span>
              <span className="font-semibold text-gray-900">{stats?.averageConversionRate || 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-500 h-2 rounded-full transition-all duration-300" 
                style={{ width: `${stats?.averageConversionRate || 0}%` }}
              ></div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
