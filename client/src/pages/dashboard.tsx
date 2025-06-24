import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, CheckCircle, MessageCircle, TrendingUp, ArrowUp, Plus, Eye, BarChart3, Zap, Globe, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";

export default function Dashboard() {
  const [, setLocation] = useLocation();

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

  const recentAgents = Array.isArray(agents) ? agents.slice(0, 3) : [];
  const activeAgents = Array.isArray(agents) ? agents.filter((agent: any) => agent.status === 'active') : [];
  const statsData = stats as any || {};

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Welcome to AgentFlow</h1>
            <p className="text-blue-100 mt-1">Your WhatsApp Business integration platform</p>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={() => setLocation('/wizard')}
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
            >
              <Plus className="w-4 h-4 mr-2" />
              Agent Wizard
            </Button>
            <Button 
              onClick={() => setLocation('/preview')}
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/30"
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Agents</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{statsData?.totalAgents || 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <ArrowUp className="w-4 h-4 text-green-600 mr-1" />
              <span className="text-green-600 font-medium">+23%</span>
              <span className="text-gray-500 ml-2">from last month</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Active Agents</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{statsData?.activeAgents || 0}</p>
              </div>
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm">
              <ArrowUp className="w-4 h-4 text-green-600 mr-1" />
              <span className="text-green-600 font-medium">+12%</span>
              <span className="text-gray-500 ml-2">from last week</span>
            </div>
          </CardContent>
        </Card>
        
        <Card className="stats-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm">Conversations</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{statsData?.totalConversations || 0}</p>
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
              <p className="text-3xl font-bold text-gray-900 mt-1">{statsData?.averageConversionRate || 0}%</p>
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
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Bot className="w-5 h-5 text-blue-600" />
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
