import { useState, useCallback } from "react";
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
    id: 'whatsapp-business-api',
    name: 'WhatsApp Business API',
    icon: MessageCircle,
    color: '#25D366',
    description: 'Official WhatsApp Business API for automated conversations',
    defaultMessage: 'Hi! How can I help you today?',
    fields: ['whatsappNumber', 'whatsappApiKey', 'whatsappWebhook']
  },
  {
    id: 'facebook-messenger',
    name: 'Facebook Messenger',
    icon: MessageCircle,
    color: '#1877F2',
    description: 'Facebook Messenger bot for customer engagement',
    defaultMessage: 'Hello! Welcome to our Messenger support.',
    fields: ['facebookPageId', 'facebookAccessToken', 'facebookWebhook']
  },
  {
    id: 'instagram-direct',
    name: 'Instagram Direct Messages',
    icon: MessageCircle,
    color: '#E4405F',
    description: 'Instagram Direct Messages automation for business',
    defaultMessage: 'Thanks for reaching out on Instagram!',
    fields: ['instagramBusinessId', 'instagramAccessToken']
  },
  {
    id: 'line-messaging',
    name: 'LINE Messaging API',
    icon: MessageCircle,
    color: '#00B900',
    description: 'LINE messaging platform integration',
    defaultMessage: 'Hello! How can we assist you today?',
    fields: ['lineChannelId', 'lineChannelSecret', 'lineChannelToken']
  },
  {
    id: 'wechat-work',
    name: 'WeChat Work',
    icon: MessageCircle,
    color: '#07C160',
    description: 'WeChat Work integration for business communication',
    defaultMessage: 'Welcome to our WeChat support!',
    fields: ['wechatCorpId', 'wechatSecret', 'wechatAgentId']
  },
  {
    id: 'telegram-bot',
    name: 'Telegram Bot',
    icon: Send,
    color: '#0088cc',
    description: 'Automated Telegram bot for customer support',
    defaultMessage: 'Hello! How can I assist you today?',
    fields: ['telegramBotToken', 'telegramUsername']
  },
  {
    id: 'viber-business',
    name: 'Viber Business Messages',
    icon: MessageCircle,
    color: '#665CAC',
    description: 'Viber Business Messages integration',
    defaultMessage: 'Hi! Thanks for contacting us on Viber.',
    fields: ['viberBotId', 'viberApiKey', 'viberWebhook']
  },
  {
    id: 'discord-bot',
    name: 'Discord Bot',
    icon: MessageCircle,
    color: '#5865F2',
    description: 'Discord server bot for community support',
    defaultMessage: 'Hello! How can I help you in Discord?',
    fields: ['discordBotToken', 'discordGuildId', 'discordChannelId']
  }
];

const createAgentSchema = z.object({
  name: z.string().min(1, "Agent name is required"),
  businessCategory: z.string().optional(),
  llmProvider: z.string().min(1, "LLM provider is required"),
  systemPrompt: z.string().min(10, "System prompt must be at least 10 characters"),
  selectedPlatforms: z.array(z.string()).min(1, "Select at least one platform"),
  leadQualificationQuestions: z.array(z.string()).default([]),
  
  // Widget and general settings
  widgetPosition: z.string().default("bottom-right"),
  widgetColor: z.string().default("#25D366"),
  welcomeMessage: z.string().default("Hi! How can I help you today?"),
  status: z.string().default("active"),
  
  // WhatsApp Business API
  whatsappNumber: z.string().optional(),
  whatsappApiKey: z.string().optional(),
  whatsappWebhook: z.string().optional(),
  whatsappMode: z.string().default("api"),
  
  // Facebook Messenger
  facebookPageId: z.string().optional(),
  facebookAccessToken: z.string().optional(),
  facebookWebhook: z.string().optional(),
  
  // Instagram Direct
  instagramBusinessId: z.string().optional(),
  instagramAccessToken: z.string().optional(),
  
  // LINE Messaging
  lineChannelId: z.string().optional(),
  lineChannelSecret: z.string().optional(),
  lineChannelToken: z.string().optional(),
  
  // WeChat Work
  wechatCorpId: z.string().optional(),
  wechatSecret: z.string().optional(),
  wechatAgentId: z.string().optional(),
  
  // Telegram Bot
  telegramBotToken: z.string().optional(),
  telegramUsername: z.string().optional(),
  
  // Viber Business
  viberBotId: z.string().optional(),
  viberApiKey: z.string().optional(),
  viberWebhook: z.string().optional(),
  
  // Discord Bot
  discordBotToken: z.string().optional(),
  discordGuildId: z.string().optional(),
  discordChannelId: z.string().optional(),
  
  // Voice calling settings
  voiceProvider: z.string().optional(),
  voiceModel: z.string().optional(),
  callScript: z.string().optional(),
});

type CreateAgentForm = z.infer<typeof createAgentSchema>;

export default function CreateAgent() {
  const [, setLocation] = useLocation();
  const [selectedLLM, setSelectedLLM] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [qualificationQuestions, setQualificationQuestions] = useState<string[]>([]);
  const [isCreatingMultiple, setIsCreatingMultiple] = useState(false);
  const { toast } = useToast();

  // Optimized platform selection handler to prevent infinite loops
  const handlePlatformToggle = useCallback((platformId: string, currentPlatforms: string[]) => {
    const updated = currentPlatforms.includes(platformId)
      ? currentPlatforms.filter(id => id !== platformId)
      : [...currentPlatforms, platformId];
    setSelectedPlatforms(updated);
    return updated;
  }, []);

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
      widgetPosition: "bottom-right",
      widgetColor: "#25D366",
      welcomeMessage: "Hi! How can I help you today?",
      status: "active",
      // WhatsApp Business API
      whatsappNumber: "",
      whatsappApiKey: "",
      whatsappWebhook: "",
      whatsappMode: "api",
      // Facebook Messenger
      facebookPageId: "",
      facebookAccessToken: "",
      facebookWebhook: "",
      // Instagram Direct
      instagramBusinessId: "",
      instagramAccessToken: "",
      // LINE Messaging
      lineChannelId: "",
      lineChannelSecret: "",
      lineChannelToken: "",
      // WeChat Work
      wechatCorpId: "",
      wechatSecret: "",
      wechatAgentId: "",
      // Telegram Bot
      telegramBotToken: "",
      telegramUsername: "",
      // Viber Business
      viberBotId: "",
      viberApiKey: "",
      viberWebhook: "",
      // Discord Bot
      discordBotToken: "",
      discordGuildId: "",
      discordChannelId: "",
      // Voice calling settings
      voiceProvider: "",
      voiceModel: "",
      callScript: "",
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
          <p className="text-gray-600 mt-1">Configure multi-platform agents for WhatsApp, chatbots, Telegram, and more</p>
          {isCreatingMultiple && (
            <div className="mt-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                Creating multiple agents...
              </Badge>
            </div>
          )}
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
              
              {/* Platform Selection */}
              <FormField
                control={form.control}
                name="selectedPlatforms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Select Platforms *</FormLabel>
                    <div className="text-sm text-gray-600 mb-4">
                      Choose one or more platforms to create agents for. Selecting multiple platforms will create separate agents for each.
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {platformTypes.map((platform) => {
                        const IconComponent = platform.icon;
                        const isSelected = field.value?.includes(platform.id);
                        
                        return (
                          <div
                            key={platform.id}
                            className={`relative cursor-pointer rounded-lg border-2 p-4 transition-all hover:shadow-md ${
                              isSelected 
                                ? 'border-blue-500 bg-blue-50 shadow-sm' 
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={(e) => {
                              // Prevent double triggering from checkbox click
                              const target = e.target as HTMLElement;
                              if (target === e.currentTarget || !target.closest('[role="checkbox"]')) {
                                const current = field.value || [];
                                const updated = handlePlatformToggle(platform.id, current);
                                field.onChange(updated);
                              }
                            }}
                          >
                            <div className="flex items-start space-x-3">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => {
                                  const current = field.value || [];
                                  const updated = checked
                                    ? [...current, platform.id]
                                    : current.filter(id => id !== platform.id);
                                  field.onChange(updated);
                                  setSelectedPlatforms(updated);
                                }}
                                className="mt-1"
                              />
                              <div className="flex-1">
                                <div className="flex items-center space-x-2 mb-2">
                                  <IconComponent 
                                    className="w-5 h-5" 
                                    style={{ color: platform.color }}
                                  />
                                  <h4 className="font-medium text-gray-900">
                                    {platform.name}
                                  </h4>
                                </div>
                                <p className="text-sm text-gray-600">
                                  {platform.description}
                                </p>
                                <div className="mt-2">
                                  <Badge 
                                    variant="outline" 
                                    className="text-xs"
                                    style={{ 
                                      borderColor: platform.color + '40',
                                      color: platform.color 
                                    }}
                                  >
                                    {platform.defaultMessage}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {field.value && field.value.length > 1 && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <Rocket className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-900">
                            Bulk Creation Enabled
                          </span>
                        </div>
                        <p className="text-sm text-blue-700 mt-1">
                          Will create {field.value.length} separate agents, one for each selected platform
                        </p>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              
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
                    disabled={createAgentMutation.isPending || isCreatingMultiple}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Rocket className="w-4 h-4 mr-2" />
                    {isCreatingMultiple ? "Creating Agents..." : 
                     selectedPlatforms.length > 1 ? `Create ${selectedPlatforms.length} Agents` : 
                     "Create & Deploy Agent"}
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
