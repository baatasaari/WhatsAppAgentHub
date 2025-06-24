import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Building2, 
  Users, 
  MessageSquare, 
  Settings, 
  CheckCircle, 
  ArrowLeft, 
  ArrowRight,
  Save,
  Play,
  Clock,
  Target,
  Globe,
  Phone,
  Mail
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: React.ElementType;
  fields: string[];
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: 1,
    title: "Business Information",
    description: "Tell us about your business and what you do",
    icon: Building2,
    fields: ["companyName", "industry", "businessSize", "website", "description"]
  },
  {
    id: 2,
    title: "Contact Details",
    description: "How can customers reach you?",
    icon: Phone,
    fields: ["primaryPhone", "supportEmail", "businessAddress", "operatingHours"]
  },
  {
    id: 3,
    title: "Target Audience",
    description: "Who are your ideal customers?",
    icon: Users,
    fields: ["targetMarket", "customerDemographics", "marketingGoals", "currentChannels"]
  },
  {
    id: 4,
    title: "Platform Selection",
    description: "Choose your messaging platforms",
    icon: MessageSquare,
    fields: ["platforms", "primaryPlatform", "platformGoals", "expectedVolume"]
  },
  {
    id: 5,
    title: "AI Configuration",
    description: "Customize your AI assistant behavior",
    icon: Settings,
    fields: ["aiPersonality", "businessTone", "keyMessages", "specialInstructions"]
  }
];

const industryOptions = [
  "E-Commerce & Retail", "Healthcare", "Financial Services", "Real Estate",
  "Education", "Technology", "Food & Beverage", "Travel & Hospitality",
  "Professional Services", "Manufacturing", "Automotive", "Other"
];

const businessSizeOptions = [
  "Solo entrepreneur", "Small team (2-10)", "Growing business (11-50)", 
  "Medium business (51-200)", "Large enterprise (200+)"
];

const platformOptions = [
  { id: "whatsapp", name: "WhatsApp Business", description: "Most popular messaging platform" },
  { id: "telegram", name: "Telegram", description: "Fast and secure messaging" },
  { id: "facebook-messenger", name: "Facebook Messenger", description: "Connect with Facebook users" },
  { id: "instagram", name: "Instagram Direct", description: "Engage with Instagram followers" },
  { id: "discord", name: "Discord", description: "Community-focused messaging" }
];

export default function BusinessOnboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const { toast } = useToast();

  // Fetch onboarding progress
  const { data: onboardingData, isLoading, error } = useQuery({
    queryKey: ["/api/onboarding"],
    retry: false,
  });

  // Load saved progress
  useEffect(() => {
    if (onboardingData) {
      setCurrentStep(onboardingData.currentStep || 1);
      setFormData(onboardingData.stepData || {});
      setCompletedSteps(onboardingData.completedSteps || []);
    }
  }, [onboardingData]);

  // Save step mutation
  const saveStepMutation = useMutation({
    mutationFn: async ({ step, stepData }: { step: number; stepData: any }) => {
      return await apiRequest("POST", "/api/onboarding/save-step", { step, stepData });
    },
    onSuccess: () => {
      toast({
        title: "Progress Saved",
        description: "Your onboarding progress has been saved.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save progress",
        variant: "destructive",
      });
    },
  });

  // Complete step mutation
  const completeStepMutation = useMutation({
    mutationFn: async (step: number) => {
      return await apiRequest("POST", "/api/onboarding/complete-step", { step });
    },
    onSuccess: () => {
      toast({
        title: "Step Completed",
        description: "Step marked as completed!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
    },
  });

  // Complete onboarding mutation
  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/onboarding/complete");
    },
    onSuccess: () => {
      toast({
        title: "Onboarding Complete!",
        description: "Welcome to AgentFlow! Your business setup is complete.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
    },
  });

  const updateFormData = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const saveCurrentStep = () => {
    const currentStepData = {};
    const currentStepFields = onboardingSteps.find(s => s.id === currentStep)?.fields || [];
    
    currentStepFields.forEach(field => {
      if (formData[field] !== undefined) {
        currentStepData[field] = formData[field];
      }
    });

    saveStepMutation.mutate({ step: currentStep, stepData: currentStepData });
  };

  const completeCurrentStep = () => {
    saveCurrentStep();
    completeStepMutation.mutate(currentStep);
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps(prev => [...prev, currentStep]);
    }
  };

  const nextStep = () => {
    if (currentStep < onboardingSteps.length) {
      completeCurrentStep();
      setCurrentStep(currentStep + 1);
    } else {
      completeOnboardingMutation.mutate();
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      saveCurrentStep();
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (step: number) => {
    saveCurrentStep();
    setCurrentStep(step);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                value={formData.companyName || ''}
                onChange={(e) => updateFormData('companyName', e.target.value)}
                placeholder="Enter your company name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry *</Label>
              <Select value={formData.industry || ''} onValueChange={(value) => updateFormData('industry', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your industry" />
                </SelectTrigger>
                <SelectContent>
                  {industryOptions.map(industry => (
                    <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessSize">Business Size *</Label>
              <Select value={formData.businessSize || ''} onValueChange={(value) => updateFormData('businessSize', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your business size" />
                </SelectTrigger>
                <SelectContent>
                  {businessSizeOptions.map(size => (
                    <SelectItem key={size} value={size}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={formData.website || ''}
                onChange={(e) => updateFormData('website', e.target.value)}
                placeholder="https://yourwebsite.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Business Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => updateFormData('description', e.target.value)}
                placeholder="Briefly describe what your business does..."
                rows={3}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="primaryPhone">Primary Phone Number *</Label>
              <Input
                id="primaryPhone"
                value={formData.primaryPhone || ''}
                onChange={(e) => updateFormData('primaryPhone', e.target.value)}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supportEmail">Support Email *</Label>
              <Input
                id="supportEmail"
                type="email"
                value={formData.supportEmail || ''}
                onChange={(e) => updateFormData('supportEmail', e.target.value)}
                placeholder="support@yourcompany.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessAddress">Business Address</Label>
              <Textarea
                id="businessAddress"
                value={formData.businessAddress || ''}
                onChange={(e) => updateFormData('businessAddress', e.target.value)}
                placeholder="Your business address..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="operatingHours">Operating Hours</Label>
              <Input
                id="operatingHours"
                value={formData.operatingHours || ''}
                onChange={(e) => updateFormData('operatingHours', e.target.value)}
                placeholder="Monday - Friday, 9 AM - 6 PM EST"
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="targetMarket">Target Market *</Label>
              <Textarea
                id="targetMarket"
                value={formData.targetMarket || ''}
                onChange={(e) => updateFormData('targetMarket', e.target.value)}
                placeholder="Describe your target market and ideal customers..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customerDemographics">Customer Demographics</Label>
              <Textarea
                id="customerDemographics"
                value={formData.customerDemographics || ''}
                onChange={(e) => updateFormData('customerDemographics', e.target.value)}
                placeholder="Age range, location, interests, etc..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="marketingGoals">Marketing Goals</Label>
              <Textarea
                id="marketingGoals"
                value={formData.marketingGoals || ''}
                onChange={(e) => updateFormData('marketingGoals', e.target.value)}
                placeholder="What do you want to achieve with messaging?"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentChannels">Current Marketing Channels</Label>
              <Input
                id="currentChannels"
                value={formData.currentChannels || ''}
                onChange={(e) => updateFormData('currentChannels', e.target.value)}
                placeholder="Email, social media, advertising, etc."
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <Label>Select Messaging Platforms *</Label>
              <div className="grid gap-3">
                {platformOptions.map(platform => (
                  <div key={platform.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Checkbox
                      id={platform.id}
                      checked={(formData.platforms || []).includes(platform.id)}
                      onCheckedChange={(checked) => {
                        const platforms = formData.platforms || [];
                        if (checked) {
                          updateFormData('platforms', [...platforms, platform.id]);
                        } else {
                          updateFormData('platforms', platforms.filter((p: string) => p !== platform.id));
                        }
                      }}
                    />
                    <div className="flex-1">
                      <Label htmlFor={platform.id} className="font-medium">
                        {platform.name}
                      </Label>
                      <p className="text-sm text-gray-500">{platform.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="primaryPlatform">Primary Platform</Label>
              <Select value={formData.primaryPlatform || ''} onValueChange={(value) => updateFormData('primaryPlatform', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose your main platform" />
                </SelectTrigger>
                <SelectContent>
                  {platformOptions.map(platform => (
                    <SelectItem key={platform.id} value={platform.id}>{platform.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expectedVolume">Expected Message Volume</Label>
              <Select value={formData.expectedVolume || ''} onValueChange={(value) => updateFormData('expectedVolume', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Estimated messages per month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (0-100 messages/month)</SelectItem>
                  <SelectItem value="medium">Medium (100-1000 messages/month)</SelectItem>
                  <SelectItem value="high">High (1000+ messages/month)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="aiPersonality">AI Personality *</Label>
              <Select value={formData.aiPersonality || ''} onValueChange={(value) => updateFormData('aiPersonality', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose AI personality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional & Formal</SelectItem>
                  <SelectItem value="friendly">Friendly & Casual</SelectItem>
                  <SelectItem value="helpful">Helpful & Supportive</SelectItem>
                  <SelectItem value="concise">Concise & Direct</SelectItem>
                  <SelectItem value="enthusiastic">Enthusiastic & Energetic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessTone">Business Tone</Label>
              <Select value={formData.businessTone || ''} onValueChange={(value) => updateFormData('businessTone', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select communication tone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corporate">Corporate</SelectItem>
                  <SelectItem value="startup">Startup</SelectItem>
                  <SelectItem value="creative">Creative</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keyMessages">Key Messages</Label>
              <Textarea
                id="keyMessages"
                value={formData.keyMessages || ''}
                onChange={(e) => updateFormData('keyMessages', e.target.value)}
                placeholder="Important points you want your AI to communicate..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialInstructions">Special Instructions</Label>
              <Textarea
                id="specialInstructions"
                value={formData.specialInstructions || ''}
                onChange={(e) => updateFormData('specialInstructions', e.target.value)}
                placeholder="Any specific instructions for your AI assistant..."
                rows={3}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading onboarding...</p>
        </div>
      </div>
    );
  }

  const progress = (currentStep / onboardingSteps.length) * 100;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Business Onboarding</h1>
        <p className="text-gray-600">Let's set up your AI-powered messaging platform</p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Step {currentStep} of {onboardingSteps.length}
          </span>
          <span className="text-sm text-gray-500">{Math.round(progress)}% complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step Navigation */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {onboardingSteps.map((step, index) => {
            const StepIcon = step.icon;
            const isCompleted = completedSteps.includes(step.id);
            const isCurrent = step.id === currentStep;
            const isAccessible = step.id <= currentStep || isCompleted;

            return (
              <div key={step.id} className="flex flex-col items-center flex-1">
                <button
                  onClick={() => isAccessible && goToStep(step.id)}
                  disabled={!isAccessible}
                  className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all ${
                    isCompleted
                      ? 'bg-green-100 text-green-600 border-2 border-green-600'
                      : isCurrent
                      ? 'bg-blue-100 text-blue-600 border-2 border-blue-600'
                      : isAccessible
                      ? 'bg-gray-100 text-gray-600 border-2 border-gray-300 hover:bg-gray-200'
                      : 'bg-gray-50 text-gray-400 border-2 border-gray-200 cursor-not-allowed'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="w-6 h-6" />
                  ) : (
                    <StepIcon className="w-6 h-6" />
                  )}
                </button>
                <span className={`text-xs text-center font-medium ${
                  isCurrent ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                }`}>
                  {step.title}
                </span>
                {index < onboardingSteps.length - 1 && (
                  <div className="w-full h-px bg-gray-200 mt-2" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-3">
            {React.createElement(onboardingSteps[currentStep - 1]?.icon, {
              className: "w-6 h-6 text-blue-600"
            })}
            <div>
              <CardTitle>{onboardingSteps[currentStep - 1]?.title}</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                {onboardingSteps[currentStep - 1]?.description}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {renderStepContent()}

          <Separator className="my-8" />

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous</span>
            </Button>

            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={saveCurrentStep}
                disabled={saveStepMutation.isPending}
                className="flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Progress</span>
              </Button>

              <Button
                onClick={nextStep}
                disabled={completeStepMutation.isPending || completeOnboardingMutation.isPending}
                className="flex items-center space-x-2"
              >
                {currentStep === onboardingSteps.length ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>Complete Onboarding</span>
                  </>
                ) : (
                  <>
                    <span>Next Step</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Auto-save indicator */}
      {saveStepMutation.isPending && (
        <div className="fixed bottom-4 right-4">
          <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
            <Clock className="w-4 h-4 animate-spin" />
            <span>Saving...</span>
          </div>
        </div>
      )}
    </div>
  );
}