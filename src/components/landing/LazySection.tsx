import { Suspense, lazy, ComponentType } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface LazySectionProps {
  fallbackHeight?: string;
}

const SectionFallback = ({ height = 'h-96' }: { height?: string }) => (
  <div className={`w-full ${height} flex items-center justify-center`}>
    <div className="space-y-4 w-full max-w-4xl px-4">
      <Skeleton className="h-12 w-3/4 mx-auto" />
      <Skeleton className="h-6 w-1/2 mx-auto" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </div>
  </div>
);

// Lazy load the below-fold sections
export const LazyHowItWorksSection = lazy(() => 
  import('./HowItWorksSection').then(module => ({ default: module.HowItWorksSection }))
);

export const LazyFeatureShowcase = lazy(() => 
  import('./FeatureShowcase').then(module => ({ default: module.FeatureShowcase }))
);

export const LazyFooter = lazy(() => 
  import('./Footer').then(module => ({ default: module.Footer }))
);

export const LazySectionWrapper = ({ 
  children, 
  fallbackHeight = 'h-96' 
}: { 
  children: React.ReactNode;
  fallbackHeight?: string;
}) => (
  <Suspense fallback={<SectionFallback height={fallbackHeight} />}>
    {children}
  </Suspense>
);
