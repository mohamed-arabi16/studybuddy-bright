
import { performance } from 'perf_hooks';

// Mock types
interface GradeComponent {
  id: string;
  name: string;
  weight: number;
  scaleMax: number;
  aggregationRule: 'average' | 'sum' | 'drop_lowest' | 'best_of' | 'weighted';
  dropCount?: number;
  bestOf?: number;
  group: 'exam' | 'work';
  isFinalExam?: boolean;
  items: ComponentItem[];
}

interface ComponentItem {
  id: string;
  name: string;
  rawScore: number | null;
  maxScore: number;
  weight?: number;
}

interface CurveAdjustment {
  id: string;
  targetType: 'component' | 'overall';
  targetId?: string;
  adjustmentType: 'add' | 'multiply' | 'set';
  value: number;
  clamp: boolean;
}

// Mock functions
const aggregateItems = (items: ComponentItem[], rule: any, dropCount?: number, bestOf?: number): number => {
    return 85;
};

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

// Data generation
const generateComponents = (count: number): GradeComponent[] => {
    const components: GradeComponent[] = [];
    for (let i = 0; i < count; i++) {
        components.push({
            id: `comp-${i}`,
            name: `Component ${i}`,
            weight: 10,
            scaleMax: 100,
            aggregationRule: 'average',
            group: 'work',
            items: []
        });
    }
    return components;
}

const generateCurves = (count: number, componentIds: string[]): CurveAdjustment[] => {
    const curves: CurveAdjustment[] = [];
    for (let i = 0; i < count; i++) {
        const targetId = componentIds[Math.floor(Math.random() * componentIds.length)];
        curves.push({
            id: `curve-${i}`,
            targetType: 'component',
            targetId: targetId,
            adjustmentType: 'add',
            value: 5,
            clamp: true
        });
    }
    return curves;
}

// Original implementation
const runOriginal = (components: GradeComponent[], curves: CurveAdjustment[]) => {
    const start = performance.now();
    const componentScores = components.map(comp => {
      const rawAvg = aggregateItems(comp.items, comp.aggregationRule, comp.dropCount, comp.bestOf);

      let adjustedScore = rawAvg;
      // THE BOTTLENECK: filtering curves inside the loop
      const componentCurves = curves.filter(c => c.targetType === 'component' && c.targetId === comp.id);
      for (const curve of componentCurves) {
        adjustedScore = applyCurve(adjustedScore, curve);
      }
      return adjustedScore;
    });
    const end = performance.now();
    return end - start;
}

// Optimized implementation
const runOptimized = (components: GradeComponent[], curves: CurveAdjustment[]) => {
    const start = performance.now();

    // Create map of curves by targetId
    // We want a map where key is targetId and value is array of curves
    const curvesMap = new Map<string, CurveAdjustment[]>();
    for (const curve of curves) {
        if (curve.targetType === 'component' && curve.targetId) {
            if (!curvesMap.has(curve.targetId)) {
                curvesMap.set(curve.targetId, []);
            }
            curvesMap.get(curve.targetId)!.push(curve);
        }
    }

    const componentScores = components.map(comp => {
      const rawAvg = aggregateItems(comp.items, comp.aggregationRule, comp.dropCount, comp.bestOf);

      let adjustedScore = rawAvg;
      const componentCurves = curvesMap.get(comp.id) || [];
      for (const curve of componentCurves) {
        adjustedScore = applyCurve(adjustedScore, curve);
      }
      return adjustedScore;
    });
    const end = performance.now();
    return end - start;
}

// Run benchmark
const COMPONENT_COUNT = 2000;
const CURVE_COUNT = 5000;

const components = generateComponents(COMPONENT_COUNT);
const curves = generateCurves(CURVE_COUNT, components.map(c => c.id));

console.log(`Benchmarking with ${COMPONENT_COUNT} components and ${CURVE_COUNT} curves...`);

// Warmup
runOriginal(components, curves);
runOptimized(components, curves);

// Measure
let totalOriginal = 0;
let totalOptimized = 0;
const ITERATIONS = 100;

for (let i = 0; i < ITERATIONS; i++) {
    totalOriginal += runOriginal(components, curves);
    totalOptimized += runOptimized(components, curves);
}

console.log(`Original Average: ${(totalOriginal / ITERATIONS).toFixed(4)} ms`);
console.log(`Optimized Average: ${(totalOptimized / ITERATIONS).toFixed(4)} ms`);
console.log(`Speedup: ${(totalOriginal / totalOptimized).toFixed(2)}x`);
