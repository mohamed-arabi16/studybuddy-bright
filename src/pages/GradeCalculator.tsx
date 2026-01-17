import { useState, useCallback, useEffect } from 'react';
import { Calculator, Plus, Trash2, Info, Target, TrendingUp, AlertTriangle, ChevronDown, ChevronUp, Settings2, BookOpen, Sparkles, Link2, Link2Off, Zap, HelpCircle, Save, Loader2, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { AggregationRuleDialog } from '@/components/AggregationRuleDialog';
import { FreeUserUpgradeDialog } from '@/components/FreeUserUpgradeDialog';

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
  isFinalExam?: boolean; // Indicates if this is a final exam (scores are optional)
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

// Tolerance for weight sum comparison
const WEIGHT_TOLERANCE = 0.01;

// Utility function to generate unique IDs
const generateId = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

// Course type for selection
interface Course {
  id: string;
  title: string;
  exam_date: string | null;
}

// Info Tooltip Component
function InfoTooltip({ content }: { content: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help inline-flex ml-1" />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function GradeCalculator() {
  const { t, dir } = useLanguage();
  const { isPro } = useSubscription();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Start dialog state
  const [showStartDialog, setShowStartDialog] = useState(true);
  const [startOption, setStartOption] = useState<'existing' | 'create' | 'none' | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [showProSuggestion, setShowProSuggestion] = useState(false);
  const [showFreeUserWarning, setShowFreeUserWarning] = useState(false);
  
  // Save/Load state (Pro users)
  const [savedCalculationId, setSavedCalculationId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [savedCalculations, setSavedCalculations] = useState<Array<{id: string; profile_name: string; updated_at: string}>>([]);
  
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
      isFinalExam: true, // Final exam scores are optional
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
  
  // Auto-save state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

  // Fetch user's courses
  const fetchCourses = useCallback(async () => {
    setLoadingCourses(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, exam_date')
        .eq('user_id', user.id)
        .neq('status', 'archived')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
    
    // Check for courseId from URL (returning from course creation)
    const urlCourseId = searchParams.get('courseId');
    if (urlCourseId) {
      setSelectedCourseId(urlCourseId);
      setShowStartDialog(false);
    }
  }, [fetchCourses, searchParams]);

  // Update selectedCourse when selectedCourseId changes
  useEffect(() => {
    if (selectedCourseId) {
      const course = courses.find(c => c.id === selectedCourseId);
      setSelectedCourse(course || null);
      // Load saved grades for this course if Pro user
      if (course && isPro) {
        loadSavedGrades(selectedCourseId);
      }
    }
  }, [selectedCourseId, courses, isPro]);

  // Track changes in components, curves, constraints, etc.
  useEffect(() => {
    // Mark as having unsaved changes when any calculation data changes
    if (selectedCourseId && isPro) {
      setHasUnsavedChanges(true);
    }
  }, [components, curves, constraints, passingThreshold, roundingMethod, selectedCourseId, isPro]);

  // Handle start option selection
  const handleStartOptionSelect = (option: 'existing' | 'create' | 'none') => {
    setStartOption(option);
    if (option === 'existing') {
      // Keep dialog open to show course selection
    } else if (option === 'create') {
      // Store return intent and navigate to courses
      sessionStorage.setItem('returnToGradeCalc', 'true');
      navigate('/app/courses?create=true');
    } else if (option === 'none') {
      // For free users, show warning dialog
      if (!isPro) {
        setShowFreeUserWarning(true);
      } else {
        setShowStartDialog(false);
      }
    }
  };

  // Handle course selection
  const handleCourseSelect = (courseId: string) => {
    setSelectedCourseId(courseId);
    const course = courses.find(c => c.id === courseId);
    setSelectedCourse(course || null);
    setShowStartDialog(false);
  };

  // Handle free user warning continue
  const handleFreeUserContinue = () => {
    setShowFreeUserWarning(false);
    setShowStartDialog(false);
  };

  // Save grades to database (Pro users only)
  const saveGrades = useCallback(async (showToast: boolean = true) => {
    if (!isPro || !selectedCourseId) return;
    
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const gradeData = {
        user_id: user.id,
        course_id: selectedCourseId,
        profile_name: selectedCourse?.title || 'Grade Calculation',
        components: components as any,
        settings: { passingThreshold, roundingMethod, curves, constraints } as any,
        result: result as any,
      };
      
      if (savedCalculationId) {
        // Update existing
        const { error } = await supabase
          .from('grade_calculations')
          .update(gradeData)
          .eq('id', savedCalculationId);
        if (error) throw error;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('grade_calculations')
          .insert(gradeData)
          .select('id')
          .single();
        if (error) throw error;
        setSavedCalculationId(data.id);
      }
      
      setLastSaved(new Date());
      if (showToast) {
        toast.success(t('gradesSaved'));
      }
    } catch (error: any) {
      console.error('Save error:', error);
      if (showToast) {
        toast.error(t('gradesSaveFailed'));
      }
    } finally {
      setIsSaving(false);
    }
  }, [isPro, selectedCourseId, selectedCourse, components, passingThreshold, roundingMethod, curves, constraints, result, savedCalculationId, t]);

  // Auto-save with 5-second interval
  useEffect(() => {
    // Only auto-save for Pro users with a connected course
    if (!isPro || !selectedCourseId || !autoSaveEnabled || !hasUnsavedChanges) {
      return;
    }
    
    const autoSaveTimer = setInterval(async () => {
      if (hasUnsavedChanges) {
        await saveGrades(false); // Don't show toast on auto-save
        setHasUnsavedChanges(false);
      }
    }, 5000); // 5 seconds
    
    return () => clearInterval(autoSaveTimer);
  }, [isPro, selectedCourseId, autoSaveEnabled, hasUnsavedChanges, saveGrades]);

  // Load saved grades from database
  const loadSavedGrades = useCallback(async (courseId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      // Fetch all calculations for this course
      const { data: allCalcs, error: listError } = await supabase
        .from('grade_calculations')
        .select('id, profile_name, updated_at')
        .eq('course_id', courseId)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      
      if (listError) throw listError;
      setSavedCalculations(allCalcs || []);
      
      // Load the most recent one by default
      if (allCalcs && allCalcs.length > 0) {
        await loadSpecificCalculation(allCalcs[0].id);
      }
    } catch (error) {
      console.error('Load error:', error);
    }
  }, [t]);

  const loadSpecificCalculation = useCallback(async (calculationId: string) => {
    try {
      const { data, error } = await supabase
        .from('grade_calculations')
        .select('*')
        .eq('id', calculationId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setSavedCalculationId(data.id);
        if (data.components) setComponents(data.components as any);
        if (data.settings) {
          const settings = data.settings as any;
          if (settings.passingThreshold) setPassingThreshold(settings.passingThreshold);
          if (settings.roundingMethod) setRoundingMethod(settings.roundingMethod);
          if (settings.curves) setCurves(settings.curves);
          if (settings.constraints) setConstraints(settings.constraints);
        }
        if (data.result) setResult(data.result as any);
        toast.success(t('gradesLoaded'));
      }
    } catch (error) {
      console.error('Load specific calculation error:', error);
    }
  }, [t]);

  // Handle Start Again - saves current and resets
  const handleStartAgain = useCallback(async () => {
    // Save current calculation if Pro user with linked course
    if (isPro && selectedCourseId && result) {
      await saveGrades();
    }
    
    // Reset all state to defaults
    setComponents([
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
        isFinalExam: true,
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
    setResult(null);
    setSavedCalculationId(null);
    setLastSaved(null);
    setSelectedCourseId(null);
    setSelectedCourse(null);
    setStartOption(null);
    setCurves([]);
    setConstraints([]);
    setPassingThreshold(60);
    setRoundingMethod('none');
    
    // Show start dialog again
    setShowStartDialog(true);
  }, [isPro, selectedCourseId, result, saveGrades, t]);

  // Handle Create New Calculation
  const handleCreateNewCalculation = useCallback(() => {
    // Reset to defaults but keep course connection
    setSavedCalculationId(null);
    setComponents([
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
        isFinalExam: true,
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
    setResult(null);
    setCurves([]);
    setConstraints([]);
    setPassingThreshold(60);
    setRoundingMethod('none');
    toast.info(t('newCalculationStarted'));
  }, [t]);

  // Handle calculate button - show Pro suggestion first for free users
  const handleCalculateClick = () => {
    if (!isPro) {
      setShowProSuggestion(true);
    } else {
      calculateGrade();
    }
  };

  // Skip Pro suggestion and calculate
  const handleSkipProSuggestion = () => {
    setShowProSuggestion(false);
    calculateGrade();
  };

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

  // Update a constraint
  const updateConstraint = useCallback((id: string, updates: Partial<ConstraintRule>) => {
    setConstraints(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
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
        const dropN = dropCount || 1;
        // If we would drop all or more items, return the highest score only
        if (normalizedScores.length <= dropN) {
          return Math.max(...normalizedScores);
        }
        const sortedDrop = [...normalizedScores].sort((a, b) => a - b);
        const afterDrop = sortedDrop.slice(dropN);
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
    if (Math.abs(totalWeight - 100) > WEIGHT_TOLERANCE) {
      warnings.push(t('weightsNotSum100') || `Weights sum to ${totalWeight.toFixed(1)}%, not 100%`);
    }

    // Pre-calculate component curves for O(1) lookup
    const componentCurvesMap = new Map<string, CurveAdjustment[]>();
    for (const curve of curves) {
      if (curve.targetType === 'component' && curve.targetId) {
        if (!componentCurvesMap.has(curve.targetId)) {
          componentCurvesMap.set(curve.targetId, []);
        }
        componentCurvesMap.get(curve.targetId)!.push(curve);
      }
    }

    // Calculate each component score
    const componentScores = components.map(comp => {
      const rawAvg = aggregateItems(comp.items, comp.aggregationRule, comp.dropCount, comp.bestOf);
      
      // Apply component-level curves
      let adjustedScore = rawAvg;
      const componentCurves = componentCurvesMap.get(comp.id) || [];
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
    
    // After setting result, trigger save for Pro users
    if (isPro && selectedCourseId) {
      saveGrades(true); // Show toast on manual calculate
      setHasUnsavedChanges(false);
    }
  }, [components, curves, constraints, passingThreshold, targetGrade, targetComponent, t, applyRounding, getLetterGrade, isPro, selectedCourseId, saveGrades]);

  return (
    <div className="space-y-4 md:space-y-6" dir={dir}>
      {/* Start Dialog - Shows when user enters the page */}
      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent className="sm:max-w-lg" dir={dir}>
          <DialogHeader>
            <div className={`flex items-center gap-3 mb-2 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Calculator className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle>{t('gradeCalcStart')}</DialogTitle>
                <DialogDescription>{t('gradeCalcStartDesc')}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            {/* Option 1: Existing Course */}
            {startOption !== 'existing' ? (
              <button
                onClick={() => handleStartOptionSelect('existing')}
                className={`w-full p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-all text-${dir === 'rtl' ? 'right' : 'left'} flex items-start gap-3 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{t('existingCourse')}</h3>
                  <p className="text-sm text-muted-foreground">{t('existingCourseDesc')}</p>
                </div>
              </button>
            ) : (
              <div className="p-4 rounded-lg border border-primary/50 bg-muted/50 space-y-3">
                <div className={`flex items-center gap-2 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
                  <BookOpen className="w-5 h-5 text-primary" />
                  <h3 className="font-medium">{t('selectCourse')}</h3>
                </div>
                {loadingCourses ? (
                  <p className="text-sm text-muted-foreground">{t('loading')}</p>
                ) : courses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('noCourses')}</p>
                ) : (
                  <Select onValueChange={handleCourseSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectCourse')} />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button variant="ghost" size="sm" onClick={() => setStartOption(null)}>
                  {t('cancel')}
                </Button>
              </div>
            )}

            {/* Option 2: Create New Course */}
            {startOption !== 'existing' && (
              <button
                onClick={() => {
                  setShowStartDialog(false);
                  navigate('/app/courses');
                }}
                className={`w-full p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-all text-${dir === 'rtl' ? 'right' : 'left'} flex items-start gap-3 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}
              >
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <Plus className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium">{t('createNewCourse')}</h3>
                  <p className="text-sm text-muted-foreground">{t('createNewCourseDesc')}</p>
                </div>
              </button>
            )}

            {/* Option 3: Continue Without Course */}
            {startOption !== 'existing' && (
              <button
                onClick={() => handleStartOptionSelect('none')}
                className={`w-full p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-all text-${dir === 'rtl' ? 'right' : 'left'} flex items-start gap-3 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}
              >
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Link2Off className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-medium">{t('continueWithoutCourse')}</h3>
                  <p className="text-sm text-muted-foreground">{t('continueWithoutCourseDesc')}</p>
                </div>
              </button>
            )}
          </div>

          {/* Free user note */}
          {!isPro && startOption !== 'existing' && (
            <Alert variant="default" className="bg-amber-500/10 border-amber-500/20">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-sm">
                {t('freeUserNote')}
              </AlertDescription>
            </Alert>
          )}
        </DialogContent>
      </Dialog>

      {/* Pro Upgrade Suggestion Dialog */}
      <Dialog open={showProSuggestion} onOpenChange={setShowProSuggestion}>
        <DialogContent className="sm:max-w-md" dir={dir}>
          <DialogHeader>
            <div className={`flex items-center gap-3 mb-2 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <DialogTitle>{t('gradeCalcProBenefit')}</DialogTitle>
                <DialogDescription>{t('gradeCalcProBenefitDesc')}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            <div className={`flex items-start gap-3 p-3 rounded-lg bg-muted/50 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-sm">{t('saveGrades')}</h4>
                <p className="text-xs text-muted-foreground">{t('saveGradesDesc')}</p>
              </div>
            </div>
            <div className={`flex items-start gap-3 p-3 rounded-lg bg-muted/50 ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-sm">{t('trackPerformance')}</h4>
                <p className="text-xs text-muted-foreground">{t('trackPerformanceDesc')}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={handleSkipProSuggestion}>
              {t('calculate')}
            </Button>
            <Button className="flex-1 gap-2" onClick={() => {
              setShowProSuggestion(false);
              navigate('/app/settings');
            }}>
              <Zap className="w-4 h-4" />
              {t('upgradeNow')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Calculator className="w-6 h-6 text-primary flex-shrink-0" strokeWidth={1.5} />
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{t('gradeCalculator')}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">{t('gradeCalculatorDesc')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Start Again Button */}
          <Button 
            variant="outline" 
            onClick={handleStartAgain} 
            className="gap-2 min-h-[44px] flex-1 sm:flex-none rtl:flex-row-reverse"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">{t('startAgain')}</span>
          </Button>
          {/* Calculate Button */}
          <Button 
            onClick={handleCalculateClick} 
            className="gap-2 min-h-[44px] flex-1 sm:flex-none rtl:flex-row-reverse"
          >
            <Calculator className="w-4 h-4" />
            {t('calculate')}
          </Button>
        </div>
      </div>

      {/* Course Connection Status */}
      {selectedCourse ? (
        <div className="flex flex-col gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm">
                {t('connectedToCourse')}: <strong>{selectedCourse.title}</strong>
              </span>
            </div>
            {isPro && (
              <div className="flex items-center gap-2 sm:ms-auto">
                <Badge variant="secondary" className="w-fit rtl:flex-row-reverse">
                  <Sparkles className="w-3 h-3 me-1" />
                  {t('proFeature')}
                </Badge>
                {/* Auto-save indicator */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      {t('saving')}
                    </>
                  ) : lastSaved ? (
                    <>
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      {t('autoSaved')}: {format(lastSaved, 'HH:mm:ss')}
                    </>
                  ) : hasUnsavedChanges ? (
                    <>
                      <AlertCircle className="w-3 h-3 text-amber-500" />
                      {t('unsavedChanges')}
                    </>
                  ) : null}
                </div>
              </div>
            )}
          </div>
          {savedCalculations.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Select 
                value={savedCalculationId || ''} 
                onValueChange={(id) => loadSpecificCalculation(id)}
              >
                <SelectTrigger className="w-48 h-8">
                  <SelectValue placeholder={t('selectCalculation')} />
                </SelectTrigger>
                <SelectContent>
                  {savedCalculations.map((calc) => (
                    <SelectItem key={calc.id} value={calc.id}>
                      {calc.profile_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleCreateNewCalculation}>
                <Plus className="w-4 h-4 me-1" />
                {t('newCalculation')}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <Link2Off className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground">{t('notConnectedToCourse')}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-fit sm:ms-auto min-h-[44px]"
            onClick={() => setShowStartDialog(true)}
          >
            {t('selectCourse')}
          </Button>
        </div>
      )}

      {/* Guess Score Hint */}
      <Alert variant="default" className="bg-blue-500/5 border-blue-500/20">
        <HelpCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-sm">
          {t('guessScoreHint')}
        </AlertDescription>
      </Alert>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:gap-6">
        {/* Left Column - Components & Scores */}
        <div className="lg:col-span-2 space-y-4 order-2 lg:order-1">
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
                      <div className="flex flex-col gap-3 cursor-pointer sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={component.group === 'exam' ? 'destructive' : 'secondary'} className="shrink-0">
                            {component.group === 'exam' ? t('exam') : t('work')}
                          </Badge>
                          <Input
                            value={component.name}
                            onChange={(e) => updateComponent(component.id, { name: e.target.value })}
                            onClick={(e) => e.stopPropagation()}
                            className="min-w-[120px] max-w-[200px] h-8 flex-1"
                            dir="auto"
                          />
                          <div className="flex items-center gap-2 shrink-0">
                            <Input
                              type="number"
                              dir="ltr"
                              value={component.weight}
                              onChange={(e) => updateComponent(component.id, { weight: parseFloat(e.target.value) || 0 })}
                              onClick={(e) => e.stopPropagation()}
                              className="w-16 h-8 text-center"
                              min={0}
                              max={100}
                            />
                            <span className="text-sm text-muted-foreground">%</span>
                            <InfoTooltip content={t('componentWeightInfo')} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-auto">
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
                          <Label className="text-xs flex items-center">
                            {t('scaleMax')}
                            <InfoTooltip content={t('maxScoreInfo')} />
                          </Label>
                          <Input
                            type="number"
                            value={component.scaleMax}
                            onChange={(e) => updateComponent(component.id, { scaleMax: parseFloat(e.target.value) || 100 })}
                            className="h-8 w-full"
                          />
                        </div>
                        <div>
                          <Label className="text-xs flex items-center">
                            {t('aggregationRule')}
                            <InfoTooltip content={t('aggregationRuleInfo')} />
                          </Label>
                          <Select
                            value={component.aggregationRule}
                            onValueChange={(v) => updateComponent(component.id, { aggregationRule: v as GradeComponent['aggregationRule'] })}
                          >
                            <SelectTrigger className="h-8 w-full">
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
                            <SelectTrigger className="h-8 w-full">
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
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || 1;
                              if (component.aggregationRule === 'drop_lowest') {
                                updateComponent(component.id, { dropCount: value });
                              } else {
                                updateComponent(component.id, { bestOf: value });
                              }
                            }}
                            className="h-8"
                            min={1}
                          />
                        </div>
                      )}

                      {/* Items */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs flex items-center">
                            {t('scores')}
                            <InfoTooltip content={t('scoreInputInfo')} />
                          </Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => addItemToComponent(component.id)}
                            className="min-h-[44px] sm:h-7 text-xs gap-1 rtl:flex-row-reverse"
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
                            {component.items.map((item, itemIndex) => {
                              // Use the isFinalExam field to determine if scores are optional
                              const isOptionalScore = component.isFinalExam === true;
                              return (
                              <div key={item.id} className="flex flex-col gap-2 p-3 rounded bg-muted/30 sm:flex-row sm:items-center sm:p-2">
                                <Input
                                  value={item.name}
                                  onChange={(e) => updateItem(component.id, item.id, { name: e.target.value })}
                                  placeholder={t('itemName')}
                                  className="min-h-[44px] sm:h-7 flex-1 min-w-0"
                                  dir="auto"
                                />
                                <div className="flex items-center gap-2 flex-wrap">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Input
                                          type="text"
                                          inputMode="decimal"
                                          pattern="[0-9]*\.?[0-9]*"
                                          dir="ltr"
                                          value={item.rawScore ?? ''}
                                          onChange={(e) => updateItem(component.id, item.id, { 
                                            rawScore: e.target.value === '' ? null : parseFloat(e.target.value) 
                                          })}
                                          placeholder={isOptionalScore ? t('optional') : t('actualGrade')}
                                          className="min-h-[44px] sm:h-7 w-24 min-w-[80px] text-start"
                                        />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{isOptionalScore ? t('finalGradeHint') : t('scoreInputInfo')}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <span className="text-sm text-muted-foreground">/</span>
                                  <Input
                                    type="text"
                                    inputMode="decimal"
                                    pattern="[0-9]*\.?[0-9]*"
                                    dir="ltr"
                                    value={item.maxScore}
                                    onChange={(e) => updateItem(component.id, item.id, { maxScore: parseFloat(e.target.value) || 100 })}
                                    className="min-h-[44px] sm:h-7 w-20 min-w-[64px] text-start"
                                  />
                                  {component.aggregationRule === 'weighted' && (
                                    <>
                                      <span className="text-sm text-muted-foreground">×</span>
                                      <Input
                                        type="text"
                                        inputMode="decimal"
                                        pattern="[0-9]*\.?[0-9]*"
                                        dir="ltr"
                                        value={item.weight ?? 1}
                                        onChange={(e) => updateItem(component.id, item.id, { weight: parseFloat(e.target.value) || 1 })}
                                        className="min-h-[44px] sm:h-7 w-20 min-w-[64px] text-start"
                                        placeholder="Weight"
                                      />
                                    </>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeItemFromComponent(component.id, item.id)}
                                    className="min-h-[44px] min-w-[44px] sm:h-7 sm:w-7 text-destructive hover:text-destructive shrink-0"
                                  >
                                    <Trash2 className="w-4 h-4 sm:w-3 sm:h-3" />
                                  </Button>
                                </div>
                              </div>
                              );
                            })}
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
                      <div className="flex items-center justify-between mb-2">
                        <Label>{t('passingThreshold')}</Label>
                        <span className="text-sm font-medium">{passingThreshold}%</span>
                      </div>
                      <div dir="ltr">
                        <Slider
                          value={[passingThreshold]}
                          onValueChange={(v) => setPassingThreshold(v[0])}
                          min={0}
                          max={100}
                          step={1}
                          className="w-full"
                        />
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
                          <div key={curve.id} className="flex flex-col gap-3 p-3 rounded-lg border sm:flex-row sm:flex-wrap sm:items-center">
                            <div className="flex items-center gap-2 flex-wrap">
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
                                dir="ltr"
                                value={curve.value}
                                onChange={(e) => updateCurve(curve.id, { value: parseFloat(e.target.value) || 0 })}
                                className="w-20 h-8"
                                step={curve.adjustmentType === 'multiply' ? 0.1 : 1}
                              />
                            </div>
                            
                            <div className="flex items-center gap-2 sm:ms-auto">
                              <div className="flex items-center gap-1">
                                <Switch
                                  checked={curve.clamp}
                                  onCheckedChange={(c) => updateCurve(curve.id, { clamp: c })}
                                />
                                <span className="text-xs text-muted-foreground whitespace-nowrap">{t('clamp')}</span>
                              </div>
                              
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeCurve(curve.id)}
                                className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
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
                              onValueChange={(v) => updateConstraint(constraint.id, { type: v as ConstraintRule['type'] })}
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
                                onValueChange={(v) => updateConstraint(constraint.id, { componentId: v })}
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
                                onChange={(e) => updateConstraint(constraint.id, { threshold: parseFloat(e.target.value) || 0 })}
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
        <div className="space-y-4 order-1 lg:order-2">
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
                <div className="flex items-center justify-between mb-2">
                  <Label>{t('targetGrade')}</Label>
                  <span className="text-sm font-medium">{targetGrade}%</span>
                </div>
                <div dir="ltr">
                  <Slider
                    value={[targetGrade]}
                    onValueChange={(v) => setTargetGrade(v[0])}
                    min={0}
                    max={100}
                    step={1}
                    className="w-full"
                  />
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
