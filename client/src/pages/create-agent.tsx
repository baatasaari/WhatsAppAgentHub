import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Rocket, Plus, Phone, MessageCircle, Bot, Send, Globe, Smartphone } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

// Platform definitions with configuration options
const platformTypes = [
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    icon: MessageCircle,
    color: '#25D366',
    description: 'Connect through WhatsApp Business for direct messaging',
    defaultMessage: 'Hi! How can I help you today?',
    fields: ['whatsappNumber', 'whatsappMode']
  },
  {
    id: 'chatbot',
    name: 'Website Chatbot',
    icon: Bot,
    color: '#2563eb',
    description: 'Embedded chat widget for your website',
    defaultMessage: 'Hello! I\'m here to assist you.',
    fields: ['widgetPosition', 'widgetColor']
  },
  {
    id: 'telegram',
    name: 'Telegram Bot',
    icon: Send,
    color: '#0088cc',
    description: 'Automated bot for Telegram messaging',
    defaultMessage: 'Welcome to our Telegram support bot!',
    fields: ['telegramBotToken', 'telegramUsername']
  },
  {
    id: 'webchat',
    name: 'Live Web Chat',
    icon: Globe,
    color: '#10b981',
    description: 'Real-time chat support on your website',
    defaultMessage: 'Hi there! Need help with anything?',
    fields: ['chatTheme', 'operatingHours']
  },
  {
    id: 'sms',
    name: 'SMS Support',
    icon: Smartphone,
    color: '#7c3aed',
    description: 'Text message based customer support',
    defaultMessage: 'Thanks for texting us! How can we help?',
    fields: ['smsNumber', 'smsProvider']
  },
  {
    id: 'voice',
    name: 'Voice Assistant',
    icon: Phone,
    color: '#dc2626',
    description: 'AI-powered phone support system',
    defaultMessage: 'Hello, thanks for calling!',
    fields: ['voiceProvider', 'voiceModel', 'callScript']
  }
];

const createAgentSchema = z.object({
  name: z.string().min(1, "Agent name is required"),
  businessCategory: z.string().optional(),
  llmProvider: z.string().min(1, "LLM provider is required"),
  systemPrompt: z.string().min(10, "System prompt must be at least 10 characters"),
  selectedPlatforms: z.array(z.string()).min(1, "Select at least one platform"),
  leadQualificationQuestions: z.array(z.string()).default([]),
  
  // Platform-specific fields
  voiceProvider: z.string().default("elevenlabs"),
  voiceModel: z.string().default("professional-male"),
  callScript: z.string().optional(),
  widgetPosition: z.string().default("bottom-right"),
  widgetColor: z.string().default("#25D366"),
  welcomeMessage: z.string().default("Hi! How can I help you today?"),
  whatsappNumber: z.string().optional(),
  whatsappMode: z.string().default("web"),
  telegramBotToken: z.string().optional(),
  telegramUsername: z.string().optional(),
  chatTheme: z.string().default("modern"),
  operatingHours: z.string().default("24/7"),
  smsNumber: z.string().optional(),
  smsProvider: z.string().default("twilio"),
  status: z.string().default("active"),
});

type CreateAgentForm = z.infer<typeof createAgentSchema>;

export default function CreateAgent() {
  const [, setLocation] = useLocation();
  const [selectedLLM, setSelectedLLM] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [qualificationQuestions, setQualificationQuestions] = useState<string[]>([]);
  const [isCreatingMultiple, setIsCreatingMultiple] = useState(false);
  const { toast } = useToast();

  // Fetch available LLM models from configuration
  const { data: availableModels, isLoading: modelsLoading } = useQuery({
    queryKey: ["/api/models"],
  });

  // Fetch industry verticals from configuration
  const { data: industryVerticals, isLoading: industriesLoading } = useQuery({
    queryKey: ["/api/industry-verticals"],
  });

  const form = useForm<CreateAgentForm>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: {
      name: "",
      businessCategory: "",
      llmProvider: "",
      systemPrompt: "",
      selectedPlatforms: [],
      leadQualificationQuestions: [],
      voiceProvider: "elevenlabs",
      voiceModel: "professional-male",
      callScript: "",
      widgetPosition: "bottom-right",
      widgetColor: "#25D366",
      welcomeMessage: "Hi! How can I help you today?",
      whatsappNumber: "",
      whatsappMode: "web",
      telegramBotToken: "",
      telegramUsername: "",
      chatTheme: "modern",
      operatingHours: "24/7",
      smsNumber: "",
      smsProvider: "twilio",
      status: "active",
    },
  });

  const createAgentMutation = useMutation({
    mutationFn: async (data: CreateAgentForm) => {
      setIsCreatingMultiple(true);
      
      if (data.selectedPlatforms.length === 1) {
        // Single platform creation
        return await apiRequest("POST", "/api/agents", {
          ...data,
          platformType: data.selectedPlatforms[0],
        });
      } else {
        // Multi-platform creation - create separate agents for each platform
        const createdAgents = [];
        for (const platform of data.selectedPlatforms) {
          const platformData = {
            ...data,
            name: `${data.name} - ${platformTypes.find(p => p.id === platform)?.name}`,
            platformType: platform,
            welcomeMessage: platformTypes.find(p => p.id === platform)?.defaultMessage || data.welcomeMessage,
            widgetColor: platformTypes.find(p => p.id === platform)?.color || data.widgetColor,
          };
          
          const agent = await apiRequest("POST", "/api/agents", platformData);
          createdAgents.push(agent);
        }
        return createdAgents;
      }
    },
    onSuccess: (result: any) => {
      setIsCreatingMultiple(false);
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      
      const isMultiple = Array.isArray(result);
      const agentCount = isMultiple ? result.length : 1;
      
      toast({ 
        title: `${agentCount} agent${agentCount > 1 ? 's' : ''} created successfully!`,
        description: isMultiple ? "Multiple platform widgets are ready." : "Your embed code is ready."
      });
      
      // Redirect to appropriate page
      if (isMultiple) {
        setLocation("/agents");
      } else {
        setLocation(`/embed-code?agentId=${result.id}`);
      }
    },
    onError: (error: any) => {
      setIsCreatingMultiple(false);
      toast({
        title: "Failed to create agent(s)",
        description: error.message || "Please check your configuration and try again.",
        variant: "destructive",
      });
    },
  });

  const addQualificationQuestion = () => {
    setQualificationQuestions([...qualificationQuestions, ""]);
  };

  const updateQualificationQuestion = (index: number, value: string) => {
    const updated = [...qualificationQuestions];
    updated[index] = value;
    setQualificationQuestions(updated);
    form.setValue("leadQualificationQuestions", updated.filter(q => q.trim()));
  };

  const removeQualificationQuestion = (index: number) => {
    const updated = qualificationQuestions.filter((_, i) => i !== index);
    setQualificationQuestions(updated);
    form.setValue("leadQualificationQuestions", updated.filter(q => q.trim()));
  };

  const onSubmit = (data: CreateAgentForm) => {
    console.log('Form submission data:', data);
    console.log('Form errors:', form.formState.errors);
    const filteredQuestions = qualificationQuestions.filter(q => q.trim());
    createAgentMutation.mutate({
      ...data,
      leadQualificationQuestions: filteredQuestions,
    });
  };

  const saveDraft = () => {
    const data = form.getValues();
    createAgentMutation.mutate({
      ...data,
      status: "draft",
      leadQualificationQuestions: qualificationQuestions.filter(q => q.trim()),
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Create New Agent</h3>
          <p className="text-gray-600 mt-1">Configure your WhatsApp agent to start converting visitors into leads</p>
        </div>
        
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., E-commerce Support Agent" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="businessCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Category</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange} disabled={industriesLoading}>
                          <SelectTrigger>
                            <SelectValue placeholder={industriesLoading ? "Loading categories..." : "Select category"} />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.isArray(industryVerticals) ? industryVerticals.map((industry: any) => (
                              <SelectItem key={industry.name} value={industry.name}>
                                {industry.name}
                              </SelectItem>
                            )) : null}
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {/* LLM Configuration */}
              <FormField
                control={form.control}
                name="llmProvider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Choose LLM Provider *</FormLabel>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {modelsLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="animate-pulse bg-gray-200 rounded-lg h-24"></div>
                        ))
                      ) : (
                        Array.isArray(availableModels) ? availableModels.map((llm: any) => (
                          <div
                            key={llm.id}
                            className={`llm-option ${field.value === llm.id ? 'selected' : ''}`}
                            onClick={() => {
                              field.onChange(llm.id);
                              setSelectedLLM(llm.id);
                            }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-gray-900">{llm.name}</h4>
                              <input
                                type="radio"
                                checked={field.value === llm.id}
                                onChange={() => {}}
                                className="text-primary"
                              />
                            </div>
                            <p className="text-sm text-gray-600">{llm.description}</p>
                            <p className={`text-xs mt-2 ${llm.badge_color}`}>{llm.badge}</p>
                          </div>
                        )) : []
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* System Prompt */}
              <FormField
                control={form.control}
                name="systemPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>System Prompt *</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={6}
                        placeholder="Define your agent's personality, knowledge, and conversation flow. Example: 'You are a helpful e-commerce assistant that helps customers find products and convert them into sales...'"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-sm text-gray-500">
                      This prompt defines how your agent will behave and respond to user queries.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Lead Qualification */}
              <div>
                <FormLabel>Lead Qualification Questions</FormLabel>
                <div className="space-y-3 mt-2">
                  {qualificationQuestions.map((question, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={question}
                        onChange={(e) => updateQualificationQuestion(index, e.target.value)}
                        placeholder="Enter qualification question..."
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeQualificationQuestion(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addQualificationQuestion}
                    className="text-primary"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Question
                  </Button>
                </div>
              </div>
              
              {/* WhatsApp Business Settings */}
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <MessageCircle className="w-4 h-4 text-green-600 mr-2" />
                    WhatsApp Business Integration
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="whatsappNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>WhatsApp Business Number</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="+1234567890"
                              {...field}
                            />
                          </FormControl>
                          <p className="text-sm text-gray-500">
                            Include country code (e.g., +1 for US)
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="whatsappMode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Integration Mode</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="whatsapp">WhatsApp Only</SelectItem>
                                <SelectItem value="web">Web Chat Only</SelectItem>
                                <SelectItem value="hybrid">Hybrid (Both)</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <p className="text-sm text-gray-500">
                            Choose how visitors interact with your agent
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* AI Voice Settings */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <Phone className="w-4 h-4 text-blue-600 mr-2" />
                    AI Call Follow-up Settings
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="voiceProvider"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Voice Provider</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                                <SelectItem value="openai">OpenAI TTS</SelectItem>
                                <SelectItem value="azure">Azure Speech</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="voiceModel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Voice Model</FormLabel>
                          <FormControl>
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="professional-male">Professional Male</SelectItem>
                                <SelectItem value="professional-female">Professional Female</SelectItem>
                                <SelectItem value="friendly-male">Friendly Male</SelectItem>
                                <SelectItem value="friendly-female">Friendly Female</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="callScript"
                    render={({ field }) => (
                      <FormItem className="mt-4">
                        <FormLabel>Call Script Template</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={3}
                            placeholder="Hi [Name], I'm calling from [Company] regarding your recent inquiry about [Product/Service]..."
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
              
              {/* Widget Appearance */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">Widget Appearance</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="widgetPosition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Widget Position</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
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
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="widgetColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Color</FormLabel>
                        <FormControl>
                          <div className="flex items-center space-x-3">
                            <input
                              type="color"
                              value={field.value}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="w-12 h-10 border border-gray-300 rounded"
                            />
                            <Input
                              value={field.value}
                              onChange={(e) => field.onChange(e.target.value)}
                              className="flex-1"
                            />
                          </div>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              <FormField
                control={form.control}
                name="welcomeMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Welcome Message</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Hi! How can I help you today?"
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={saveDraft}
                  disabled={createAgentMutation.isPending}
                >
                  Save as Draft
                </Button>
                <div className="flex items-center space-x-3">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={createAgentMutation.isPending}
                    onClick={() => setLocation('/preview')}
                  >
                    Preview Widget
                  </Button>
                  <Button
                    type="submit"
                    disabled={createAgentMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Rocket className="w-4 h-4 mr-2" />
                    Create & Deploy Agent
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
