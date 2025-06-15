import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Copy, Check, MessageCircle, Bot, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import CopyButton from "@/components/ui/copy-button";

export default function EmbedCode() {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [widgetConfig, setWidgetConfig] = useState({
    position: "bottom-right",
    color: "#25D366",
    welcomeMessage: "Hi! How can I help you today?"
  });
  const [showChatPreview, setShowChatPreview] = useState(false);

  const { data: agents, isLoading } = useQuery({
    queryKey: ["/api/agents"],
  });

  const selectedAgent = agents?.find((agent: any) => agent.id.toString() === selectedAgentId);
  
  const generateEmbedCode = () => {
    if (!selectedAgent) return "";
    
    const baseUrl = window.location.origin;
    
    return `<!-- AgentFlow WhatsApp Widget -->
<script>
(function() {
    var agentflowWidget = document.createElement('script');
    agentflowWidget.src = '${baseUrl}/widget/agentflow-widget.js';
    agentflowWidget.setAttribute('data-agent-id', '${selectedAgent.apiKey}');
    agentflowWidget.setAttribute('data-position', '${widgetConfig.position}');
    agentflowWidget.setAttribute('data-color', '${widgetConfig.color}');
    agentflowWidget.setAttribute('data-welcome-msg', '${widgetConfig.welcomeMessage}');
    agentflowWidget.async = true;
    document.head.appendChild(agentflowWidget);
})();
</script>
<!-- End AgentFlow Widget -->`;
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const activeAgents = (agents || []).filter((agent: any) => agent.status === 'active');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Agent Selection */}
      <Card>
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Select Agent to Embed</h3>
        </div>
        <CardContent className="p-6">
          {activeAgents.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 mb-2">No active agents available</p>
              <p className="text-sm text-gray-400">Create and activate an agent first to generate embed code</p>
              <Button className="mt-4" onClick={() => window.location.href = "/create"}>
                Create Agent
              </Button>
            </div>
          ) : (
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger className="text-lg py-3">
                <SelectValue placeholder="Choose an agent to embed" />
              </SelectTrigger>
              <SelectContent>
                {activeAgents.map((agent: any) => (
                  <SelectItem key={agent.id} value={agent.id.toString()}>
                    {agent.name} - {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {selectedAgent && (
        <>
          {/* Generated Code */}
          <Card>
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Embeddable Code</h3>
                <CopyButton text={generateEmbedCode()} />
              </div>
            </div>
            <CardContent className="p-6">
              <div className="bg-gray-900 rounded-lg p-4 text-sm">
                <pre className="text-green-400 overflow-x-auto">
                  <code>{generateEmbedCode()}</code>
                </pre>
              </div>
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                  <Info className="w-4 h-4 mr-2" />
                  Integration Instructions
                </h4>
                <ol className="text-blue-800 text-sm space-y-1 ml-4 list-decimal">
                  <li>Copy the code above</li>
                  <li>Paste it just before the closing &lt;/body&gt; tag on your website</li>
                  <li>The WhatsApp widget will automatically appear on all pages</li>
                  <li>Visitors can click to start conversations with your AI agent</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          {/* Widget Preview */}
          <Card>
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Widget Preview</h3>
            </div>
            <CardContent className="p-6">
              <div className="bg-gray-100 rounded-lg p-8 relative min-h-96">
                <div className="text-center text-gray-500 mb-4">
                  <div className="w-16 h-16 bg-gray-300 rounded-lg mx-auto mb-2 flex items-center justify-center">
                    <Bot className="w-8 h-8 text-gray-600" />
                  </div>
                  <p>Your website preview</p>
                </div>
                
                {/* WhatsApp Widget Preview */}
                <div className={`fixed z-50 ${
                  widgetConfig.position === 'bottom-right' ? 'bottom-6 right-6' :
                  widgetConfig.position === 'bottom-left' ? 'bottom-6 left-6' :
                  widgetConfig.position === 'top-right' ? 'top-6 right-6' :
                  'top-6 left-6'
                }`}>
                  <div 
                    className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center cursor-pointer transition-all transform hover:scale-110"
                    style={{ backgroundColor: widgetConfig.color }}
                    onClick={() => setShowChatPreview(!showChatPreview)}
                  >
                    <MessageCircle className="w-6 h-6 text-white" />
                  </div>
                  
                  {/* Chat popup preview */}
                  {showChatPreview && (
                    <div className={`absolute w-80 bg-white rounded-lg shadow-xl border border-gray-200 ${
                      widgetConfig.position.includes('bottom') ? 'bottom-16' : 'top-16'
                    } ${
                      widgetConfig.position.includes('right') ? 'right-0' : 'left-0'
                    }`}>
                      <div 
                        className="text-white p-4 rounded-t-lg"
                        style={{ backgroundColor: widgetConfig.color }}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                            <Bot className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-semibold">{selectedAgent.name}</p>
                            <p className="text-xs opacity-90">Typically replies instantly</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                        <div className="bg-gray-100 rounded-lg p-3 max-w-xs">
                          <p className="text-sm">{widgetConfig.welcomeMessage}</p>
                        </div>
                      </div>
                      <div className="p-4 border-t border-gray-200">
                        <div className="flex items-center space-x-2">
                          <Input
                            placeholder="Type your message..."
                            className="flex-1 text-sm"
                          />
                          <Button 
                            size="sm"
                            className="w-8 h-8 p-0"
                            style={{ backgroundColor: widgetConfig.color }}
                          >
                            <MessageCircle className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configuration Options */}
          <Card>
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Widget Configuration</h3>
            </div>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
                  <Select 
                    value={widgetConfig.position} 
                    onValueChange={(value) => setWidgetConfig({...widgetConfig, position: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bottom-right">Bottom Right</SelectItem>
                      <SelectItem value="bottom-left">Bottom Left</SelectItem>
                      <SelectItem value="top-right">Top Right</SelectItem>
                      <SelectItem value="top-left">Top Left</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={widgetConfig.color}
                      onChange={(e) => setWidgetConfig({...widgetConfig, color: e.target.value})}
                      className="w-10 h-8 border border-gray-300 rounded"
                    />
                    <Input
                      value={widgetConfig.color}
                      onChange={(e) => setWidgetConfig({...widgetConfig, color: e.target.value})}
                      className="flex-1 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Welcome Message</label>
                  <Input
                    value={widgetConfig.welcomeMessage}
                    onChange={(e) => setWidgetConfig({...widgetConfig, welcomeMessage: e.target.value})}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
