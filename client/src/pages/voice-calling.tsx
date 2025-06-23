import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, PhoneCall, Clock, TrendingUp, Users, DollarSign, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default function VoiceCalling() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState<string>("");

  const { data: agents = [] } = useQuery({
    queryKey: ['/api/agents'],
  });

  const { data: voiceCalls = [] } = useQuery({
    queryKey: ['/api/voice-calls'],
    enabled: !!selectedAgent,
  });

  const { data: callAnalytics = [] } = useQuery({
    queryKey: ['/api/voice-calls/analytics', selectedAgent],
    enabled: !!selectedAgent,
  });

  const { data: trigger } = useQuery({
    queryKey: ['/api/voice-calls/trigger', selectedAgent],
    enabled: !!selectedAgent,
  });

  const triggerMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest(`/api/voice-calls/trigger/${selectedAgent}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Voice Call Settings Updated",
        description: "Your AI voice calling configuration has been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/voice-calls/trigger', selectedAgent] });
    },
  });

  const manualCallMutation = useMutation({
    mutationFn: async (data: { phoneNumber: string; reason: string }) => {
      return await apiRequest(`/api/voice-calls/manual`, {
        method: 'POST',
        body: JSON.stringify({
          agentId: selectedAgent,
          phoneNumber: data.phoneNumber,
          triggerReason: data.reason,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Manual Call Initiated",
        description: "The AI voice call has been started.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/voice-calls'] });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: { variant: "secondary" as const, icon: Clock },
      calling: { variant: "default" as const, icon: PhoneCall },
      completed: { variant: "default" as const, icon: CheckCircle },
      failed: { variant: "destructive" as const, icon: XCircle },
      no_answer: { variant: "outline" as const, icon: AlertCircle },
    };
    
    const config = variants[status as keyof typeof variants] || variants.pending;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getOutcomeBadge = (outcome: string) => {
    const colors = {
      conversion: "bg-green-100 text-green-800",
      callback_scheduled: "bg-blue-100 text-blue-800",
      not_interested: "bg-red-100 text-red-800",
      no_answer: "bg-gray-100 text-gray-800",
    };
    
    return (
      <Badge className={colors[outcome as keyof typeof colors] || "bg-gray-100 text-gray-800"}>
        {outcome?.replace('_', ' ').toUpperCase() || 'PENDING'}
      </Badge>
    );
  };

  const handleTriggerUpdate = (field: string, value: any) => {
    const updatedTrigger = { ...trigger, [field]: value };
    triggerMutation.mutate(updatedTrigger);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <Phone className="w-8 h-8 text-blue-600 mr-3" />
            <h1 className="text-3xl font-bold text-gray-900">AI Voice Calling</h1>
          </div>
          <p className="text-lg text-gray-600">
            Automatically call potential customers when they don't convert through your WhatsApp widget
          </p>
        </div>

        {/* Agent Selection */}
        <div className="mb-6">
          <Label htmlFor="agent-select">Select Agent</Label>
          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Choose an agent to configure voice calling" />
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

        {selectedAgent && (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="settings">Call Settings</TabsTrigger>
              <TabsTrigger value="calls">Call History</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
                    <PhoneCall className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{callAnalytics.totalCalls || 0}</div>
                    <p className="text-xs text-muted-foreground">This month</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {callAnalytics.totalCalls > 0 
                        ? Math.round((callAnalytics.successfulConnections / callAnalytics.totalCalls) * 100)
                        : 0}%
                    </div>
                    <p className="text-xs text-muted-foreground">Connection rate</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Conversions</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{callAnalytics.conversions || 0}</div>
                    <p className="text-xs text-muted-foreground">From voice calls</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${((callAnalytics.totalCost || 0) / 100).toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground">This month</p>
                  </CardContent>
                </Card>
              </div>

              {/* Manual Call Trigger */}
              <Card>
                <CardHeader>
                  <CardTitle>Manual Call</CardTitle>
                  <CardDescription>
                    Initiate an immediate AI voice call to a specific phone number
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input 
                        id="phone" 
                        placeholder="+1 (555) 123-4567"
                        onChange={(e) => setPhoneNumber(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="reason">Call Reason</Label>
                      <Select onValueChange={(value) => setCallReason(value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cart_abandonment">Cart Abandonment</SelectItem>
                          <SelectItem value="form_incomplete">Incomplete Form</SelectItem>
                          <SelectItem value="high_value_lead">High Value Lead</SelectItem>
                          <SelectItem value="manual_follow_up">Manual Follow-up</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button 
                    onClick={() => manualCallMutation.mutate({ phoneNumber, reason: callReason })}
                    disabled={!phoneNumber || !callReason || manualCallMutation.isPending}
                  >
                    {manualCallMutation.isPending ? "Initiating Call..." : "Start AI Call"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Voice Call Trigger Settings</CardTitle>
                  <CardDescription>
                    Configure when and how AI voice calls are automatically triggered
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Enable/Disable */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable AI Voice Calling</Label>
                      <p className="text-sm text-gray-600">Automatically call leads when they don't convert</p>
                    </div>
                    <Switch 
                      checked={trigger?.enabled || false}
                      onCheckedChange={(enabled) => handleTriggerUpdate('enabled', enabled)}
                    />
                  </div>

                  {trigger?.enabled && (
                    <>
                      {/* Timing Settings */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Delay (minutes)</Label>
                          <Input 
                            type="number"
                            value={trigger.delayMinutes || 15}
                            onChange={(e) => handleTriggerUpdate('delayMinutes', parseInt(e.target.value))}
                          />
                          <p className="text-xs text-gray-600">Wait time after failed conversion</p>
                        </div>
                        <div>
                          <Label>Max Attempts per Lead</Label>
                          <Input 
                            type="number"
                            value={trigger.maxAttemptsPerLead || 2}
                            onChange={(e) => handleTriggerUpdate('maxAttemptsPerLead', parseInt(e.target.value))}
                          />
                        </div>
                      </div>

                      {/* Requirements */}
                      <div className="space-y-4">
                        <h4 className="font-medium">Lead Requirements</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center space-x-2">
                            <Switch 
                              checked={trigger.requirePhoneCapture || false}
                              onCheckedChange={(checked) => handleTriggerUpdate('requirePhoneCapture', checked)}
                            />
                            <Label>Require Phone Number</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch 
                              checked={trigger.requireEmailCapture || false}
                              onCheckedChange={(checked) => handleTriggerUpdate('requireEmailCapture', checked)}
                            />
                            <Label>Require Email Address</Label>
                          </div>
                        </div>
                        <div>
                          <Label>Minimum Engagement Score</Label>
                          <Input 
                            type="number"
                            min="0"
                            max="100"
                            value={trigger.minEngagementScore || 50}
                            onChange={(e) => handleTriggerUpdate('minEngagementScore', parseInt(e.target.value))}
                          />
                          <p className="text-xs text-gray-600">Score based on conversation length and interaction quality</p>
                        </div>
                      </div>

                      {/* Voice Configuration */}
                      <div className="space-y-4">
                        <h4 className="font-medium">Voice Configuration</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Voice Persona</Label>
                            <Select 
                              value={trigger.voicePersona || 'professional'}
                              onValueChange={(value) => handleTriggerUpdate('voicePersona', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="professional">Professional</SelectItem>
                                <SelectItem value="friendly">Friendly</SelectItem>
                                <SelectItem value="sales">Sales-focused</SelectItem>
                                <SelectItem value="empathetic">Empathetic</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Call Objective</Label>
                            <Select 
                              value={trigger.callObjective || 'answer_questions'}
                              onValueChange={(value) => handleTriggerUpdate('callObjective', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="answer_questions">Answer Questions</SelectItem>
                                <SelectItem value="schedule_demo">Schedule Demo</SelectItem>
                                <SelectItem value="close_sale">Close Sale</SelectItem>
                                <SelectItem value="gather_requirements">Gather Requirements</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Call History Tab */}
            <TabsContent value="calls" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Voice Calls</CardTitle>
                  <CardDescription>History of AI voice calls for this agent</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {voiceCalls.length === 0 ? (
                      <p className="text-center text-gray-500 py-8">No voice calls yet</p>
                    ) : (
                      voiceCalls.map((call: any) => (
                        <div key={call.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Phone className="w-5 h-5 text-blue-600" />
                              <div>
                                <p className="font-medium">{call.phoneNumber}</p>
                                <p className="text-sm text-gray-600">
                                  {new Date(call.createdAt).toLocaleDateString()} at{' '}
                                  {new Date(call.createdAt).toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {getStatusBadge(call.status)}
                              {call.callOutcome && getOutcomeBadge(call.callOutcome)}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600">Trigger Reason</p>
                              <p className="font-medium">{call.triggerReason?.replace('_', ' ')}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Duration</p>
                              <p className="font-medium">
                                {call.callDuration ? `${Math.floor(call.callDuration / 60)}:${(call.callDuration % 60).toString().padStart(2, '0')}` : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-600">Lead Score</p>
                              <p className="font-medium">{call.leadScore || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-gray-600">Sentiment</p>
                              <p className="font-medium">{call.sentiment || 'N/A'}</p>
                            </div>
                          </div>
                          
                          {call.transcript && (
                            <div>
                              <p className="text-gray-600 text-sm mb-2">Transcript:</p>
                              <div className="bg-gray-50 rounded p-3 text-sm max-h-32 overflow-y-auto">
                                {call.transcript}
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Call Performance</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span>Average Call Duration</span>
                      <span className="font-medium">
                        {callAnalytics.avgCallDuration 
                          ? `${Math.floor(callAnalytics.avgCallDuration / 60)}:${(callAnalytics.avgCallDuration % 60).toString().padStart(2, '0')}`
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Average Lead Score</span>
                      <span className="font-medium">{callAnalytics.avgLeadScore || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Conversion Rate</span>
                      <span className="font-medium">
                        {callAnalytics.totalCalls > 0 
                          ? `${Math.round((callAnalytics.conversions / callAnalytics.totalCalls) * 100)}%`
                          : '0%'}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Cost Analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span>Cost per Call</span>
                      <span className="font-medium">${((callAnalytics.costPerCall || 0) / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cost per Conversion</span>
                      <span className="font-medium">${((callAnalytics.costPerConversion || 0) / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Monthly Cost</span>
                      <span className="font-medium">${((callAnalytics.totalCost || 0) / 100).toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

// Helper state for manual calls
function setPhoneNumber(value: string) {
  // Implementation will be added with React state
}

function setCallReason(value: string) {
  // Implementation will be added with React state
}