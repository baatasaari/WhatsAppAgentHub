import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Copy } from "lucide-react";

interface WhatsAppStatus {
  configured: boolean;
  issues: string[];
  webhookUrl: string;
  requirements: {
    whatsappNumber: boolean;
    accessToken: boolean;
    phoneNumberId: boolean;
    webhookVerifyToken: boolean;
    businessAccountId: boolean;
  };
}

interface TestResult {
  name: string;
  passed: boolean;
  issues: string[];
}

interface TestResults {
  success: boolean;
  tests: TestResult[];
  summary: string;
  webhookUrl: string;
}

export default function WhatsAppDiagnostics({ agentId }: { agentId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [testing, setTesting] = useState(false);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: [`/api/agents/${agentId}/whatsapp-status`],
    enabled: !!agentId,
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/agents/${agentId}/test-whatsapp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Test completed",
        description: "WhatsApp integration test results are available below.",
      });
    },
    onError: (error) => {
      toast({
        title: "Test failed",
        description: "Failed to run WhatsApp integration test.",
        variant: "destructive",
      });
    },
  });

  const copyWebhookUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({
      title: "Copied",
      description: "Webhook URL copied to clipboard.",
    });
  };

  const runTest = () => {
    setTesting(true);
    testMutation.mutate();
    setTimeout(() => setTesting(false), 2000);
  };

  if (statusLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Loading WhatsApp status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const whatsappStatus = status as WhatsAppStatus;
  const testResults = testMutation.data as TestResults;

  return (
    <div className="space-y-6">
      {/* Configuration Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            {whatsappStatus?.configured ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <span>WhatsApp Integration Status</span>
          </CardTitle>
          <CardDescription>
            Current configuration status for WhatsApp Business API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {whatsappStatus?.configured ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                WhatsApp Business API is properly configured and ready to use.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                WhatsApp Business API is not configured. Please set up the required credentials.
              </AlertDescription>
            </Alert>
          )}

          {/* Requirements Checklist */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">WhatsApp Number</span>
              <Badge variant={whatsappStatus?.requirements?.whatsappNumber ? "default" : "destructive"}>
                {whatsappStatus?.requirements?.whatsappNumber ? "Configured" : "Missing"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Access Token</span>
              <Badge variant={whatsappStatus?.requirements?.accessToken ? "default" : "destructive"}>
                {whatsappStatus?.requirements?.accessToken ? "Configured" : "Missing"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Phone Number ID</span>
              <Badge variant={whatsappStatus?.requirements?.phoneNumberId ? "default" : "destructive"}>
                {whatsappStatus?.requirements?.phoneNumberId ? "Configured" : "Missing"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Webhook Token</span>
              <Badge variant={whatsappStatus?.requirements?.webhookVerifyToken ? "default" : "destructive"}>
                {whatsappStatus?.requirements?.webhookVerifyToken ? "Configured" : "Missing"}
              </Badge>
            </div>
          </div>

          {/* Issues List */}
          {whatsappStatus?.issues && whatsappStatus.issues.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-red-600">Configuration Issues:</h4>
              <ul className="text-sm space-y-1">
                {whatsappStatus.issues.map((issue, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <XCircle className="w-3 h-3 text-red-500" />
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Webhook URL */}
          {whatsappStatus?.webhookUrl && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Webhook URL:</h4>
              <div className="flex items-center space-x-2 p-2 bg-gray-50 rounded border">
                <code className="text-xs flex-1 break-all">{whatsappStatus.webhookUrl}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyWebhookUrl(whatsappStatus.webhookUrl)}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Integration */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Testing</CardTitle>
          <CardDescription>
            Test your WhatsApp Business API configuration and connectivity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={runTest} 
            disabled={testing || testMutation.isPending}
            className="w-full"
          >
            {testing || testMutation.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Running Tests...
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 mr-2" />
                Run Integration Test
              </>
            )}
          </Button>

          {/* Test Results */}
          {testResults && (
            <div className="space-y-4">
              <Alert variant={testResults.success ? "default" : "destructive"}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{testResults.summary}</AlertDescription>
              </Alert>

              <div className="space-y-3">
                {testResults.tests.map((test, index) => (
                  <Card key={index} className="border-l-4" style={{
                    borderLeftColor: test.passed ? '#10b981' : '#ef4444'
                  }}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{test.name}</h4>
                        <Badge variant={test.passed ? "default" : "destructive"}>
                          {test.passed ? "Passed" : "Failed"}
                        </Badge>
                      </div>
                      <ul className="text-sm space-y-1">
                        {test.issues.map((issue, issueIndex) => (
                          <li key={issueIndex} className="flex items-center space-x-2">
                            {test.passed ? (
                              <CheckCircle className="w-3 h-3 text-green-500" />
                            ) : (
                              <XCircle className="w-3 h-3 text-red-500" />
                            )}
                            <span>{issue}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {testResults.webhookUrl && (
                <div className="p-4 bg-blue-50 rounded border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">Next Steps:</h4>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Configure your WhatsApp Business API credentials in the agent settings</li>
                    <li>Set up the webhook URL in your WhatsApp Business dashboard: <code className="bg-white px-1 rounded">{testResults.webhookUrl}</code></li>
                    <li>Use a strong verification token and update it in your agent configuration</li>
                    <li>Test the integration again to verify everything works</li>
                  </ol>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}