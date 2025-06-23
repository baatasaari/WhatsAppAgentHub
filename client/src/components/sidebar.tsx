import { useLocation, Link } from "wouter";
import { Bot, Home, Plus, BarChart3, Code, User, Eye, Settings, Smartphone, TestTube, MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const getNavigationForRole = (userRole: string) => {
  const baseNavigation = [
    { name: "Dashboard", href: "/", icon: Home },
    { name: "My Agents", href: "/agents", icon: Bot },
    { name: "Create Agent", href: "/create", icon: Plus },
    { name: "Widget Preview", href: "/preview", icon: Eye },
    { name: "Embed Code", href: "/embed-code", icon: Code },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
    { name: "Platform Test", href: "/test", icon: TestTube },
  ];

  // System Admin gets access to all features including model configuration
  if (userRole === 'system_admin') {
    return [
      ...baseNavigation,
      { name: "Model Config", href: "/model-config", icon: Settings },
    ];
  }

  // Business Manager and Business User get standard features
  return baseNavigation;
};

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const navigation = getNavigationForRole(user?.role || 'business_user');

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  return (
    <div className="w-64 bg-white shadow-sm border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">AgentFlow</h1>
            <p className="text-xs text-gray-500">Agentic Workflows</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`nav-item ${isActive(item.href) ? 'active' : ''}`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-gray-200">
        <Link href="/settings" className="flex items-center space-x-3 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer">
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-gray-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">
              {user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Loading...'}
            </p>
            <p className="text-xs text-gray-500">{user?.email || 'Loading...'}</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
