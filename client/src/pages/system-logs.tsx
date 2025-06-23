import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  AlertTriangle, 
  Info, 
  Bug, 
  Shield, 
  Server,
  MessageSquare,
  Phone,
  DollarSign,
  BarChart3,
  Calendar,
  RefreshCw
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface LogEntry {
  id: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  category: 'agent' | 'auth' | 'api' | 'cost' | 'webhook' | 'voice' | 'whatsapp' | 'system' | 'security';
  message: string;
  userId?: number;
  agentId?: number;
  sessionId?: string;
  metadata: Record<string, any>;
  timestamp: string;
}

interface LogStats {
  levelStats: { level: string; count: number }[];
  categoryStats: { category: string; count: number }[];
  totalLogs: number;
}

const levelColors = {
  debug: 'bg-gray-100 text-gray-800',
  info: 'bg-blue-100 text-blue-800',
  warn: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  critical: 'bg-purple-100 text-purple-800'
};

const categoryIcons = {
  agent: MessageSquare,
  auth: Shield,
  api: Server,
  cost: DollarSign,
  webhook: Server,
  voice: Phone,
  whatsapp: MessageSquare,
  system: Server,
  security: Shield
};

export default function SystemLogs() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    level: '',
    category: '',
    search: '',
    startDate: '',
    endDate: '',
    limit: 50,
    offset: 0
  });

  // Check if user is system admin
  if (user?.role !== 'system_admin') {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-gray-600">Only System Administrators can access system logs.</p>
        </div>
      </div>
    );
  }

  // Fetch logs
  const { data: logs = [], isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ['/api/admin/logs', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value.toString());
      });
      return apiRequest('GET', `/api/admin/logs?${params.toString()}`);
    },
  });

  // Fetch log statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/admin/logs/stats', filters.startDate, filters.endDate],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      return apiRequest('GET', `/api/admin/logs/stats?${params.toString()}`);
    },
  });

  // Cleanup logs mutation
  const cleanupMutation = useMutation({
    mutationFn: (daysToKeep: number) => 
      apiRequest('DELETE', '/api/admin/logs/cleanup', { daysToKeep }),
    onSuccess: (data) => {
      toast({
        title: "Logs Cleaned Up",
        description: `Successfully deleted ${data.deletedCount} old log entries`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/logs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/logs/stats'] });
    },
    onError: () => {
      toast({
        title: "Cleanup Failed",
        description: "Failed to cleanup old logs",
        variant: "destructive",
      });
    },
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, offset: 0 }));
  };

  const handleCleanup = (daysToKeep: number) => {
    if (confirm(`Are you sure you want to delete logs older than ${daysToKeep} days?`)) {
      cleanupMutation.mutate(daysToKeep);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
      case 'critical':
        return <AlertTriangle className="w-4 h-4" />;
      case 'warn':
        return <AlertTriangle className="w-4 h-4" />;
      case 'debug':
        return <Bug className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Logs</h1>
          <p className="text-gray-600">Monitor agent decisions, costs, and system operations</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => refetchLogs()}
            disabled={logsLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${logsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => handleCleanup(30)}
            disabled={cleanupMutation.isPending}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Cleanup (30d)
          </Button>
        </div>
      </div>

      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="logs">Log Entries</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="w-5 h-5 mr-2" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Level</label>
                  <Select value={filters.level} onValueChange={(value) => handleFilterChange('level', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All levels</SelectItem>
                      <SelectItem value="debug">Debug</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warn">Warning</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <Select value={filters.category} onValueChange={(value) => handleFilterChange('category', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All categories</SelectItem>
                      <SelectItem value="agent">Agent</SelectItem>
                      <SelectItem value="auth">Authentication</SelectItem>
                      <SelectItem value="api">API</SelectItem>
                      <SelectItem value="cost">Cost</SelectItem>
                      <SelectItem value="webhook">Webhook</SelectItem>
                      <SelectItem value="voice">Voice</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                      <SelectItem value="security">Security</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Search messages..."
                      value={filters.search}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <Input
                    type="datetime-local"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">End Date</label>
                  <Input
                    type="datetime-local"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Limit</label>
                  <Select value={filters.limit.toString()} onValueChange={(value) => handleFilterChange('limit', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Log Entries */}
          <Card>
            <CardHeader>
              <CardTitle>Log Entries ({logs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                {logsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No logs found matching your criteria
                  </div>
                ) : (
                  <div className="space-y-2">
                    {logs.map((log: LogEntry) => {
                      const CategoryIcon = categoryIcons[log.category] || Server;
                      return (
                        <div
                          key={log.id}
                          className="border rounded-lg p-3 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1">
                              <div className="flex items-center space-x-2">
                                {getLevelIcon(log.level)}
                                <CategoryIcon className="w-4 h-4 text-gray-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-1">
                                  <Badge className={levelColors[log.level]}>
                                    {log.level.toUpperCase()}
                                  </Badge>
                                  <Badge variant="outline">
                                    {log.category}
                                  </Badge>
                                  <span className="text-sm text-gray-500">
                                    {formatTimestamp(log.timestamp)}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-900 mb-2">{log.message}</p>
                                {Object.keys(log.metadata).length > 0 && (
                                  <details className="text-xs">
                                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                      View metadata
                                    </summary>
                                    <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                                      {JSON.stringify(log.metadata, null, 2)}
                                    </pre>
                                  </details>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-gray-500 space-y-1">
                              {log.userId && <div>User: {log.userId}</div>}
                              {log.agentId && <div>Agent: {log.agentId}</div>}
                              {log.sessionId && <div>Session: {log.sessionId.slice(0, 8)}...</div>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Level Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Log Levels
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                ) : stats?.levelStats ? (
                  <div className="space-y-3">
                    {stats.levelStats.map((stat: any) => (
                      <div key={stat.level} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getLevelIcon(stat.level)}
                          <span className="capitalize">{stat.level}</span>
                        </div>
                        <Badge className={levelColors[stat.level as keyof typeof levelColors]}>
                          {stat.count || 0}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">No data available</div>
                )}
              </CardContent>
            </Card>

            {/* Category Statistics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Categories
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  </div>
                ) : stats?.categoryStats ? (
                  <div className="space-y-3">
                    {stats.categoryStats.map((stat: any) => {
                      const CategoryIcon = categoryIcons[stat.category as keyof typeof categoryIcons] || Server;
                      return (
                        <div key={stat.category} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <CategoryIcon className="w-4 h-4 text-gray-500" />
                            <span className="capitalize">{stat.category}</span>
                          </div>
                          <Badge variant="outline">
                            {stat.count || 0}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">No data available</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {stats?.totalLogs || 0}
                  </div>
                  <div className="text-sm text-gray-600">Total Logs</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {stats?.levelStats?.find((s: any) => s.level === 'info')?.count || 0}
                  </div>
                  <div className="text-sm text-gray-600">Info Messages</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-600">
                    {(stats?.levelStats?.find((s: any) => s.level === 'error')?.count || 0) +
                     (stats?.levelStats?.find((s: any) => s.level === 'critical')?.count || 0)}
                  </div>
                  <div className="text-sm text-gray-600">Errors/Critical</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}