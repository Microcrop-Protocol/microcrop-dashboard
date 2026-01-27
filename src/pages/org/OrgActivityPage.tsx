import { useQuery } from "@tanstack/react-query";
import { mockApi, mockActivities } from "@/lib/mockData";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrgActivityPage() {
  const { data } = useQuery({ queryKey: ["orgActivities"], queryFn: () => mockApi.getActivities("org1") });

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">Activity Log</h1><p className="text-muted-foreground">View organization activity</p></div>
      <Card><CardHeader><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader><CardContent><ActivityFeed activities={data?.data ?? mockActivities.filter(a => a.organizationId === 'org1')} /></CardContent></Card>
    </div>
  );
}
