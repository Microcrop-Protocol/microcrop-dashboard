import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrgActivityPage() {
  const { user } = useAuthStore();
  const orgId = user?.organizationId || "";

  const { data } = useQuery({
    queryKey: ["orgActivities", orgId],
    queryFn: () => api.getActivities(orgId),
    enabled: !!orgId,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Activity Log</h1>
        <p className="text-muted-foreground">View organization activity</p>
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
