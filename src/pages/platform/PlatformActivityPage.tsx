import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PlatformActivityPage() {
  const { data } = useQuery({
    queryKey: ["platformActivities"],
    queryFn: () => api.getActivities(),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Activity Log</h1>
        <p className="text-muted-foreground">View all platform activity</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed activities={data?.data ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
