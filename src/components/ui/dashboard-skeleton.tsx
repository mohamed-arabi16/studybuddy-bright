import { Card, CardContent, CardHeader } from './card';
import { Skeleton } from './skeleton';

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex items-center gap-2">
           <Skeleton className="h-9 w-32" />
           <Skeleton className="h-9 w-32" />
        </div>
      </div>

      {/* Exam Countdown Skeleton - Row of 3 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
             <Skeleton className="h-4 w-4" />
             <Skeleton className="h-4 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-2 flex-1 rounded-full" />
                    <Skeleton className="h-3 w-8" />
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      </div>

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Today's Plan Skeleton */}
        <Card className="lg:col-span-1">
            <div className="p-4 border-b border-border/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-5 w-24" />
                </div>
                <Skeleton className="h-8 w-24" />
            </div>
            <CardContent className="p-4 space-y-3">
                <div className="mb-4">
                     <Skeleton className="h-1.5 w-full rounded-full" />
                </div>
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border/30">
                        <Skeleton className="h-4 w-4 rounded" />
                        <Skeleton className="h-2 w-2 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                        <Skeleton className="h-3 w-8" />
                    </div>
                ))}
            </CardContent>
        </Card>

        {/* Pomodoro Skeleton */}
        <div className="md:col-span-1">
             <Card>
                <CardContent className="p-6">
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <Skeleton className="h-48 w-48 rounded-full" />
                        <div className="flex gap-4">
                             <Skeleton className="h-10 w-10 rounded-full" />
                             <Skeleton className="h-10 w-10 rounded-full" />
                        </div>
                    </div>
                </CardContent>
             </Card>
        </div>

        {/* Progress Section Skeleton */}
        <div className="md:col-span-2 lg:col-span-1">
             <Card className="h-full">
                <CardHeader>
                    <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="space-y-2">
                            <div className="flex justify-between">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-4 w-8" />
                            </div>
                            <Skeleton className="h-2 w-full rounded-full" />
                        </div>
                    ))}
                </CardContent>
             </Card>
        </div>
      </div>

       {/* Collapsible Info Skeleton */}
       <div className="space-y-3">
          <Card className="h-14 flex items-center px-4 justify-between">
               <div className="flex gap-3 items-center">
                   <Skeleton className="h-5 w-5" />
                   <Skeleton className="h-5 w-40" />
               </div>
               <Skeleton className="h-5 w-5" />
          </Card>
       </div>
    </div>
  );
}
