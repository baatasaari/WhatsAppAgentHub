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
import { useAuth } from "@/hooks/useAuth";

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
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();

  // Check for edit mode from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    console.log('Edit mode check:', { editId, urlParams: window.location.search });
    if (editId) {
      setEditingAgentId(editId);
      setIsEditMode(true);
      console.log('Edit mode activated for agent ID:', editId);
    }
  }, []);
  
  // Knowledge Base state
  const [knowledgeData, setKnowledgeData] = useState({
    websiteUrls: '',
    cloudStorage: '',
    databaseConnection: '',
    apiEndpoints: '',
    businessInfo: ''
  });
  
  // Training Examples state
  const [trainingExamples, setTrainingExamples] = useState({
    customerQuestions: '',
    supportScenarios: '',
    salesConversations: '',
    brandVoiceTone: 'professional',
    personality: 'helpful',
    communicationStyle: 'technical'
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to access the Agent Wizard.",
        variant: "destructive",
      });
      setTimeout(() => {
        setLocation("/login");
      }, 1000);
      return;
    }
  }, [authLoading, isAuthenticated, setLocation, toast]);

  // Fetch available LLM models
  const { data: availableModels, isLoading: modelsLoading } = useQuery({
    queryKey: ["/api/models"],
    enabled: isAuthenticated,
  });

  // Fetch industry verticals - with fallback data
  const { data: industryVerticals, isLoading: industriesLoading, error: industriesError } = useQuery({
    queryKey: ["/api/industry-verticals"],
    enabled: isAuthenticated,
    retry: (failureCount, error) => {
      // Don't retry on authentication errors
      if (error.message.includes('401')) {
        return false;
      }
      return failureCount < 3;
    },
  });

  // Fetch existing agent data when in edit mode
  const { data: existingAgent, isLoading: agentLoading, error: agentError } = useQuery({
    queryKey: ["/api/agents", editingAgentId],
    enabled: isAuthenticated && isEditMode && !!editingAgentId,
  });

  // Debug agent data fetch
  useEffect(() => {
    if (existingAgent) {
      console.log('Fetched existing agent data:', existingAgent);
    }
    if (agentError) {
      console.error('Error fetching agent data:', agentError);
    }
  }, [existingAgent, agentError]);

  // Fallback industry verticals if API fails
  const fallbackIndustries = [
    { name: "E-Commerce & Retail", description: "Online and offline selling of goods, retail management", systemInstruction: "You are a professional customer service assistant for an e-commerce and retail business. Your primary role is to help customers with product inquiries, order management, shipping information, returns and exchanges, and general shopping assistance." },
    { name: "Healthcare & Medical", description: "Medical services, healthcare providers, patient care", systemInstruction: "You are a healthcare customer service assistant designed to help patients with appointment scheduling, general health information, and administrative inquiries. IMPORTANT: You cannot provide medical advice, diagnose conditions, or replace professional medical consultation." },
    { name: "Financial Services", description: "Banking, insurance, investment, fintech", systemInstruction: "You are a financial services customer support assistant specializing in account inquiries, transaction support, and general financial service information. IMPORTANT: You cannot provide financial advice, access sensitive account details, or handle monetary transactions." },
    { name: "Education & Training", description: "Schools, universities, online learning", systemInstruction: "You are an educational support assistant helping students, parents, and learners with course information, enrollment processes, academic resources, and learning support." },
    { name: "Technology & Software", description: "Software development, IT services, tech support", systemInstruction: "You are a technical support assistant for technology and software services. Help users with software troubleshooting, feature explanations, account management, and technical inquiries." },
    { name: "Real Estate", description: "Property sales, rentals, property management", systemInstruction: "You are a real estate customer service assistant helping clients with property inquiries, viewing appointments, rental information, and real estate services." },
    { name: "Hospitality & Travel", description: "Hotels, restaurants, travel agencies, tourism", systemInstruction: "You are a hospitality and travel customer service assistant focused on creating exceptional guest experiences. Help customers with reservations, travel planning, accommodation inquiries." },
    { name: "Automotive", description: "Car dealerships, auto repair, automotive services", systemInstruction: "You are an automotive customer service assistant helping customers with vehicle inquiries, service appointments, parts information, and automotive services." },
    { name: "Legal Services", description: "Law firms, legal consulting, compliance", systemInstruction: "You are a legal services administrative assistant helping clients with appointment scheduling, document requests, and general legal service information. IMPORTANT: You cannot provide legal advice or legal interpretation." },
    { name: "Manufacturing", description: "Production, industrial services, supply chain", systemInstruction: "You are a manufacturing customer service assistant helping clients with product specifications, order status, delivery information, and manufacturing services." },
    { name: "Non-Profit", description: "Charitable organizations, community services", systemInstruction: "You are a non-profit organization assistant helping supporters with donation information, volunteer opportunities, program details, and community service inquiries." },
    { name: "Government", description: "Public services, municipal services, government agencies", systemInstruction: "You are a government services assistant helping citizens with public service information, application processes, requirements, and directing them to appropriate departments." },
    { name: "Entertainment & Media", description: "Broadcasting, publishing, entertainment", systemInstruction: "You are an entertainment and media customer service assistant helping audiences with content information, subscription services, event details, and media-related inquiries." },
    { name: "Food & Beverage", description: "Restaurants, food service, catering", systemInstruction: "You are a food and beverage service assistant helping customers with menu information, reservations, catering services, dietary accommodations, and food service inquiries." },
    { name: "Construction", description: "Building services, contracting, architecture", systemInstruction: "You are a construction services assistant helping clients with project inquiries, service estimates, scheduling, and construction-related information." }
  ];

  // Use API data if available, fallback otherwise
  const availableIndustries = industryVerticals || fallbackIndustries;

  // Handle authentication loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render anything if not authenticated (redirect will happen)
  if (!isAuthenticated) {
    return null;
  }

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

  // Populate form with existing agent data when in edit mode
  useEffect(() => {
    console.log('Form population effect triggered:', { existingAgent, isEditMode, editingAgentId });
    if (existingAgent && isEditMode && typeof existingAgent === 'object') {
      const agent = existingAgent as Record<string, any>;
      console.log('Populating form with agent data:', agent);
      
      // Update form with existing agent data
      form.reset({
        name: agent?.name || "",
        businessCategory: agent?.businessCategory || "",
        description: agent?.description || "",
        llmProvider: agent?.llmProvider || "",
        systemPrompt: agent?.systemPrompt || "",
        widgetColor: agent?.widgetColor || "#25D366",
        welcomeMessage: agent?.welcomeMessage || "Hi! How can I help you today?",
        operatingHours: agent?.operatingHours || "24/7",
        // Platform credentials
        whatsappNumber: agent?.whatsappNumber || "",
        whatsappApiKey: agent?.whatsappApiKey || "",
        whatsappWebhook: agent?.whatsappWebhook || "",
        facebookPageId: agent?.facebookPageId || "",
        facebookAccessToken: agent?.facebookAccessToken || "",
        facebookWebhook: agent?.facebookWebhook || "",
        instagramBusinessId: agent?.instagramBusinessId || "",
        instagramAccessToken: agent?.instagramAccessToken || "",
        lineChannelId: agent?.lineChannelId || "",
        lineChannelSecret: agent?.lineChannelSecret || "",
        lineChannelToken: agent?.lineChannelToken || "",
        telegramBotToken: agent?.telegramBotToken || "",
        telegramUsername: agent?.telegramUsername || "",
        discordBotToken: agent?.discordBotToken || "",
        discordGuildId: agent?.discordGuildId || "",
        discordChannelId: agent?.discordChannelId || "",
      });

      // Set platform selection based on existing agent
      if (agent?.platformType) {
        setLocalSelectedPlatforms([agent.platformType]);
      }
    }
  }, [existingAgent, isEditMode, form]);

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
      
      if (isEditMode && editingAgentId) {
        // Edit existing agent
        const agentData = {
          name: data.name,
          businessCategory: data.businessCategory,
          llmProvider: data.llmProvider,
          systemPrompt: data.systemPrompt,
          widgetColor: data.widgetColor,
          welcomeMessage: data.welcomeMessage,
          operatingHours: data.operatingHours,
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

        const response = await apiRequest("PUT", `/api/agents/${editingAgentId}`, agentData);
        const agent = await response.json();
        return [agent];
      } else {
        // Create new agents
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
      }
    },
    onSuccess: (agents) => {
      setIsCreating(false);
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      
      if (isEditMode) {
        toast({
          title: "Agent Updated Successfully!",
          description: "Your agent has been updated with the new configuration.",
        });
      } else {
        toast({
          title: "Agents Created Successfully!",
          description: `Created ${agents.length} agent${agents.length > 1 ? 's' : ''} across ${localSelectedPlatforms.length} platform${localSelectedPlatforms.length > 1 ? 's' : ''}`,
        });
      }
      
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
                        if (Array.isArray(availableIndustries)) {
                          const selectedVertical = availableIndustries.find((v: any) => v.name === value);
                          if (selectedVertical?.systemInstruction) {
                            form.setValue("systemPrompt", selectedVertical.systemInstruction);
                          }
                        }

                      }}
                      disabled={industriesLoading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={industriesLoading ? "Loading..." : "Select your business category"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {Array.isArray(availableIndustries) ? availableIndustries.map((industry: any) => (
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
                    Connect data sources for your agent to reference
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Website URLs</label>
                      <Textarea 
                        placeholder="https://yourwebsite.com/about&#10;https://yourwebsite.com/products&#10;https://yourwebsite.com/support"
                        className="min-h-[80px]"
                        value={knowledgeData.websiteUrls}
                        onChange={(e) => setKnowledgeData(prev => ({ ...prev, websiteUrls: e.target.value }))}
                      />
                      <p className="text-xs text-gray-500 mt-1">One URL per line - pages to crawl for information</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cloud Storage</label>
                      <Input 
                        placeholder="gs://bucket-name/folder or s3://bucket-name/folder"
                        value={knowledgeData.cloudStorage}
                        onChange={(e) => setKnowledgeData(prev => ({ ...prev, cloudStorage: e.target.value }))}
                      />
                      <p className="text-xs text-gray-500 mt-1">Google Cloud Storage, AWS S3, or Azure Blob URLs</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Database Connection</label>
                      <Input 
                        placeholder="bigquery://project.dataset.table or postgresql://connection-string"
                        value={knowledgeData.databaseConnection}
                        onChange={(e) => setKnowledgeData(prev => ({ ...prev, databaseConnection: e.target.value }))}
                      />
                      <p className="text-xs text-gray-500 mt-1">BigQuery, PostgreSQL, MySQL, or other database connections</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">API Endpoints</label>
                      <Textarea 
                        placeholder="https://api.yourservice.com/knowledge&#10;https://api.yourservice.com/faq"
                        className="min-h-[60px]"
                        value={knowledgeData.apiEndpoints}
                        onChange={(e) => setKnowledgeData(prev => ({ ...prev, apiEndpoints: e.target.value }))}
                      />
                      <p className="text-xs text-gray-500 mt-1">REST API endpoints that return knowledge data</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Business Information</label>
                      <Textarea 
                        placeholder="Company overview, history, mission, values, team information..."
                        className="min-h-[100px]"
                        value={knowledgeData.businessInfo}
                        onChange={(e) => setKnowledgeData(prev => ({ ...prev, businessInfo: e.target.value }))}
                      />
                      <p className="text-xs text-gray-500 mt-1">Direct text about your company and services</p>
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
                    Add example conversations to train your agent
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Customer Questions & Answers</label>
                      <Textarea 
                        placeholder="Q: What are your business hours?&#10;A: We're open Monday-Friday 9AM-6PM EST.&#10;&#10;Q: Do you offer refunds?&#10;A: Yes, we offer full refunds within 30 days of purchase."
                        className="min-h-[100px]"
                        value={trainingExamples.customerQuestions}
                        onChange={(e) => setTrainingExamples(prev => ({ ...prev, customerQuestions: e.target.value }))}
                      />
                      <p className="text-xs text-gray-500 mt-1">Format: Q: question A: answer, one pair per section</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Support Scenarios</label>
                      <Textarea 
                        placeholder="Customer: I'm having trouble with my order&#10;Agent: I'd be happy to help you with that. Can you provide your order number?&#10;Customer: It's #12345&#10;Agent: Thank you. I can see your order and will resolve this immediately."
                        className="min-h-[80px]"
                        value={trainingExamples.supportScenarios}
                        onChange={(e) => setTrainingExamples(prev => ({ ...prev, supportScenarios: e.target.value }))}
                      />
                      <p className="text-xs text-gray-500 mt-1">Example support conversations showing problem resolution</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Sales Conversations</label>
                      <Textarea 
                        placeholder="Customer: I'm interested in your premium package&#10;Agent: Great choice! Our premium package includes X, Y, and Z. Would you like me to explain the benefits?&#10;Customer: Yes please&#10;Agent: The key benefits are..."
                        className="min-h-[80px]"
                        value={trainingExamples.salesConversations}
                        onChange={(e) => setTrainingExamples(prev => ({ ...prev, salesConversations: e.target.value }))}
                      />
                      <p className="text-xs text-gray-500 mt-1">Example sales and lead qualification dialogues</p>
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
                    <Select value={trainingExamples.brandVoiceTone} onValueChange={(value) => setTrainingExamples(prev => ({ ...prev, brandVoiceTone: value }))}>
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
                    <Select value={trainingExamples.personality} onValueChange={(value) => setTrainingExamples(prev => ({ ...prev, personality: value }))}>
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
                    <Select value={trainingExamples.communicationStyle} onValueChange={(value) => setTrainingExamples(prev => ({ ...prev, communicationStyle: value }))}>
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
                {isCreating ? (isEditMode ? "Updating Agent..." : "Creating Agents...") : (isEditMode ? "Update Agent" : `Create ${localSelectedPlatforms.length} Agent${localSelectedPlatforms.length > 1 ? 's' : ''}`)}
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
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditMode ? "Edit Agent" : "Agent Configuration Wizard"}
          </h1>
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