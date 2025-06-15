import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Rocket, Plus, Phone, MessageCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

const createAgentSchema = z.object({
  name: z.string().min(1, "Agent name is required"),
  businessCategory: z.string().optional(),
  llmProvider: z.string().min(1, "LLM provider is required"),
  systemPrompt: z.string().min(10, "System prompt must be at least 10 characters"),
  leadQualificationQuestions: z.array(z.string()).default([]),
  voiceProvider: z.string().default("elevenlabs"),
  voiceModel: z.string().default("professional-male"),
  callScript: z.string().optional(),
  widgetPosition: z.string().default("bottom-right"),
  widgetColor: z.string().default("#25D366"),
  welcomeMessage: z.string().default("Hi! How can I help you today?"),
  whatsappNumber: z.string().optional(),
  whatsappMode: z.string().default("web"),
  status: z.string().default("active"),
});

type CreateAgentForm = z.infer<typeof createAgentSchema>;

export default function CreateAgent() {
  const [, setLocation] = useLocation();
  const [selectedLLM, setSelectedLLM] = useState("");
  const [qualificationQuestions, setQualificationQuestions] = useState<string[]>([]);
  const { toast } = useToast();

  const form = useForm<CreateAgentForm>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: {
      name: "",
      businessCategory: "",
      llmProvider: "",
      systemPrompt: "",
      leadQualificationQuestions: [],
      voiceProvider: "elevenlabs",
      voiceModel: "professional-male",
      callScript: "",
      widgetPosition: "bottom-right",
      widgetColor: "#25D366",
      welcomeMessage: "Hi! How can I help you today?",
      status: "active",
    },
  });

  const createAgentMutation = useMutation({
    mutationFn: async (data: CreateAgentForm) => {
      return await apiRequest("POST", "/api/agents", data);
    },
    onSuccess: (newAgent: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({ title: "Agent created successfully! Your embed code is ready." });
      // Redirect to embed code page with the new agent
      setLocation(`/embed-code?agentId=${newAgent.id}`);
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to create agent", 
        description: error.message,
        variant: "destructive" 
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
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="E-commerce">E-commerce</SelectItem>
                            <SelectItem value="Real Estate">Real Estate</SelectItem>
                            <SelectItem value="Healthcare">Healthcare</SelectItem>
                            <SelectItem value="Education">Education</SelectItem>
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
                      {[
                        { id: "gpt-4o", name: "OpenAI GPT-4o", desc: "Most capable model for complex conversations", badge: "Recommended", badgeColor: "text-green-600" },
                        { id: "claude-3", name: "Claude-3 Sonnet", desc: "Great for reasoning and analysis", badge: "Fast & Reliable", badgeColor: "text-blue-600" },
                        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", desc: "Cost-effective for simple tasks", badge: "Budget Friendly", badgeColor: "text-orange-600" },
                      ].map((llm) => (
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
                          <p className="text-sm text-gray-600">{llm.desc}</p>
                          <p className={`text-xs mt-2 ${llm.badgeColor}`}>{llm.badge}</p>
                        </div>
                      ))}
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
