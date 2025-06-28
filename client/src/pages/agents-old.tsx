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
  List
} from "lucide-react";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export default function Agents() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [viewingAgent, setViewingAgent] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    systemPrompt: "",
    businessCategory: "",
    llmProvider: "",
    widgetColor: "",
    welcomeMessage: "",
    operatingHours: ""
  });
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: agents, isLoading, error } = useQuery({
    queryKey: ["/api/agents"],
    retry: (failureCount, error: any) => {
      // Don't retry on authentication errors
      if (error?.message?.includes('401')) {
        return false;
      }
      return failureCount < 3;
    }
  });

  const updateAgentMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: any }) => {
      return await apiRequest("PUT", `/api/agents/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Agent updated successfully" });
      setEditingAgent(null);
    },
    onError: (error) => {
      toast({ 
        title: "Error updating agent", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const deleteAgentMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/agents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Agent deleted successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Error deleting agent", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return await apiRequest("PUT", `/api/agents/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Agent status updated successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Error updating agent status", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  const clearTokenMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("POST", `/api/agents/${id}/clear-token`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Agent token cleared successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Error clearing token", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900">Unable to load agents</h3>
          <p className="text-sm text-gray-500 mt-1">
            {error.message || "There was an error loading your agents"}
          </p>
        </div>
        <Button onClick={() => window.location.reload()} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  const filteredAgents = Array.isArray(agents) ? agents.filter((agent: any) => {
    if (statusFilter === "all") return true;
    return agent.status === statusFilter;
  }) : [];

  const handleEdit = (agent: any) => {
    setEditingAgent(agent);
    setEditForm({
      name: agent.name || "",
      systemPrompt: agent.systemPrompt || "",
      businessCategory: agent.businessCategory || "",
      llmProvider: agent.llmProvider || "",
      widgetColor: agent.widgetColor || "#0ea5e9",
      welcomeMessage: agent.welcomeMessage || "",
      operatingHours: agent.operatingHours || ""
    });
  };

  const handleSaveEdit = async () => {
    if (!editingAgent) return;
    
    await updateAgentMutation.mutateAsync({
      id: editingAgent.id,
      updates: editForm
    });
  };

  const handleViewAgent = (agent: any) => {
    setViewingAgent(agent);
  };

  const handleToggleStatus = async (agent: any) => {
    const newStatus = agent.status === 'active' ? 'paused' : 'active';
    await toggleStatusMutation.mutateAsync({
      id: agent.id,
      status: newStatus
    });
  };

  const handleClearToken = async (agentId: number) => {
    await clearTokenMutation.mutateAsync(agentId);
  };

  const handleDelete = async (agentId: number) => {
    if (window.confirm('Are you sure you want to delete this agent? This action cannot be undone.')) {
      await deleteAgentMutation.mutateAsync(agentId);
    }
  };

  const canEditAgent = (agent: any) => {
    return user?.role === 'system_admin' || 
           user?.role === 'business_manager' || 
           (user?.role === 'business_user' && agent.userId === user.id);
  };

  const canDeleteAgent = (agent: any) => {
    return user?.role === 'system_admin' || user?.role === 'business_manager';
  };

  return (
    <div className="space-y-6">
      <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
        UI Update {Date.now()} - Action buttons now using shadcn Button components
      </div>
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Agents</h1>
          <p className="text-muted-foreground">
            Manage your AI conversational agents
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#FF0000',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              marginRight: '12px'
            }}
          >
            🔄 FORCE REFRESH
          </button>
          <Button onClick={() => setLocation('/agent-wizard')}>
            <Plus className="w-4 h-4 mr-2" />
            Create Agent
          </Button>
        </div>
      </div>

      <Card>
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-3 w-[150px]" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No agents found</h3>
            <p className="text-gray-500 mb-6">
              {statusFilter === "all" 
                ? "Get started by creating your first AI agent"
                : `No ${statusFilter} agents found. Try changing the filter.`
              }
            </p>
            <Button onClick={() => setLocation('/agent-wizard')}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Agent
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Agent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    LLM Provider
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAgents.map((agent: any) => (
                  <tr key={agent.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Bot className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{agent.name}</p>
                          <p className="text-sm text-gray-500">API: {agent.apiKey}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                        agent.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : agent.status === 'paused'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          agent.llmProvider?.includes('gpt') 
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
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {agent.businessCategory || 'General'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(agent.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-xs"
                          onClick={() => handleViewAgent(agent)}
                        >
                          View
                        </button>
                        
                        {canEditAgent(agent) && (
                          <button 
                            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs"
                            onClick={() => handleEdit(agent)}
                          >
                            Edit
                          </button>
                        )}
                        
                        <button 
                          className={`px-3 py-1 text-white rounded text-xs ${
                            agent.status === 'active' 
                              ? 'bg-orange-500 hover:bg-orange-600' 
                              : 'bg-green-500 hover:bg-green-600'
                          }`}
                          onClick={() => handleToggleStatus(agent)}
                        >
                          {agent.status === 'active' ? 'Pause' : 'Start'}
                        </button>
                        
                        {canEditAgent(agent) && (
                          <button 
                            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                            onClick={() => handleClearToken(agent.id)}
                          >
                            Token
                          </button>
                        )}
                        
                        {canDeleteAgent(agent) && (
                          <button 
                            className="px-3 py-1 bg-red-700 text-white rounded hover:bg-red-800 text-xs"
                            onClick={() => handleDelete(agent.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit Agent Modal */}
      <Dialog open={!!editingAgent} onOpenChange={() => setEditingAgent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Agent Name</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Enter agent name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessCategory">Business Category</Label>
              <Input
                id="businessCategory"
                value={editForm.businessCategory}
                onChange={(e) => setEditForm({ ...editForm, businessCategory: e.target.value })}
                placeholder="e.g., E-commerce, Healthcare, Education"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="llmProvider">LLM Provider</Label>
                <Select value={editForm.llmProvider} onValueChange={(value) => setEditForm({ ...editForm, llmProvider: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select LLM Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o">OpenAI GPT-4o</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">OpenAI GPT-3.5 Turbo</SelectItem>
                    <SelectItem value="claude-sonnet-4-20250514">Anthropic Claude Sonnet 4</SelectItem>
                    <SelectItem value="claude-3-7-sonnet-20250219">Anthropic Claude 3.7 Sonnet</SelectItem>
                    <SelectItem value="gemini-1.5-pro">Google Gemini 1.5 Pro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="widgetColor">Widget Color</Label>
                <Input
                  id="widgetColor"
                  type="color"
                  value={editForm.widgetColor}
                  onChange={(e) => setEditForm({ ...editForm, widgetColor: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="welcomeMessage">Welcome Message</Label>
              <Input
                id="welcomeMessage"
                value={editForm.welcomeMessage}
                onChange={(e) => setEditForm({ ...editForm, welcomeMessage: e.target.value })}
                placeholder="e.g., Hi! How can I help you today?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="operatingHours">Operating Hours</Label>
              <Input
                id="operatingHours"
                value={editForm.operatingHours}
                onChange={(e) => setEditForm({ ...editForm, operatingHours: e.target.value })}
                placeholder="e.g., 24/7, Mon-Fri 9AM-5PM"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <Textarea
                id="systemPrompt"
                value={editForm.systemPrompt}
                onChange={(e) => setEditForm({ ...editForm, systemPrompt: e.target.value })}
                placeholder="Enter the AI system prompt and instructions"
                rows={6}
                className="resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setEditingAgent(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={updateAgentMutation.isPending}
            >
              {updateAgentMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Agent Modal */}
      <Dialog open={!!viewingAgent} onOpenChange={() => setViewingAgent(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-3">
              <Bot className="w-6 h-6 text-blue-600" />
              <span>{viewingAgent?.name}</span>
              <Badge variant={viewingAgent?.status === 'active' ? 'default' : 'secondary'}>
                {viewingAgent?.status}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          
          {viewingAgent && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Agent Information</h3>
                    <div className="space-y-2">
                      <p><span className="font-medium">Name:</span> {viewingAgent.name}</p>
                      <p><span className="font-medium">Category:</span> {viewingAgent.businessCategory || 'General'}</p>
                      <p><span className="font-medium">API Key:</span> {viewingAgent.apiKey}</p>
                      <p><span className="font-medium">Created:</span> {new Date(viewingAgent.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Configuration</h3>
                    <div className="space-y-2">
                      <p><span className="font-medium">LLM Provider:</span> {viewingAgent.llmProvider}</p>
                      <p><span className="font-medium">Widget Color:</span> 
                        <span 
                          className="inline-block w-4 h-4 rounded ml-2 border" 
                          style={{ backgroundColor: viewingAgent.widgetColor }}
                        ></span>
                      </p>
                      <p><span className="font-medium">Operating Hours:</span> {viewingAgent.operatingHours || 'Not specified'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Welcome Message</h3>
                    <p className="text-sm bg-gray-50 p-3 rounded-md">
                      {viewingAgent.welcomeMessage || 'No welcome message set'}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">System Prompt</h3>
                    <div className="text-sm bg-gray-50 p-3 rounded-md max-h-40 overflow-y-auto">
                      {viewingAgent.systemPrompt || 'No system prompt set'}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-center">
                <div className="space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleStatus(viewingAgent)}
                    disabled={toggleStatusMutation.isPending}
                  >
                    {viewingAgent.status === 'active' ? (
                      <>
                        <PowerOff className="w-4 h-4 mr-2" />
                        Pause Agent
                      </>
                    ) : (
                      <>
                        <Power className="w-4 h-4 mr-2" />
                        Activate Agent
                      </>
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleClearToken(viewingAgent.id)}
                    disabled={clearTokenMutation.isPending}
                  >
                    <Key className="w-4 h-4 mr-2" />
                    Clear Token
                  </Button>
                </div>

                <div className="space-x-2">
                  {canEditAgent(viewingAgent) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setViewingAgent(null);
                        handleEdit(viewingAgent);
                      }}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Agent
                    </Button>
                  )}

                  {canDeleteAgent(viewingAgent) && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setViewingAgent(null);
                        handleDelete(viewingAgent.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Agent
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => setViewingAgent(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}