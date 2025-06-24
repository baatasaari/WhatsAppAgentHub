import { useState, useCallback, useRef, useEffect } from 'react';
import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  MarkerType,
  Panel,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Bot, 
  Plus, 
  Search, 
  GitBranch, 
  MessageCircle, 
  Users, 
  Settings,
  Eye,
  Edit,
  ArrowRight,
  Sparkles,
  Save,
  Play,
  Download,
  Upload,
  Trash2,
  Copy,
  Zap,
  Brain,
  Target,
  HelpCircle,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Send
} from 'lucide-react';

// Custom Node Components
const StartNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 bg-green-500 text-white rounded-lg border-2 border-green-600 min-w-32 text-center">
    <div className="flex items-center gap-2 justify-center">
      <Play className="w-4 h-4" />
      <span className="font-medium">Start</span>
    </div>
    {data.label && <div className="text-xs mt-1 opacity-90">{data.label}</div>}
  </div>
);

const MessageNode = ({ data }: { data: any }) => (
  <div className="px-4 py-3 bg-blue-500 text-white rounded-lg border-2 border-blue-600 min-w-48">
    <div className="flex items-center gap-2 mb-2">
      <MessageCircle className="w-4 h-4" />
      <span className="font-medium">Message</span>
    </div>
    <div className="text-sm bg-blue-600 p-2 rounded text-left">
      {data.message || 'Click to edit message...'}
    </div>
  </div>
);

const ConditionNode = ({ data }: { data: any }) => (
  <div className="px-4 py-3 bg-yellow-500 text-white rounded-lg border-2 border-yellow-600 min-w-48">
    <div className="flex items-center gap-2 mb-2">
      <HelpCircle className="w-4 h-4" />
      <span className="font-medium">Condition</span>
    </div>
    <div className="text-sm bg-yellow-600 p-2 rounded text-left">
      {data.condition || 'Click to set condition...'}
    </div>
  </div>
);

const ActionNode = ({ data }: { data: any }) => (
  <div className="px-4 py-3 bg-purple-500 text-white rounded-lg border-2 border-purple-600 min-w-48">
    <div className="flex items-center gap-2 mb-2">
      <Zap className="w-4 h-4" />
      <span className="font-medium">Action</span>
    </div>
    <div className="text-sm bg-purple-600 p-2 rounded text-left">
      {data.action || 'Click to set action...'}
    </div>
  </div>
);

const EndNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 bg-red-500 text-white rounded-lg border-2 border-red-600 min-w-32 text-center">
    <div className="flex items-center gap-2 justify-center">
      <XCircle className="w-4 h-4" />
      <span className="font-medium">End</span>
    </div>
    {data.label && <div className="text-xs mt-1 opacity-90">{data.label}</div>}
  </div>
);

const nodeTypes: NodeTypes = {
  start: StartNode,
  message: MessageNode,
  condition: ConditionNode,
  action: ActionNode,
  end: EndNode,
};

// Initial nodes and edges
const initialNodes: Node[] = [
  {
    id: '1',
    type: 'start',
    position: { x: 250, y: 25 },
    data: { label: 'Conversation Start' },
  },
];

const initialEdges: Edge[] = [];

function FlowCanvas() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const reactFlowInstance = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showNodeDialog, setShowNodeDialog] = useState(false);
  const [flowName, setFlowName] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string>('');

  // Fetch user's agents
  const { data: agents = [] } = useQuery({
    queryKey: ['/api/agents'],
    retry: false,
  });

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({
      ...params,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 2 },
    }, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.type !== 'start') {
      setSelectedNode(node);
      setShowNodeDialog(true);
    }
  }, []);

  const addNode = useCallback((type: string) => {
    const position = reactFlowInstance.project({
      x: Math.random() * 400 + 50,
      y: Math.random() * 400 + 100,
    });

    const newNode: Node = {
      id: `${nodes.length + 1}`,
      type,
      position,
      data: getDefaultNodeData(type),
    };

    setNodes((nds) => nds.concat(newNode));
  }, [nodes.length, reactFlowInstance, setNodes]);

  const updateNodeData = useCallback((nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  }, [setNodes]);

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
  }, [setNodes, setEdges]);

  // Save flow mutation
  const saveFlowMutation = useMutation({
    mutationFn: async (flowData: any) => {
      return apiRequest(`/api/agents/${selectedAgent}/conversation-flow`, {
        method: 'POST',
        body: flowData,
      });
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Conversation flow saved successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to save conversation flow',
        variant: 'destructive' 
      });
    },
  });

  const handleSaveFlow = () => {
    if (!selectedAgent) {
      toast({ 
        title: 'Error', 
        description: 'Please select an agent first',
        variant: 'destructive' 
      });
      return;
    }

    if (!flowName.trim()) {
      toast({ 
        title: 'Error', 
        description: 'Please enter a flow name',
        variant: 'destructive' 
      });
      return;
    }

    const flowData = {
      name: flowName,
      nodes: nodes,
      edges: edges,
      metadata: {
        created: new Date().toISOString(),
        version: '1.0',
      },
    };

    saveFlowMutation.mutate(flowData);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Top Panel */}
      <Panel position="top-left" className="m-4">
        <Card className="p-4 bg-white shadow-lg">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <Label htmlFor="agent-select">Select Agent</Label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent: any) => (
                    <SelectItem key={agent.id} value={agent.id.toString()}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label htmlFor="flow-name">Flow Name</Label>
              <Input
                id="flow-name"
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                placeholder="Enter flow name..."
              />
            </div>
            <Button 
              onClick={handleSaveFlow} 
              disabled={saveFlowMutation.isPending}
              className="mt-6"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveFlowMutation.isPending ? 'Saving...' : 'Save Flow'}
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button onClick={() => addNode('message')} size="sm">
              <MessageCircle className="w-4 h-4 mr-1" />
              Message
            </Button>
            <Button onClick={() => addNode('condition')} size="sm" variant="outline">
              <HelpCircle className="w-4 h-4 mr-1" />
              Condition
            </Button>
            <Button onClick={() => addNode('action')} size="sm" variant="outline">
              <Zap className="w-4 h-4 mr-1" />
              Action
            </Button>
            <Button onClick={() => addNode('end')} size="sm" variant="outline">
              <XCircle className="w-4 h-4 mr-1" />
              End
            </Button>
          </div>
        </Card>
      </Panel>

      {/* Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        className="bg-gray-50"
        connectionLineStyle={{ strokeWidth: 2 }}
        defaultEdgeOptions={{
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { strokeWidth: 2 },
        }}
      >
        <Controls />
        <Background variant="dots" gap={20} size={1} />
      </ReactFlow>

      {/* Node Edit Dialog */}
      <NodeEditDialog 
        node={selectedNode}
        open={showNodeDialog}
        onOpenChange={setShowNodeDialog}
        onUpdate={updateNodeData}
        onDelete={deleteNode}
      />
    </div>
  );
}

function NodeEditDialog({ 
  node, 
  open, 
  onOpenChange, 
  onUpdate, 
  onDelete 
}: {
  node: Node | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (nodeId: string, data: any) => void;
  onDelete: (nodeId: string) => void;
}) {
  const [formData, setFormData] = useState<any>({});

  React.useEffect(() => {
    if (node) {
      setFormData(node.data || {});
    }
  }, [node]);

  const handleSave = () => {
    if (node) {
      onUpdate(node.id, formData);
      onOpenChange(false);
    }
  };

  const handleDelete = () => {
    if (node) {
      onDelete(node.id);
      onOpenChange(false);
    }
  };

  if (!node) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {node.type} Node</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {node.type === 'message' && (
            <div>
              <Label htmlFor="message">Message Text</Label>
              <Textarea
                id="message"
                value={formData.message || ''}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Enter the message to send..."
                rows={3}
              />
            </div>
          )}

          {node.type === 'condition' && (
            <div>
              <Label htmlFor="condition">Condition</Label>
              <Input
                id="condition"
                value={formData.condition || ''}
                onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                placeholder="e.g., user_input contains 'yes'"
              />
            </div>
          )}

          {node.type === 'action' && (
            <div>
              <Label htmlFor="action">Action Type</Label>
              <Select 
                value={formData.action || ''} 
                onValueChange={(value) => setFormData({ ...formData, action: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose action..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="send_email">Send Email</SelectItem>
                  <SelectItem value="create_ticket">Create Ticket</SelectItem>
                  <SelectItem value="schedule_call">Schedule Call</SelectItem>
                  <SelectItem value="save_lead">Save Lead</SelectItem>
                  <SelectItem value="transfer_human">Transfer to Human</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {node.type === 'end' && (
            <div>
              <Label htmlFor="label">End Label</Label>
              <Input
                id="label"
                value={formData.label || ''}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="e.g., Conversation Complete"
              />
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getDefaultNodeData(type: string) {
  switch (type) {
    case 'message':
      return { message: 'Hello! How can I help you today?' };
    case 'condition':
      return { condition: 'user_input contains keyword' };
    case 'action':
      return { action: 'save_lead' };
    case 'end':
      return { label: 'Conversation Complete' };
    default:
      return {};
  }
}

export default function ConversationFlowDesigner() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<'templates' | 'designer'>('templates');
  
  // Fetch user's agents
  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ['/api/agents'],
    retry: false,
  });

  // Fetch conversation flow templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/conversation-flow-templates'],
    retry: false,
  });

  const filteredAgents = Array.isArray(agents) ? agents.filter((agent: any) =>
    agent.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  const categoryColors = {
    'sales': 'bg-green-100 text-green-800',
    'support': 'bg-blue-100 text-blue-800',
    'booking': 'bg-purple-100 text-purple-800',
    'feedback': 'bg-orange-100 text-orange-800',
    'onboarding': 'bg-indigo-100 text-indigo-800',
    'default': 'bg-gray-100 text-gray-800'
  };

  const getPreviewFor = (template: any) => {
    toast({
      title: "Flow Preview",
      description: `${template.name}: ${template.description}`,
    });
  };

  const useTemplate = (templateName: string) => {
    setViewMode('designer');
    toast({
      title: "Template Applied",
      description: `${templateName} template has been loaded for customization.`,
    });
  };

  if (agentsLoading || templatesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading conversation flow designer...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <GitBranch className="w-8 h-8 text-purple-600" />
          Intelligent Conversation Flow Designer
        </h1>
        <p className="text-gray-600">
          Design sophisticated conversation flows with drag-and-drop simplicity. Create branching logic, conditions, and automated responses.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bot className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{agents.length}</p>
                <p className="text-sm text-gray-600">Active Agents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <GitBranch className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{templates.length}</p>
                <p className="text-sm text-gray-600">Flow Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <MessageCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {agents.reduce((acc: number, agent: any) => acc + (agent.conversationFlows?.length || 0), 0)}
                </p>
                <p className="text-sm text-gray-600">Active Flows</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Sparkles className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">AI</p>
                <p className="text-sm text-gray-600">Powered</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mode Selection */}
      <div className="mb-6">
        <Tabs value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="templates">Browse Templates</TabsTrigger>
            <TabsTrigger value="designer">Flow Designer</TabsTrigger>
          </TabsList>
          
          <TabsContent value="templates" className="mt-6">
            {/* Search */}
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search agents and templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => setViewMode('designer')}>
                <Plus className="w-4 h-4 mr-2" />
                Create New Flow
              </Button>
            </div>

            {/* Templates Section */}
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Pre-built Templates
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template: any, index: number) => (
                  <Card key={index} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <Badge className={categoryColors[template.category as keyof typeof categoryColors] || categoryColors.default}>
                          {template.category}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600 text-sm mb-4">{template.description}</p>
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                        <span>{template.nodes} nodes</span>
                        <span>{template.complexity} complexity</span>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => getPreviewFor(template)}
                          className="flex-1"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Preview
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => useTemplate(template.name)}
                          className="flex-1"
                        >
                          <ArrowRight className="w-4 h-4 mr-1" />
                          Use Template
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Agents Section */}
            <div>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Bot className="w-5 h-5" />
                Your Agents
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAgents.map((agent: any) => (
                  <Card key={agent.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{agent.name}</CardTitle>
                        <Badge variant={agent.conversationFlows?.length > 0 ? "default" : "secondary"}>
                          {agent.conversationFlows?.length > 0 ? 'Has Flows' : 'No Flows'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600 text-sm mb-4">{agent.description}</p>
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
                        <span>{agent.conversationFlows?.length || 0} flows</span>
                        <span className="capitalize">{agent.platformType}</span>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/conversation-flow/${agent.id}`} className="flex-1">
                          <Button size="sm" variant="outline" className="w-full">
                            <Edit className="w-4 h-4 mr-1" />
                            Edit Flows
                          </Button>
                        </Link>
                        <Button 
                          size="sm" 
                          onClick={() => setViewMode('designer')}
                          className="flex-1"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          New Flow
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="designer" className="mt-6">
            <div className="h-[800px] border rounded-lg bg-white">
              <ReactFlowProvider>
                <FlowCanvas />
              </ReactFlowProvider>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <GitBranch className="w-8 h-8 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">Intelligent Conversation Flow Designer</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-4xl mx-auto">
            Create sophisticated conversation flows with visual drag-and-drop interface. Design complex decision trees, 
            conditional logic, and multi-step user journeys for your AI agents.
          </p>
        </div>

        {/* Search */}
        <div className="max-w-md mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Flow Templates Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Flow Templates</h2>
            <Badge variant="secondary" className="bg-blue-50 text-blue-700">
              {templates.length} Templates Available
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template: any) => (
              <Card key={template.id} className="hover:shadow-md transition-shadow border-gray-200">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <MessageCircle className="w-5 h-5 text-blue-600" />
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                    </div>
                    <Badge 
                      variant="secondary" 
                      className={categoryColors[template.category] || categoryColors.default}
                    >
                      {template.category}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {template.description}
                  </p>
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 font-medium mb-1">Flow Preview:</p>
                    <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded text-center">
                      {template.preview}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        toast({
                          title: `${template.name} Preview`,
                          description: template.description,
                        });
                      }}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Preview
                    </Button>
                    <Button 
                      size="sm" 
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                      onClick={() => {
                        toast({
                          title: "Template Selected",
                          description: `${template.name} template is ready to use. Create an agent first to apply this template.`,
                        });
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Use Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Your Agents Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Design Flows for Your Agents</h2>
            <Badge variant="secondary" className="bg-green-50 text-green-700">
              {filteredAgents.length} Agents Available
            </Badge>
          </div>

          {filteredAgents.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Bot className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No Agents Found</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  You need to create agents first before designing conversation flows. 
                  Start by creating your first AI agent.
                </p>
                <Link href="/wizard">
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Agent
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAgents.map((agent: any) => (
                <Card key={agent.id} className="hover:shadow-md transition-shadow border-gray-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <Bot className="w-5 h-5 text-green-600" />
                        <CardTitle className="text-lg">{agent.name}</CardTitle>
                      </div>
                      <Badge variant={agent.flowEnabled ? "default" : "secondary"}>
                        {agent.flowEnabled ? 'Flow Active' : 'No Flow'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {agent.description || 'No description available'}
                    </p>
                    
                    <div className="mb-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Platform:</span>
                        <Badge variant="outline" className="text-xs">
                          {agent.platformType || 'WhatsApp'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Model:</span>
                        <span className="text-gray-700 font-medium">{agent.model || 'GPT-4o'}</span>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Link href={`/conversation-flow/${agent.id}`} className="flex-1">
                        <Button size="sm" variant="outline" className="w-full">
                          <Edit className="w-4 h-4 mr-1" />
                          {agent.flowEnabled ? 'Edit Flow' : 'Design Flow'}
                        </Button>
                      </Link>
                      <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700">
                        <Sparkles className="w-4 h-4 mr-1" />
                        AI Assist
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Feature Highlights */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="text-center p-6 border-dashed border-2 border-gray-300">
            <GitBranch className="w-12 h-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Visual Flow Builder</h3>
            <p className="text-gray-600 text-sm">
              Drag and drop interface with conditional logic, decision trees, and complex routing
            </p>
          </Card>
          
          <Card className="text-center p-6 border-dashed border-2 border-gray-300">
            <Users className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Multi-Platform Support</h3>
            <p className="text-gray-600 text-sm">
              Design flows that work across WhatsApp, Telegram, Discord, and social platforms
            </p>
          </Card>
          
          <Card className="text-center p-6 border-dashed border-2 border-gray-300">
            <Settings className="w-12 h-12 text-purple-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Advanced Automation</h3>
            <p className="text-gray-600 text-sm">
              Variables, conditions, API integrations, and webhook triggers for sophisticated workflows
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}