import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactFlow, { 
  Node, 
  Edge, 
  addEdge, 
  Connection, 
  useNodesState, 
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Panel,
  NodeTypes,
  EdgeTypes
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

import { 
  MessageCircle, 
  Plus, 
  Save, 
  Play, 
  Settings, 
  Eye,
  Trash2,
  Copy,
  Download,
  Upload,
  GitBranch,
  Diamond,
  Square,
  Circle,
  ArrowRight,
  Template,
  FileText,
  Users,
  ShoppingCart,
  HeadphonesIcon,
  Calendar,
  Star,
  UserPlus
} from 'lucide-react';

// Custom node types
const StartNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-green-100 border-2 border-green-300">
    <div className="flex items-center">
      <Circle className="w-4 h-4 mr-2 text-green-600" />
      <div className="text-sm font-medium">Start</div>
    </div>
  </div>
);

const MessageNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-blue-100 border-2 border-blue-300 min-w-[200px]">
    <div className="flex items-center mb-2">
      <MessageCircle className="w-4 h-4 mr-2 text-blue-600" />
      <div className="text-sm font-medium">Message</div>
    </div>
    <div className="text-xs text-gray-600 break-words">
      {data.message || 'Enter message...'}
    </div>
  </div>
);

const ConditionNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-yellow-100 border-2 border-yellow-300 min-w-[180px]">
    <div className="flex items-center mb-2">
      <Diamond className="w-4 h-4 mr-2 text-yellow-600" />
      <div className="text-sm font-medium">Condition</div>
    </div>
    <div className="text-xs text-gray-600 break-words">
      {data.condition || 'Enter condition...'}
    </div>
  </div>
);

const ActionNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-purple-100 border-2 border-purple-300 min-w-[180px]">
    <div className="flex items-center mb-2">
      <Settings className="w-4 h-4 mr-2 text-purple-600" />
      <div className="text-sm font-medium">Action</div>
    </div>
    <div className="text-xs text-gray-600 break-words">
      {data.action || 'Enter action...'}
    </div>
  </div>
);

const EndNode = ({ data }: { data: any }) => (
  <div className="px-4 py-2 shadow-md rounded-md bg-red-100 border-2 border-red-300">
    <div className="flex items-center">
      <Square className="w-4 h-4 mr-2 text-red-600" />
      <div className="text-sm font-medium">End</div>
    </div>
  </div>
);

const nodeTypes: NodeTypes = {
  start: StartNode,
  message: MessageNode,
  condition: ConditionNode,
  action: ActionNode,
  end: EndNode,
};

// Flow Templates Component
const FlowTemplates = ({ onLoadTemplate, onClearFlow }: { 
  onLoadTemplate: (template: any) => void; 
  onClearFlow: () => void; 
}) => {
  const templates = [
    {
      id: 'lead-qualification',
      name: 'Lead Qualification',
      description: 'Qualify potential customers by collecting contact information',
      icon: Users,
      category: 'sales',
      color: 'bg-blue-100 text-blue-600'
    },
    {
      id: 'customer-support',
      name: 'Customer Support',
      description: 'Route customer inquiries to appropriate support channels',
      icon: HeadphonesIcon,
      category: 'support',
      color: 'bg-green-100 text-green-600'
    },
    {
      id: 'appointment-booking',
      name: 'Appointment Booking',
      description: 'Guide customers through booking appointments or consultations',
      icon: Calendar,
      category: 'booking',
      color: 'bg-purple-100 text-purple-600'
    },
    {
      id: 'product-recommendation',
      name: 'Product Recommendations',
      description: 'Help customers find the right products based on their needs',
      icon: ShoppingCart,
      category: 'sales',
      color: 'bg-orange-100 text-orange-600'
    },
    {
      id: 'feedback-collection',
      name: 'Feedback Collection',
      description: 'Collect customer feedback and handle complaints professionally',
      icon: Star,
      category: 'feedback',
      color: 'bg-yellow-100 text-yellow-600'
    },
    {
      id: 'onboarding-flow',
      name: 'Customer Onboarding',
      description: 'Welcome new customers and guide them through initial setup',
      icon: UserPlus,
      category: 'onboarding',
      color: 'bg-indigo-100 text-indigo-600'
    }
  ];

  const loadTemplateFlow = async (templateId: string) => {
    try {
      const response = await apiRequest(`/api/conversation-flow-templates/${templateId}`);
      if (response) {
        onLoadTemplate(response);
      }
    } catch (error) {
      // Fallback to basic templates
      const basicTemplates: any = {
        'lead-qualification': {
          nodes: [
            {
              id: 'start-1',
              type: 'start',
              position: { x: 100, y: 100 },
              data: { label: 'Start' }
            },
            {
              id: 'welcome-1',
              type: 'message',
              position: { x: 100, y: 200 },
              data: { 
                label: 'Welcome Message',
                message: 'Hello! Welcome to our business. May I get your name?' 
              }
            },
            {
              id: 'collect-email-1',
              type: 'message',
              position: { x: 100, y: 300 },
              data: { 
                label: 'Collect Email',
                message: 'Great! Could you share your email address?' 
              }
            },
            {
              id: 'save-lead-1',
              type: 'action',
              position: { x: 100, y: 400 },
              data: { 
                label: 'Save Lead',
                action: 'save_lead_info' 
              }
            }
          ],
          edges: [
            { id: 'e1', source: 'start-1', target: 'welcome-1' },
            { id: 'e2', source: 'welcome-1', target: 'collect-email-1' },
            { id: 'e3', source: 'collect-email-1', target: 'save-lead-1' }
          ]
        },
        'customer-support': {
          nodes: [
            {
              id: 'start-1',
              type: 'start',
              position: { x: 100, y: 100 },
              data: { label: 'Support Start' }
            },
            {
              id: 'support-greeting-1',
              type: 'message',
              position: { x: 100, y: 200 },
              data: { 
                label: 'Support Greeting',
                message: 'Hi! I\'m here to help. What can I assist you with today?' 
              }
            },
            {
              id: 'issue-check-1',
              type: 'condition',
              position: { x: 100, y: 300 },
              data: { 
                label: 'Issue Type',
                condition: 'user_input contains "billing" or "payment"' 
              }
            },
            {
              id: 'billing-help-1',
              type: 'message',
              position: { x: 250, y: 400 },
              data: { 
                label: 'Billing Help',
                message: 'I\'ll connect you with our billing team right away.' 
              }
            },
            {
              id: 'general-help-1',
              type: 'message',
              position: { x: -50, y: 400 },
              data: { 
                label: 'General Help',
                message: 'Let me help you with that. Can you provide more details?' 
              }
            }
          ],
          edges: [
            { id: 'e1', source: 'start-1', target: 'support-greeting-1' },
            { id: 'e2', source: 'support-greeting-1', target: 'issue-check-1' },
            { id: 'e3', source: 'issue-check-1', target: 'billing-help-1', label: 'Billing' },
            { id: 'e4', source: 'issue-check-1', target: 'general-help-1', label: 'Other' }
          ]
        }
      };

      const template = basicTemplates[templateId];
      if (template) {
        onLoadTemplate(template);
      }
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm flex items-center">
          <Template className="w-4 h-4 mr-2" />
          Flow Templates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2">
          {templates.map((template) => (
            <Button
              key={template.id}
              size="sm"
              variant="outline"
              className="w-full p-3 h-auto text-left justify-start hover:bg-gray-50"
              onClick={() => loadTemplateFlow(template.id)}
            >
              <div className="flex items-start space-x-3 w-full">
                <div className={`p-1.5 rounded ${template.color}`}>
                  <template.icon className="w-3 h-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-xs">{template.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {template.description}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {template.category}
                  </div>
                </div>
              </div>
            </Button>
          ))}
        </div>
        
        <Separator />
        
        <div className="space-y-2">
          <Button
            size="sm"
            variant="outline"
            className="w-full justify-start text-gray-600"
            onClick={onClearFlow}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear Flow
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default function ConversationFlow() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [isFlowEnabled, setIsFlowEnabled] = useState(false);

  // Fetch agent data
  const { data: agent, isLoading } = useQuery({
    queryKey: ['/api/agents', id],
    enabled: !!id,
  });

  // Load existing flow
  useEffect(() => {
    if (agent?.conversationFlow) {
      setNodes(agent.conversationFlow.nodes || []);
      setEdges(agent.conversationFlow.edges || []);
      setIsFlowEnabled(agent.flowEnabled || false);
    }
  }, [agent, setNodes, setEdges]);

  // Save flow mutation
  const saveFlowMutation = useMutation({
    mutationFn: async (flowData: any) => {
      return apiRequest(`/api/agents/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          conversationFlow: {
            nodes,
            edges,
            variables: flowData.variables || []
          },
          flowEnabled: isFlowEnabled
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Flow Saved",
        description: "Conversation flow has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/agents', id] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save conversation flow.",
        variant: "destructive",
      });
    },
  });

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((event: any, node: Node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  }, []);

  const onEdgeClick = useCallback((event: any, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  const addNode = useCallback((type: string) => {
    const newNode = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { 
        label: `${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
        message: type === 'message' ? 'Enter your message here...' : undefined,
        condition: type === 'condition' ? 'user_input contains "yes"' : undefined,
        action: type === 'action' ? 'save_lead_info' : undefined,
      },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [setNodes]);

  const updateNodeData = useCallback((nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  }, [setNodes]);

  const deleteSelectedNode = useCallback(() => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((node) => node.id !== selectedNode.id));
      setEdges((eds) => eds.filter((edge) => 
        edge.source !== selectedNode.id && edge.target !== selectedNode.id
      ));
      setSelectedNode(null);
    }
  }, [selectedNode, setNodes, setEdges]);

  const deleteSelectedEdge = useCallback(() => {
    if (selectedEdge) {
      setEdges((eds) => eds.filter((edge) => edge.id !== selectedEdge.id));
      setSelectedEdge(null);
    }
  }, [selectedEdge, setEdges]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  if (!agent) {
    return <div className="text-center">Agent not found</div>;
  }

  return (
    <div className="flex h-screen">
      {/* Main Flow Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
          
          {/* Top Panel */}
          <Panel position="top-left">
            <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-md">
              <Badge variant="outline">{agent.name}</Badge>
              <Separator orientation="vertical" className="h-4" />
              <div className="flex items-center gap-2">
                <Switch
                  checked={isFlowEnabled}
                  onCheckedChange={setIsFlowEnabled}
                />
                <Label className="text-sm">Flow Enabled</Label>
              </div>
              <Button
                size="sm"
                onClick={() => saveFlowMutation.mutate({})}
                disabled={saveFlowMutation.isPending}
              >
                <Save className="w-4 h-4 mr-1" />
                Save
              </Button>
            </div>
          </Panel>

          {/* Node Creation Panel */}
          <Panel position="top-center">
            <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-md">
              <Button
                size="sm"
                variant="outline"
                onClick={() => addNode('start')}
              >
                <Circle className="w-4 h-4 mr-1" />
                Start
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addNode('message')}
              >
                <MessageCircle className="w-4 h-4 mr-1" />
                Message
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addNode('condition')}
              >
                <Diamond className="w-4 h-4 mr-1" />
                Condition
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addNode('action')}
              >
                <Settings className="w-4 h-4 mr-1" />
                Action
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => addNode('end')}
              >
                <Square className="w-4 h-4 mr-1" />
                End
              </Button>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Properties Panel */}
      <div className="w-80 bg-gray-50 border-l overflow-y-auto">
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4">Properties</h3>
          
          {selectedNode ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  Node: {selectedNode.type}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={deleteSelectedNode}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Label</Label>
                  <Input
                    value={selectedNode.data.label || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                  />
                </div>

                {selectedNode.type === 'message' && (
                  <div>
                    <Label>Message Content</Label>
                    <Textarea
                      value={selectedNode.data.message || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { message: e.target.value })}
                      placeholder="Enter the message to send..."
                      rows={4}
                    />
                  </div>
                )}

                {selectedNode.type === 'condition' && (
                  <div className="space-y-3">
                    <div>
                      <Label>Condition</Label>
                      <Input
                        value={selectedNode.data.condition || ''}
                        onChange={(e) => updateNodeData(selectedNode.id, { condition: e.target.value })}
                        placeholder="e.g., user_input contains 'yes'"
                      />
                    </div>
                    <div className="text-xs text-gray-600">
                      Available variables: user_input, user_name, conversation_count
                    </div>
                  </div>
                )}

                {selectedNode.type === 'action' && (
                  <div>
                    <Label>Action Type</Label>
                    <Select
                      value={selectedNode.data.action || ''}
                      onValueChange={(value) => updateNodeData(selectedNode.id, { action: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select action" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="save_lead_info">Save Lead Info</SelectItem>
                        <SelectItem value="send_email">Send Email</SelectItem>
                        <SelectItem value="create_ticket">Create Support Ticket</SelectItem>
                        <SelectItem value="schedule_callback">Schedule Callback</SelectItem>
                        <SelectItem value="transfer_to_human">Transfer to Human</SelectItem>
                        <SelectItem value="update_user_profile">Update User Profile</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <Label>Position</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="X"
                      value={selectedNode.position.x}
                      onChange={(e) => {
                        const newNodes = nodes.map(node =>
                          node.id === selectedNode.id 
                            ? { ...node, position: { ...node.position, x: Number(e.target.value) } }
                            : node
                        );
                        setNodes(newNodes);
                      }}
                    />
                    <Input
                      type="number"
                      placeholder="Y"
                      value={selectedNode.position.y}
                      onChange={(e) => {
                        const newNodes = nodes.map(node =>
                          node.id === selectedNode.id 
                            ? { ...node, position: { ...node.position, y: Number(e.target.value) } }
                            : node
                        );
                        setNodes(newNodes);
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : selectedEdge ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  Connection
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={deleteSelectedEdge}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Label</Label>
                  <Input
                    value={selectedEdge.label || ''}
                    onChange={(e) => {
                      const newEdges = edges.map(edge =>
                        edge.id === selectedEdge.id 
                          ? { ...edge, label: e.target.value }
                          : edge
                      );
                      setEdges(newEdges);
                    }}
                    placeholder="e.g., Yes, No, Default"
                  />
                </div>
                <div className="text-xs text-gray-600">
                  From: {selectedEdge.source} → To: {selectedEdge.target}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Flow Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Nodes:</span>
                  <Badge variant="secondary">{nodes.length}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Connections:</span>
                  <Badge variant="secondary">{edges.length}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <Badge variant={isFlowEnabled ? "default" : "outline"}>
                    {isFlowEnabled ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Flow Templates */}
          <FlowTemplates 
            onLoadTemplate={(template) => {
              setNodes(template.nodes);
              setEdges(template.edges);
            }}
            onClearFlow={() => {
              setNodes([]);
              setEdges([]);
            }}
          />
        </div>
      </div>
    </div>
  );
}