import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Phone, Settings, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const whatsappConfigSchema = z.object({
  agentId: z.number(),
  whatsappBusinessAccountId: z.string().min(1, "Business Account ID is required"),
  whatsappPhoneNumberId: z.string().min(1, "Phone Number ID is required"),
  whatsappAccessToken: z.string().min(1, "Access Token is required"),
  whatsappWebhookVerifyToken: z.string().min(1, "Webhook Verify Token is required"),
  whatsappNumber: z.string().min(1, "WhatsApp Number is required"),
});

type WhatsAppConfigForm = z.infer<typeof whatsappConfigSchema>;

export default function WhatsAppConfig() {
  const { user } = useAuth();
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Fetch user's agents
  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ["/api/agents"],
    enabled: !!user,
  });

  // Fetch agent details when selected
  const { data: agent, isLoading: agentLoading } = useQuery({
    queryKey: ["/api/agents", selectedAgent],
    enabled: !!selectedAgent,
  });

  // Fetch WhatsApp messages for selected agent
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["/api/agents", selectedAgent, "whatsapp-messages"],
    enabled: !!selectedAgent,
  });

  const form = useForm<WhatsAppConfigForm>({
    resolver: zodResolver(whatsappConfigSchema),
    defaultValues: {
      agentId: selectedAgent || 0,
      whatsappBusinessAccountId: "",
      whatsappPhoneNumberId: "",
      whatsappAccessToken: "",
      whatsappWebhookVerifyToken: "",
      whatsappNumber: "",
    },
  });

  // Update form when agent data loads
  React.useEffect(() => {
    if (agent && selectedAgent) {
      form.reset({
        agentId: selectedAgent,
        whatsappBusinessAccountId: (agent as any).whatsappBusinessAccountId || "",
        whatsappPhoneNumberId: (agent as any).whatsappPhoneNumberId || "",
        whatsappAccessToken: (agent as any).whatsappAccessToken || "",
        whatsappWebhookVerifyToken: (agent as any).whatsappWebhookVerifyToken || "",
        whatsappNumber: (agent as any).whatsappNumber || "",
      });
    }
  }, [agent, selectedAgent, form]);

  const updateConfigMutation = useMutation({
    mutationFn: async (data: WhatsAppConfigForm) => {
      const response = await apiRequest("PUT", `/api/agents/${data.agentId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", selectedAgent] });
      setTestResult({ success: true, message: "WhatsApp configuration updated successfully" });
    },
    onError: (error: any) => {
      setTestResult({ success: false, message: error.message || "Failed to update configuration" });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const response = await apiRequest("POST", `/api/agents/${selectedAgent}/send-whatsapp`, {
        phoneNumber,
        message: "🤖 Test message from AgentFlow - Your WhatsApp Business API integration is working!"
      });
      return response.json();
    },
    onSuccess: () => {
      setTestResult({ success: true, message: "Test message sent successfully!" });
      queryClient.invalidateQueries({ queryKey: ["/api/agents", selectedAgent, "whatsapp-messages"] });
    },
    onError: (error: any) => {
      setTestResult({ success: false, message: error.message || "Failed to send test message" });
    },
  });

  const onSubmit = (data: WhatsAppConfigForm) => {
    updateConfigMutation.mutate(data);
  };

  const handleTestConnection = () => {
    const phoneNumber = form.getValues("whatsappNumber");
    if (phoneNumber) {
      testConnectionMutation.mutate(phoneNumber);
    }
  };

  const isConfigured = (agent as any)?.whatsappAccessToken && (agent as any)?.whatsappPhoneNumberId;
  const webhookUrl = selectedAgent ? `${window.location.origin}/webhook/whatsapp/${selectedAgent}` : "";

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">WhatsApp Business API</h1>
          <p className="text-gray-600">Configure real WhatsApp Business API integration for your agents</p>
        </div>
        {isConfigured && (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="w-4 h-4 mr-1" />
            Configured
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              Select Agent
            </CardTitle>
            <CardDescription>
              Choose an agent to configure with WhatsApp Business API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {agentsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {(agents as any[]).map((agent: any) => (
                  <Button
                    key={agent.id}
                    variant={selectedAgent === agent.id ? "default" : "outline"}
                    className="w-full justify-start"
                    onClick={() => setSelectedAgent(agent.id)}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    {agent.name}
                    {agent.whatsappAccessToken && (
                      <CheckCircle className="w-4 h-4 ml-auto text-green-600" />
                    )}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuration Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Phone className="w-5 h-5 mr-2" />
              WhatsApp Business API Configuration
            </CardTitle>
            <CardDescription>
              Enter your WhatsApp Business API credentials to enable real-time messaging
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedAgent ? (
              <div className="text-center py-8 text-gray-500">
                Select an agent to configure WhatsApp Business API settings
              </div>
            ) : agentLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <Tabs defaultValue="config" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="config">Configuration</TabsTrigger>
                  <TabsTrigger value="webhook">Webhook</TabsTrigger>
                  <TabsTrigger value="messages">Messages</TabsTrigger>
                </TabsList>

                <TabsContent value="config" className="space-y-4">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="whatsappBusinessAccountId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Business Account ID</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Your WhatsApp Business Account ID" />
                            </FormControl>
                            <FormDescription>
                              Found in your Meta Business Manager under WhatsApp Business Account
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="whatsappPhoneNumberId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number ID</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Your WhatsApp Phone Number ID" />
                            </FormControl>
                            <FormDescription>
                              The ID of your registered WhatsApp Business phone number
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="whatsappAccessToken"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Access Token</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" placeholder="Your WhatsApp Business API Access Token" />
                            </FormControl>
                            <FormDescription>
                              Permanent access token from your Meta App
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="whatsappWebhookVerifyToken"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Webhook Verify Token</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Custom verification token" />
                            </FormControl>
                            <FormDescription>
                              A custom string to verify webhook requests (create your own)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="whatsappNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>WhatsApp Phone Number</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="+1234567890" />
                            </FormControl>
                            <FormDescription>
                              Your registered WhatsApp Business phone number (with country code)
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex space-x-3">
                        <Button
                          type="submit"
                          disabled={updateConfigMutation.isPending}
                          className="flex-1"
                        >
                          {updateConfigMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Save Configuration
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleTestConnection}
                          disabled={testConnectionMutation.isPending || !isConfigured}
                        >
                          {testConnectionMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Test Connection
                        </Button>
                      </div>
                    </form>
                  </Form>

                  {testResult && (
                    <Alert variant={testResult.success ? "default" : "destructive"}>
                      {testResult.success ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                      <AlertDescription>{testResult.message}</AlertDescription>
                    </Alert>
                  )}
                </TabsContent>

                <TabsContent value="webhook" className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <Label>Webhook URL</Label>
                      <div className="flex space-x-2 mt-1">
                        <Input value={webhookUrl} readOnly className="flex-1" />
                        <Button
                          variant="outline"
                          onClick={() => navigator.clipboard.writeText(webhookUrl)}
                        >
                          Copy
                        </Button>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Configure this URL in your Meta App webhook settings
                      </p>
                    </div>

                    <div>
                      <Label>Verify Token</Label>
                      <Input
                        value={form.getValues("whatsappWebhookVerifyToken") || ""}
                        readOnly
                        className="mt-1"
                      />
                      <p className="text-sm text-gray-600 mt-1">
                        Use this token when setting up the webhook in Meta
                      </p>
                    </div>

                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Setup Instructions:</strong>
                        <ol className="list-decimal list-inside mt-2 space-y-1">
                          <li>Go to your Meta App &gt; WhatsApp &gt; Configuration</li>
                          <li>Add the webhook URL above</li>
                          <li>Enter the verify token</li>
                          <li>Subscribe to 'messages' webhook field</li>
                          <li>Save and verify the webhook</li>
                        </ol>
                      </AlertDescription>
                    </Alert>
                  </div>
                </TabsContent>

                <TabsContent value="messages" className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Message History</h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/agents", selectedAgent, "whatsapp-messages"] })}
                      >
                        Refresh
                      </Button>
                    </div>

                    {messagesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin" />
                      </div>
                    ) : (messages as any[]).length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No WhatsApp messages yet. Send a test message to see it here.
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {(messages as any[]).map((message: any) => (
                          <div
                            key={message.id}
                            className={`p-3 rounded-lg ${
                              message.direction === 'inbound'
                                ? 'bg-gray-100 ml-8'
                                : 'bg-blue-100 mr-8'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                              <span>
                                {message.direction === 'inbound' ? 'From' : 'To'}: {
                                  message.direction === 'inbound' 
                                    ? message.fromPhoneNumber 
                                    : message.toPhoneNumber
                                }
                              </span>
                              <span>{new Date(message.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="text-sm">{message.content}</p>
                            <div className="flex items-center justify-between mt-2">
                              <Badge variant="outline" className="text-xs">
                                {message.messageType}
                              </Badge>
                              {message.status && (
                                <Badge variant="secondary" className="text-xs">
                                  {message.status}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}