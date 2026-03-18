import React, { useMemo } from 'react';
import { Scene, AnalysisData, parseAnalysis } from '@/types/analysis';
import { Badge } from '@/components/ui/badge';

interface ProductionSummaryProps {
  scenes: Scene[];
}

// Normalize strings for deduplication
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[.,;:!?]+$/, '');
}

export const ProductionSummary: React.FC<ProductionSummaryProps> = ({ scenes }) => {
  const data = useMemo(() => {
    const analyzed: { sceneNumber: number; analysis: AnalysisData }[] = [];
    for (const scene of scenes) {
      const a = parseAnalysis(scene.analysis);
      if (a?.producing_logistics) {
        analyzed.push({ sceneNumber: scene.scene_number, analysis: a });
      }
    }

    // ── Locations ──
    const locationMap = new Map<string, { intExt: string; timeOfDay: string; scenes: number[] }>();
    for (const { sceneNumber, analysis } of analyzed) {
      const loc = analysis.producing_logistics.locations;
      if (!loc?.primary) continue;
      const key = normalize(loc.primary);
      const existing = locationMap.get(key);
      if (existing) {
        if (!existing.scenes.includes(sceneNumber)) existing.scenes.push(sceneNumber);
      } else {
        locationMap.set(key, {
          intExt: loc.intExt || '—',
          timeOfDay: loc.timeOfDay || '—',
          scenes: [sceneNumber],
        });
      }
    }
    const locations = Array.from(locationMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.scenes.length - a.scenes.length);

    // ── Cast ──
    const castMap = new Map<string, { speaking: Set<number>; silent: Set<number>; principal: boolean }>();
    const addCast = (names: string[] | undefined, sceneNumber: number, role: 'speaking' | 'silent' | 'principal') => {
      if (!names) return;
      for (const name of names) {
        const key = normalize(name);
        if (!key) continue;
        let entry = castMap.get(key);
        if (!entry) {
          entry = { speaking: new Set(), silent: new Set(), principal: false };
          castMap.set(key, entry);
        }
        if (role === 'principal') {
          entry.principal = true;
          entry.speaking.add(sceneNumber);
        } else {
          entry[role].add(sceneNumber);
        }
      }
    };
    for (const { sceneNumber, analysis } of analyzed) {
      const cast = analysis.producing_logistics.cast;
      if (!cast) continue;
      addCast(cast.principal, sceneNumber, 'principal');
      addCast(cast.speaking, sceneNumber, 'speaking');
      addCast(cast.silent, sceneNumber, 'silent');
    }
    const cast = Array.from(castMap.entries())
      .map(([name, data]) => ({
        name,
        principal: data.principal,
        speakingScenes: Array.from(data.speaking).sort((a, b) => a - b),
        silentScenes: Array.from(data.silent).sort((a, b) => a - b),
        totalScenes: new Set([...data.speaking, ...data.silent]).size,
      }))
      .sort((a, b) => b.totalScenes - a.totalScenes);

    // ── Props ──
    const propMap = new Map<string, Set<number>>();
    for (const { sceneNumber, analysis } of analyzed) {
      const props = analysis.producing_logistics.key_props;
      if (!props) continue;
      for (const prop of props) {
        const key = normalize(prop);
        if (!key) continue;
        if (!propMap.has(key)) propMap.set(key, new Set());
        propMap.get(key)!.add(sceneNumber);
      }
    }
    const props = Array.from(propMap.entries())
      .map(([name, sceneSet]) => ({ name, scenes: Array.from(sceneSet).sort((a, b) => a - b) }))
      .sort((a, b) => b.scenes.length - a.scenes.length);

    // ── Special Requirements (SFX, VFX, stunts, safety, red flags) ──
    const specialReqs: { type: string; description: string; scenes: number[] }[] = [];
    const reqMap = new Map<string, { type: string; scenes: Set<number> }>();
    const addReq = (type: string, items: string[] | undefined, sceneNumber: number) => {
      if (!items) return;
      for (const item of items) {
        const key = `${type}::${normalize(item)}`;
        if (!reqMap.has(key)) reqMap.set(key, { type, scenes: new Set() });
        reqMap.get(key)!.scenes.add(sceneNumber);
      }
    };
    for (const { sceneNumber, analysis } of analyzed) {
      const p = analysis.producing_logistics;
      // SFX
      if (p.sfx?.practical) addReq('Practical SFX', p.sfx.practical, sceneNumber);
      if (p.sfx?.vfx) addReq('VFX', p.sfx.vfx, sceneNumber);
      // Safety
      if (p.safety_specifics?.concerns) addReq('Safety', p.safety_specifics.concerns, sceneNumber);
      if (p.safety_specifics?.protocols_required) addReq('Safety Protocol', p.safety_specifics.protocols_required, sceneNumber);
      // Red flags
      addReq('Red Flag', p.red_flags, sceneNumber);
      // Special requirements
      if (p.special_requirements) addReq('Special', p.special_requirements, sceneNumber);
    }
    for (const [key, val] of reqMap.entries()) {
      const desc = key.split('::')[1];
      specialReqs.push({ type: val.type, description: desc, scenes: Array.from(val.scenes).sort((a, b) => a - b) });
    }
    specialReqs.sort((a, b) => b.scenes.length - a.scenes.length);

    // ── Schedule Complexity ──
    const complexity = analyzed
      .filter(({ analysis }) => analysis.producing_logistics.scene_complexity)
      .map(({ sceneNumber, analysis }) => ({
        sceneNumber,
        rating: analysis.producing_logistics.scene_complexity!.rating,
        justification: analysis.producing_logistics.scene_complexity!.justification,
        resourceImpact: analysis.producing_logistics.resource_impact,
        estimatedMinutes: analysis.producing_logistics.estimated_screen_time?.estimated_minutes || '—',
      }))
      .sort((a, b) => b.rating - a.rating);

    return { locations, cast, props, specialReqs, complexity, analyzedCount: analyzed.length };
  }, [scenes]);

  if (data.analyzedCount === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No analyzed scenes yet. Analyze scenes to see the production summary.
      </div>
    );
  }

  const sceneList = (nums: number[]) => nums.map(n => `Sc ${n}`).join(', ');
  const complexityColor = (rating: number) => {
    if (rating >= 4) return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (rating >= 3) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-green-500/20 text-green-400 border-green-500/30';
  };
  const impactColor = (impact: string) => {
    if (impact === 'High') return 'bg-red-500/20 text-red-400 border-red-500/30';
    if (impact === 'Medium') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-green-500/20 text-green-400 border-green-500/30';
  };

  const thClass = 'px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border';
  const tdClass = 'px-3 py-2 text-sm text-foreground border-b border-border/50';

  return (
    <div className="space-y-8">
      {/* Locations */}
      <section>
        <h3 className="text-sm font-bold text-primary mb-3 uppercase tracking-wide">Locations ({data.locations.length})</h3>
        {data.locations.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full">
              <thead className="bg-[#1a1a1a]">
                <tr>
                  <th className={thClass}>Location</th>
                  <th className={thClass}>INT/EXT</th>
                  <th className={thClass}>Time of Day</th>
                  <th className={thClass}>Scenes</th>
                  <th className={`${thClass} text-center`}>#</th>
                </tr>
              </thead>
              <tbody>
                {data.locations.map((loc) => (
                  <tr key={loc.name} className="hover:bg-white/5">
                    <td className={`${tdClass} font-medium capitalize`}>{loc.name}</td>
                    <td className={tdClass}>{loc.intExt}</td>
                    <td className={tdClass}>{loc.timeOfDay}</td>
                    <td className={`${tdClass} text-muted-foreground`}>{sceneList(loc.scenes)}</td>
                    <td className={`${tdClass} text-center`}>
                      <Badge variant="outline" className="text-xs">{loc.scenes.length}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No location data available.</p>
        )}
      </section>

      {/* Cast */}
      <section>
        <h3 className="text-sm font-bold text-primary mb-3 uppercase tracking-wide">Cast ({data.cast.length})</h3>
        {data.cast.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full">
              <thead className="bg-[#1a1a1a]">
                <tr>
                  <th className={thClass}>Character</th>
                  <th className={thClass}>Role</th>
                  <th className={thClass}>Speaking</th>
                  <th className={thClass}>Silent</th>
                  <th className={`${thClass} text-center`}>Total Scenes</th>
                </tr>
              </thead>
              <tbody>
                {data.cast.map((c) => (
                  <tr key={c.name} className="hover:bg-white/5">
                    <td className={`${tdClass} font-medium capitalize`}>{c.name}</td>
                    <td className={tdClass}>
                      {c.principal ? (
                        <Badge variant="default" className="text-xs bg-netflix-red">Principal</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Supporting</Badge>
                      )}
                    </td>
                    <td className={`${tdClass} text-muted-foreground`}>
                      {c.speakingScenes.length > 0 ? sceneList(c.speakingScenes) : '—'}
                    </td>
                    <td className={`${tdClass} text-muted-foreground`}>
                      {c.silentScenes.length > 0 ? sceneList(c.silentScenes) : '—'}
                    </td>
                    <td className={`${tdClass} text-center`}>
                      <Badge variant="outline" className="text-xs">{c.totalScenes}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No cast data available.</p>
        )}
      </section>

      {/* Props */}
      <section>
        <h3 className="text-sm font-bold text-primary mb-3 uppercase tracking-wide">Key Props ({data.props.length})</h3>
        {data.props.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full">
              <thead className="bg-[#1a1a1a]">
                <tr>
                  <th className={thClass}>Prop</th>
                  <th className={thClass}>Scenes</th>
                  <th className={`${thClass} text-center`}>#</th>
                </tr>
              </thead>
              <tbody>
                {data.props.map((p) => (
                  <tr key={p.name} className="hover:bg-white/5">
                    <td className={`${tdClass} font-medium capitalize`}>{p.name}</td>
                    <td className={`${tdClass} text-muted-foreground`}>{sceneList(p.scenes)}</td>
                    <td className={`${tdClass} text-center`}>
                      <Badge variant="outline" className="text-xs">{p.scenes.length}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No props data available.</p>
        )}
      </section>

      {/* Special Requirements */}
      <section>
        <h3 className="text-sm font-bold text-primary mb-3 uppercase tracking-wide">Special Requirements ({data.specialReqs.length})</h3>
        {data.specialReqs.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full">
              <thead className="bg-[#1a1a1a]">
                <tr>
                  <th className={thClass}>Type</th>
                  <th className={thClass}>Description</th>
                  <th className={thClass}>Scenes</th>
                </tr>
              </thead>
              <tbody>
                {data.specialReqs.map((r, i) => (
                  <tr key={i} className="hover:bg-white/5">
                    <td className={tdClass}>
                      <Badge variant="outline" className={`text-xs ${
                        r.type === 'VFX' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                        r.type === 'Safety' || r.type === 'Safety Protocol' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                        r.type === 'Red Flag' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                        'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      }`}>{r.type}</Badge>
                    </td>
                    <td className={`${tdClass} capitalize`}>{r.description}</td>
                    <td className={`${tdClass} text-muted-foreground`}>{sceneList(r.scenes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No special requirements identified.</p>
        )}
      </section>

      {/* Schedule Complexity */}
      <section>
        <h3 className="text-sm font-bold text-primary mb-3 uppercase tracking-wide">Schedule Complexity</h3>
        {data.complexity.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full">
              <thead className="bg-[#1a1a1a]">
                <tr>
                  <th className={thClass}>Scene</th>
                  <th className={`${thClass} text-center`}>Complexity</th>
                  <th className={`${thClass} text-center`}>Impact</th>
                  <th className={`${thClass} text-center`}>Est. Time</th>
                  <th className={thClass}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {data.complexity.map((c) => (
                  <tr key={c.sceneNumber} className="hover:bg-white/5">
                    <td className={`${tdClass} font-medium`}>Scene {c.sceneNumber}</td>
                    <td className={`${tdClass} text-center`}>
                      <Badge variant="outline" className={`text-xs ${complexityColor(c.rating)}`}>
                        {c.rating}/5
                      </Badge>
                    </td>
                    <td className={`${tdClass} text-center`}>
                      <Badge variant="outline" className={`text-xs ${impactColor(c.resourceImpact)}`}>
                        {c.resourceImpact}
                      </Badge>
                    </td>
                    <td className={`${tdClass} text-center text-muted-foreground`}>{c.estimatedMinutes}</td>
                    <td className={`${tdClass} text-muted-foreground text-xs`}>{c.justification}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No complexity data available.</p>
        )}
      </section>
    </div>
  );
};
