import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Smartphone, Monitor, Palette, MessageSquare, Eye, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function WidgetPreview() {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [widgetConfig, setWidgetConfig] = useState({
    position: "bottom-right",
    color: "#25D366",
    welcomeMessage: "Hi! How can I help you today?"
  });

  const { data: agents, isLoading } = useQuery({
    queryKey: ["/api/agents"],
  });

  const { data: embedData } = useQuery({
    queryKey: ["/api/agents", selectedAgentId, "embed-code"],
    enabled: !!selectedAgentId,
  });

  const selectedAgent = Array.isArray(agents) ? agents.find((agent: any) => agent.id.toString() === selectedAgentId) : undefined;

  useEffect(() => {
    if (selectedAgent) {
      setWidgetConfig({
        position: selectedAgent.widgetPosition || "bottom-right",
        color: selectedAgent.widgetColor || "#25D366",
        welcomeMessage: selectedAgent.welcomeMessage || "Hi! How can I help you today?"
      });
    }
  }, [selectedAgent]);

  const handleWhatsAppTest = () => {
    if (selectedAgent?.whatsappNumber) {
      const message = encodeURIComponent(widgetConfig.welcomeMessage);
      const cleanNumber = selectedAgent.whatsappNumber.replace(/[^0-9]/g, '');
      const whatsappUrl = `https://wa.me/${cleanNumber}?text=${message}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  const activeAgents = Array.isArray(agents) ? agents.filter((agent: any) => agent.status === 'active') : [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Eye className="w-6 h-6" />
          Widget Preview & Testing
        </h1>
        <p className="text-blue-100 mt-2">
          Preview your WhatsApp widgets and test them directly before deployment
        </p>
      </div>

      {/* Agent Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Select Agent to Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose Agent
              </label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent to preview" />
                </SelectTrigger>
                <SelectContent>
                  {activeAgents.map((agent: any) => (
                    <SelectItem key={agent.id} value={agent.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        {agent.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preview Device
              </label>
              <div className="flex gap-2">
                <Button
                  variant={previewDevice === "desktop" ? "default" : "outline"}
                  onClick={() => setPreviewDevice("desktop")}
                  className="flex-1"
                >
                  <Monitor className="w-4 h-4 mr-2" />
                  Desktop
                </Button>
                <Button
                  variant={previewDevice === "mobile" ? "default" : "outline"}
                  onClick={() => setPreviewDevice("mobile")}
                  className="flex-1"
                >
                  <Smartphone className="w-4 h-4 mr-2" />
                  Mobile
                </Button>
              </div>
            </div>
          </div>

          {selectedAgent && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900">{selectedAgent.name}</h4>
                  <p className="text-sm text-gray-600">
                    WhatsApp: {selectedAgent.whatsappNumber || "Not configured"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {selectedAgent.status}
                  </Badge>
                  {selectedAgent.whatsappNumber && (
                    <Button 
                      onClick={handleWhatsAppTest}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Test WhatsApp
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedAgent && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Widget Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Position
                </label>
                <Select 
                  value={widgetConfig.position} 
                  onValueChange={(value) => setWidgetConfig(prev => ({ ...prev, position: value }))}
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Widget Color
                </label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={widgetConfig.color}
                    onChange={(e) => setWidgetConfig(prev => ({ ...prev, color: e.target.value }))}
                    className="w-16 h-10"
                  />
                  <Input
                    type="text"
                    value={widgetConfig.color}
                    onChange={(e) => setWidgetConfig(prev => ({ ...prev, color: e.target.value }))}
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Welcome Message
                </label>
                <Input
                  value={widgetConfig.welcomeMessage}
                  onChange={(e) => setWidgetConfig(prev => ({ ...prev, welcomeMessage: e.target.value }))}
                  placeholder="Enter welcome message"
                />
              </div>

              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2">WhatsApp Configuration</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Business Number:</span>
                    <span className="font-mono">{selectedAgent.whatsappNumber || "Not set"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mode:</span>
                    <span className="capitalize">{selectedAgent.whatsappMode || "web"}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
              <p className="text-sm text-gray-600">
                Preview how your widget will appear on websites
              </p>
            </CardHeader>
            <CardContent>
              <div 
                className={`relative bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden transition-all duration-300 ${
                  previewDevice === "mobile" ? "h-96 w-48 mx-auto" : "h-64 w-full"
                }`}
                style={{
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%239C92AC" fill-opacity="0.1"%3E%3Ccircle cx="30" cy="30" r="4"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'
                }}
              >
                {/* Mock Website Content */}
                <div className="p-6 h-full flex flex-col justify-center items-center text-center">
                  <div className="bg-white rounded-lg p-4 shadow-lg mb-4 max-w-xs">
                    <h3 className="font-bold text-gray-800">Sample Website</h3>
                    <p className="text-sm text-gray-600 mt-2">
                      This is how your widget will appear on client websites
                    </p>
                  </div>
                </div>

                {/* Widget Preview */}
                <div 
                  className={`absolute ${
                    widgetConfig.position === "bottom-right" ? "bottom-6 right-6" :
                    widgetConfig.position === "bottom-left" ? "bottom-6 left-6" :
                    widgetConfig.position === "top-right" ? "top-6 right-6" :
                    "top-6 left-6"
                  }`}
                >
                  <button
                    onClick={handleWhatsAppTest}
                    className="w-14 h-14 rounded-full shadow-lg hover:scale-110 transition-transform duration-200 flex items-center justify-center"
                    style={{ backgroundColor: widgetConfig.color }}
                    title={widgetConfig.welcomeMessage}
                  >
                    <svg className="w-8 h-8 fill-white" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.893 3.086"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Click the widget above to test WhatsApp integration!</strong>
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Generated URL: https://wa.me/{selectedAgent.whatsappNumber?.replace(/[^0-9]/g, '')}?text={encodeURIComponent(widgetConfig.welcomeMessage)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Integration Testing */}
      {selectedAgent && embedData && (
        <Card>
          <CardHeader>
            <CardTitle>Integration Testing</CardTitle>
            <p className="text-sm text-gray-600">
              Test your widget integration with different scenarios
            </p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="live-test" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="live-test">Live Test</TabsTrigger>
                <TabsTrigger value="embed-code">Embed Code</TabsTrigger>
                <TabsTrigger value="analytics">Test Results</TabsTrigger>
              </TabsList>

              <TabsContent value="live-test" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button 
                    onClick={handleWhatsAppTest}
                    className="bg-green-600 hover:bg-green-700 h-12"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Test WhatsApp Integration
                  </Button>
                  <Button 
                    onClick={() => window.open('/test-widget.html', '_blank')}
                    variant="outline"
                    className="h-12"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Test Page
                  </Button>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Test Checklist:</h4>
                  <ul className="text-sm space-y-1 text-gray-600">
                    <li>✓ Widget appears in correct position</li>
                    <li>✓ Color matches configuration</li>
                    <li>✓ WhatsApp opens with correct number</li>
                    <li>✓ Welcome message is pre-filled</li>
                    <li>✓ Works on both desktop and mobile</li>
                  </ul>
                </div>
              </TabsContent>

              <TabsContent value="embed-code">
                <div className="space-y-4">
                  <div className="bg-gray-900 text-gray-100 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                    <pre>{embedData?.secureEmbedCode || 'Loading embed code...'}</pre>
                  </div>
                  <Button 
                    onClick={() => navigator.clipboard.writeText(embedData?.secureEmbedCode || '')}
                    className="w-full"
                    disabled={!embedData?.secureEmbedCode}
                  >
                    Copy Embed Code
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="analytics">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="font-medium text-green-800">WhatsApp Tests</h4>
                    <p className="text-2xl font-bold text-green-900 mt-1">0</p>
                    <p className="text-sm text-green-600">Successful redirects</p>
                  </div>
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-800">Widget Loads</h4>
                    <p className="text-2xl font-bold text-blue-900 mt-1">0</p>
                    <p className="text-sm text-blue-600">Page integrations</p>
                  </div>
                  <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <h4 className="font-medium text-purple-800">Conversion Rate</h4>
                    <p className="text-2xl font-bold text-purple-900 mt-1">0%</p>
                    <p className="text-sm text-purple-600">Widget to WhatsApp</p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}