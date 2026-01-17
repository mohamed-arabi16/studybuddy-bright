import { Card, CardContent, CardHeader } from './card';
import { Skeleton } from './skeleton';

export function CourseDetailSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Skeleton */}
      <div className="flex items-center space-x-4">
        <Skeleton className="h-10 w-10 rounded-md" /> {/* Back button */}
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-64" /> {/* Title */}
          <div className="flex items-center gap-3">
             <Skeleton className="h-4 w-40" /> {/* Date */}
             <Skeleton className="h-5 w-24 rounded-full" /> {/* Badge */}
          </div>
        </div>
        <Skeleton className="h-10 w-10 rounded-md" /> {/* Menu button */}
      </div>

      {/* Tabs List Skeleton */}
      <div className="w-full overflow-x-auto pb-2">
        <div className="flex space-x-2">
           {[1, 2, 3, 4, 5, 6].map(i => (
               <Skeleton key={i} className="h-10 w-24 rounded-md" />
           ))}
        </div>
      </div>

      {/* Content Skeleton (Simulating Files Tab) */}
      <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-md" /> {/* Alert/Info */}

          {/* Upload Zone */}
          <Card>
              <CardHeader>
                  <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                  <Skeleton className="h-32 w-full rounded-lg border-2 border-dashed" />
              </CardContent>
          </Card>

          {/* Uploaded Files */}
          <Card>
              <CardHeader>
                  <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                  <div className="space-y-3">
                      {[1, 2, 3].map(i => (
                          <div key={i} className="flex flex-col sm:flex-row gap-3 p-3 rounded-lg border">
                              <div className="flex items-center gap-3 flex-1">
                                  <Skeleton className="h-5 w-5" />
                                  <div className="space-y-1 flex-1">
                                      <Skeleton className="h-5 w-48" />
                                      <div className="flex gap-2">
                                          <Skeleton className="h-4 w-16" />
                                          <Skeleton className="h-4 w-24 rounded-full" />
                                      </div>
                                  </div>
                              </div>
                              <div className="flex gap-2">
                                  <Skeleton className="h-8 w-8 rounded-md" />
                                  <Skeleton className="h-8 w-8 rounded-md" />
                              </div>
                          </div>
                      ))}
                  </div>
              </CardContent>
          </Card>
      </div>
    </div>
  );
}
