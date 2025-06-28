import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription,
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Eye, 
  Edit, 
  Play, 
  Pause, 
  Key, 
  Trash2, 
  Bot,
  Filter,
  Grid3X3,
  List,
  Clock,
  Globe,
  Phone
} from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export default function Agents() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [viewingAgent, setViewingAgent] = useState<any>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: agents, isLoading, error } = useQuery({
    queryKey: ["/api/agents"],
  });

  const deleteAgentMutation = useMutation({
    mutationFn: async (agentId: number) => {
      const response = await apiRequest("DELETE", `/api/agents/${agentId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Success",
        description: "Agent deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete agent",
        variant: "destructive",
      });
    },
  });

  const toggleAgentMutation = useMutation({
    mutationFn: async ({ agentId, newStatus }: { agentId: number; newStatus: string }) => {
      const response = await apiRequest("PUT", `/api/agents/${agentId}`, { status: newStatus });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Success",
        description: "Agent status updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update agent status",
        variant: "destructive",
      });
    },
  });

  const clearTokenMutation = useMutation({
    mutationFn: async (agentId: number) => {
      const response = await apiRequest("POST", `/api/agents/${agentId}/clear-token`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Success",
        description: "API token cleared successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to clear token",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">My Agents</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to load agents</h3>
          <p className="text-sm text-gray-500">
            {error.message || "There was an error loading your agents"}
          </p>
        </div>
        <Button onClick={() => window.location.reload()} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  const filteredAgents = Array.isArray(agents) ? agents.filter((agent: any) => {
    const matchesSearch = agent.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.businessCategory?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || agent.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) : [];

  const handleViewAgent = (agent: any) => {
    try {
      setViewingAgent(agent);
    } catch (error) {
      console.error('Error viewing agent:', error);
      toast({
        title: "Error",
        description: "Failed to view agent details",
        variant: "destructive",
      });
    }
  };

  const handleEditAgent = (agent: any) => {
    try {
      // Navigate to agent wizard for editing with agent ID
      setLocation(`/wizard?edit=${agent.id}`);
    } catch (error) {
      console.error('Error navigating to edit agent:', error);
      toast({
        title: "Error",
        description: "Failed to open agent editor",
        variant: "destructive",
      });
    }
  };

  const handleToggleStatus = (agent: any) => {
    try {
      const newStatus = agent.status === 'active' ? 'paused' : 'active';
      toggleAgentMutation.mutate({ agentId: agent.id, newStatus });
    } catch (error) {
      console.error('Error toggling agent status:', error);
      toast({
        title: "Error",
        description: "Failed to update agent status",
        variant: "destructive",
      });
    }
  };

  const handleClearToken = (agent: any) => {
    try {
      if (window.confirm(`Are you sure you want to clear the API token for "${agent.name}"?`)) {
        clearTokenMutation.mutate(agent.id);
      }
    } catch (error) {
      console.error('Error clearing token:', error);
      toast({
        title: "Error",
        description: "Failed to clear agent token",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAgent = (agent: any) => {
    try {
      if (window.confirm(`Are you sure you want to delete "${agent.name}"? This action cannot be undone.`)) {
        deleteAgentMutation.mutate(agent.id);
      }
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast({
        title: "Error",
        description: "Failed to delete agent",
        variant: "destructive",
      });
    }
  };

  const canEditAgent = (agent: any) => {
    return user?.role === 'system_admin' || user?.role === 'business_manager' || agent.userId === user?.id;
  };

  const canDeleteAgent = (agent: any) => {
    return user?.role === 'system_admin' || user?.role === 'business_manager';
  };

  const getPlatformBadge = (platformType: string) => {
    const platforms = {
      'whatsapp-business-api': { label: 'WhatsApp', color: 'bg-green-100 text-green-800' },
      'telegram-bot': { label: 'Telegram', color: 'bg-blue-100 text-blue-800' },
      'discord-bot': { label: 'Discord', color: 'bg-indigo-100 text-indigo-800' },
      'facebook-messenger': { label: 'Messenger', color: 'bg-blue-100 text-blue-800' },
      'instagram-direct': { label: 'Instagram', color: 'bg-pink-100 text-pink-800' },
    };
    const platform = platforms[platformType as keyof typeof platforms] || { label: platformType, color: 'bg-gray-100 text-gray-800' };
    return <Badge className={platform.color}>{platform.label}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'active': { label: 'Active', color: 'bg-green-100 text-green-800' },
      'paused': { label: 'Paused', color: 'bg-yellow-100 text-yellow-800' },
      'inactive': { label: 'Inactive', color: 'bg-gray-100 text-gray-800' },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, color: 'bg-gray-100 text-gray-800' };
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getLLMBadge = (llmProvider: string) => {
    if (llmProvider?.includes('gpt-4o')) return <Badge className="bg-green-100 text-green-800">GPT-4o</Badge>;
    if (llmProvider?.includes('claude-sonnet-4')) return <Badge className="bg-purple-100 text-purple-800">Claude 4</Badge>;
    if (llmProvider?.includes('claude-3-7')) return <Badge className="bg-purple-100 text-purple-800">Claude 3.7</Badge>;
    if (llmProvider?.includes('gemini-1.5')) return <Badge className="bg-blue-100 text-blue-800">Gemini 1.5</Badge>;
    if (llmProvider?.includes('gpt-3.5')) return <Badge className="bg-green-100 text-green-800">GPT-3.5</Badge>;
    return <Badge className="bg-gray-100 text-gray-800">{llmProvider || 'Unknown'}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Agents</h1>
          <p className="text-muted-foreground">Manage your AI conversational agents</p>
        </div>
        <Button onClick={() => setLocation('/agent-wizard')} className="w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Create Agent
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search agents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Filter className="w-4 h-4 mr-2" />
              Status: {statusFilter === 'all' ? 'All' : statusFilter}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setStatusFilter('all')}>All</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('active')}>Active</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('paused')}>Paused</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setStatusFilter('inactive')}>Inactive</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex rounded-md border">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="rounded-r-none"
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="rounded-l-none"
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{filteredAgents.length}</div>
            <p className="text-xs text-muted-foreground">Total Agents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{filteredAgents.filter(a => a.status === 'active').length}</div>
            <p className="text-xs text-muted-foreground">Active Agents</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{filteredAgents.filter(a => a.status === 'paused').length}</div>
            <p className="text-xs text-muted-foreground">Paused Agents</p>
          </CardContent>
        </Card>
      </div>

      {/* Agents Grid/List */}
      {filteredAgents.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Bot className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No agents found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Create your first AI agent to get started'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button onClick={() => setLocation('/agent-wizard')}>
                <Plus className="w-4 h-4 mr-2" />
                Create Agent
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className={viewMode === 'grid' 
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
          : "space-y-4"
        }>
          {filteredAgents.map((agent: any) => (
            <Card key={agent.id} className={viewMode === 'list' ? "p-0" : ""}>
              <CardHeader className={viewMode === 'list' ? "pb-2" : ""}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {agent.businessCategory || 'General'}
                    </CardDescription>
                    {/* Client Details */}
                    <div className="mt-2 space-y-1">
                      {agent.businessWebsite && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Globe className="w-3 h-3 mr-1" />
                          <span className="truncate">{agent.businessWebsite}</span>
                        </div>
                      )}
                      {agent.whatsappNumber && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Phone className="w-3 h-3 mr-1" />
                          <span>{agent.whatsappNumber}</span>
                        </div>
                      )}
                      {agent.operatingHours && agent.operatingHours !== '24/7' && (
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="w-3 h-3 mr-1" />
                          <span>{agent.operatingHours}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleViewAgent(agent)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      
                      {canEditAgent(agent) && (
                        <DropdownMenuItem onClick={() => handleEditAgent(agent)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Agent
                        </DropdownMenuItem>
                      )}
                      
                      <DropdownMenuItem onClick={() => handleToggleStatus(agent)}>
                        {agent.status === 'active' ? (
                          <>
                            <Pause className="w-4 h-4 mr-2" />
                            Pause Agent
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Activate Agent
                          </>
                        )}
                      </DropdownMenuItem>
                      
                      {canEditAgent(agent) && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleClearToken(agent)}>
                            <Key className="w-4 h-4 mr-2" />
                            Clear Token
                          </DropdownMenuItem>
                        </>
                      )}
                      
                      {canDeleteAgent(agent) && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDeleteAgent(agent)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Agent
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              
              <CardContent className={viewMode === 'list' ? "pt-0" : ""}>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {getPlatformBadge(agent.platformType)}
                    {getStatusBadge(agent.status)}
                    {getLLMBadge(agent.llmProvider)}
                  </div>
                  
                  {viewMode === 'grid' && (
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {agent.systemPrompt || 'No description available'}
                    </p>
                  )}
                  
                  <div className="text-xs text-gray-500">
                    Created {new Date(agent.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Agent Dialog */}
      <Dialog open={!!viewingAgent} onOpenChange={() => setViewingAgent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewingAgent?.name}</DialogTitle>
            <DialogDescription>
              Agent details and configuration
            </DialogDescription>
          </DialogHeader>
          
          {viewingAgent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Platform</label>
                  <div className="mt-1">
                    {getPlatformBadge(viewingAgent.platformType)}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <div className="mt-1">
                    {getStatusBadge(viewingAgent.status)}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">LLM Provider</label>
                  <div className="mt-1">
                    {getLLMBadge(viewingAgent.llmProvider)}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Business Category</label>
                  <div className="mt-1 text-sm">
                    {viewingAgent.businessCategory || 'General'}
                  </div>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">System Prompt</label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md text-sm">
                  {viewingAgent.systemPrompt || 'No system prompt configured'}
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">Welcome Message</label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md text-sm">
                  {viewingAgent.welcomeMessage || 'No welcome message configured'}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}