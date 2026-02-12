import { Link } from "react-router-dom";
import { ArrowRight, Film } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Simple Header */}
      <header className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#E50914] rounded flex items-center justify-center">
            <Film className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold">ShotLogic</span>
        </div>
        <Link to="/projects">
          <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
            Sign In
          </Button>
        </Link>
      </header>

      {/* Hero - Single Focus */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 -mt-16">
        <div className="max-w-2xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Upload a script.<br />
            Get a shot list.
          </h1>
          <p className="text-white/40 text-lg mb-8">
            AI-powered scene analysis and shot planning for filmmakers.
          </p>
          <Link to="/new-project">
            <Button size="lg" className="bg-[#E50914] hover:bg-[#B20710] text-white font-semibold px-8 h-12 text-base group">
              Get Started
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="px-6 py-5 text-center text-white/20 text-sm">
        Scene breakdowns • Shot lists • Storyboard exports
      </footer>
    </div>
  );
}
