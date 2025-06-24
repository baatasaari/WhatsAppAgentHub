import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
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
  Sparkles
} from 'lucide-react';

export default function ConversationFlowDesigner() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  
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

  if (agentsLoading || templatesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading conversation designer...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
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