import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/utils/logger";

export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    logger.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="px-6 py-5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#E50914] rounded flex items-center justify-center">
            <Film className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold">ShotLogic</span>
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 -mt-16">
        <div className="max-w-lg text-center">
          <div className="text-[#E50914] text-7xl md:text-8xl font-black tracking-tight mb-6">404</div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
            This scene doesn't exist.
          </h1>
          <p className="text-white/40 text-lg mb-8">
            The page you're looking for may have been moved or never existed. Let's get you back on set.
          </p>
          <Link to="/">
            <Button size="lg" className="bg-[#E50914] hover:bg-[#B20710] text-white font-semibold px-8 h-12 text-base group">
              <ArrowLeft className="mr-2 w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Return home
            </Button>
          </Link>
        </div>
      </main>

      <footer className="px-6 py-5 text-center text-white/20 text-sm">
        <Link to="/" className="hover:text-white/40 transition-colors">© 2026 ShotLogic</Link>
        <span className="mx-2">·</span>
        <Link to="/privacy" className="hover:text-white/40 transition-colors">Privacy</Link>
        <span className="mx-2">·</span>
        <Link to="/terms" className="hover:text-white/40 transition-colors">Terms</Link>
        <span className="mx-2">·</span>
        <a href="mailto:support@shotlogic.studio" className="hover:text-white/40 transition-colors">Contact</a>
      </footer>
    </div>
  );
}
