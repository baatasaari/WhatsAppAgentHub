import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Bot, Zap, DollarSign, Clock, Shield, Star, Plus, Edit3, Trash2, Settings, Grid3X3, List, GripVertical, Eye, EyeOff, MoreVertical } from "lucide-react";
import { useState, useRef } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  version: string;
  description: string;
  badge: string;
  badge_color: string;
  model_type: string;
  cost_profile: {
    prompt_token_cost_per_1k: number;
    completion_token_cost_per_1k: number;
    currency: string;
  };
  latency_profile: {
    avg_latency_ms: number;
  };
  input: {
    max_tokens: number;
  };
  capabilities: string[];
  compliance: string[];
  usage_limits: {
    rate_limit_rpm: number;
  };
  fine_tuning: {
    supported: boolean;
  };
}

interface DisplayOptions {
  cost: boolean;
  performance: boolean;
  capabilities: boolean;
  compliance: boolean;
  limits: boolean;
}

export default function ModelConfig() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>({
    cost: true,
    performance: true,
    capabilities: true,
    compliance: true,
    limits: true,
  });
  const [searchFilter, setSearchFilter] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: models, isLoading, error } = useQuery({
    queryKey: ["/api/models"],
  });

  const createModelMutation = useMutation({
    mutationFn: async (modelData: Partial<ModelConfig>) => {
      const response = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modelData),
      });
      if (!response.ok) throw new Error("Failed to create model");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      setIsAddDialogOpen(false);
      toast({ title: "Model added successfully" });
    },
    onError: () => {
      toast({ title: "Failed to add model", variant: "destructive" });
    },
  });

  const updateModelMutation = useMutation({
    mutationFn: async ({ id, ...modelData }: Partial<ModelConfig> & { id: string }) => {
      const response = await fetch(`/api/models/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modelData),
      });
      if (!response.ok) throw new Error("Failed to update model");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      setEditingModel(null);
      toast({ title: "Model updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update model", variant: "destructive" });
    },
  });

  const deleteModelMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/models/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete model");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      toast({ title: "Model deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete model", variant: "destructive" });
    },
  });

  const reorderModelsMutation = useMutation({
    mutationFn: async (reorderedModels: ModelConfig[]) => {
      const response = await fetch("/api/models/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ models: reorderedModels }),
      });
      if (!response.ok) throw new Error("Failed to reorder models");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/models"] });
      toast({ title: "Models reordered successfully" });
    },
    onError: () => {
      toast({ title: "Failed to reorder models", variant: "destructive" });
    },
  });

  const onDragEnd = (result: any) => {
    if (!result.destination || !models || !Array.isArray(models)) return;

    const modelsList = models as ModelConfig[];
    const reorderedModels = [...modelsList];
    const [movedModel] = reorderedModels.splice(result.source.index, 1);
    reorderedModels.splice(result.destination.index, 0, movedModel);

    // Update local state immediately for better UX
    queryClient.setQueryData(["/api/models"], reorderedModels);
    
    // Save to backend
    reorderModelsMutation.mutate(reorderedModels);
  };

  const filteredModels = Array.isArray(models) 
    ? models.filter((model: ModelConfig) => 
        model.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
        model.provider.toLowerCase().includes(searchFilter.toLowerCase())
      )
    : [];

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

  const ModelCard = ({ model, index }: { model: ModelConfig; index: number }) => (
    <Draggable draggableId={model.id} index={index}>
      {(provided, snapshot) => (
        <Card 
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`overflow-hidden transition-shadow ${
            snapshot.isDragging ? 'shadow-lg' : ''
          }`}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div {...provided.dragHandleProps}>
                  <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                </div>
                <CardTitle className="text-lg">{model.name}</CardTitle>
              </div>
              <div className="flex items-center space-x-2">
                <Badge 
                  variant="secondary" 
                  className={`${model.badge_color} bg-opacity-10`}
                >
                  {model.badge}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setEditingModel(model)}>
                      <Edit3 className="w-4 h-4 mr-2" />
                      Edit Model
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => deleteModelMutation.mutate(model.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Model
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
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
            {displayOptions.cost && (
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
            )}

            {/* Performance */}
            {displayOptions.performance && (
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
            )}

            {/* Capabilities */}
            {displayOptions.capabilities && (
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
            )}

            {/* Safety & Compliance */}
            {displayOptions.compliance && (
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
            )}

            {/* Usage Limits */}
            {displayOptions.limits && (
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
            )}
          </CardContent>
        </Card>
      )}
    </Draggable>
  );

  const ModelListItem = ({ model, index }: { model: ModelConfig; index: number }) => (
    <Draggable draggableId={model.id} index={index}>
      {(provided, snapshot) => (
        <div 
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={`flex items-center p-4 bg-white border rounded-lg mb-2 transition-shadow ${
            snapshot.isDragging ? 'shadow-lg' : ''
          }`}
        >
          <div {...provided.dragHandleProps} className="mr-3">
            <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
          </div>
          
          <div className="flex-1">
            <div className="flex items-center space-x-3">
              <h3 className="font-semibold text-gray-900">{model.name}</h3>
              <Badge variant="secondary" className={`${model.badge_color} bg-opacity-10`}>
                {model.badge}
              </Badge>
              <span className="text-sm text-gray-500">{model.provider}</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">{model.description}</p>
          </div>

          <div className="flex items-center space-x-4 text-sm text-gray-500">
            {displayOptions.cost && (
              <div className="text-right">
                <div className="font-medium">${model.cost_profile?.prompt_token_cost_per_1k?.toFixed(4)}</div>
                <div className="text-xs">per 1K tokens</div>
              </div>
            )}
            {displayOptions.performance && (
              <div className="text-right">
                <div className="font-medium">{model.latency_profile?.avg_latency_ms}ms</div>
                <div className="text-xs">latency</div>
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setEditingModel(model)}>
                <Edit3 className="w-4 h-4 mr-2" />
                Edit Model
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => deleteModelMutation.mutate(model.id)}
                className="text-red-600"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Model
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </Draggable>
  );

  const ModelForm = ({ model, onSubmit, onCancel }: { 
    model?: ModelConfig | null; 
    onSubmit: (data: any) => void; 
    onCancel: () => void; 
  }) => {
    const [formData, setFormData] = useState({
      id: model?.id || '',
      name: model?.name || '',
      provider: model?.provider || '',
      version: model?.version || '',
      description: model?.description || '',
      badge: model?.badge || '',
      badge_color: model?.badge_color || '',
      prompt_token_cost: model?.cost_profile?.prompt_token_cost_per_1k || 0,
      completion_token_cost: model?.cost_profile?.completion_token_cost_per_1k || 0,
      avg_latency: model?.latency_profile?.avg_latency_ms || 0,
      max_tokens: model?.input?.max_tokens || 0,
      rate_limit: model?.usage_limits?.rate_limit_rpm || 0,
      fine_tuning_supported: model?.fine_tuning?.supported || false,
      capabilities: model?.capabilities?.join(', ') || '',
      compliance: model?.compliance?.join(', ') || '',
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      const submitData = {
        id: formData.id,
        name: formData.name,
        provider: formData.provider,
        version: formData.version,
        description: formData.description,
        badge: formData.badge,
        badge_color: formData.badge_color,
        model_type: "transformer",
        cost_profile: {
          prompt_token_cost_per_1k: formData.prompt_token_cost,
          completion_token_cost_per_1k: formData.completion_token_cost,
          currency: "USD"
        },
        latency_profile: {
          avg_latency_ms: formData.avg_latency
        },
        input: {
          max_tokens: formData.max_tokens
        },
        capabilities: formData.capabilities.split(',').map(s => s.trim()).filter(Boolean),
        compliance: formData.compliance.split(',').map(s => s.trim()).filter(Boolean),
        usage_limits: {
          rate_limit_rpm: formData.rate_limit
        },
        fine_tuning: {
          supported: formData.fine_tuning_supported
        }
      };

      onSubmit(submitData);
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Model Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="provider">Provider</Label>
            <Select value={formData.provider} onValueChange={(value) => setFormData({ ...formData, provider: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OpenAI">OpenAI</SelectItem>
                <SelectItem value="Anthropic">Anthropic</SelectItem>
                <SelectItem value="Google">Google</SelectItem>
                <SelectItem value="Meta">Meta</SelectItem>
                <SelectItem value="Mistral">Mistral</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="version">Version</Label>
            <Input
              id="version"
              value={formData.version}
              onChange={(e) => setFormData({ ...formData, version: e.target.value })}
              required
            />
          </div>
          <div>
            <Label htmlFor="badge">Badge</Label>
            <Input
              id="badge"
              value={formData.badge}
              onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
              placeholder="Latest, Beta, etc."
            />
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="prompt_cost">Input Cost (per 1K tokens)</Label>
            <Input
              id="prompt_cost"
              type="number"
              step="0.0001"
              value={formData.prompt_token_cost}
              onChange={(e) => setFormData({ ...formData, prompt_token_cost: parseFloat(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="completion_cost">Output Cost (per 1K tokens)</Label>
            <Input
              id="completion_cost"
              type="number"
              step="0.0001"
              value={formData.completion_token_cost}
              onChange={(e) => setFormData({ ...formData, completion_token_cost: parseFloat(e.target.value) })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="latency">Average Latency (ms)</Label>
            <Input
              id="latency"
              type="number"
              value={formData.avg_latency}
              onChange={(e) => setFormData({ ...formData, avg_latency: parseInt(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="max_tokens">Max Tokens</Label>
            <Input
              id="max_tokens"
              type="number"
              value={formData.max_tokens}
              onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="capabilities">Capabilities (comma-separated)</Label>
          <Input
            id="capabilities"
            value={formData.capabilities}
            onChange={(e) => setFormData({ ...formData, capabilities: e.target.value })}
            placeholder="text_generation, code_generation, reasoning"
          />
        </div>

        <div>
          <Label htmlFor="compliance">Compliance Standards (comma-separated)</Label>
          <Input
            id="compliance"
            value={formData.compliance}
            onChange={(e) => setFormData({ ...formData, compliance: e.target.value })}
            placeholder="SOC2, GDPR, HIPAA"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="fine_tuning"
            checked={formData.fine_tuning_supported}
            onCheckedChange={(checked) => setFormData({ ...formData, fine_tuning_supported: checked as boolean })}
          />
          <Label htmlFor="fine_tuning">Fine-tuning supported</Label>
        </div>

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">
            {model ? 'Update Model' : 'Add Model'}
          </Button>
        </div>
      </form>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-xl">
        <h1 className="text-2xl font-bold">LLM Model Configuration</h1>
        <p className="text-blue-100 mt-1">Manage, configure, and organize AI models</p>
      </div>

      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div className="flex items-center space-x-4">
          <Input
            placeholder="Search models..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-64"
          />
          
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Display Options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Display Options
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <div className="p-2 space-y-2">
                {Object.entries(displayOptions).map(([key, value]) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={key}
                      checked={value}
                      onCheckedChange={(checked) => 
                        setDisplayOptions(prev => ({ ...prev, [key]: checked as boolean }))
                      }
                    />
                    <Label htmlFor={key} className="text-sm capitalize">
                      {key === 'compliance' ? 'Security' : key}
                    </Label>
                  </div>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Add Model */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Model
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Model</DialogTitle>
              </DialogHeader>
              <ModelForm
                onSubmit={(data) => createModelMutation.mutate(data)}
                onCancel={() => setIsAddDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>

          {/* Edit Model Dialog */}
          <Dialog open={!!editingModel} onOpenChange={() => setEditingModel(null)}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Model</DialogTitle>
              </DialogHeader>
              <ModelForm
                model={editingModel}
                onSubmit={(data) => updateModelMutation.mutate(data)}
                onCancel={() => setEditingModel(null)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Models Display */}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="models" direction={viewMode === 'grid' ? 'vertical' : 'vertical'}>
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps}>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredModels.map((model: ModelConfig, index: number) => (
                    <ModelCard key={model.id} model={model} index={index} />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredModels.map((model: ModelConfig, index: number) => (
                    <ModelListItem key={model.id} model={model} index={index} />
                  ))}
                </div>
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {filteredModels.length === 0 && (
        <div className="text-center py-12">
          <Bot className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchFilter ? 'No models match your search' : 'No Models Available'}
          </h3>
          <p className="text-gray-500">
            {searchFilter ? 'Try a different search term' : 'Add a new model to get started'}
          </p>
          {!searchFilter && (
            <Button className="mt-4" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Model
            </Button>
          )}
        </div>
      )}
    </div>
  );
}