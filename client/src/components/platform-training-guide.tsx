import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { MessageSquare, Bot, TrendingUp, Target, CheckCircle, XCircle, Lightbulb, BarChart3 } from "lucide-react";

interface PlatformTrainingGuideProps {
  agentId: number;
  selectedPlatform: string;
}

export function PlatformTrainingGuide({ agentId, selectedPlatform }: PlatformTrainingGuideProps) {
  const [activeTab, setActiveTab] = useState("recommendations");

  // Get platform-specific recommendations
  const { data: recommendations, isLoading: recommendationsLoading } = useQuery({
    queryKey: [`/api/agents/${agentId}/platform-recommendations/${selectedPlatform}`],
    enabled: !!agentId && !!selectedPlatform,
  });

  // Get platform conversation analysis
  const { data: analysis, isLoading: analysisLoading } = useQuery({
    queryKey: [`/api/agents/${agentId}/platform-analysis/${selectedPlatform}`],
    enabled: !!agentId && !!selectedPlatform,
  });

  const platformConfig = {
    whatsapp: {
      name: "WhatsApp Business",
      color: "#25D366",
      icon: MessageSquare,
      description: "Direct customer communication with rich media support"
    },
    telegram: {
      name: "Telegram Bot",
      color: "#0088CC",
      icon: Bot,
      description: "Community engagement with advanced bot features"
    },
    discord: {
      name: "Discord Bot",
      color: "#5865F2",
      icon: Bot,
      description: "Gaming and community server integration"
    },
    facebook: {
      name: "Facebook Messenger",
      color: "#1877F2",
      icon: MessageSquare,
      description: "Social media customer engagement"
    },
    instagram: {
      name: "Instagram Direct",
      color: "#E4405F",
      icon: MessageSquare,
      description: "Visual-first brand communication"
    }
  };

  const platform = platformConfig[selectedPlatform as keyof typeof platformConfig];
  const PlatformIcon = platform?.icon || MessageSquare;

  if (!platform) {
    return (
      <Alert>
        <AlertDescription>
          Please select a platform to view training recommendations.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div 
          className="p-2 rounded-lg"
          style={{ backgroundColor: `${platform.color}20`, color: platform.color }}
        >
          <PlatformIcon className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">{platform.name} Training Guide</h3>
          <p className="text-sm text-gray-600">{platform.description}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="recommendations">Best Practices</TabsTrigger>
          <TabsTrigger value="training">Training Tips</TabsTrigger>
          <TabsTrigger value="analytics">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Platform Best Practices
              </CardTitle>
              <CardDescription>
                Optimize your agent for {platform.name} specific features and user expectations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recommendationsLoading ? (
                <div>Loading recommendations...</div>
              ) : recommendations ? (
                <div className="space-y-4">
                  <div>
                    <h5 className="font-medium mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Best Practices
                    </h5>
                    <ul className="space-y-2">
                      {recommendations.bestPractices?.map((practice: string, index: number) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                          {practice}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h5 className="font-medium mb-2 flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-blue-600" />
                      Brand Voice Recommendations
                    </h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-600 mb-2">Recommended Tones:</p>
                        <div className="flex flex-wrap gap-1">
                          {recommendations.brandVoice?.recommended?.map((tone: string) => (
                            <Badge key={tone} variant="default" className="text-xs">
                              {tone}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600 mb-2">Avoid:</p>
                        <div className="flex flex-wrap gap-1">
                          {recommendations.brandVoice?.avoid?.map((tone: string) => (
                            <Badge key={tone} variant="secondary" className="text-xs">
                              {tone}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>No recommendations available</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="training" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                Training Optimization
              </CardTitle>
              <CardDescription>
                Specific training scenarios and examples for {platform.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recommendationsLoading ? (
                <div>Loading training tips...</div>
              ) : recommendations ? (
                <div className="space-y-4">
                  <div>
                    <h5 className="font-medium mb-3">Training Scenarios</h5>
                    <ScrollArea className="h-64">
                      <div className="space-y-3">
                        {recommendations.trainingTips?.map((tip: string, index: number) => (
                          <div key={index} className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-start gap-2">
                              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-medium text-blue-600">{index + 1}</span>
                              </div>
                              <div>
                                <p className="text-sm font-medium">{tip}</p>
                                <p className="text-xs text-gray-600 mt-1">
                                  Add training examples covering this scenario
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  <Alert>
                    <Lightbulb className="h-4 w-4" />
                    <AlertDescription>
                      Focus your training examples on platform-specific interactions. 
                      Each platform has unique user expectations and communication patterns.
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <div>No training tips available</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Platform Performance
              </CardTitle>
              <CardDescription>
                Analyze how your agent performs on {platform.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analysisLoading ? (
                <div>Loading analytics...</div>
              ) : analysis ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: platform.color }}>
                        {analysis.totalConversations}
                      </div>
                      <div className="text-xs text-gray-600">Total Conversations</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {analysis.averageResponseTime}s
                      </div>
                      <div className="text-xs text-gray-600">Avg Response Time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {analysis.commonTopics?.length || 0}
                      </div>
                      <div className="text-xs text-gray-600">Common Topics</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {analysis.successPatterns?.length || 0}
                      </div>
                      <div className="text-xs text-gray-600">Success Patterns</div>
                    </div>
                  </div>

                  {analysis.platformSpecificMetrics && (
                    <div>
                      <h5 className="font-medium mb-3">Platform-Specific Metrics</h5>
                      <div className="space-y-3">
                        {Object.entries(analysis.platformSpecificMetrics).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-sm capitalize">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                            <div className="flex items-center gap-2 min-w-24">
                              <Progress 
                                value={typeof value === 'number' ? value * 100 : 0} 
                                className="w-16 h-2" 
                              />
                              <span className="text-sm font-medium min-w-12">
                                {typeof value === 'number' ? `${(value * 100).toFixed(0)}%` : value}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysis.improvementAreas && analysis.improvementAreas.length > 0 && (
                    <div>
                      <h5 className="font-medium mb-2 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-orange-600" />
                        Improvement Areas
                      </h5>
                      <ul className="space-y-1">
                        {analysis.improvementAreas.map((area: string, index: number) => (
                          <li key={index} className="text-sm text-gray-700 flex items-center gap-2">
                            <XCircle className="h-3 w-3 text-orange-500" />
                            {area}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No analytics data available yet</p>
                  <p className="text-sm text-gray-500">Start conversations to see performance metrics</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}