import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

export default function FarmerImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Import Data</h1>
        <p className="text-muted-foreground">Import farmers and plots via JSON or CSV</p>
      </div>
      <Tabs defaultValue="farmers">
        <TabsList><TabsTrigger value="farmers">Import Farmers</TabsTrigger><TabsTrigger value="plots">Import Plots</TabsTrigger></TabsList>
        <TabsContent value="farmers">
          <Card>
            <CardHeader><CardTitle className="text-base">Import Farmers (Max 500)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Textarea placeholder='[{"firstName": "John", "lastName": "Doe", "phone": "+254712345678", "nationalId": "12345678", "county": "Nakuru"}]' rows={10} />
              <Button><Upload className="mr-2 h-4 w-4" />Import Farmers</Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="plots">
          <Card>
            <CardHeader><CardTitle className="text-base">Import Plots (Max 500)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Textarea placeholder='[{"farmerPhone": "+254712345678", "name": "Plot A", "latitude": -0.3031, "longitude": 36.08, "acreage": 2.5, "cropType": "Maize"}]' rows={10} />
              <Button><Upload className="mr-2 h-4 w-4" />Import Plots</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
