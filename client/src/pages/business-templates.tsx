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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Store, Code, Utensils, Briefcase, Building, Search, Sparkles, ArrowRight } from "lucide-react";

const categoryIcons = {
  ecommerce: Store,
  saas: Code,
  restaurant: Utensils,
  services: Briefcase,
  real_estate: Building,
};

const categoryColors = {
  ecommerce: "bg-orange-100 text-orange-800",
  saas: "bg-blue-100 text-blue-800", 
  restaurant: "bg-amber-100 text-amber-800",
  services: "bg-purple-100 text-purple-800",
  real_estate: "bg-green-100 text-green-800",
};

export default function BusinessTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [customizationData, setCustomizationData] = useState({
    businessName: "",
    website: "",
    phone: "",
    email: "",
    brandColor: "#25D366",
  });
  const [searchQuery, setSearchQuery] = useState("");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['/api/business-templates'],
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['/api/business-templates/categories'],
  });

  const customizeMutation = useMutation({
    mutationFn: async (data: { templateName: string; businessData: any }) => {
      return await apiRequest(`/api/business-templates/${data.templateName}/customize`, {
        method: 'POST',
        body: JSON.stringify(data.businessData),
      });
    },
    onSuccess: (customizedTemplate) => {
      toast({
        title: "Template Customized",
        description: "Your business template has been customized successfully!",
      });
      
      // Navigate to create agent with pre-filled data
      const agentData = {
        name: `${customizationData.businessName} Assistant`,
        description: customizedTemplate.description,
        systemPrompt: customizedTemplate.systemPrompt,
        welcomeMessage: customizedTemplate.welcomeMessage,
        businessCategory: customizedTemplate.category,
        businessType: customizedTemplate.category,
        businessWebsite: customizationData.website,
        contactInfo: {
          email: customizationData.email,
          phone: customizationData.phone,
        },
        faqData: customizedTemplate.sampleFaqs,
        productCatalog: customizedTemplate.sampleProducts,
        leadQualificationQuestions: customizedTemplate.leadQualificationFlow,
        customBranding: {
          primaryColor: customizationData.brandColor,
          companyName: customizationData.businessName,
        },
        widgetColor: customizedTemplate.customizations.widgetColor,
      };
      
      // Store in localStorage and redirect to create agent
      localStorage.setItem('templateAgentData', JSON.stringify(agentData));
      window.location.href = '/create?fromTemplate=true';
    },
    onError: (error: any) => {
      toast({
        title: "Customization Failed",
        description: error.message || "Failed to customize template",
        variant: "destructive",
      });
    },
  });

  const filteredTemplates = templates.filter((template: any) =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCustomizeTemplate = () => {
    if (!selectedTemplate) return;
    
    customizeMutation.mutate({
      templateName: selectedTemplate.name,
      businessData: customizationData,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading business templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-900">Business Templates</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Jump-start your WhatsApp widget with industry-specific templates. Pre-configured prompts, FAQs, and lead qualification flows designed for your business type.
          </p>
        </div>

        {/* Search */}
        <div className="max-w-md mx-auto mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {categories.map((category: string) => {
            const Icon = categoryIcons[category as keyof typeof categoryIcons];
            return (
              <Badge
                key={category}
                variant="outline"
                className={`cursor-pointer px-4 py-2 ${categoryColors[category as keyof typeof categoryColors]}`}
              >
                {Icon && <Icon className="w-4 h-4 mr-2" />}
                {category.replace('_', ' ').toUpperCase()}
              </Badge>
            );
          })}
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template: any) => {
            const Icon = categoryIcons[template.category as keyof typeof categoryIcons];
            return (
              <Card key={template.name} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      {Icon && <Icon className="w-6 h-6 text-blue-600" />}
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <Badge 
                          variant="secondary" 
                          className={`mt-1 ${categoryColors[template.category as keyof typeof categoryColors]}`}
                        >
                          {template.category.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <CardDescription className="mt-3">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Sample Features */}
                    <div>
                      <h4 className="font-medium text-sm text-gray-900 mb-2">Includes:</h4>
                      <ul className="text-sm text-gray-600 space-y-1">
                        <li>• {template.sampleFaqs?.length || 0} pre-written FAQs</li>
                        <li>• {template.sampleProducts?.length || 0} sample products/services</li>
                        <li>• Lead qualification flow</li>
                        <li>• Industry-specific prompts</li>
                      </ul>
                    </div>

                    {/* Sample Welcome Message */}
                    <div>
                      <h4 className="font-medium text-sm text-gray-900 mb-2">Welcome Message:</h4>
                      <p className="text-sm text-gray-600 italic line-clamp-2">
                        "{template.welcomeMessage}"
                      </p>
                    </div>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          className="w-full"
                          onClick={() => setSelectedTemplate(template)}
                        >
                          Customize Template
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Customize {template.name} Template</DialogTitle>
                          <DialogDescription>
                            Personalize this template with your business information to create a tailored WhatsApp agent.
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-6 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="businessName">Business Name</Label>
                              <Input
                                id="businessName"
                                placeholder="Your Business Name"
                                value={customizationData.businessName}
                                onChange={(e) => setCustomizationData(prev => ({
                                  ...prev,
                                  businessName: e.target.value
                                }))}
                              />
                            </div>
                            <div>
                              <Label htmlFor="website">Website</Label>
                              <Input
                                id="website"
                                placeholder="https://yourbusiness.com"
                                value={customizationData.website}
                                onChange={(e) => setCustomizationData(prev => ({
                                  ...prev,
                                  website: e.target.value
                                }))}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="email">Email</Label>
                              <Input
                                id="email"
                                type="email"
                                placeholder="contact@yourbusiness.com"
                                value={customizationData.email}
                                onChange={(e) => setCustomizationData(prev => ({
                                  ...prev,
                                  email: e.target.value
                                }))}
                              />
                            </div>
                            <div>
                              <Label htmlFor="phone">Phone</Label>
                              <Input
                                id="phone"
                                placeholder="+1 (555) 123-4567"
                                value={customizationData.phone}
                                onChange={(e) => setCustomizationData(prev => ({
                                  ...prev,
                                  phone: e.target.value
                                }))}
                              />
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="brandColor">Brand Color</Label>
                            <div className="flex items-center space-x-3 mt-1">
                              <Input
                                id="brandColor"
                                type="color"
                                value={customizationData.brandColor}
                                onChange={(e) => setCustomizationData(prev => ({
                                  ...prev,
                                  brandColor: e.target.value
                                }))}
                                className="w-16 h-10"
                              />
                              <Input
                                value={customizationData.brandColor}
                                onChange={(e) => setCustomizationData(prev => ({
                                  ...prev,
                                  brandColor: e.target.value
                                }))}
                                placeholder="#25D366"
                                className="flex-1"
                              />
                            </div>
                          </div>

                          <div className="pt-4 border-t">
                            <Button 
                              onClick={handleCustomizeTemplate}
                              disabled={!customizationData.businessName || customizeMutation.isPending}
                              className="w-full"
                            >
                              {customizeMutation.isPending ? "Customizing..." : "Create Agent from Template"}
                              <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
            <p className="text-gray-600">Try adjusting your search or browse all categories.</p>
          </div>
        )}
      </div>
    </div>
  );
}