import { Link } from "react-router-dom";
import { ArrowRight, Film, FileText, Camera, Download, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      {/* Cinematic grain overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.015] z-50"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#E50914] to-[#B20710] rounded-lg flex items-center justify-center">
              <Film className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">ShotLogic</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-white/60 hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-white/60 hover:text-white transition-colors">How It Works</a>
            <a href="#sample" className="text-sm text-white/60 hover:text-white transition-colors">Sample Output</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/projects">
              <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10">
                Log In
              </Button>
            </Link>
            <Link to="/upload">
              <Button className="bg-[#E50914] hover:bg-[#B20710] text-white font-semibold px-5">
                Try Free
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#E50914]/5 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-[#E50914]/10 rounded-full blur-[128px]" />
        <div className="absolute top-40 right-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-[100px]" />
        
        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8">
            <Sparkles className="w-4 h-4 text-[#E50914]" />
            <span className="text-sm text-white/70">AI-Powered Screenplay Analysis</span>
          </div>
          
          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] mb-6 tracking-tight">
            From screenplay to
            <span className="block bg-gradient-to-r from-[#E50914] via-[#ff4d4d] to-[#E50914] bg-clip-text text-transparent">
              shot-ready planning
            </span>
          </h1>
          
          {/* Subhead */}
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
            Upload your script. Get structured scene analysis, production breakdowns, 
            and editable shot lists with rationale—ready for your next production meeting.
          </p>
          
          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link to="/upload">
              <Button size="lg" className="bg-[#E50914] hover:bg-[#B20710] text-white font-semibold px-8 py-6 text-lg group">
                Try a Script Free
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <a href="#sample">
              <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 px-8 py-6 text-lg">
                View Sample Output
              </Button>
            </a>
          </div>
          
          {/* Hero Visual - Mock Interface */}
          <div className="relative max-w-4xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent z-10 pointer-events-none" />
            <div className="bg-[#141414] rounded-xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 bg-[#1a1a1a] border-b border-white/5">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                <span className="ml-4 text-xs text-white/30 font-mono">shotlogic.app</span>
              </div>
              {/* Mock content */}
              <div className="p-6 grid grid-cols-3 gap-4">
                <div className="col-span-1 space-y-3">
                  <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Scenes</div>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div key={n} className={`p-3 rounded-lg text-sm ${n === 2 ? 'bg-[#E50914]/20 border border-[#E50914]/30 text-white' : 'bg-white/5 text-white/50'}`}>
                      Scene {n}
                    </div>
                  ))}
                </div>
                <div className="col-span-2 bg-[#1a1a1a] rounded-lg p-4">
                  <div className="flex gap-4 mb-4 border-b border-white/10 pb-3">
                    <span className="text-sm text-[#E50914] font-medium border-b-2 border-[#E50914] pb-3 -mb-3">Story</span>
                    <span className="text-sm text-white/40">Producing</span>
                    <span className="text-sm text-white/40">Directing</span>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="bg-white/5 rounded p-3">
                      <div className="text-white/40 text-xs mb-1">📝 Synopsis</div>
                      <div className="text-white/70">Bob attempts to break into his own car...</div>
                    </div>
                    <div className="bg-white/5 rounded p-3">
                      <div className="text-white/40 text-xs mb-1">⚡ Scene Turn</div>
                      <div className="text-white/70">"The pepper spray changes everything..."</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 bg-[#0f0f0f]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Outputs that map to real prep work</h2>
            <p className="text-white/50 text-lg">Everything you need to go from script to shooting.</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: FileText,
                title: "Scene Breakdowns",
                description: "Locations, time of day, characters, props, wardrobe, and production requirements—automatically extracted."
              },
              {
                icon: Film,
                title: "Story Analysis",
                description: "Synopsis, conflict, stakes, subtext, and scene turns identified for every scene."
              },
              {
                icon: Camera,
                title: "Shot Lists with Rationale",
                description: "Coverage-driven shot planning with explanations for every camera setup."
              },
              {
                icon: Sparkles,
                title: "Directing Vision",
                description: "Character motivations, tone shifts, visual strategy, and key moments to capture."
              },
              {
                icon: Download,
                title: "Multiple Export Formats",
                description: "PDF reports, CSV shot lists, and storyboard templates ready for your workflow."
              },
              {
                icon: Check,
                title: "Fully Editable",
                description: "AI generates the first pass. You refine it. Every field is editable and saveable."
              }
            ].map((feature, idx) => (
              <div 
                key={idx}
                className="group p-6 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-lg bg-[#E50914]/10 flex items-center justify-center mb-4 group-hover:bg-[#E50914]/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-[#E50914]" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-white/50 text-lg">Three steps from script to shot-ready.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Upload",
                description: "Drop your screenplay PDF or paste text. We parse scene headers, dialogue, and action automatically."
              },
              {
                step: "02",
                title: "Analyze",
                description: "AI generates structured analysis: story beats, production needs, directing notes, and shot coverage."
              },
              {
                step: "03",
                title: "Edit & Export",
                description: "Refine the analysis, adjust shot lists, then export as PDF, CSV, or storyboard templates."
              }
            ].map((item, idx) => (
              <div key={idx} className="relative">
                {idx < 2 && (
                  <div className="hidden md:block absolute top-12 left-full w-full h-px bg-gradient-to-r from-white/20 to-transparent -translate-x-1/2" />
                )}
                <div className="text-5xl font-bold text-[#E50914]/20 mb-4">{item.step}</div>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-white/50 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-16">
            <Link to="/upload">
              <Button size="lg" className="bg-[#E50914] hover:bg-[#B20710] text-white font-semibold px-8 py-6 text-lg">
                Try It Now — Free
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Sample Output Section */}
      <section id="sample" className="py-24 px-6 bg-[#0f0f0f]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Real Output, Not Demos</h2>
            <p className="text-white/50 text-lg">See what ShotLogic generates from an actual screenplay.</p>
          </div>
          
          <div className="bg-[#141414] rounded-xl border border-white/10 overflow-hidden">
            <div className="grid md:grid-cols-2">
              {/* Left: Script excerpt */}
              <div className="p-8 border-r border-white/5">
                <div className="text-xs text-white/40 uppercase tracking-wider mb-4">Script Input</div>
                <div className="font-mono text-sm text-white/70 space-y-4 bg-black/30 rounded-lg p-4">
                  <p className="text-[#E50914]">EXT. APARTMENT COMPLEX - NIGHT</p>
                  <p>An ELDERLY WOMAN (70's) walks her small dog across the street. She stops and watches as Bob comes over to the Jetta holding a wire coat hanger and pliers. He's still in his bathrobe.</p>
                  <p>Bob takes the pliers and bends the wire hanger till it comes apart. He twists one end into a J hook...</p>
                </div>
              </div>
              
              {/* Right: Analysis output */}
              <div className="p-8">
                <div className="text-xs text-white/40 uppercase tracking-wider mb-4">ShotLogic Output</div>
                <div className="space-y-4">
                  <div className="bg-white/5 rounded-lg p-4">
                    <div className="text-xs text-[#E50914] mb-2">📍 Producing</div>
                    <div className="text-sm text-white/70 space-y-1">
                      <p><span className="text-white/40">Location:</span> Apartment complex parking lot</p>
                      <p><span className="text-white/40">Time:</span> NIGHT</p>
                      <p><span className="text-white/40">Cast:</span> Bob, Elderly Woman, Dog</p>
                      <p><span className="text-white/40">Props:</span> Wire hanger, Pliers, Bathrobe, Dog leash</p>
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-lg p-4">
                    <div className="text-xs text-[#E50914] mb-2">🎬 Shot 1 of 8</div>
                    <div className="text-sm text-white/70">
                      <p className="font-medium text-white">WIDE - Establishing</p>
                      <p className="mt-1">Dimly lit street with apartment buildings, Bob by the car in his bathrobe</p>
                      <p className="text-white/40 text-xs mt-2 italic">Sets spatial context and mood of isolation</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to plan your next shoot?</h2>
          <p className="text-white/50 text-lg mb-10">
            Upload a script and see what ShotLogic can do. No account required.
          </p>
          <Link to="/upload">
            <Button size="lg" className="bg-[#E50914] hover:bg-[#B20710] text-white font-semibold px-10 py-6 text-lg group">
              Start Analyzing — Free
              <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[#E50914] to-[#B20710] rounded-lg flex items-center justify-center">
              <Film className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold">ShotLogic</span>
          </div>
          <div className="flex items-center gap-8 text-sm text-white/40">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
          <div className="text-sm text-white/30">
            © 2024 ShotLogic. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
