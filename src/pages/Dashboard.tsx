import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Users, TrendingUp, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "leader" | "member";
}

interface CellSummary {
  name: string;
  avg_attendance_percent: number;
  total_members: number;
}

interface Activity {
  id: string;
  type: "ata" | "reuniao";
  title: string;
  date: string;
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
    cellsGrowth: 0,
    membersGrowth: 0,
  });

  const [cellSummaries, setCellSummaries] = useState<CellSummary[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  // 🔹 Inicialização
  useEffect(() => {
    checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (profileError) throw profileError;

      setProfile(profileData);

      await Promise.all([loadStats(), loadCellSummaries(), loadActivities()]);
    } catch (error: any) {
      console.error("Erro:", error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // 📊 Carregar estatísticas gerais
  const loadStats = async () => {
    try {
      const { count: minutesCount } = await supabase
        .from("minutes")
        .select("*", { count: "exact", head: true });

      const { count: cellsCount } = await supabase
        .from("cells")
        .select("*", { count: "exact", head: true });

      const { count: membersCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Crescimento simulado — pode virar view SQL depois
      const cellsGrowth = Math.floor(Math.random() * 20 - 10);
      const membersGrowth = Math.floor(Math.random() * 15 - 5);

      setStats({
        totalMinutes: minutesCount || 0,
        totalCells: cellsCount || 0,
        totalMembers: membersCount || 0,
        cellsGrowth,
        membersGrowth,
      });
    } catch (error: any) {
      console.error("Erro ao carregar estatísticas:", error);
    }
  };

  // 📈 Carregar médias por célula (baseado na view v_cell_summary)
  const loadCellSummaries = async () => {
    try {
      const { data, error } = await supabase.from("v_cell_summary").select("*");
      if (error) throw error;
      setCellSummaries(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar médias:", error);
    }
  };

  // 📰 Carregar últimas atividades (atas + reuniões)
  const loadActivities = async () => {
    try {
      const [minutesRes, meetingsRes] = await Promise.all([
        supabase
          .from("minutes")
          .select("id, title, created_at")
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("cell_meetings")
          .select("id, topic, meeting_date")
          .order("meeting_date", { ascending: false })
          .limit(3),
      ]);

      const formatted: Activity[] = [];

      if (minutesRes.data) {
        formatted.push(
          ...minutesRes.data.map((a) => ({
            id: a.id,
            type: "ata",
            title: a.title || "Ata registrada",
            date: new Date(a.created_at).toLocaleDateString("pt-BR"),
          }))
        );
      }

      if (meetingsRes.data) {
        formatted.push(
          ...meetingsRes.data.map((m) => ({
            id: m.id,
            type: "reuniao",
            title: m.topic || "Reunião de célula",
            date: new Date(m.meeting_date).toLocaleDateString("pt-BR"),
          }))
        );
      }

      setActivities(formatted.sort((a, b) => (a.date < b.date ? 1 : -1)));
    } catch (error: any) {
      console.error("Erro ao carregar atividades:", error);
    }
  };

  const canAccessAdmin = profile?.role === "admin" || profile?.role === "leader";

  // 💡 Dados do gráfico
  const chartData = useMemo(() => {
    return cellSummaries.map((c) => ({
      name: c.name,
      "Frequência Média": c.avg_attendance_percent || 0,
    }));
  }, [cellSummaries]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <Navbar
        userRole={profile?.role}
        userName={profile?.full_name}
        userPhoto={profile?.photo_url}
      />


      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <section>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Olá, {profile?.full_name?.split(" ")[0]}
          </h1>
          <p className="text-lg text-muted-foreground">
            Bem-vindo ao painel da IPR Sinop — visão geral e atividades recentes.
          </p>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Células Ativas
              </CardTitle>
              <CardDescription>Grupos de relacionamento da igreja</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{stats.totalCells}</p>
              <p className={`text-sm mt-1 ${stats.cellsGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
                {stats.cellsGrowth >= 0 ? "↑" : "↓"} {Math.abs(stats.cellsGrowth)}% desde o mês passado
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Membros Cadastrados
              </CardTitle>
              <CardDescription>Participantes ativos e visitantes</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{stats.totalMembers}</p>
              <p className={`text-sm mt-1 ${stats.membersGrowth >= 0 ? "text-green-600" : "text-red-600"}`}>
                {stats.membersGrowth >= 0 ? "↑" : "↓"} {Math.abs(stats.membersGrowth)}% desde o mês passado
              </p>
            </CardContent>
          </Card>

          {canAccessAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> Atas Registradas
                </CardTitle>
                <CardDescription>Reuniões oficiais documentadas</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">{stats.totalMinutes}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Histórico administrativo
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Chart */}
        {canAccessAdmin && (
          <section>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" /> Frequência Média por Célula
                </CardTitle>
                <CardDescription>
                  Percentual médio de presença nas reuniões das células
                </CardDescription>
              </CardHeader>
              <CardContent>
                {chartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum dado de frequência disponível.</p>
                ) : (
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis unit="%" />
                        <Tooltip />
                        <Bar dataKey="Frequência Média" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        )}

        {/* Recent Activities */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" /> Últimas Atividades
              </CardTitle>
              <CardDescription>Atas e reuniões mais recentes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {activities.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma atividade recente registrada.</p>
              ) : (
                activities.map((act) => (
                  <div key={act.id} className="flex justify-between border-b py-2">
                    <span>
                      {act.type === "ata" ? "📄" : "👥"} {act.title}
                    </span>
                    <span className="text-muted-foreground">{act.date}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
