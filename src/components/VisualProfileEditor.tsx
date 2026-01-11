import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Palette, Camera, Sun, Film, Sparkles, Save, RotateCcw } from 'lucide-react';
import { VisualProfile, VISUAL_PROFILE_PRESETS, createDefaultVisualProfile } from '@/types/visualProfile';

interface VisualProfileEditorProps {
  initialProfile?: VisualProfile | null;
  onSave: (profile: VisualProfile) => Promise<void>;
  isSaving?: boolean;
}

export function VisualProfileEditor({ initialProfile, onSave, isSaving = false }: VisualProfileEditorProps) {
  const [profile, setProfile] = useState<VisualProfile>(() =>
    initialProfile || createDefaultVisualProfile()
  );

  const [selectedPreset, setSelectedPreset] = useState<string>('custom');
  const [isMonochrome, setIsMonochrome] = useState<boolean>(false);
  const [monochromeContrast, setMonochromeContrast] = useState<number>(100);
  const [originalColors, setOriginalColors] = useState<{
    palette: string[];
    accent: string[];
  } | null>(null);

  // Update profile when initialProfile changes
  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
    }
  }, [initialProfile]);

  const handlePresetChange = (presetKey: string) => {
    setSelectedPreset(presetKey);

    if (presetKey === 'custom') {
      return;
    }

    const presetConfig = VISUAL_PROFILE_PRESETS[presetKey];
    if (presetConfig) {
      setProfile({
        ...createDefaultVisualProfile(),
        ...presetConfig,
        updated_at: new Date().toISOString()
      });
    }
  };

  const handleColorChange = (index: number, value: string, type: 'palette' | 'accent') => {
    const colors = type === 'palette' ? [...profile.color_palette_hex] : [...profile.accent_colors_hex];
    colors[index] = value;

    setProfile({
      ...profile,
      [type === 'palette' ? 'color_palette_hex' : 'accent_colors_hex']: colors,
      updated_at: new Date().toISOString()
    });
    setSelectedPreset('custom');
  };

  const handleSave = async () => {
    await onSave(profile);
  };

  const handleReset = () => {
    setProfile(createDefaultVisualProfile());
    setSelectedPreset('custom');
    setIsMonochrome(false);
    setOriginalColors(null);
  };

  // Convert hex to grayscale with adjustable contrast
  const hexToGrayscale = (hex: string, contrast: number): string => {
    // Remove # if present
    const cleanHex = hex.replace('#', '');

    // Convert to RGB
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);

    // Calculate luminance (weighted grayscale)
    let gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

    // Apply contrast adjustment
    // contrast: 0 = minimum (all gray), 100 = normal, 200 = maximum
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    gray = Math.round(factor * (gray - 128) + 128);
    gray = Math.max(0, Math.min(255, gray));

    // Convert back to hex
    const grayHex = gray.toString(16).padStart(2, '0');
    return `#${grayHex}${grayHex}${grayHex}`;
  };

  const handleMonochromeToggle = (enabled: boolean) => {
    setIsMonochrome(enabled);

    if (enabled) {
      // Save original colors
      setOriginalColors({
        palette: [...profile.color_palette_hex],
        accent: [...profile.accent_colors_hex]
      });

      // Convert current colors to grayscale
      const grayPalette = profile.color_palette_hex.map(c => hexToGrayscale(c, monochromeContrast));
      const grayAccent = profile.accent_colors_hex.map(c => hexToGrayscale(c, monochromeContrast));

      setProfile({
        ...profile,
        color_palette_hex: grayPalette,
        accent_colors_hex: grayAccent,
        updated_at: new Date().toISOString()
      });
    } else {
      // Restore original colors if available
      if (originalColors) {
        setProfile({
          ...profile,
          color_palette_hex: originalColors.palette,
          accent_colors_hex: originalColors.accent,
          updated_at: new Date().toISOString()
        });
      }
    }
    setSelectedPreset('custom');
  };

  const handleContrastChange = (value: number[]) => {
    const newContrast = value[0];
    setMonochromeContrast(newContrast);

    if (isMonochrome && originalColors) {
      // Re-convert with new contrast value
      const grayPalette = originalColors.palette.map(c => hexToGrayscale(c, newContrast));
      const grayAccent = originalColors.accent.map(c => hexToGrayscale(c, newContrast));

      setProfile({
        ...profile,
        color_palette_hex: grayPalette,
        accent_colors_hex: grayAccent,
        updated_at: new Date().toISOString()
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Preset Selector */}
      <Card className="bg-neutral-900/50 border-neutral-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#E50914]" />
              <CardTitle>Visual Profile Presets</CardTitle>
            </div>
            <Select value={selectedPreset} onValueChange={handlePresetChange}>
              <SelectTrigger className="w-[250px] bg-neutral-800 border-neutral-700">
                <SelectValue placeholder="Select a preset" />
              </SelectTrigger>
              <SelectContent className="bg-neutral-800 border-neutral-700">
                <SelectItem value="custom">Custom Configuration</SelectItem>
                <SelectItem value="naturalistic_drama">Naturalistic Drama</SelectItem>
                <SelectItem value="stylized_thriller">Stylized Thriller</SelectItem>
                <SelectItem value="film_noir">Film Noir (High Contrast)</SelectItem>
                <SelectItem value="period_romance">Period Romance (Warm)</SelectItem>
                <SelectItem value="sci_fi_dystopian">Sci-Fi Dystopian (Cool)</SelectItem>
                <SelectItem value="warm_sepia">Warm Sepia</SelectItem>
                <SelectItem value="cool_moonlight">Cool Moonlight</SelectItem>
                <SelectItem value="golden_hour">Golden Hour</SelectItem>
                <SelectItem value="overcast_neutral">Overcast Neutral</SelectItem>
                <SelectItem value="high_contrast_bw">High Contrast B&W</SelectItem>
                <SelectItem value="two_strip_technicolor">Two-Strip Technicolor</SelectItem>
                <SelectItem value="bleach_bypass">Bleach Bypass</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <CardDescription className="text-neutral-400">
            Choose a starting point for your visual style, or create a custom configuration
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Main Configuration Tabs */}
      <Tabs defaultValue="colors" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-neutral-900/50 border border-neutral-800">
          <TabsTrigger value="colors" className="data-[state=active]:bg-[#E50914]">
            <Palette className="w-4 h-4 mr-2" />
            Colors
          </TabsTrigger>
          <TabsTrigger value="camera" className="data-[state=active]:bg-[#E50914]">
            <Camera className="w-4 h-4 mr-2" />
            Camera
          </TabsTrigger>
          <TabsTrigger value="lighting" className="data-[state=active]:bg-[#E50914]">
            <Sun className="w-4 h-4 mr-2" />
            Lighting
          </TabsTrigger>
          <TabsTrigger value="post" className="data-[state=active]:bg-[#E50914]">
            <Film className="w-4 h-4 mr-2" />
            Post
          </TabsTrigger>
        </TabsList>

        {/* COLORS TAB */}
        <TabsContent value="colors" className="space-y-6 mt-6">
          <Card className="bg-neutral-900/50 border-neutral-800">
            <CardHeader>
              <CardTitle>Color Palette</CardTitle>
              <CardDescription className="text-neutral-400">
                Define the primary color palette (6 colors) and accent colors (2-3) for visual consistency
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Primary Palette */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Primary Palette (6 colors)</Label>
                <div className="grid grid-cols-6 gap-3">
                  {profile.color_palette_hex.map((color, index) => (
                    <div key={`palette-${index}`} className="space-y-2">
                      <div
                        className="w-full h-20 rounded-lg border-2 border-neutral-700 cursor-pointer relative overflow-hidden group hover:border-[#E50914] transition-colors"
                        style={{ backgroundColor: color }}
                      >
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => handleColorChange(index, e.target.value, 'palette')}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Palette className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <input
                        type="text"
                        value={color}
                        onChange={(e) => handleColorChange(index, e.target.value, 'palette')}
                        className="w-full px-2 py-1 text-xs bg-neutral-800 border border-neutral-700 rounded text-center font-mono uppercase"
                        placeholder="#HEXCODE"
                        maxLength={7}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="bg-neutral-800" />

              {/* Accent Colors */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Accent Colors (2-3 colors)</Label>
                <div className="grid grid-cols-3 gap-3 max-w-md">
                  {profile.accent_colors_hex.map((color, index) => (
                    <div key={`accent-${index}`} className="space-y-2">
                      <div
                        className="w-full h-20 rounded-lg border-2 border-neutral-700 cursor-pointer relative overflow-hidden group hover:border-[#E50914] transition-colors"
                        style={{ backgroundColor: color }}
                      >
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => handleColorChange(index, e.target.value, 'accent')}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Palette className="w-6 h-6 text-white" />
                        </div>
                      </div>
                      <input
                        type="text"
                        value={color}
                        onChange={(e) => handleColorChange(index, e.target.value, 'accent')}
                        className="w-full px-2 py-1 text-xs bg-neutral-800 border border-neutral-700 rounded text-center font-mono uppercase"
                        placeholder="#HEXCODE"
                        maxLength={7}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="bg-neutral-800" />

              {/* Color Temperature */}
              <div className="space-y-3">
                <Label htmlFor="color-temp">Overall Color Temperature</Label>
                <Select
                  value={profile.color_temperature}
                  onValueChange={(value: any) => {
                    setProfile({ ...profile, color_temperature: value, updated_at: new Date().toISOString() });
                    setSelectedPreset('custom');
                  }}
                >
                  <SelectTrigger id="color-temp" className="bg-neutral-800 border-neutral-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-800 border-neutral-700">
                    <SelectItem value="warm">Warm (Golden, amber tones)</SelectItem>
                    <SelectItem value="neutral">Neutral (Balanced)</SelectItem>
                    <SelectItem value="cool">Cool (Blue, teal tones)</SelectItem>
                    <SelectItem value="mixed">Mixed (Varied per scene)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator className="bg-neutral-800" />

              {/* Monochrome/B&W Toggle */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="monochrome-toggle" className="text-sm font-medium">
                      Monochrome / Black & White
                    </Label>
                    <p className="text-xs text-neutral-400">
                      Convert palette to grayscale values with adjustable contrast
                    </p>
                  </div>
                  <Switch
                    id="monochrome-toggle"
                    checked={isMonochrome}
                    onCheckedChange={handleMonochromeToggle}
                  />
                </div>

                {isMonochrome && (
                  <div className="space-y-2 pl-4 border-l-2 border-neutral-700">
                    <Label htmlFor="contrast-slider" className="text-xs text-neutral-400">
                      Contrast: {monochromeContrast}%
                    </Label>
                    <Slider
                      id="contrast-slider"
                      min={0}
                      max={200}
                      step={5}
                      value={[monochromeContrast]}
                      onValueChange={handleContrastChange}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-neutral-500">
                      <span>Low (0%)</span>
                      <span>Normal (100%)</span>
                      <span>High (200%)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Extract from Image - Disabled for now */}
              <Button
                variant="outline"
                disabled
                className="w-full border-neutral-700 bg-neutral-800/50 opacity-50 cursor-not-allowed"
              >
                <Palette className="w-4 h-4 mr-2" />
                Extract Colors from Reference Image (Coming Soon)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CAMERA TAB */}
        <TabsContent value="camera" className="space-y-6 mt-6">
          <Card className="bg-neutral-900/50 border-neutral-800">
            <CardHeader>
              <CardTitle>Camera & Lens Configuration</CardTitle>
              <CardDescription className="text-neutral-400">
                Define aspect ratio, lens character, and film stock look
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Aspect Ratio */}
              <div className="space-y-3">
                <Label htmlFor="aspect-ratio">Aspect Ratio</Label>
                <Select
                  value={profile.aspect_ratio}
                  onValueChange={(value: any) => {
                    setProfile({ ...profile, aspect_ratio: value, updated_at: new Date().toISOString() });
                    setSelectedPreset('custom');
                  }}
                >
                  <SelectTrigger id="aspect-ratio" className="bg-neutral-800 border-neutral-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-800 border-neutral-700">
                    <SelectItem value="2.39:1">2.39:1 (Anamorphic Widescreen)</SelectItem>
                    <SelectItem value="2.35:1">2.35:1 (CinemaScope)</SelectItem>
                    <SelectItem value="1.85:1">1.85:1 (Theatrical Standard)</SelectItem>
                    <SelectItem value="16:9">16:9 (HD/TV Standard)</SelectItem>
                    <SelectItem value="4:3">4:3 (Classic/Academy)</SelectItem>
                    <SelectItem value="1:1">1:1 (Square Format)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Lens Character */}
              <div className="space-y-3">
                <Label htmlFor="lens-char">Lens Character</Label>
                <Select
                  value={profile.lens_character}
                  onValueChange={(value: any) => {
                    setProfile({ ...profile, lens_character: value, updated_at: new Date().toISOString() });
                    setSelectedPreset('custom');
                  }}
                >
                  <SelectTrigger id="lens-char" className="bg-neutral-800 border-neutral-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-800 border-neutral-700">
                    <SelectItem value="anamorphic_flares">Anamorphic (horizontal flares, oval bokeh)</SelectItem>
                    <SelectItem value="anamorphic_clean">Anamorphic Clean (wide, minimal artifacts)</SelectItem>
                    <SelectItem value="spherical_clean">Spherical Clean (modern, sharp)</SelectItem>
                    <SelectItem value="vintage_soft">Vintage Soft (dreamy, glowing)</SelectItem>
                    <SelectItem value="vintage_character">Vintage Character (flares, low contrast)</SelectItem>
                    <SelectItem value="modern_sharp">Modern Sharp (clinical precision)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Film Stock Look */}
              <div className="space-y-3">
                <Label htmlFor="film-stock">Film Stock / Sensor Look</Label>
                <Select
                  value={profile.film_stock_look}
                  onValueChange={(value: any) => {
                    setProfile({ ...profile, film_stock_look: value, updated_at: new Date().toISOString() });
                    setSelectedPreset('custom');
                  }}
                >
                  <SelectTrigger id="film-stock" className="bg-neutral-800 border-neutral-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-800 border-neutral-700">
                    <SelectItem value="clean_digital_alexa">Clean Digital (ARRI Alexa)</SelectItem>
                    <SelectItem value="red_color_science">Red Color Science (punchy, saturated)</SelectItem>
                    <SelectItem value="sony_venice_look">Sony Venice (smooth, filmic)</SelectItem>
                    <SelectItem value="kodak_5219_500T">Kodak 5219 500T (warm, classic)</SelectItem>
                    <SelectItem value="kodak_5207_250D">Kodak 5207 250D (neutral daylight)</SelectItem>
                    <SelectItem value="fuji_eterna_vivid">Fuji Eterna Vivid (cool, saturated)</SelectItem>
                    <SelectItem value="film_noir_high_contrast">Film Noir (high contrast B&W)</SelectItem>
                    <SelectItem value="custom">Custom Look</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Composition Principles */}
              <Separator className="bg-neutral-800" />
              <div className="space-y-3">
                <Label className="text-base font-semibold">Composition Principles</Label>

                <div className="space-y-3">
                  <Label htmlFor="symmetry">Framing Preference</Label>
                  <Select
                    value={profile.composition_principles.symmetry_preference}
                    onValueChange={(value: any) => {
                      setProfile({
                        ...profile,
                        composition_principles: { ...profile.composition_principles, symmetry_preference: value },
                        updated_at: new Date().toISOString()
                      });
                      setSelectedPreset('custom');
                    }}
                  >
                    <SelectTrigger id="symmetry" className="bg-neutral-800 border-neutral-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700">
                      <SelectItem value="centered">Centered (symmetrical, formal)</SelectItem>
                      <SelectItem value="rule_of_thirds">Rule of Thirds (balanced, dynamic)</SelectItem>
                      <SelectItem value="golden_ratio">Golden Ratio (natural, pleasing)</SelectItem>
                      <SelectItem value="dynamic">Dynamic (off-balance, tension)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label htmlFor="headroom">Headroom</Label>
                    <Select
                      value={profile.composition_principles.headroom}
                      onValueChange={(value: any) => {
                        setProfile({
                          ...profile,
                          composition_principles: { ...profile.composition_principles, headroom: value },
                          updated_at: new Date().toISOString()
                        });
                        setSelectedPreset('custom');
                      }}
                    >
                      <SelectTrigger id="headroom" className="bg-neutral-800 border-neutral-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-800 border-neutral-700">
                        <SelectItem value="tight">Tight (close crop)</SelectItem>
                        <SelectItem value="standard">Standard (balanced)</SelectItem>
                        <SelectItem value="loose">Loose (breathing room)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="dof">Depth of Field</Label>
                    <Select
                      value={profile.composition_principles.depth_of_field}
                      onValueChange={(value: any) => {
                        setProfile({
                          ...profile,
                          composition_principles: { ...profile.composition_principles, depth_of_field: value },
                          updated_at: new Date().toISOString()
                        });
                        setSelectedPreset('custom');
                      }}
                    >
                      <SelectTrigger id="dof" className="bg-neutral-800 border-neutral-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-neutral-800 border-neutral-700">
                        <SelectItem value="shallow">Shallow (cinematic bokeh)</SelectItem>
                        <SelectItem value="medium">Medium (balanced)</SelectItem>
                        <SelectItem value="deep">Deep (wide focus)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LIGHTING TAB */}
        <TabsContent value="lighting" className="space-y-6 mt-6">
          <Card className="bg-neutral-900/50 border-neutral-800">
            <CardHeader>
              <CardTitle>Lighting Style</CardTitle>
              <CardDescription className="text-neutral-400">
                Configure key light direction, temperature, shadow hardness, and contrast
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Key Light Direction */}
                <div className="space-y-3">
                  <Label htmlFor="key-dir">Key Light Direction</Label>
                  <Select
                    value={profile.lighting_style.key_light_direction}
                    onValueChange={(value: any) => {
                      setProfile({
                        ...profile,
                        lighting_style: { ...profile.lighting_style, key_light_direction: value },
                        updated_at: new Date().toISOString()
                      });
                      setSelectedPreset('custom');
                    }}
                  >
                    <SelectTrigger id="key-dir" className="bg-neutral-800 border-neutral-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700">
                      <SelectItem value="front">Front (flat, even)</SelectItem>
                      <SelectItem value="side">Side (sculpting, dimensional)</SelectItem>
                      <SelectItem value="back">Back (silhouette, rim)</SelectItem>
                      <SelectItem value="top">Top (dramatic, overhead)</SelectItem>
                      <SelectItem value="motivated">Motivated (story-driven sources)</SelectItem>
                      <SelectItem value="natural">Natural (available light)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Temperature */}
                <div className="space-y-3">
                  <Label htmlFor="light-temp">Light Temperature</Label>
                  <Select
                    value={profile.lighting_style.temperature}
                    onValueChange={(value: any) => {
                      setProfile({
                        ...profile,
                        lighting_style: { ...profile.lighting_style, temperature: value },
                        updated_at: new Date().toISOString()
                      });
                      setSelectedPreset('custom');
                    }}
                  >
                    <SelectTrigger id="light-temp" className="bg-neutral-800 border-neutral-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700">
                      <SelectItem value="tungsten_3200K">Tungsten 3200K (warm, orange)</SelectItem>
                      <SelectItem value="daylight_5600K">Daylight 5600K (neutral white)</SelectItem>
                      <SelectItem value="cool_blue">Cool Blue (cold, clinical)</SelectItem>
                      <SelectItem value="warm_amber">Warm Amber (golden, romantic)</SelectItem>
                      <SelectItem value="mixed">Mixed (varied sources)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Shadow Hardness */}
                <div className="space-y-3">
                  <Label htmlFor="shadows">Shadow Hardness</Label>
                  <Select
                    value={profile.lighting_style.shadow_hardness}
                    onValueChange={(value: any) => {
                      setProfile({
                        ...profile,
                        lighting_style: { ...profile.lighting_style, shadow_hardness: value },
                        updated_at: new Date().toISOString()
                      });
                      setSelectedPreset('custom');
                    }}
                  >
                    <SelectTrigger id="shadows" className="bg-neutral-800 border-neutral-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700">
                      <SelectItem value="hard">Hard (sharp, defined edges)</SelectItem>
                      <SelectItem value="medium">Medium (moderate transition)</SelectItem>
                      <SelectItem value="soft">Soft (gentle, diffused)</SelectItem>
                      <SelectItem value="variable">Variable (scene-dependent)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Contrast Ratio */}
                <div className="space-y-3">
                  <Label htmlFor="contrast">Contrast Ratio</Label>
                  <Select
                    value={profile.lighting_style.contrast_ratio}
                    onValueChange={(value: any) => {
                      setProfile({
                        ...profile,
                        lighting_style: { ...profile.lighting_style, contrast_ratio: value },
                        updated_at: new Date().toISOString()
                      });
                      setSelectedPreset('custom');
                    }}
                  >
                    <SelectTrigger id="contrast" className="bg-neutral-800 border-neutral-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700">
                      <SelectItem value="high_contrast">High Contrast (dramatic, film noir)</SelectItem>
                      <SelectItem value="medium_contrast">Medium Contrast (balanced)</SelectItem>
                      <SelectItem value="low_contrast">Low Contrast (soft, ethereal)</SelectItem>
                      <SelectItem value="flat">Flat (minimal contrast, natural)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* POST-PROCESSING TAB */}
        <TabsContent value="post" className="space-y-6 mt-6">
          <Card className="bg-neutral-900/50 border-neutral-800">
            <CardHeader>
              <CardTitle>Post-Processing</CardTitle>
              <CardDescription className="text-neutral-400">
                Configure grain, color grade style, contrast, and vignette
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Grain Level */}
                <div className="space-y-3">
                  <Label htmlFor="grain">Grain Level</Label>
                  <Select
                    value={profile.post_processing.grain_level}
                    onValueChange={(value: any) => {
                      setProfile({
                        ...profile,
                        post_processing: { ...profile.post_processing, grain_level: value },
                        updated_at: new Date().toISOString()
                      });
                      setSelectedPreset('custom');
                    }}
                  >
                    <SelectTrigger id="grain" className="bg-neutral-800 border-neutral-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700">
                      <SelectItem value="none">None (clean digital)</SelectItem>
                      <SelectItem value="subtle">Subtle (fine texture)</SelectItem>
                      <SelectItem value="medium">Medium (noticeable)</SelectItem>
                      <SelectItem value="heavy">Heavy (pronounced)</SelectItem>
                      <SelectItem value="film_grain">Film Grain (authentic 35mm)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Color Grade Style */}
                <div className="space-y-3">
                  <Label htmlFor="grade">Color Grade Style</Label>
                  <Select
                    value={profile.post_processing.color_grade_style}
                    onValueChange={(value: any) => {
                      setProfile({
                        ...profile,
                        post_processing: { ...profile.post_processing, color_grade_style: value },
                        updated_at: new Date().toISOString()
                      });
                      setSelectedPreset('custom');
                    }}
                  >
                    <SelectTrigger id="grade" className="bg-neutral-800 border-neutral-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700">
                      <SelectItem value="naturalistic">Naturalistic (true to life)</SelectItem>
                      <SelectItem value="desaturated">Desaturated (muted, gritty)</SelectItem>
                      <SelectItem value="high_saturation">High Saturation (vibrant)</SelectItem>
                      <SelectItem value="teal_orange">Teal & Orange (blockbuster)</SelectItem>
                      <SelectItem value="monochrome">Monochrome (black & white)</SelectItem>
                      <SelectItem value="bleach_bypass">Bleach Bypass (desaturated contrast)</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Contrast Post */}
                <div className="space-y-3">
                  <Label htmlFor="post-contrast">Contrast Adjustment</Label>
                  <Select
                    value={profile.post_processing.contrast}
                    onValueChange={(value: any) => {
                      setProfile({
                        ...profile,
                        post_processing: { ...profile.post_processing, contrast: value },
                        updated_at: new Date().toISOString()
                      });
                      setSelectedPreset('custom');
                    }}
                  >
                    <SelectTrigger id="post-contrast" className="bg-neutral-800 border-neutral-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700">
                      <SelectItem value="crushed_blacks">Crushed Blacks (deep, dramatic)</SelectItem>
                      <SelectItem value="lifted_blacks">Lifted Blacks (milky, vintage)</SelectItem>
                      <SelectItem value="normal">Normal (standard curve)</SelectItem>
                      <SelectItem value="low_contrast">Low Contrast (flat, soft)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Vignette */}
                <div className="space-y-3">
                  <Label htmlFor="vignette">Vignette</Label>
                  <Select
                    value={profile.post_processing.vignette}
                    onValueChange={(value: any) => {
                      setProfile({
                        ...profile,
                        post_processing: { ...profile.post_processing, vignette: value },
                        updated_at: new Date().toISOString()
                      });
                      setSelectedPreset('custom');
                    }}
                  >
                    <SelectTrigger id="vignette" className="bg-neutral-800 border-neutral-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-neutral-800 border-neutral-700">
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="subtle">Subtle (gentle edge darkening)</SelectItem>
                      <SelectItem value="medium">Medium (noticeable)</SelectItem>
                      <SelectItem value="heavy">Heavy (dramatic, vintage)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator className="bg-neutral-800" />

              {/* Director's Vision Notes */}
              <div className="space-y-3">
                <Label htmlFor="notes">Director's Vision Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Describe your visual inspiration, reference films, or specific aesthetic goals..."
                  value={profile.inspiration_notes || ''}
                  onChange={(e) => {
                    setProfile({ ...profile, inspiration_notes: e.target.value, updated_at: new Date().toISOString() });
                    setSelectedPreset('custom');
                  }}
                  className="min-h-[100px] bg-neutral-800 border-neutral-700 text-neutral-100 placeholder:text-neutral-500"
                />
                <p className="text-xs text-neutral-500">
                  These notes will be included in the AI prompts to guide visual style generation
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex gap-3 justify-end pt-4 border-t border-neutral-800">
        <Button
          variant="outline"
          onClick={handleReset}
          className="border-neutral-700 hover:bg-neutral-800"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset to Default
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[#E50914] hover:bg-[#B20710] text-white"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Visual Profile'}
        </Button>
      </div>
    </div>
  );
}
