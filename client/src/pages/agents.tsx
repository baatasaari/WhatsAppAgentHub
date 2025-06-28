import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, Edit, Pause, Play, Trash2, GitBranch, MoreHorizontal, Plus, Eye, Key, Power, PowerOff, Settings, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
    },
    onError: () => {
      toast({ title: "Failed to update agent", variant: "destructive" });
    },
  });

  const deleteAgentMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/agents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Agent deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete agent", variant: "destructive" });
    },
  });

  const clearTokenMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("POST", `/api/agents/${id}/clear-token`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Agent token cleared successfully" });
    },
    onError: () => {
      toast({ title: "Failed to clear agent token", variant: "destructive" });
    },
  });

  const handleStatusToggle = (agent: any) => {
    const newStatus = agent.status === 'active' ? 'paused' : 'active';
    updateAgentMutation.mutate({ id: agent.id, updates: { status: newStatus } });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this agent? This action cannot be undone.")) {
      deleteAgentMutation.mutate(id);
    }
  };

  const handleEdit = (agent: any) => {
    setEditingAgent(agent);
    setEditForm({
      name: agent.name || "",
      systemPrompt: agent.systemPrompt || "",
      businessCategory: agent.businessCategory || "",
      llmProvider: agent.llmProvider || "",
      widgetColor: agent.widgetColor || "#25D366",
      welcomeMessage: agent.welcomeMessage || "",
      operatingHours: agent.operatingHours || "24/7"
    });
  };

  const handleSaveEdit = () => {
    if (!editingAgent) return;
    
    updateAgentMutation.mutate({
      id: editingAgent.id,
      updates: editForm
    });
    setEditingAgent(null);
  };

  const canEditAgent = (agent: any) => {
    // System admins can edit all agents
    if (user?.role === 'system_admin') return true;
    // Business managers can edit agents they own
    if (user?.role === 'business_manager' && agent.userId === user.id) return true;
    // Business users can only edit their own agents
    if (user?.role === 'business_user' && agent.userId === user.id) return true;
    return false;
  };

  const canDeleteAgent = (agent: any) => {
    // Only system admins and business managers can delete agents
    if (user?.role === 'system_admin') return true;
    if (user?.role === 'business_manager' && agent.userId === user.id) return true;
    return false;
  };

  const handleViewAgent = (agent: any) => {
    setViewingAgent(agent);
  };

  const handleClearToken = (id: number) => {
    if (confirm("Are you sure you want to clear this agent's token? This will generate a new API key.")) {
      clearTokenMutation.mutate(id);
    }
  };

  const handleToggleStatus = (agent: any) => {
    const newStatus = agent.status === 'active' ? 'paused' : 'active';
    updateAgentMutation.mutate({ 
      id: agent.id, 
      updates: { status: newStatus } 
    });
  };

  const filteredAgents = Array.isArray(agents) ? agents.filter((agent: any) => 
    statusFilter === "all" || agent.status === statusFilter
  ) : [];

  // Show error state for authentication issues
  if (error && error.message.includes('401')) {
    return (
      <div className="p-12 text-center">
        <Bot className="w-16 h-16 mx-auto mb-4 text-red-300" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Authentication Required</h3>
        <p className="text-gray-500 mb-6">Please log in to view your agents.</p>
        <Button onClick={() => window.location.href = "/login"}>
          Log In
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Agent Management</h3>
            <div className="flex items-center space-x-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
              
              {(user?.role === 'system_admin' || user?.role === 'business_manager') && (
                <Button onClick={() => setLocation("/wizard")} className="flex items-center space-x-2">
                  <Plus className="w-4 h-4" />
                  <span>Create Agent</span>
                </Button>
              )}
            </div>
          </div>
        </div>
        
        {filteredAgents.length === 0 ? (
          <div className="p-12 text-center">
            <Bot className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No agents found</h3>
            <p className="text-gray-500 mb-6">
              {statusFilter === "all" 
                ? "You haven't created any agents yet." 
                : `No ${statusFilter} agents found.`}
            </p>
            <Button onClick={() => setLocation("/wizard")}>
              Create Your First Agent
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Agent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    LLM
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                      <div className="flex items-center justify-end space-x-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 hover:bg-gray-100 focus:bg-gray-100 data-[state=open]:bg-gray-100"
                            >
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4 text-gray-600" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 z-50">
                            <DropdownMenuItem 
                              onClick={() => handleViewAgent(agent)}
                              className="cursor-pointer"
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            
                            {canEditAgent(agent) && (
                              <DropdownMenuItem 
                                onClick={() => handleEdit(agent)}
                                className="cursor-pointer"
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Agent
                              </DropdownMenuItem>
                            )}
                            
                            <DropdownMenuItem 
                              onClick={() => handleToggleStatus(agent)}
                              className="cursor-pointer"
                            >
                              {agent.status === 'active' ? (
                                <>
                                  <PowerOff className="mr-2 h-4 w-4" />
                                  Disable Agent
                                </>
                              ) : (
                                <>
                                  <Power className="mr-2 h-4 w-4" />
                                  Enable Agent
                                </>
                              )}
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem 
                              onClick={() => handleClearToken(agent.id)}
                              className="cursor-pointer"
                            >
                              <Key className="mr-2 h-4 w-4" />
                              Clear Token
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />
                            
                            {canDeleteAgent(agent) && (
                              <DropdownMenuItem 
                                onClick={() => handleDelete(agent.id)}
                                className="text-red-600 focus:text-red-600 cursor-pointer"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Agent
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
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
                  placeholder="e.g., E-Commerce, Healthcare"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="llmProvider">LLM Model</Label>
                <Select
                  value={editForm.llmProvider}
                  onValueChange={(value) => setEditForm({ ...editForm, llmProvider: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select LLM model" />
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

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setEditingAgent(null)}
              disabled={updateAgentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateAgentMutation.isPending}
            >
              {updateAgentMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Agent Details View Modal */}
      <Dialog open={!!viewingAgent} onOpenChange={() => setViewingAgent(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Agent Details</DialogTitle>
          </DialogHeader>
          
          {viewingAgent && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Agent Name</Label>
                    <p className="text-lg font-semibold">{viewingAgent.name}</p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Status</Label>
                    <div className="flex items-center space-x-2">
                      <Badge variant={viewingAgent.status === 'active' ? 'default' : 'secondary'}>
                        {viewingAgent.status}
                      </Badge>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleToggleStatus(viewingAgent)}
                      >
                        {viewingAgent.status === 'active' ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Business Category</Label>
                    <p className="text-sm">{viewingAgent.businessCategory || 'Not specified'}</p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Platform Type</Label>
                    <p className="text-sm capitalize">{viewingAgent.platformType}</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">LLM Provider</Label>
                    <p className="text-sm">{viewingAgent.llmProvider}</p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Widget Color</Label>
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-6 h-6 rounded border"
                        style={{ backgroundColor: viewingAgent.widgetColor }}
                      />
                      <p className="text-sm">{viewingAgent.widgetColor}</p>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Created</Label>
                    <p className="text-sm">{new Date(viewingAgent.createdAt).toLocaleString()}</p>
                  </div>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-500">API Token</Label>
                    <div className="flex items-center space-x-2">
                      <Input 
                        type="password" 
                        value={viewingAgent.apiKey || '••••••••••••••••'} 
                        readOnly 
                        className="font-mono text-xs"
                      />
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleClearToken(viewingAgent.id)}
                      >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Reset
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-500">Welcome Message</Label>
                <p className="text-sm bg-gray-50 p-3 rounded border">
                  {viewingAgent.welcomeMessage || 'No welcome message set'}
                </p>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-500">System Prompt</Label>
                <div className="bg-gray-50 p-4 rounded border max-h-40 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap">
                    {viewingAgent.systemPrompt || 'No system prompt configured'}
                  </p>
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-4">
                <div className="flex space-x-2">
                  {canEditAgent(viewingAgent) && (
                    <Button onClick={() => {
                      setViewingAgent(null);
                      handleEdit(viewingAgent);
                    }}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Agent
                    </Button>
                  )}
                  
                  <Button 
                    variant="outline" 
                    onClick={() => handleClearToken(viewingAgent.id)}
                  >
                    <Key className="w-4 h-4 mr-2" />
                    Clear Token
                  </Button>
                </div>
                
                <div className="flex space-x-2">
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
                  
                  <Button variant="outline" onClick={() => setViewingAgent(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
