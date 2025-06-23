import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Dashboard from "@/pages/dashboard";
import Agents from "@/pages/agents";
import CreateAgent from "@/pages/create-agent";
import Analytics from "@/pages/analytics";
import EmbedCode from "@/pages/embed-code";
import WidgetPreview from "@/pages/widget-preview";
import ModelConfig from "@/pages/model-config";
import PlatformTest from "@/pages/platform-test";
import WhatsAppConfig from "@/pages/whatsapp-config";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Register from "@/pages/register";
import BusinessTemplates from "@/pages/business-templates";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/register" component={Register} />
        <Route path="/login" component={Login} />
        <Route component={Login} />
      </Switch>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/business-templates" component={BusinessTemplates} />
            <Route path="/agents" component={Agents} />
            <Route path="/create" component={CreateAgent} />
            <Route path="/analytics" component={Analytics} />
            <Route path="/embed-code" component={EmbedCode} />
            <Route path="/preview" component={WidgetPreview} />
            <Route path="/model-config" component={ModelConfig} />
            <Route path="/whatsapp-config" component={WhatsAppConfig} />
            <Route path="/settings" component={Settings} />
            <Route path="/test" component={PlatformTest} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
