import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const pageData = {
  "/": {
    title: "Dashboard",
    subtitle: "Overview of your agentic workflows"
  },
  "/agents": {
    title: "My Agents",
    subtitle: "Manage and monitor your AI agents"
  },
  "/create": {
    title: "Create Agent",
    subtitle: "Build a new agentic workflow"
  },
  "/analytics": {
    title: "Analytics",
    subtitle: "Performance insights and metrics"
  },
  "/embed": {
    title: "Embed Code",
    subtitle: "Generate code for your website"
  }
};

export default function Header() {
  const [location, setLocation] = useLocation();
  
  const currentPage = pageData[location as keyof typeof pageData] || pageData["/"];

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{currentPage.title}</h2>
          <p className="text-gray-600">{currentPage.subtitle}</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button 
            onClick={() => setLocation("/create")}
            className="bg-primary hover:bg-primary-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Agent
          </Button>
        </div>
      </div>
    </header>
  );
}
