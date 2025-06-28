import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, User, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const pageData = {
  "/": {
    title: "Dashboard",
    subtitle: "Overview of your agentic workflows"
  },
  "/agents": {
    title: "My Agents",
    subtitle: "Manage and monitor your AI agents"
  },
  "/wizard": {
    title: "Agent Wizard",
    subtitle: "Build a new agentic workflow"
  },
  "/ai-training": {
    title: "AI Training",
    subtitle: "Train your agents with custom knowledge"
  },
  "/business-onboarding": {
    title: "Business Onboarding", 
    subtitle: "Complete your business setup"
  },
  "/business-templates": {
    title: "Business Templates",
    subtitle: "Choose pre-built agent templates"
  },
  "/conversation-flow-designer": {
    title: "Conversation Designer",
    subtitle: "Design conversation flows"
  },
  "/voice-calling": {
    title: "Voice Calling",
    subtitle: "AI voice call management"
  },
  "/test": {
    title: "Platform Test",
    subtitle: "Test platform integrations"
  },
  "/whatsapp-config": {
    title: "WhatsApp Config",
    subtitle: "Configure WhatsApp Business API"
  },
  "/whatsapp-diagnostics": {
    title: "WhatsApp Diagnostics", 
    subtitle: "Diagnose WhatsApp integration"
  },
  "/system-logs": {
    title: "System Logs",
    subtitle: "Monitor system activity"
  },
  "/settings": {
    title: "Settings",
    subtitle: "Manage your account and preferences"
  },
  "/analytics": {
    title: "Analytics",
    subtitle: "Performance insights and metrics"
  },
  "/embed-code": {
    title: "Embed Code",
    subtitle: "Generate code for your website"
  },
  "/model-config": {
    title: "Model Configuration",
    subtitle: "Manage AI models and settings"
  }
};

export default function Header() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  
  const currentPage = pageData[location as keyof typeof pageData] || pageData["/"];

  const handleLogout = async () => {
    try {
      // Call backend logout endpoint
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
    } catch (error) {
      console.log('Logout API call failed, proceeding with local logout');
    }
    
    // Always clear local state
    logout();
    window.location.href = '/login';
  };

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{currentPage.title}</h2>
            <p className="text-gray-600">{currentPage.subtitle}</p>
          </div>
          {user?.role === 'admin' && (
            <Badge variant="secondary" className="text-xs">
              Admin
            </Badge>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <Button 
            onClick={() => setLocation("/wizard")}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Agent Wizard
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              {user?.role === 'admin' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>User Management</DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
