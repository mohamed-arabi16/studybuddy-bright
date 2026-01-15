import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, ArrowRight, GitBranch, Info } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

interface Topic {
  id: string;
  title: string;
  prerequisite_ids: string[] | null;
  status: string;
}

interface DependencyFlowVisualProps {
  courseId: string;
}

interface DependencyChain {
  topic: Topic;
  prerequisites: Topic[];
  dependents: Topic[];
}

/**
 * Lightweight dependency flow visualization for topics
 * Shows simple arrow list format: Variables → Loops → Functions
 */
export function DependencyFlowVisual({ courseId }: DependencyFlowVisualProps) {
  const { t, language, dir } = useLanguage();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasCycles, setHasCycles] = useState(false);
  const [cycleTopics, setCycleTopics] = useState<string[]>([]);

  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const { data, error } = await supabase
          .from("topics")
          .select("id, title, prerequisite_ids, status")
          .eq("course_id", courseId)
          .order("order_index", { ascending: true });

        if (error) throw error;
        setTopics(data || []);
        
        // Detect cycles
        const { cycles, topicsInCycles } = detectCycles(data || []);
        setHasCycles(cycles);
        setCycleTopics(topicsInCycles);
      } catch (error) {
        console.error("Error fetching topics for dependency flow:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTopics();
  }, [courseId]);

  // Detect cycles using DFS
  const detectCycles = (topicList: Topic[]): { cycles: boolean; topicsInCycles: string[] } => {
    const topicMap = new Map<string, Topic>();
    topicList.forEach(t => topicMap.set(t.id, t));

    const visited = new Set<string>();
    const recStack = new Set<string>();
    const topicsInCycles: string[] = [];

    const hasCycleDFS = (topicId: string, path: string[]): boolean => {
      if (recStack.has(topicId)) {
        // Found cycle - mark all topics in the path
        const cycleStart = path.indexOf(topicId);
        if (cycleStart !== -1) {
          path.slice(cycleStart).forEach(id => {
            if (!topicsInCycles.includes(id)) topicsInCycles.push(id);
          });
        }
        return true;
      }

      if (visited.has(topicId)) return false;

      visited.add(topicId);
      recStack.add(topicId);

      const topic = topicMap.get(topicId);
      const prereqs = topic?.prerequisite_ids || [];
      let foundCycle = false;

      for (const prereqId of prereqs) {
        if (topicMap.has(prereqId)) {
          if (hasCycleDFS(prereqId, [...path, topicId])) {
            foundCycle = true;
          }
        }
      }

      recStack.delete(topicId);
      return foundCycle;
    };

    let cycles = false;
    for (const topic of topicList) {
      if (!visited.has(topic.id)) {
        if (hasCycleDFS(topic.id, [])) {
          cycles = true;
        }
      }
    }

    return { cycles, topicsInCycles };
  };

  // Build dependency chains for visualization
  const getDependencyChains = (): DependencyChain[] => {
    const topicMap = new Map<string, Topic>();
    topics.forEach(t => topicMap.set(t.id, t));

    // Find topics with prerequisites
    const topicsWithPrereqs = topics.filter(
      t => t.prerequisite_ids && t.prerequisite_ids.length > 0
    );

    // Build chain info for each topic
    return topicsWithPrereqs.map(topic => {
      const prerequisites = (topic.prerequisite_ids || [])
        .map(id => topicMap.get(id))
        .filter((t): t is Topic => t !== undefined);

      const dependents = topics.filter(
        t => t.prerequisite_ids?.includes(topic.id)
      );

      return { topic, prerequisites, dependents };
    });
  };

  // Find root topics (no prerequisites)
  const getRootTopics = (): Topic[] => {
    return topics.filter(
      t => !t.prerequisite_ids || t.prerequisite_ids.length === 0
    );
  };

  if (loading) {
    return null; // Don't show loading state for this supplementary component
  }

  if (topics.length === 0) {
    return null; // No topics, nothing to show
  }

  const chains = getDependencyChains();
  const rootTopics = getRootTopics();

  // If no dependencies exist, don't show the component
  if (chains.length === 0) {
    return null;
  }

  const ArrowIcon = dir === "rtl" ? (
    <ArrowRight className="w-3 h-3 rotate-180 text-muted-foreground" />
  ) : (
    <ArrowRight className="w-3 h-3 text-muted-foreground" />
  );

  return (
    <Card className="mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <GitBranch className="w-4 h-4" />
          {language === "ar" ? "تدفق المتطلبات" : "Dependency Flow"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Cycle warning */}
        {hasCycles && (
          <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-700 dark:text-amber-400">
              {language === "ar" 
                ? `تم اكتشاف حلقة تبعية في ${cycleTopics.length} موضوع(ات). يرجى مراجعة المتطلبات المسبقة.`
                : `Circular dependency detected in ${cycleTopics.length} topic(s). Please review prerequisites.`}
            </AlertDescription>
          </Alert>
        )}

        {/* Simple arrow chain visualization */}
        <div className="space-y-2">
          {chains.slice(0, 5).map(({ topic, prerequisites }) => (
            <div 
              key={topic.id}
              className={`flex items-center gap-1 flex-wrap p-2 rounded-lg ${
                cycleTopics.includes(topic.id) 
                  ? 'bg-amber-500/10 border border-amber-500/30' 
                  : 'bg-muted/30'
              }`}
            >
              {prerequisites.map((prereq, idx) => (
                <span key={prereq.id} className="flex items-center gap-1">
                  <Badge 
                    variant={prereq.status === 'done' ? 'secondary' : 'outline'}
                    className={`text-xs ${prereq.status === 'done' ? 'line-through opacity-60' : ''}`}
                  >
                    {prereq.title.length > 20 
                      ? prereq.title.substring(0, 20) + '...' 
                      : prereq.title}
                  </Badge>
                  {ArrowIcon}
                </span>
              ))}
              <Badge 
                variant={topic.status === 'done' ? 'secondary' : 'default'}
                className={`text-xs ${
                  topic.status === 'done' ? 'line-through opacity-60' : ''
                } ${cycleTopics.includes(topic.id) ? 'border-amber-500' : ''}`}
              >
                {topic.title.length > 20 
                  ? topic.title.substring(0, 20) + '...' 
                  : topic.title}
                {cycleTopics.includes(topic.id) && (
                  <AlertTriangle className="w-3 h-3 ms-1 text-amber-500 inline" />
                )}
              </Badge>
            </div>
          ))}

          {/* Show more indicator */}
          {chains.length > 5 && (
            <p className="text-xs text-muted-foreground text-center">
              {language === "ar"
                ? `و ${chains.length - 5} سلسلة(ات) أخرى...`
                : `and ${chains.length - 5} more chain(s)...`}
            </p>
          )}
        </div>

        {/* Foundation topics indicator */}
        {rootTopics.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <Info className="w-3 h-3" />
              {language === "ar" ? "مواضيع أساسية (بدون متطلبات):" : "Foundation topics (no prerequisites):"}
            </p>
            <div className="flex flex-wrap gap-1">
              {rootTopics.slice(0, 5).map(topic => (
                <Badge 
                  key={topic.id} 
                  variant="outline" 
                  className={`text-xs ${topic.status === 'done' ? 'line-through opacity-60' : ''}`}
                >
                  {topic.title.length > 15 
                    ? topic.title.substring(0, 15) + '...' 
                    : topic.title}
                </Badge>
              ))}
              {rootTopics.length > 5 && (
                <Badge variant="outline" className="text-xs">
                  +{rootTopics.length - 5}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
