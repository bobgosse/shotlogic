import { LogOut, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logo from "@/assets/shotlogic-logo-netflix.png";
import { CreditsIndicator } from "./CreditsIndicator";

interface NavigationProps {
  onSignOut: () => void;
}

export const Navigation = ({ onSignOut }: NavigationProps) => {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-8 h-28 flex items-center justify-between">
        {/* Logo & Brand */}
        <div className="flex items-center gap-4 shrink-0">
          <img src={logo} alt="ShotLogic" className="w-16 h-16" />
          <span className="text-4xl font-black tracking-tight text-foreground">ShotLogic</span>
          
          {/* Main Nav Links - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-6">
            <a 
              href="/" 
              className="text-sm font-medium text-foreground hover:text-netflix-red transition-colors"
            >
              Dashboard
            </a>
            {/* Future nav items: Projects, Analytics, etc. */}
          </div>
        </div>

        {/* Credits & User Menu */}
        <div className="flex items-center gap-4">
          <CreditsIndicator />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-9 w-9 rounded-full border border-border hover:border-netflix-red transition-colors"
              >
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-card border-border">
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              My Account
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="cursor-not-allowed opacity-50">
              <User className="mr-2 h-4 w-4" />
              Profile
              <span className="ml-auto text-xs text-muted-foreground">Soon</span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled className="cursor-not-allowed opacity-50">
              <Settings className="mr-2 h-4 w-4" />
              Settings
              <span className="ml-auto text-xs text-muted-foreground">Soon</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={onSignOut}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
};