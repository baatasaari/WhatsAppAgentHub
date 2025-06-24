import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Brain, Plus, Upload, Download, BookOpen, Zap, Target, MessageSquare, Trash2, Edit, Play, Check, AlertCircle, FileText, Bot, Smartphone, Globe } from "lucide-react";
import { PlatformTrainingGuide } from "@/components/platform-training-guide";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const knowledgeItemSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  content: z.string().min(10, "Content must be at least 10 characters"),
  category: z.string().min(1, "Category is required"),
  tags: z.string().optional(),
});

const trainingExampleSchema = z.object({
  input: z.string().min(5, "Input must be at least 5 characters"),
  expectedOutput: z.string().min(10, "Expected output must be at least 10 characters"),
  category: z.string().min(1, "Category is required"),
  weight: z.number().min(1).max(10).default(1),
});

const brandVoiceSchema = z.object({
  tone: z.string().min(1, "Tone is required"),
  personality: z.string().min(1, "Personality is required"),
  communicationStyle: z.string().min(1, "Communication style is required"),
  dosList: z.string().optional(),
  dontsList: z.string().optional(),
});

const businessContextSchema = z.object({
  industry: z.string().min(1, "Industry is required"),
  companySize: z.string().min(1, "Company size is required"),
  targetAudience: z.string().min(1, "Target audience is required"),
  keyProducts: z.string().optional(),
  valueProposition: z.string().min(10, "Value proposition must be at least 10 characters"),
});

export default function AITraining() {
  const { toast } = useToast();
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("knowledge");
  const [trainingExamples, setTrainingExamples] = useState<any[]>([]);
  const [showKnowledgeDialog, setShowKnowledgeDialog] = useState(false);
  const [showExampleDialog, setShowExampleDialog] = useState(false);

  // Get user's agents
  const { data: agents = [], isLoading: agentsLoading } = useQuery({
    queryKey: ["/api/agents"],
  });

  // Get agent details with training data
  const { data: agentDetails, isLoading: agentLoading } = useQuery({
    queryKey: ["/api/agents", selectedAgent],
    enabled: !!selectedAgent,
  });

  // Get knowledge base items
  const { data: knowledgeItems = [], isLoading: knowledgeLoading } = useQuery({
    queryKey: ["/api/agents", selectedAgent, "knowledge"],
    enabled: !!selectedAgent,
  });

  // Get training sessions
  const { data: trainingSessions = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ["/api/agents", selectedAgent, "training-sessions"],
    enabled: !!selectedAgent,
  });

  // Knowledge item form
  const knowledgeForm = useForm<z.infer<typeof knowledgeItemSchema>>({
    resolver: zodResolver(knowledgeItemSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "",
      tags: "",
    },
  });

  // Training example form
  const exampleForm = useForm<z.infer<typeof trainingExampleSchema>>({
    resolver: zodResolver(trainingExampleSchema),
    defaultValues: {
      input: "",
      expectedOutput: "",
      category: "",
      weight: 1,
    },
  });

  // Brand voice form
  const brandVoiceForm = useForm<z.infer<typeof brandVoiceSchema>>({
    resolver: zodResolver(brandVoiceSchema),
    defaultValues: {
      tone: "",
      personality: "",
      communicationStyle: "",
      dosList: "",
      dontsList: "",
    },
  });

  // Business context form
  const businessContextForm = useForm<z.infer<typeof businessContextSchema>>({
    resolver: zodResolver(businessContextSchema),
    defaultValues: {
      industry: "",
      companySize: "",
      targetAudience: "",
      keyProducts: "",
      valueProposition: "",
    },
  });

  // Add knowledge item mutation
  const addKnowledgeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof knowledgeItemSchema>) => {
      return apiRequest(`/api/agents/${selectedAgent}/knowledge`, {
        method: "POST",
        body: {
          ...data,
          tags: data.tags?.split(",").map(tag => tag.trim()).filter(Boolean) || [],
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", selectedAgent, "knowledge"] });
      knowledgeForm.reset();
      setShowKnowledgeDialog(false);
      toast({ title: "Knowledge item added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error adding knowledge item", description: error.message, variant: "destructive" });
    },
  });

  // Add training example
  const addTrainingExample = (data: z.infer<typeof trainingExampleSchema>) => {
    setTrainingExamples(prev => [...prev, { ...data, id: Date.now().toString() }]);
    exampleForm.reset();
    setShowExampleDialog(false);
    toast({ title: "Training example added" });
  };

  // Start training session mutation
  const startTrainingMutation = useMutation({
    mutationFn: async (data: {
      sessionName: string;
      brandVoice: z.infer<typeof brandVoiceSchema>;
      businessContext: z.infer<typeof businessContextSchema>;
    }) => {
      return apiRequest(`/api/agents/${selectedAgent}/training`, {
        method: "POST",
        body: {
          sessionName: data.sessionName,
          trainingData: trainingExamples,
          brandVoiceConfig: {
            ...data.brandVoice,
            dosList: data.brandVoice.dosList?.split(",").map(item => item.trim()).filter(Boolean) || [],
            dontsList: data.brandVoice.dontsList?.split(",").map(item => item.trim()).filter(Boolean) || [],
          },
          businessContextConfig: {
            ...data.businessContext,
            keyProducts: data.businessContext.keyProducts?.split(",").map(item => item.trim()).filter(Boolean) || [],
          },
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", selectedAgent, "training-sessions"] });
      setTrainingExamples([]);
      brandVoiceForm.reset();
      businessContextForm.reset();
      toast({ title: "Training session started successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error starting training", description: error.message, variant: "destructive" });
    },
  });

  const handleStartTraining = () => {
    if (trainingExamples.length < 5) {
      toast({ 
        title: "Insufficient training data", 
        description: "At least 5 training examples are required",
        variant: "destructive" 
      });
      return;
    }

    const brandVoiceData = brandVoiceForm.getValues();
    const businessContextData = businessContextForm.getValues();
    
    const sessionName = `Training Session ${new Date().toLocaleDateString()}`;
    
    startTrainingMutation.mutate({
      sessionName,
      brandVoice: brandVoiceData,
      businessContext: businessContextData,
    });
  };

  if (agentsLoading) {
    return <div className="flex items-center justify-center h-64">Loading agents...</div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Brain className="h-8 w-8 text-blue-600" />
          Custom AI Training
        </h1>
        <p className="text-gray-600 mt-2">
          Train your agents with custom knowledge, brand voice, and business context for personalized responses.
        </p>
      </div>

      {/* Agent Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Agent to Train</CardTitle>
          <CardDescription>Choose which agent you want to customize with training data</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedAgent?.toString()} onValueChange={(value) => setSelectedAgent(parseInt(value))}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an agent to train..." />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent: any) => (
                <SelectItem key={agent.id} value={agent.id.toString()}>
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    {agent.name}
                    {agent.customTraining?.trainingStatus === 'trained' && (
                      <Badge variant="secondary" className="ml-2">Trained</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedAgent && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
            <TabsTrigger value="training">Training Examples</TabsTrigger>
            <TabsTrigger value="voice">Brand Voice</TabsTrigger>
            <TabsTrigger value="platforms">Platform Guide</TabsTrigger>
            <TabsTrigger value="sources">Data Sources</TabsTrigger>
            <TabsTrigger value="sessions">Training Sessions</TabsTrigger>
          </TabsList>

          {/* Knowledge Base Tab */}
          <TabsContent value="knowledge" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Knowledge Base</h3>
                <p className="text-sm text-gray-600">Add company-specific information, FAQs, and product details</p>
              </div>
              <Dialog open={showKnowledgeDialog} onOpenChange={setShowKnowledgeDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Knowledge
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add Knowledge Item</DialogTitle>
                    <DialogDescription>
                      Add information that your agent should know and reference in conversations
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...knowledgeForm}>
                    <form onSubmit={knowledgeForm.handleSubmit((data) => addKnowledgeMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={knowledgeForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Product pricing information" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={knowledgeForm.control}
                        name="content"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Content</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Detailed information that the agent should know..."
                                className="min-h-32"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={knowledgeForm.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="product">Product Information</SelectItem>
                                  <SelectItem value="pricing">Pricing</SelectItem>
                                  <SelectItem value="support">Support</SelectItem>
                                  <SelectItem value="company">Company Info</SelectItem>
                                  <SelectItem value="faq">FAQ</SelectItem>
                                  <SelectItem value="policy">Policies</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={knowledgeForm.control}
                          name="tags"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tags</FormLabel>
                              <FormControl>
                                <Input placeholder="tag1, tag2, tag3" {...field} />
                              </FormControl>
                              <FormDescription>Comma-separated tags</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setShowKnowledgeDialog(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={addKnowledgeMutation.isPending}>
                          {addKnowledgeMutation.isPending ? "Adding..." : "Add Knowledge"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {knowledgeLoading ? (
                <div>Loading knowledge items...</div>
              ) : knowledgeItems.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <BookOpen className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-600 text-center">
                      No knowledge items yet. Add some company information to get started.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                knowledgeItems.map((item: any) => (
                  <Card key={item.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{item.title}</CardTitle>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline">{item.category}</Badge>
                            {item.tags?.map((tag: string) => (
                              <Badge key={tag} variant="secondary">{tag}</Badge>
                            ))}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700">{item.content}</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Training Examples Tab */}
          <TabsContent value="training" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Training Examples</h3>
                <p className="text-sm text-gray-600">Provide examples of ideal conversations and responses</p>
              </div>
              <Dialog open={showExampleDialog} onOpenChange={setShowExampleDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Example
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add Training Example</DialogTitle>
                    <DialogDescription>
                      Show your agent how to respond to specific types of customer messages
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...exampleForm}>
                    <form onSubmit={exampleForm.handleSubmit(addTrainingExample)} className="space-y-4">
                      <FormField
                        control={exampleForm.control}
                        name="input"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Customer Input</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="What the customer might say..."
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={exampleForm.control}
                        name="expectedOutput"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ideal Response</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="How your agent should respond..."
                                className="min-h-24"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={exampleForm.control}
                          name="category"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="greeting">Greeting</SelectItem>
                                  <SelectItem value="product_inquiry">Product Inquiry</SelectItem>
                                  <SelectItem value="pricing">Pricing Question</SelectItem>
                                  <SelectItem value="support">Support Request</SelectItem>
                                  <SelectItem value="complaint">Complaint Handling</SelectItem>
                                  <SelectItem value="lead_qualification">Lead Qualification</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={exampleForm.control}
                          name="weight"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Importance (1-10)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  min="1" 
                                  max="10" 
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value))}
                                />
                              </FormControl>
                              <FormDescription>Higher numbers = more important</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setShowExampleDialog(false)}>
                          Cancel
                        </Button>
                        <Button type="submit">Add Example</Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4">
              {trainingExamples.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <MessageSquare className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-600 text-center">
                      No training examples yet. Add some example conversations to improve your agent's responses.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                trainingExamples.map((example) => (
                  <Card key={example.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex gap-2">
                          <Badge variant="outline">{example.category}</Badge>
                          <Badge variant="secondary">Weight: {example.weight}</Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTrainingExamples(prev => prev.filter(e => e.id !== example.id))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h5 className="font-medium text-sm text-gray-600 mb-1">Customer Input:</h5>
                        <p className="text-gray-900 bg-gray-50 p-3 rounded">{example.input}</p>
                      </div>
                      <div>
                        <h5 className="font-medium text-sm text-gray-600 mb-1">Expected Response:</h5>
                        <p className="text-gray-900 bg-blue-50 p-3 rounded">{example.expectedOutput}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {trainingExamples.length >= 5 && (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertDescription>
                  Great! You have {trainingExamples.length} training examples. You can now proceed to configure brand voice and start training.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Brand Voice Tab */}
          <TabsContent value="voice" className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">Brand Voice & Communication Style</h3>
              <p className="text-sm text-gray-600">Define how your agent should communicate to match your brand</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Brand Voice
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...brandVoiceForm}>
                    <div className="space-y-4">
                      <FormField
                        control={brandVoiceForm.control}
                        name="tone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tone</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select tone" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="professional">Professional</SelectItem>
                                <SelectItem value="friendly">Friendly</SelectItem>
                                <SelectItem value="casual">Casual</SelectItem>
                                <SelectItem value="formal">Formal</SelectItem>
                                <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                                <SelectItem value="empathetic">Empathetic</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={brandVoiceForm.control}
                        name="personality"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Personality</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select personality" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="helpful">Helpful</SelectItem>
                                <SelectItem value="witty">Witty</SelectItem>
                                <SelectItem value="authoritative">Authoritative</SelectItem>
                                <SelectItem value="warm">Warm</SelectItem>
                                <SelectItem value="direct">Direct</SelectItem>
                                <SelectItem value="patient">Patient</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={brandVoiceForm.control}
                        name="communicationStyle"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Communication Style</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select style" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="concise">Concise</SelectItem>
                                <SelectItem value="detailed">Detailed</SelectItem>
                                <SelectItem value="conversational">Conversational</SelectItem>
                                <SelectItem value="technical">Technical</SelectItem>
                                <SelectItem value="simple">Simple Language</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </Form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Communication Guidelines</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...brandVoiceForm}>
                    <div className="space-y-4">
                      <FormField
                        control={brandVoiceForm.control}
                        name="dosList"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Always Do</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="e.g., Use customer's name, Offer help immediately, Provide specific examples"
                                {...field} 
                              />
                            </FormControl>
                            <FormDescription>Comma-separated list of things to always do</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={brandVoiceForm.control}
                        name="dontsList"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Never Do</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="e.g., Use technical jargon, Make promises we can't keep, Be pushy"
                                {...field} 
                              />
                            </FormControl>
                            <FormDescription>Comma-separated list of things to never do</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </Form>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Business Context</CardTitle>
                <CardDescription>Provide context about your business to help the agent understand your industry and goals</CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...businessContextForm}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={businessContextForm.control}
                      name="industry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Industry</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., SaaS, E-commerce, Healthcare" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={businessContextForm.control}
                      name="companySize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Size</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select size" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="startup">Startup (1-10)</SelectItem>
                              <SelectItem value="small">Small (11-50)</SelectItem>
                              <SelectItem value="medium">Medium (51-200)</SelectItem>
                              <SelectItem value="large">Large (201-1000)</SelectItem>
                              <SelectItem value="enterprise">Enterprise (1000+)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={businessContextForm.control}
                      name="targetAudience"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Target Audience</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Small business owners, Tech professionals" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={businessContextForm.control}
                      name="keyProducts"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Key Products/Services</FormLabel>
                          <FormControl>
                            <Input placeholder="Product 1, Product 2, Service 1" {...field} />
                          </FormControl>
                          <FormDescription>Comma-separated list</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={businessContextForm.control}
                    name="valueProposition"
                    render={({ field }) => (
                      <FormItem className="mt-4">
                        <FormLabel>Value Proposition</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="What makes your business unique and valuable to customers?"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </Form>
              </CardContent>
            </Card>

            {trainingExamples.length >= 5 && (
              <div className="flex justify-center">
                <Button 
                  size="lg" 
                  onClick={handleStartTraining}
                  disabled={startTrainingMutation.isPending}
                  className="min-w-48"
                >
                  <Zap className="h-5 w-5 mr-2" />
                  {startTrainingMutation.isPending ? "Starting Training..." : "Start AI Training"}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Platform Training Guide Tab */}
          <TabsContent value="platforms" className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Platform-Specific Training</h3>
              <p className="text-sm text-gray-600">Optimize your agent for each messaging platform's unique features and user expectations</p>
            </div>

            {agentDetails && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    Selected Platform: {agentDetails.platformType}
                  </CardTitle>
                  <CardDescription>
                    Training recommendations and analytics for your agent's primary platform
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PlatformTrainingGuide 
                    agentId={selectedAgent} 
                    selectedPlatform={agentDetails.platformType} 
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Multi-Platform Training Tips</CardTitle>
                <CardDescription>
                  How AI training adapts across different messaging platforms
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 border rounded-lg">
                    <h5 className="font-medium mb-2">WhatsApp Business</h5>
                    <ul className="text-sm space-y-1 text-gray-600">
                      <li>• Interactive buttons for quick responses</li>
                      <li>• Rich media support with images/documents</li>
                      <li>• Business profile integration</li>
                      <li>• Customer service focus</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h5 className="font-medium mb-2">Telegram Bot</h5>
                    <ul className="text-sm space-y-1 text-gray-600">
                      <li>• Inline keyboards and commands</li>
                      <li>• Group chat management</li>
                      <li>• File sharing capabilities</li>
                      <li>• Technical community support</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h5 className="font-medium mb-2">Discord Bot</h5>
                    <ul className="text-sm space-y-1 text-gray-600">
                      <li>• Embed messages with rich content</li>
                      <li>• Server-specific customization</li>
                      <li>• Gaming community integration</li>
                      <li>• Voice channel announcements</li>
                    </ul>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h5 className="font-medium mb-2">Facebook Messenger</h5>
                    <ul className="text-sm space-y-1 text-gray-600">
                      <li>• Generic templates for showcases</li>
                      <li>• Quick replies for navigation</li>
                      <li>• Social media integration</li>
                      <li>• Lead generation focus</li>
                    </ul>
                  </div>
                </div>

                <Alert>
                  <Brain className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Custom Training Adaptation:</strong> Your agent automatically adapts its responses 
                    based on the platform. The same training data produces different response formats optimized 
                    for each platform's capabilities and user expectations.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Sources Tab */}
          <TabsContent value="sources" className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Data Source Integrations</h3>
              <p className="text-sm text-gray-600">Connect external data sources to automatically enhance your agent's knowledge and training</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    File Imports
                  </CardTitle>
                  <CardDescription>
                    Import training data and knowledge from files
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg">
                      <h5 className="font-medium">CSV Training Data</h5>
                      <p className="text-sm text-gray-600 mb-2">
                        Import conversation examples from CSV files
                      </p>
                      <Button size="sm" variant="outline">
                        <Upload className="h-4 w-4 mr-2" />
                        Import CSV
                      </Button>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <h5 className="font-medium">JSON Knowledge Base</h5>
                      <p className="text-sm text-gray-600 mb-2">
                        Import structured knowledge from JSON files
                      </p>
                      <Button size="sm" variant="outline">
                        <Upload className="h-4 w-4 mr-2" />
                        Import JSON
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    CRM Systems
                  </CardTitle>
                  <CardDescription>
                    Connect to your customer relationship management systems
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg">
                      <h5 className="font-medium">Salesforce</h5>
                      <p className="text-sm text-gray-600 mb-2">
                        Import customer interactions and knowledge articles
                      </p>
                      <Button size="sm" variant="outline">
                        Connect Salesforce
                      </Button>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <h5 className="font-medium">HubSpot</h5>
                      <p className="text-sm text-gray-600 mb-2">
                        Sync customer conversations and support tickets
                      </p>
                      <Button size="sm" variant="outline">
                        Connect HubSpot
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Help Desk Systems
                  </CardTitle>
                  <CardDescription>
                    Import support tickets and knowledge base articles
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg">
                      <h5 className="font-medium">Zendesk</h5>
                      <p className="text-sm text-gray-600 mb-2">
                        Import tickets and help center articles
                      </p>
                      <Button size="sm" variant="outline">
                        Connect Zendesk
                      </Button>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <h5 className="font-medium">Intercom</h5>
                      <p className="text-sm text-gray-600 mb-2">
                        Sync conversations and resolution bot articles
                      </p>
                      <Button size="sm" variant="outline">
                        Connect Intercom
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-5 w-5" />
                    Real-Time Learning
                  </CardTitle>
                  <CardDescription>
                    Automatically learn from live conversations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 border rounded-lg">
                    <h5 className="font-medium">Conversation Learning</h5>
                    <p className="text-sm text-gray-600 mb-3">
                      Automatically extract training examples from successful conversations
                    </p>
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" className="rounded" />
                        <span className="text-sm">Auto-approve high-rated conversations</span>
                      </label>
                      <label className="flex items-center space-x-2">
                        <input type="checkbox" className="rounded" />
                        <span className="text-sm">Learn from positive feedback</span>
                      </label>
                    </div>
                    <Button size="sm" className="mt-3">
                      Enable Learning
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>External Integrations</CardTitle>
                <CardDescription>
                  Additional data sources and integrations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 border rounded-lg text-center">
                    <Globe className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                    <h5 className="font-medium">Website Scraping</h5>
                    <p className="text-sm text-gray-600 mb-3">
                      Extract content from your website pages
                    </p>
                    <Button size="sm" variant="outline">
                      Setup Scraper
                    </Button>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-green-600" />
                    <h5 className="font-medium">Google Sheets</h5>
                    <p className="text-sm text-gray-600 mb-3">
                      Import data directly from Google Sheets
                    </p>
                    <Button size="sm" variant="outline">
                      Connect Sheets
                    </Button>
                  </div>
                  <div className="p-4 border rounded-lg text-center">
                    <Download className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                    <h5 className="font-medium">API Webhooks</h5>
                    <p className="text-sm text-gray-600 mb-3">
                      Receive real-time data via webhooks
                    </p>
                    <Button size="sm" variant="outline">
                      Setup Webhook
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Alert>
              <Brain className="h-4 w-4" />
              <AlertDescription>
                <strong>Connected Data Sources:</strong> All imported data is automatically processed with OpenAI embeddings 
                for semantic search and integrated into your agent's knowledge base. The system maintains data lineage 
                and allows you to track which responses use which data sources.
              </AlertDescription>
            </Alert>
          </TabsContent>

          {/* Training Sessions Tab */}
          <TabsContent value="sessions" className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Training Sessions</h3>
              <p className="text-sm text-gray-600">Monitor and manage your agent's training progress</p>
            </div>

            <div className="grid gap-4">
              {sessionsLoading ? (
                <div>Loading training sessions...</div>
              ) : trainingSessions.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-gray-600 text-center">
                      No training sessions yet. Complete the training setup to start your first session.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                trainingSessions.map((session: any) => (
                  <Card key={session.id}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{session.sessionName}</CardTitle>
                          <p className="text-sm text-gray-600">
                            Created {new Date(session.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge 
                          variant={
                            session.status === 'completed' ? 'default' :
                            session.status === 'processing' ? 'secondary' :
                            session.status === 'failed' ? 'destructive' : 'outline'
                          }
                        >
                          {session.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {session.status === 'processing' && (
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span>Training Progress</span>
                            <span>{session.progressPercentage}%</span>
                          </div>
                          <Progress value={session.progressPercentage} />
                        </div>
                      )}
                      
                      {session.metrics && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-gray-600">Accuracy</p>
                            <p className="font-semibold">{(session.metrics.accuracy * 100).toFixed(1)}%</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Data Points</p>
                            <p className="font-semibold">{session.metrics.dataPoints}</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Training Time</p>
                            <p className="font-semibold">{Math.round(session.metrics.trainingTime / 60)} min</p>
                          </div>
                          <div>
                            <p className="text-gray-600">Improvement</p>
                            <p className="font-semibold">{(session.metrics.improvementScore * 100).toFixed(1)}%</p>
                          </div>
                        </div>
                      )}

                      {session.errorLog && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>{session.errorLog}</AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}