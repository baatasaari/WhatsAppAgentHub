import { useState, useEffect, useCallback } from "react";
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
import { Progress } from "@/components/ui/progress";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  MessageCircle, 
  Bot, 
  Send, 
  Settings, 
  Wand2,
  Globe,
  Smartphone,
  Phone,
  ArrowRight,
  Shield,
  Zap,
  Brain,
  BookOpen,
  Target,
  Lightbulb,
  Plus,
  Trash2
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

// Platform definitions
const platformTypes = [
  {
    id: 'whatsapp-business-api',
    name: 'WhatsApp Business API',
    icon: MessageCircle,
    color: '#25D366',
    description: 'Official WhatsApp Business API for automated conversations',
    setupComplexity: 'Medium',
    estimatedTime: '10-15 minutes',
    requirements: ['Business phone number', 'Meta Business Account', 'Webhook URL'],
    fields: ['whatsappNumber', 'whatsappApiKey', 'whatsappWebhook']
  },
  {
    id: 'facebook-messenger',
    name: 'Facebook Messenger',
    icon: MessageCircle,
    color: '#1877F2',
    description: 'Facebook Messenger bot for customer engagement',
    setupComplexity: 'Medium',
    estimatedTime: '15-20 minutes',
    requirements: ['Facebook Page', 'Meta App', 'Page Access Token'],
    fields: ['facebookPageId', 'facebookAccessToken', 'facebookWebhook']
  },
  {
    id: 'instagram-direct',
    name: 'Instagram Direct Messages',
    icon: MessageCircle,
    color: '#E4405F',
    description: 'Instagram Direct Messages automation for business',
    setupComplexity: 'Medium',
    estimatedTime: '10-15 minutes',
    requirements: ['Instagram Business Account', 'Meta Business Account'],
    fields: ['instagramBusinessId', 'instagramAccessToken']
  },
  {
    id: 'line-messaging',
    name: 'LINE Messaging API',
    icon: MessageCircle,
    color: '#00B900',
    description: 'LINE messaging platform integration',
    setupComplexity: 'Easy',
    estimatedTime: '5-10 minutes',
    requirements: ['LINE Developer Account', 'Channel ID', 'Channel Secret'],
    fields: ['lineChannelId', 'lineChannelSecret', 'lineChannelToken']
  },
  {
    id: 'telegram-bot',
    name: 'Telegram Bot',
    icon: Send,
    color: '#0088cc',
    description: 'Automated Telegram bot for customer support',
    setupComplexity: 'Easy',
    estimatedTime: '5 minutes',
    requirements: ['Telegram Bot Token from @BotFather'],
    fields: ['telegramBotToken', 'telegramUsername']
  },
  {
    id: 'discord-bot',
    name: 'Discord Bot',
    icon: MessageCircle,
    color: '#5865F2',
    description: 'Discord server bot for community support',
    setupComplexity: 'Easy',
    estimatedTime: '5-10 minutes',
    requirements: ['Discord Application', 'Bot Token', 'Server Permissions'],
    fields: ['discordBotToken', 'discordGuildId', 'discordChannelId']
  }
];

const wizardSchema = z.object({
  // Step 1: Basic Info
  name: z.string().min(1, "Agent name is required"),
  businessCategory: z.string().optional(),
  description: z.string().optional(),
  
  // Step 2: Platform Selection (handled by local state, not form)
  // selectedPlatforms: z.array(z.string()).min(1, "Select at least one platform"),
  
  // Step 3: AI Configuration
  llmProvider: z.string().min(1, "LLM provider is required"),
  systemPrompt: z.string().min(10, "System prompt must be at least 10 characters"),
  
  // Step 4: Platform Configuration (conditional fields)
  // WhatsApp Business API
  whatsappNumber: z.string().optional(),
  whatsappApiKey: z.string().optional(),
  whatsappWebhook: z.string().optional(),
  
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
  
  // Telegram Bot
  telegramBotToken: z.string().optional(),
  telegramUsername: z.string().optional(),
  
  // Discord Bot
  discordBotToken: z.string().optional(),
  discordGuildId: z.string().optional(),
  discordChannelId: z.string().optional(),
  
  // Step 5: Customization
  widgetColor: z.string().default("#25D366"),
  welcomeMessage: z.string().default("Hi! How can I help you today?"),
  operatingHours: z.string().default("24/7"),
});

type WizardFormData = z.infer<typeof wizardSchema>;

const steps = [
  { id: 1, title: "Basic Information", icon: Settings },
  { id: 2, title: "Select Platforms", icon: Globe },
  { id: 3, title: "AI Configuration", icon: Bot },
  { id: 4, title: "AI Training", icon: Brain },
  { id: 5, title: "Platform Setup", icon: Shield },
  { id: 6, title: "Customization", icon: Wand2 },
  { id: 7, title: "Review & Deploy", icon: Zap }
];

export default function AgentWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Fetch available LLM models
  const { data: availableModels, isLoading: modelsLoading } = useQuery({
    queryKey: ["/api/models"],
  });

  // Fetch industry verticals
  const { data: industryVerticals, isLoading: industriesLoading } = useQuery({
    queryKey: ["/api/industry-verticals"],
  });

  const form = useForm<WizardFormData>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      name: "",
      businessCategory: "",
      description: "",
      llmProvider: "",
      systemPrompt: "",
      widgetColor: "#25D366",
      welcomeMessage: "Hi! How can I help you today?",
      operatingHours: "24/7",
      // Platform credentials (empty by default)
      whatsappNumber: "",
      whatsappApiKey: "",
      whatsappWebhook: "",
      facebookPageId: "",
      facebookAccessToken: "",
      facebookWebhook: "",
      instagramBusinessId: "",
      instagramAccessToken: "",
      lineChannelId: "",
      lineChannelSecret: "",
      lineChannelToken: "",
      telegramBotToken: "",
      telegramUsername: "",
      discordBotToken: "",
      discordGuildId: "",
      discordChannelId: "",
    },
  });

  // Use local state for platform selection
  const [localSelectedPlatforms, setLocalSelectedPlatforms] = useState<string[]>([]);
  
  // Memoized platform toggle handler to prevent infinite re-renders
  const togglePlatform = useCallback((platformId: string, checked: boolean) => {
    setLocalSelectedPlatforms(prev => {
      if (checked) {
        return prev.includes(platformId) ? prev : [...prev, platformId];
      } else {
        return prev.filter(id => id !== platformId);
      }
    });
  }, []);
  
  // Watch LLM provider for model options
  const selectedLlmProvider = form.watch("llmProvider");

  const createAgentsMutation = useMutation({
    mutationFn: async (data: WizardFormData) => {
      setIsCreating(true);
      
      const createdAgents = [];
      for (const platformId of localSelectedPlatforms) {
        const platform = platformTypes.find(p => p.id === platformId);
        if (!platform) continue;

        const agentData = {
          name: `${data.name} - ${platform.name}`,
          businessCategory: data.businessCategory,
          llmProvider: data.llmProvider,
          systemPrompt: data.systemPrompt,
          platformTypes: [platformId], // Send as array to match backend expectation
          widgetPosition: "bottom-right",
          widgetColor: data.widgetColor,
          welcomeMessage: data.welcomeMessage,
          operatingHours: data.operatingHours,
          status: "active",
          // Platform-specific fields
          whatsappNumber: data.whatsappNumber,
          whatsappApiKey: data.whatsappApiKey,
          whatsappWebhook: data.whatsappWebhook,
          facebookPageId: data.facebookPageId,
          facebookAccessToken: data.facebookAccessToken,
          facebookWebhook: data.facebookWebhook,
          instagramBusinessId: data.instagramBusinessId,
          instagramAccessToken: data.instagramAccessToken,
          lineChannelId: data.lineChannelId,
          lineChannelSecret: data.lineChannelSecret,
          lineChannelToken: data.lineChannelToken,
          telegramBotToken: data.telegramBotToken,
          telegramUsername: data.telegramUsername,
          discordBotToken: data.discordBotToken,
          discordGuildId: data.discordGuildId,
          discordChannelId: data.discordChannelId,
        };

        const response = await apiRequest("POST", "/api/agents", agentData);
        const agent = await response.json();
        createdAgents.push(agent);
      }
      
      return createdAgents;
    },
    onSuccess: (agents) => {
      setIsCreating(false);
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      
      toast({
        title: "Agents Created Successfully!",
        description: `Created ${agents.length} agent${agents.length > 1 ? 's' : ''} across ${localSelectedPlatforms.length} platform${localSelectedPlatforms.length > 1 ? 's' : ''}`,
      });
      
      setLocation("/agents");
    },
    onError: (error: any) => {
      setIsCreating(false);
      toast({
        title: "Error Creating Agents",
        description: error.message || "Failed to create agents. Please try again.",
        variant: "destructive",
      });
    },
  });

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCompletedSteps(prev => [...prev, currentStep]);
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return form.getValues("name").length > 0;
      case 2:
        return localSelectedPlatforms.length > 0;
      case 3:
        return form.getValues("llmProvider") && form.getValues("systemPrompt").length >= 10;
      case 4:
        // Check if required platform credentials are provided
        return localSelectedPlatforms.every((platformId: string) => {
          const platform = platformTypes.find(p => p.id === platformId);
          if (!platform) return true;
          
          // For now, allow proceeding even without credentials (can be set later)
          return true;
        });
      case 5:
        return true;
      default:
        return true;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Let's start with the basics</h2>
              <p className="text-gray-600">Tell us about your agent and business</p>
            </div>
            
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agent Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Customer Support Agent" {...field} />
                  </FormControl>
                  <FormDescription>This will be the base name for your agents</FormDescription>
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
                    <Select 
                      value={field.value} 
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Auto-populate system prompt based on business category
                        const selectedVertical = industryVerticals?.find((v: any) => 
                          v.name === value
                        );
                        if (selectedVertical?.systemInstruction) {
                          form.setValue("systemPrompt", selectedVertical.systemInstruction);
                        }
                      }}
                      disabled={industriesLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={industriesLoading ? "Loading..." : "Select your business category"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {Array.isArray(industryVerticals) ? industryVerticals.map((industry: any) => (
                          <SelectItem key={industry.name} value={industry.name}>
                            {industry.name}
                          </SelectItem>
                        )) : null}
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormDescription>
                    Choose the category that best describes your business. This will auto-populate the AI instructions below.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Brief description of what this agent will do..."
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose your platforms</h2>
              <p className="text-gray-600">Select where you want your agents to be available</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {platformTypes.map((platform) => {
                      const IconComponent = platform.icon;
                      const isSelected = localSelectedPlatforms.includes(platform.id);
                      
                      return (
                        <div
                          key={platform.id}
                          className={`relative rounded-lg border-2 p-4 transition-all ${
                            isSelected 
                              ? 'border-blue-500 bg-blue-50 shadow-sm' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <label className="flex items-start justify-between cursor-pointer w-full">
                            <div className="flex items-start space-x-3 flex-1">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={(checked) => togglePlatform(platform.id, !!checked)}
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
                                <p className="text-sm text-gray-600 mb-3">
                                  {platform.description}
                                </p>
                                <div className="flex items-center justify-between">
                                  <Badge variant="outline" className="text-xs">
                                    {platform.setupComplexity}
                                  </Badge>
                                  <span className="text-xs text-gray-500">
                                    ~{platform.estimatedTime}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </label>
                        </div>
                      );
                    })}
            </div>
            
            <div className="mt-6">
              {localSelectedPlatforms.length > 0 ? (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center space-x-2">
                    <Check className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-900">
                      {localSelectedPlatforms.length} platform{localSelectedPlatforms.length > 1 ? 's' : ''} selected
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {localSelectedPlatforms.map(platformId => {
                      const platform = platformTypes.find(p => p.id === platformId);
                      if (!platform) return null;
                      const IconComponent = platform.icon;
                      return (
                        <div key={platformId} className="flex items-center space-x-1 px-2 py-1 bg-blue-100 rounded-full text-xs">
                          <IconComponent className="w-3 h-3" style={{ color: platform.color }} />
                          <span className="text-blue-800">{platform.name}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-sm text-blue-700 mt-2">
                    We'll create separate agents for each platform to ensure optimal performance
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                    <span className="font-medium text-gray-600">
                      Select platforms for your agents
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Choose one or more messaging platforms where your AI agents will be available
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Configure AI behavior</h2>
              <p className="text-gray-600">Choose your AI model and define how it should respond</p>
            </div>
            
            <FormField
              control={form.control}
              name="llmProvider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>AI Model *</FormLabel>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {modelsLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
                      ))
                    ) : (
                      availableModels && Array.isArray(availableModels) ? availableModels.map((model: any) => (
                        <div
                          key={model.id}
                          className={`cursor-pointer rounded-lg border-2 p-4 transition-all hover:shadow-md ${
                            selectedLlmProvider === model.id 
                              ? 'border-blue-500 bg-blue-50' 
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => {
                            console.log('Model selected:', model.id);
                            field.onChange(model.id);
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-sm text-gray-900">{model.name}</h4>
                            <Badge variant="outline" className="text-xs">
                              {model.provider}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600">{model.description}</p>
                        </div>
                      )) : (
                        <div className="col-span-full text-center py-8">
                          <p className="text-gray-500">No AI models available. Please check your configuration.</p>
                        </div>
                      )
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="systemPrompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>System Instructions *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="You are a helpful customer service assistant. Your goal is to..."
                      className="min-h-[200px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Define how your AI should behave and respond to customers. Instructions are auto-populated based on your business category but can be fully customized to match your specific needs.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">AI Training & Knowledge</h2>
              <p className="text-gray-600">Train your agent with custom knowledge and examples</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Knowledge Base Section */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    <h3 className="font-semibold text-gray-900">Knowledge Base</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Add information about your business, products, and services
                  </p>
                  <div className="space-y-3">
                    <div className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Business Info</span>
                        <Badge variant="outline">Optional</Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Company details, history, values</p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Products/Services</span>
                        <Badge variant="outline">Optional</Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Catalog, features, pricing</p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">FAQs</span>
                        <Badge variant="outline">Recommended</Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Common questions and answers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Training Examples Section */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <Target className="w-5 h-5 text-green-600" />
                    <h3 className="font-semibold text-gray-900">Training Examples</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Provide example conversations to improve responses
                  </p>
                  <div className="space-y-3">
                    <div className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Customer Questions</span>
                        <Badge variant="outline">Optional</Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Common customer inquiries</p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Support Scenarios</span>
                        <Badge variant="outline">Optional</Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Problem resolution examples</p>
                    </div>
                    <div className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Sales Conversations</span>
                        <Badge variant="outline">Optional</Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Lead qualification dialogues</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Brand Voice Configuration */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2 mb-4">
                  <Lightbulb className="w-5 h-5 text-yellow-600" />
                  <h3 className="font-semibold text-gray-900">Brand Voice & Style</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tone</label>
                    <Select defaultValue="professional">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="friendly">Friendly</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="formal">Formal</SelectItem>
                        <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Personality</label>
                    <Select defaultValue="helpful">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="helpful">Helpful</SelectItem>
                        <SelectItem value="expert">Expert</SelectItem>
                        <SelectItem value="empathetic">Empathetic</SelectItem>
                        <SelectItem value="efficient">Efficient</SelectItem>
                        <SelectItem value="consultative">Consultative</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Style</label>
                    <Select defaultValue="concise">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="concise">Concise</SelectItem>
                        <SelectItem value="detailed">Detailed</SelectItem>
                        <SelectItem value="conversational">Conversational</SelectItem>
                        <SelectItem value="technical">Technical</SelectItem>
                        <SelectItem value="simple">Simple</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <Brain className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900">AI Training Benefits</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Custom training helps your agent provide more accurate, brand-consistent responses. 
                    You can always add more training data after deployment.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Platform credentials</h2>
              <p className="text-gray-600">Configure your platform integrations</p>
            </div>
            
            {localSelectedPlatforms.map((platformId: string) => {
              const platform = platformTypes.find(p => p.id === platformId);
              if (!platform) return null;
              
              const IconComponent = platform.icon;
              
              return (
                <Card key={platformId} className="border-l-4" style={{ borderLeftColor: platform.color }}>
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <IconComponent className="w-6 h-6" style={{ color: platform.color }} />
                      <h3 className="text-lg font-semibold text-gray-900">{platform.name}</h3>
                    </div>
                    
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-900 mb-2">Requirements:</h4>
                      <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                        {platform.requirements.map((req, index) => (
                          <li key={index}>{req}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Platform-specific form fields */}
                      {platform.id === 'whatsapp-business-api' && (
                        <>
                          <FormField
                            control={form.control}
                            name="whatsappNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>WhatsApp Business Number</FormLabel>
                                <FormControl>
                                  <Input placeholder="+1234567890" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="whatsappApiKey"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>API Key</FormLabel>
                                <FormControl>
                                  <Input placeholder="Your WhatsApp Business API key" type="password" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="whatsappWebhook"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Webhook URL</FormLabel>
                                <FormControl>
                                  <Input placeholder="https://your-domain.com/webhook" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}
                      
                      {platform.id === 'facebook-messenger' && (
                        <>
                          <FormField
                            control={form.control}
                            name="facebookPageId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Facebook Page ID</FormLabel>
                                <FormControl>
                                  <Input placeholder="Your Facebook Page ID" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="facebookAccessToken"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Page Access Token</FormLabel>
                                <FormControl>
                                  <Input placeholder="Your Page Access Token" type="password" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}
                      
                      {platform.id === 'telegram-bot' && (
                        <>
                          <FormField
                            control={form.control}
                            name="telegramBotToken"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Bot Token</FormLabel>
                                <FormControl>
                                  <Input placeholder="Bot token from @BotFather" type="password" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="telegramUsername"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Bot Username</FormLabel>
                                <FormControl>
                                  <Input placeholder="@yourbotname" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      )}
                      
                      {/* Add other platform configurations as needed */}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> You can skip credential setup for now and configure them later from the agent settings.
              </p>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Customize your experience</h2>
              <p className="text-gray-600">Fine-tune your agent's appearance and behavior</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="widgetColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Widget Color</FormLabel>
                    <FormControl>
                      <div className="flex items-center space-x-3">
                        <input 
                          type="color" 
                          value={field.value} 
                          onChange={field.onChange}
                          className="w-12 h-10 border border-gray-300 rounded"
                        />
                        <Input {...field} placeholder="#25D366" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="operatingHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Operating Hours</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="24/7">24/7</SelectItem>
                          <SelectItem value="Business Hours">Business Hours (9AM-5PM)</SelectItem>
                          <SelectItem value="Extended Hours">Extended Hours (8AM-8PM)</SelectItem>
                          <SelectItem value="Custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="welcomeMessage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Welcome Message</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Hi! How can I help you today?"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    This message will greet users when they start a conversation
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );

      case 7:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Review and deploy</h2>
              <p className="text-gray-600">Everything looks good? Let's create your agents!</p>
            </div>
            
            <div className="space-y-4">
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Agent Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Name:</span>
                      <span className="ml-2 font-medium">{form.getValues("name")}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Category:</span>
                      <span className="ml-2 font-medium">{form.getValues("businessCategory") || "Not specified"}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">AI Model:</span>
                      <span className="ml-2 font-medium">{Array.isArray(availableModels) ? availableModels.find((m: any) => m.id === form.getValues("llmProvider"))?.name || "Not selected" : "Not selected"}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Platforms:</span>
                      <span className="ml-2 font-medium">{localSelectedPlatforms.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Selected Platforms</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {localSelectedPlatforms.map((platformId: string) => {
                      const platform = platformTypes.find(p => p.id === platformId);
                      if (!platform) return null;
                      
                      const IconComponent = platform.icon;
                      return (
                        <div key={platformId} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                          <IconComponent className="w-5 h-5" style={{ color: platform.color }} />
                          <span className="font-medium text-gray-900">{platform.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="flex justify-center">
              <Button 
                onClick={() => createAgentsMutation.mutate(form.getValues())}
                disabled={isCreating}
                size="lg"
                className="min-w-[200px]"
              >
                {isCreating ? "Creating Agents..." : `Create ${localSelectedPlatforms.length} Agent${localSelectedPlatforms.length > 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const progress = ((currentStep - 1) / (steps.length - 1)) * 100;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Agent Configuration Wizard</h1>
          <Badge variant="outline">
            Step {currentStep} of {steps.length}
          </Badge>
        </div>
        
        <Progress value={progress} className="h-2 mb-4" />
        
        <div className="flex items-center justify-between text-sm">
          {steps.map((step, index) => {
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = currentStep === step.id;
            const IconComponent = step.icon;
            
            return (
              <div 
                key={step.id} 
                className={`flex items-center space-x-2 ${
                  isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <IconComponent className="w-4 h-4" />
                )}
                <span className="hidden md:inline">{step.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardContent className="p-8">
          <Form {...form}>
            {renderStepContent()}
          </Form>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={currentStep === 1}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>
        
        {currentStep < steps.length ? (
          <Button
            onClick={nextStep}
            disabled={!canProceed()}
          >
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}