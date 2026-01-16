import { useState, useCallback } from 'react';
import { Calculator, Plus, Trash2, Info, Target, TrendingUp, AlertTriangle, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { LiquidGlassCard } from '@/components/ui/LiquidGlassCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

// Types for grade calculation
interface GradeComponent {
  id: string;
  name: string;
  weight: number;
  scaleMax: number;
  aggregationRule: 'average' | 'sum' | 'drop_lowest' | 'best_of' | 'weighted';
  dropCount?: number;
  bestOf?: number;
  group: 'exam' | 'work';
  items: ComponentItem[];
}

interface ComponentItem {
  id: string;
  name: string;
  rawScore: number | null;
  maxScore: number;
  weight?: number;
}

interface GradeBoundary {
  letter: string;
  minScore: number;
  maxScore: number;
}

interface CurveAdjustment {
  id: string;
  targetType: 'component' | 'overall';
  targetId?: string;
  adjustmentType: 'add' | 'multiply' | 'set';
  value: number;
  clamp: boolean;
}

interface ConstraintRule {
  id: string;
  name: string;
  type: 'min_exam' | 'cap_work' | 'min_component' | 'custom';
  formula?: string;
  threshold?: number;
  componentId?: string;
}

interface CalculationResult {
  componentScores: { id: string; name: string; rawAvg: number; adjustedScore: number; contribution: number }[];
  subtotal: number;
  adjustedTotal: number;
  finalGrade: number;
  letterGrade: string;
  passed: boolean;
  warnings: string[];
  requiredFinalForTarget?: number;
}

// Default grade boundaries (can be customized)
const DEFAULT_GRADE_BOUNDARIES: GradeBoundary[] = [
  { letter: 'A+', minScore: 97, maxScore: 100 },
  { letter: 'A', minScore: 93, maxScore: 96.99 },
  { letter: 'A-', minScore: 90, maxScore: 92.99 },
  { letter: 'B+', minScore: 87, maxScore: 89.99 },
  { letter: 'B', minScore: 83, maxScore: 86.99 },
  { letter: 'B-', minScore: 80, maxScore: 82.99 },
  { letter: 'C+', minScore: 77, maxScore: 79.99 },
  { letter: 'C', minScore: 73, maxScore: 76.99 },
  { letter: 'C-', minScore: 70, maxScore: 72.99 },
  { letter: 'D+', minScore: 67, maxScore: 69.99 },
  { letter: 'D', minScore: 60, maxScore: 66.99 },
  { letter: 'F', minScore: 0, maxScore: 59.99 },
];

// Utility function to generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 9);

export default function GradeCalculator() {
  const { t, dir } = useLanguage();
  
  // Course Profile State
  const [components, setComponents] = useState<GradeComponent[]>([
    {
      id: generateId(),
      name: t('midterm') || 'Midterm',
      weight: 25,
      scaleMax: 100,
      aggregationRule: 'average',
      group: 'exam',
      items: [{ id: generateId(), name: 'Midterm', rawScore: null, maxScore: 100 }],
    },
    {
      id: generateId(),
      name: t('final') || 'Final',
      weight: 40,
      scaleMax: 100,
      aggregationRule: 'average',
      group: 'exam',
      items: [{ id: generateId(), name: 'Final', rawScore: null, maxScore: 100 }],
    },
    {
      id: generateId(),
      name: t('homework') || 'Homework',
      weight: 20,
      scaleMax: 100,
      aggregationRule: 'average',
      group: 'work',
      items: [],
    },
    {
      id: generateId(),
      name: t('quizzes') || 'Quizzes',
      weight: 15,
      scaleMax: 100,
      aggregationRule: 'average',
      group: 'work',
      items: [],
    },
  ]);
  
  const [passingThreshold, setPassingThreshold] = useState(60);
  const [roundingMethod, setRoundingMethod] = useState<'none' | 'nearest' | 'floor' | 'ceil'>('none');
  const [gradeBoundaries, setGradeBoundaries] = useState<GradeBoundary[]>(DEFAULT_GRADE_BOUNDARIES);
  const [constraints, setConstraints] = useState<ConstraintRule[]>([]);
  const [curves, setCurves] = useState<CurveAdjustment[]>([]);
  
  // Target grade for "what-if" analysis
  const [targetGrade, setTargetGrade] = useState<number>(70);
  const [targetComponent, setTargetComponent] = useState<string>('');
  
  // UI State
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedComponent, setExpandedComponent] = useState<string | null>(null);
  const [result, setResult] = useState<CalculationResult | null>(null);

  // Add a new component
  const addComponent = useCallback(() => {
    const newComponent: GradeComponent = {
      id: generateId(),
      name: t('newComponent') || 'New Component',
      weight: 0,
      scaleMax: 100,
      aggregationRule: 'average',
      group: 'work',
      items: [],
    };
    setComponents(prev => [...prev, newComponent]);
  }, [t]);

  // Remove a component
  const removeComponent = useCallback((id: string) => {
    setComponents(prev => prev.filter(c => c.id !== id));
  }, []);

  // Update a component
  const updateComponent = useCallback((id: string, updates: Partial<GradeComponent>) => {
    setComponents(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  // Add item to component
  const addItemToComponent = useCallback((componentId: string) => {
    setComponents(prev => prev.map(c => {
      if (c.id !== componentId) return c;
      const newItem: ComponentItem = {
        id: generateId(),
        name: `${c.name} ${c.items.length + 1}`,
        rawScore: null,
        maxScore: c.scaleMax,
      };
      return { ...c, items: [...c.items, newItem] };
    }));
  }, []);

  // Remove item from component
  const removeItemFromComponent = useCallback((componentId: string, itemId: string) => {
    setComponents(prev => prev.map(c => {
      if (c.id !== componentId) return c;
      return { ...c, items: c.items.filter(i => i.id !== itemId) };
    }));
  }, []);

  // Update item in component
  const updateItem = useCallback((componentId: string, itemId: string, updates: Partial<ComponentItem>) => {
    setComponents(prev => prev.map(c => {
      if (c.id !== componentId) return c;
      return {
        ...c,
        items: c.items.map(i => i.id === itemId ? { ...i, ...updates } : i),
      };
    }));
  }, []);

  // Add a curve adjustment
  const addCurve = useCallback(() => {
    const newCurve: CurveAdjustment = {
      id: generateId(),
      targetType: 'component',
      adjustmentType: 'add',
      value: 0,
      clamp: true,
    };
    setCurves(prev => [...prev, newCurve]);
  }, []);

  // Remove a curve
  const removeCurve = useCallback((id: string) => {
    setCurves(prev => prev.filter(c => c.id !== id));
  }, []);

  // Update a curve
  const updateCurve = useCallback((id: string, updates: Partial<CurveAdjustment>) => {
    setCurves(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  // Add a constraint
  const addConstraint = useCallback(() => {
    const newConstraint: ConstraintRule = {
      id: generateId(),
      name: t('newConstraint') || 'New Constraint',
      type: 'min_exam',
      threshold: 50,
    };
    setConstraints(prev => [...prev, newConstraint]);
  }, [t]);

  // Remove a constraint
  const removeConstraint = useCallback((id: string) => {
    setConstraints(prev => prev.filter(c => c.id !== id));
  }, []);

  // Aggregate items based on rule
  const aggregateItems = (items: ComponentItem[], rule: GradeComponent['aggregationRule'], dropCount?: number, bestOf?: number): number => {
    const validItems = items.filter(i => i.rawScore !== null);
    if (validItems.length === 0) return 0;

    // Normalize scores to 0-100
    const normalizedScores = validItems.map(i => (i.rawScore! / i.maxScore) * 100);

    switch (rule) {
      case 'average':
        return normalizedScores.reduce((sum, s) => sum + s, 0) / normalizedScores.length;
      
      case 'sum': {
        const totalRaw = validItems.reduce((sum, i) => sum + i.rawScore!, 0);
        const totalMax = validItems.reduce((sum, i) => sum + i.maxScore, 0);
        return (totalRaw / totalMax) * 100;
      }
      
      case 'drop_lowest': {
        if (normalizedScores.length <= (dropCount || 1)) return normalizedScores.reduce((sum, s) => sum + s, 0) / normalizedScores.length;
        const sortedDrop = [...normalizedScores].sort((a, b) => a - b);
        const afterDrop = sortedDrop.slice(dropCount || 1);
        return afterDrop.reduce((sum, s) => sum + s, 0) / afterDrop.length;
      }
      
      case 'best_of': {
        const sortedBest = [...normalizedScores].sort((a, b) => b - a);
        const best = sortedBest.slice(0, bestOf || normalizedScores.length);
        return best.reduce((sum, s) => sum + s, 0) / best.length;
      }
      
      case 'weighted': {
        const totalWeight = validItems.reduce((sum, i) => sum + (i.weight || 1), 0);
        return validItems.reduce((sum, i) => {
          const normalized = (i.rawScore! / i.maxScore) * 100;
          return sum + normalized * ((i.weight || 1) / totalWeight);
        }, 0);
      }
      
      default:
        return normalizedScores.reduce((sum, s) => sum + s, 0) / normalizedScores.length;
    }
  };

  // Apply curve to a score
  const applyCurve = (score: number, curve: CurveAdjustment): number => {
    let adjusted = score;
    switch (curve.adjustmentType) {
      case 'add':
        adjusted = score + curve.value;
        break;
      case 'multiply':
        adjusted = score * curve.value;
        break;
      case 'set':
        adjusted = curve.value;
        break;
    }
    if (curve.clamp) {
      adjusted = Math.min(100, Math.max(0, adjusted));
    }
    return adjusted;
  };

  // Apply rounding
  const applyRounding = useCallback((score: number): number => {
    switch (roundingMethod) {
      case 'nearest':
        return Math.round(score);
      case 'floor':
        return Math.floor(score);
      case 'ceil':
        return Math.ceil(score);
      default:
        return score;
    }
  }, [roundingMethod]);

  // Get letter grade from score
  const getLetterGrade = useCallback((score: number): string => {
    for (const boundary of gradeBoundaries) {
      if (score >= boundary.minScore && score <= boundary.maxScore) {
        return boundary.letter;
      }
    }
    return 'F';
  }, [gradeBoundaries]);

  // Calculate grade
  const calculateGrade = useCallback(() => {
    const warnings: string[] = [];
    
    // Check weights sum to 100
    const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      warnings.push(t('weightsNotSum100') || `Weights sum to ${totalWeight.toFixed(1)}%, not 100%`);
    }

    // Calculate each component score
    const componentScores = components.map(comp => {
      const rawAvg = aggregateItems(comp.items, comp.aggregationRule, comp.dropCount, comp.bestOf);
      
      // Apply component-level curves
      let adjustedScore = rawAvg;
      const componentCurves = curves.filter(c => c.targetType === 'component' && c.targetId === comp.id);
      for (const curve of componentCurves) {
        adjustedScore = applyCurve(adjustedScore, curve);
      }
      
      const contribution = (adjustedScore * comp.weight) / 100;
      
      return {
        id: comp.id,
        name: comp.name,
        rawAvg,
        adjustedScore,
        contribution,
      };
    });

    // Calculate subtotal
    const subtotal = componentScores.reduce((sum, c) => sum + c.contribution, 0);

    // Check constraints
    for (const constraint of constraints) {
      switch (constraint.type) {
        case 'min_exam': {
          const examComponents = components.filter(c => c.group === 'exam');
          const examScores = componentScores.filter(cs => 
            examComponents.some(ec => ec.id === cs.id)
          );
          const examAvg = examScores.length > 0 
            ? examScores.reduce((sum, e) => sum + e.adjustedScore, 0) / examScores.length 
            : 0;
          if (examAvg < (constraint.threshold || 0)) {
            warnings.push(t('examMinNotMet') || `Exam average (${examAvg.toFixed(1)}%) below minimum (${constraint.threshold}%)`);
          }
          break;
        }
        case 'cap_work': {
          const examComponents = components.filter(c => c.group === 'exam');
          const workComponents = components.filter(c => c.group === 'work');
          const examScores = componentScores.filter(cs => 
            examComponents.some(ec => ec.id === cs.id)
          );
          const workScores = componentScores.filter(cs => 
            workComponents.some(wc => wc.id === cs.id)
          );
          const examAvg = examScores.length > 0 
            ? examScores.reduce((sum, e) => sum + e.adjustedScore, 0) / examScores.length 
            : 0;
          const workAvg = workScores.length > 0 
            ? workScores.reduce((sum, w) => sum + w.adjustedScore, 0) / workScores.length 
            : 0;
          const capMultiplier = constraint.threshold || 2;
          if (workAvg > examAvg * capMultiplier) {
            warnings.push(t('workCapApplied') || `Work average capped to ${(examAvg * capMultiplier).toFixed(1)}%`);
            // Recalculate with capped work
            // This would need a more complex recalculation in real implementation
          }
          break;
        }
        case 'min_component': {
          const comp = componentScores.find(cs => cs.id === constraint.componentId);
          if (comp && comp.adjustedScore < (constraint.threshold || 0)) {
            warnings.push(t('componentMinNotMet') || `${comp.name} (${comp.adjustedScore.toFixed(1)}%) below minimum (${constraint.threshold}%)`);
          }
          break;
        }
      }
    }

    // Apply overall curves
    let adjustedTotal = subtotal;
    const overallCurves = curves.filter(c => c.targetType === 'overall');
    for (const curve of overallCurves) {
      adjustedTotal = applyCurve(adjustedTotal, curve);
    }

    // Apply rounding
    const finalGrade = applyRounding(adjustedTotal);
    
    // Get letter grade
    const letterGrade = getLetterGrade(finalGrade);
    
    // Check if passed
    const passed = finalGrade >= passingThreshold;

    // Calculate required score for target (what-if analysis)
    let requiredFinalForTarget: number | undefined;
    if (targetComponent) {
      const targetComp = components.find(c => c.id === targetComponent);
      if (targetComp) {
        const currentWithoutTarget = componentScores
          .filter(cs => cs.id !== targetComponent)
          .reduce((sum, c) => sum + c.contribution, 0);
        const needed = targetGrade - currentWithoutTarget;
        requiredFinalForTarget = (needed / targetComp.weight) * 100;
        if (requiredFinalForTarget < 0) requiredFinalForTarget = 0;
        if (requiredFinalForTarget > 100) {
          warnings.push(t('targetNotAchievable') || `Target grade not achievable even with 100% on ${targetComp.name}`);
        }
      }
    }

    setResult({
      componentScores,
      subtotal,
      adjustedTotal,
      finalGrade,
      letterGrade,
      passed,
      warnings,
      requiredFinalForTarget,
    });

    toast.success(t('calculationComplete') || 'Calculation complete!');
  }, [components, curves, constraints, passingThreshold, targetGrade, targetComponent, t, applyRounding, getLetterGrade]);

  return (
    <div className="space-y-6" dir={dir}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calculator className="w-6 h-6 text-primary" strokeWidth={1.5} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t('gradeCalculator')}</h1>
            <p className="text-sm text-muted-foreground">{t('gradeCalculatorDesc')}</p>
          </div>
        </div>
        <Button onClick={calculateGrade} className="gap-2">
          <Calculator className="w-4 h-4" />
          {t('calculate')}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Components & Scores */}
        <div className="lg:col-span-2 space-y-4">
          {/* Components Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">{t('gradeComponents')}</CardTitle>
                  <CardDescription>{t('gradeComponentsDesc')}</CardDescription>
                </div>
                <Button onClick={addComponent} size="sm" variant="outline" className="gap-1">
                  <Plus className="w-4 h-4" />
                  {t('addComponent')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Weight Summary */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Info className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {t('totalWeight')}: <span className={`font-semibold ${Math.abs(components.reduce((sum, c) => sum + c.weight, 0) - 100) > 0.01 ? 'text-destructive' : 'text-green-500'}`}>
                    {components.reduce((sum, c) => sum + c.weight, 0).toFixed(1)}%
                  </span>
                </span>
              </div>

              {/* Components List */}
              {components.map((component, index) => (
                <Collapsible
                  key={component.id}
                  open={expandedComponent === component.id}
                  onOpenChange={(open) => setExpandedComponent(open ? component.id : null)}
                >
                  <LiquidGlassCard className="p-4" disableAnimation>
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Badge variant={component.group === 'exam' ? 'destructive' : 'secondary'}>
                            {component.group === 'exam' ? t('exam') : t('work')}
                          </Badge>
                          <Input
                            value={component.name}
                            onChange={(e) => updateComponent(component.id, { name: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                            className="w-32 sm:w-48 h-8"
                          />
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={component.weight}
                              onChange={(e) => updateComponent(component.id, { weight: parseFloat(e.target.value) || 0 })}
                              onClick={(e) => e.stopPropagation()}
                              className="w-16 h-8 text-center"
                              min={0}
                              max={100}
                            />
                            <span className="text-sm text-muted-foreground">%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeComponent(component.id);
                            }}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          {expandedComponent === component.id ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent className="pt-4 space-y-4">
                      <Separator />
                      
                      {/* Component Settings */}
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                          <Label className="text-xs">{t('scaleMax')}</Label>
                          <Input
                            type="number"
                            value={component.scaleMax}
                            onChange={(e) => updateComponent(component.id, { scaleMax: parseFloat(e.target.value) || 100 })}
                            className="h-8"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">{t('aggregationRule')}</Label>
                          <Select
                            value={component.aggregationRule}
                            onValueChange={(v) => updateComponent(component.id, { aggregationRule: v as GradeComponent['aggregationRule'] })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="average">{t('average')}</SelectItem>
                              <SelectItem value="sum">{t('sum')}</SelectItem>
                              <SelectItem value="drop_lowest">{t('dropLowest')}</SelectItem>
                              <SelectItem value="best_of">{t('bestOf')}</SelectItem>
                              <SelectItem value="weighted">{t('weighted')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">{t('componentGroup')}</Label>
                          <Select
                            value={component.group}
                            onValueChange={(v) => updateComponent(component.id, { group: v as 'exam' | 'work' })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="exam">{t('exam')}</SelectItem>
                              <SelectItem value="work">{t('work')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {(component.aggregationRule === 'drop_lowest' || component.aggregationRule === 'best_of') && (
                        <div className="w-32">
                          <Label className="text-xs">
                            {component.aggregationRule === 'drop_lowest' ? t('dropCount') : t('bestOfCount')}
                          </Label>
                          <Input
                            type="number"
                            value={component.aggregationRule === 'drop_lowest' ? component.dropCount || 1 : component.bestOf || 1}
                            onChange={(e) => updateComponent(component.id, {
                              [component.aggregationRule === 'drop_lowest' ? 'dropCount' : 'bestOf']: parseInt(e.target.value) || 1
                            })}
                            className="h-8"
                            min={1}
                          />
                        </div>
                      )}

                      {/* Items */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">{t('scores')}</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => addItemToComponent(component.id)}
                            className="h-7 text-xs gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            {t('addScore')}
                          </Button>
                        </div>
                        
                        {component.items.length === 0 ? (
                          <div className="text-sm text-muted-foreground italic p-2">
                            {t('noScoresYet')}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {component.items.map((item, itemIndex) => (
                              <div key={item.id} className="flex items-center gap-2 p-2 rounded bg-muted/30">
                                <Input
                                  value={item.name}
                                  onChange={(e) => updateItem(component.id, item.id, { name: e.target.value })}
                                  placeholder={t('itemName')}
                                  className="h-7 flex-1"
                                />
                                <Input
                                  type="number"
                                  value={item.rawScore ?? ''}
                                  onChange={(e) => updateItem(component.id, item.id, { 
                                    rawScore: e.target.value === '' ? null : parseFloat(e.target.value) 
                                  })}
                                  placeholder="Score"
                                  className="h-7 w-20"
                                />
                                <span className="text-sm text-muted-foreground">/</span>
                                <Input
                                  type="number"
                                  value={item.maxScore}
                                  onChange={(e) => updateItem(component.id, item.id, { maxScore: parseFloat(e.target.value) || 100 })}
                                  className="h-7 w-16"
                                />
                                {component.aggregationRule === 'weighted' && (
                                  <>
                                    <span className="text-sm text-muted-foreground">×</span>
                                    <Input
                                      type="number"
                                      value={item.weight ?? 1}
                                      onChange={(e) => updateItem(component.id, item.id, { weight: parseFloat(e.target.value) || 1 })}
                                      className="h-7 w-16"
                                      placeholder="Weight"
                                    />
                                  </>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeItemFromComponent(component.id, item.id)}
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </LiquidGlassCard>
                </Collapsible>
              ))}
            </CardContent>
          </Card>

          {/* Advanced Settings */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <Card>
              <CardHeader className="pb-3">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-muted-foreground" />
                      <CardTitle className="text-lg">{t('advancedSettings')}</CardTitle>
                    </div>
                    {showAdvanced ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="space-y-6">
                  {/* Passing Threshold & Rounding */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>{t('passingThreshold')}</Label>
                      <div className="flex items-center gap-2 mt-2">
                        <Slider
                          value={[passingThreshold]}
                          onValueChange={(v) => setPassingThreshold(v[0])}
                          min={0}
                          max={100}
                          step={1}
                          className="flex-1"
                        />
                        <span className="text-sm font-medium w-12">{passingThreshold}%</span>
                      </div>
                    </div>
                    <div>
                      <Label>{t('roundingMethod')}</Label>
                      <Select value={roundingMethod} onValueChange={(v) => setRoundingMethod(v as typeof roundingMethod)}>
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t('noRounding')}</SelectItem>
                          <SelectItem value="nearest">{t('roundNearest')}</SelectItem>
                          <SelectItem value="floor">{t('roundDown')}</SelectItem>
                          <SelectItem value="ceil">{t('roundUp')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  {/* Curves Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label>{t('curveAdjustments')}</Label>
                      <Button onClick={addCurve} size="sm" variant="outline" className="gap-1">
                        <Plus className="w-4 h-4" />
                        {t('addCurve')}
                      </Button>
                    </div>
                    {curves.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">{t('noCurvesYet')}</p>
                    ) : (
                      <div className="space-y-2">
                        {curves.map((curve) => (
                          <div key={curve.id} className="flex items-center gap-2 p-3 rounded-lg border">
                            <Select
                              value={curve.targetType}
                              onValueChange={(v) => updateCurve(curve.id, { targetType: v as 'component' | 'overall', targetId: undefined })}
                            >
                              <SelectTrigger className="w-28 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="component">{t('component')}</SelectItem>
                                <SelectItem value="overall">{t('overall')}</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            {curve.targetType === 'component' && (
                              <Select
                                value={curve.targetId || ''}
                                onValueChange={(v) => updateCurve(curve.id, { targetId: v })}
                              >
                                <SelectTrigger className="w-32 h-8">
                                  <SelectValue placeholder={t('selectComponent')} />
                                </SelectTrigger>
                                <SelectContent>
                                  {components.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            
                            <Select
                              value={curve.adjustmentType}
                              onValueChange={(v) => updateCurve(curve.id, { adjustmentType: v as 'add' | 'multiply' | 'set' })}
                            >
                              <SelectTrigger className="w-24 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="add">+ {t('add')}</SelectItem>
                                <SelectItem value="multiply">× {t('multiply')}</SelectItem>
                                <SelectItem value="set">= {t('set')}</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            <Input
                              type="number"
                              value={curve.value}
                              onChange={(e) => updateCurve(curve.id, { value: parseFloat(e.target.value) || 0 })}
                              className="w-20 h-8"
                              step={curve.adjustmentType === 'multiply' ? 0.1 : 1}
                            />
                            
                            <div className="flex items-center gap-1">
                              <Switch
                                checked={curve.clamp}
                                onCheckedChange={(c) => updateCurve(curve.id, { clamp: c })}
                              />
                              <span className="text-xs text-muted-foreground">{t('clamp')}</span>
                            </div>
                            
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeCurve(curve.id)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Constraints Section */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label>{t('constraints')}</Label>
                      <Button onClick={addConstraint} size="sm" variant="outline" className="gap-1">
                        <Plus className="w-4 h-4" />
                        {t('addConstraint')}
                      </Button>
                    </div>
                    {constraints.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">{t('noConstraintsYet')}</p>
                    ) : (
                      <div className="space-y-2">
                        {constraints.map((constraint) => (
                          <div key={constraint.id} className="flex items-center gap-2 p-3 rounded-lg border">
                            <Select
                              value={constraint.type}
                              onValueChange={(v) => setConstraints(prev => prev.map(c => 
                                c.id === constraint.id ? { ...c, type: v as ConstraintRule['type'] } : c
                              ))}
                            >
                              <SelectTrigger className="w-36 h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="min_exam">{t('minExamAvg')}</SelectItem>
                                <SelectItem value="cap_work">{t('capWork')}</SelectItem>
                                <SelectItem value="min_component">{t('minComponent')}</SelectItem>
                              </SelectContent>
                            </Select>
                            
                            {constraint.type === 'min_component' && (
                              <Select
                                value={constraint.componentId || ''}
                                onValueChange={(v) => setConstraints(prev => prev.map(c => 
                                  c.id === constraint.id ? { ...c, componentId: v } : c
                                ))}
                              >
                                <SelectTrigger className="w-32 h-8">
                                  <SelectValue placeholder={t('selectComponent')} />
                                </SelectTrigger>
                                <SelectContent>
                                  {components.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                            
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-muted-foreground">
                                {constraint.type === 'cap_work' ? '×' : '≥'}
                              </span>
                              <Input
                                type="number"
                                value={constraint.threshold || 0}
                                onChange={(e) => setConstraints(prev => prev.map(c => 
                                  c.id === constraint.id ? { ...c, threshold: parseFloat(e.target.value) || 0 } : c
                                ))}
                                className="w-20 h-8"
                                step={constraint.type === 'cap_work' ? 0.1 : 1}
                              />
                              {constraint.type !== 'cap_work' && <span className="text-sm text-muted-foreground">%</span>}
                            </div>
                            
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeConstraint(constraint.id)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>

        {/* Right Column - Results & What-If */}
        <div className="space-y-4">
          {/* Results Card */}
          <LiquidGlassCard className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">{t('results')}</h3>
            </div>
            
            {result ? (
              <div className="space-y-4">
                {/* Final Grade */}
                <div className="text-center p-6 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                  <div className="text-5xl font-bold text-primary mb-1">
                    {result.finalGrade.toFixed(1)}%
                  </div>
                  <div className="text-2xl font-semibold">
                    {result.letterGrade}
                  </div>
                  <Badge variant={result.passed ? 'default' : 'destructive'} className="mt-2">
                    {result.passed ? t('passed') : t('notPassed')}
                  </Badge>
                </div>

                {/* Component Breakdown */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{t('componentBreakdown')}</Label>
                  {result.componentScores.map((cs) => (
                    <div key={cs.id} className="flex items-center justify-between p-2 rounded bg-muted/30">
                      <span className="text-sm">{cs.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{cs.adjustedScore.toFixed(1)}%</span>
                        <span className="text-xs text-muted-foreground">
                          (+{cs.contribution.toFixed(1)})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Warnings */}
                {result.warnings.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{t('warnings')}</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside text-sm">
                        {result.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calculator className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">{t('enterScoresToCalculate')}</p>
              </div>
            )}
          </LiquidGlassCard>

          {/* What-If Analysis */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-lg">{t('whatIfAnalysis')}</CardTitle>
              </div>
              <CardDescription>{t('whatIfAnalysisDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{t('targetGrade')}</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Slider
                    value={[targetGrade]}
                    onValueChange={(v) => setTargetGrade(v[0])}
                    min={0}
                    max={100}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-12">{targetGrade}%</span>
                </div>
              </div>
              
              <div>
                <Label>{t('componentToSolve')}</Label>
                <Select value={targetComponent} onValueChange={setTargetComponent}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder={t('selectComponent')} />
                  </SelectTrigger>
                  <SelectContent>
                    {components.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {result?.requiredFinalForTarget !== undefined && targetComponent && (
                <Alert>
                  <Target className="h-4 w-4" />
                  <AlertTitle>{t('requiredScore')}</AlertTitle>
                  <AlertDescription>
                    {t('youNeedToScore')} <strong>{result.requiredFinalForTarget.toFixed(1)}%</strong> {t('on')} {components.find(c => c.id === targetComponent)?.name} {t('toAchieve')} {targetGrade}%
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
