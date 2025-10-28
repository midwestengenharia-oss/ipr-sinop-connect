import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Users, PlusCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "leader" | "member";
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalMinutes: 0,
    totalCells: 0,
    totalMembers: 0,
  });

  useEffect(() => {
    checkAuth();
    loadStats();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (error) throw error;
      
      setProfile(profileData);
    } catch (error: any) {
      console.error("Error checking auth:", error);
      toast({
        title: "Erro ao carregar perfil",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Load minutes count
      const { count: minutesCount } = await supabase
        .from("minutes")
        .select("*", { count: "exact", head: true });

      // Load cells count
      const { count: cellsCount } = await supabase
        .from("cells")
        .select("*", { count: "exact", head: true });

      // Load members count
      const { count: membersCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      setStats({
        totalMinutes: minutesCount || 0,
        totalCells: cellsCount || 0,
        totalMembers: membersCount || 0,
      });
    } catch (error: any) {
      console.error("Error loading stats:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const canAccessMinutes = profile?.role === "admin" || profile?.role === "leader";

  return (
    <div className="min-h-screen bg-muted">
      <Navbar userRole={profile?.role} userName={profile?.full_name} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Bem-vindo, {profile?.full_name?.split(" ")[0]}!
          </h1>
          <p className="text-lg text-muted-foreground">
            Sistema de Gestão Eclesiástica - IPR Sinop
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {canAccessMinutes && (
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Atas Registradas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">{stats.totalMinutes}</p>
                <p className="text-sm text-muted-foreground mt-1">Total de atas no sistema</p>
              </CardContent>
            </Card>
          )}

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Células Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{stats.totalCells}</p>
              <p className="text-sm text-muted-foreground mt-1">Grupos de relacionamento</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Membros Cadastrados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{stats.totalMembers}</p>
              <p className="text-sm text-muted-foreground mt-1">Total de usuários</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {canAccessMinutes && (
            <Card>
              <CardHeader>
                <CardTitle>Gestão de Atas</CardTitle>
                <CardDescription>
                  Registre e acompanhe as atas de reuniões oficiais da igreja
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {profile?.role === "admin" && (
                  <Button
                    onClick={() => navigate("/atas/nova")}
                    className="w-full justify-start"
                  >
                    <PlusCircle className="h-5 w-5 mr-2" />
                    Nova Ata
                  </Button>
                )}
                <Button
                  onClick={() => navigate("/atas")}
                  variant="outline"
                  className="w-full justify-start"
                >
                  <FileText className="h-5 w-5 mr-2" />
                  Ver Todas as Atas
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Células e Grupos</CardTitle>
              <CardDescription>
                Gerencie os grupos de relacionamento e acompanhe participantes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(profile?.role === "admin" || profile?.role === "leader") && (
                <Button
                  onClick={() => navigate("/celulas/nova")}
                  className="w-full justify-start"
                >
                  <PlusCircle className="h-5 w-5 mr-2" />
                  Nova Célula
                </Button>
              )}
              <Button
                onClick={() => navigate("/celulas")}
                variant="outline"
                className="w-full justify-start"
              >
                <Users className="h-5 w-5 mr-2" />
                Ver Todas as Células
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
