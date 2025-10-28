import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, PlusCircle, Loader2, Download, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Profile {
  id: string;
  full_name: string;
  role: "admin" | "leader" | "member";
}

interface Minute {
  id: string;
  number: string;
  title: string;
  type: string;
  date: string;
  location: string;
  status: string;
  pdf_url: string | null;
  profiles: {
    full_name: string;
  };
}

const Minutes = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [minutes, setMinutes] = useState<Minute[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
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
      
      if (profileData.role !== "admin" && profileData.role !== "leader") {
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para acessar esta página",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setProfile(profileData);
      await loadMinutes();
    } catch (error: any) {
      console.error("Error:", error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadMinutes = async () => {
    try {
      const { data, error } = await supabase
        .from("minutes")
        .select(`
          *,
          profiles:responsible_user_id (
            full_name
          )
        `)
        .order("date", { ascending: false });

      if (error) throw error;
      setMinutes(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar atas",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      conselho: "Conselho",
      assembleia: "Assembleia",
      ministerio: "Ministério",
      celula: "Célula",
      outro: "Outro",
    };
    return types[type] || type;
  };

  const getStatusBadge = (status: string) => {
    if (status === "assinada_arquivada") {
      return <Badge className="bg-success">Assinada e Arquivada</Badge>;
    }
    return <Badge variant="secondary">Em Andamento</Badge>;
  };

  const filteredMinutes = filter === "all" 
    ? minutes 
    : minutes.filter(m => m.type === filter);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <Navbar userRole={profile?.role} userName={profile?.full_name} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Atas</h1>
            <p className="text-lg text-muted-foreground">
              Controle e arquivamento de atas de reuniões
            </p>
          </div>
          
          {profile?.role === "admin" && (
            <Button onClick={() => navigate("/atas/nova")}>
              <PlusCircle className="h-5 w-5 mr-2" />
              Nova Ata
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => setFilter("all")}
            size="sm"
          >
            Todas
          </Button>
          <Button
            variant={filter === "conselho" ? "default" : "outline"}
            onClick={() => setFilter("conselho")}
            size="sm"
          >
            Conselho
          </Button>
          <Button
            variant={filter === "assembleia" ? "default" : "outline"}
            onClick={() => setFilter("assembleia")}
            size="sm"
          >
            Assembleia
          </Button>
          <Button
            variant={filter === "ministerio" ? "default" : "outline"}
            onClick={() => setFilter("ministerio")}
            size="sm"
          >
            Ministério
          </Button>
          <Button
            variant={filter === "celula" ? "default" : "outline"}
            onClick={() => setFilter("celula")}
            size="sm"
          >
            Célula
          </Button>
        </div>

        {/* Minutes List */}
        <div className="grid grid-cols-1 gap-4">
          {filteredMinutes.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">
                  Nenhuma ata encontrada
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredMinutes.map((minute) => (
              <Card key={minute.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{minute.number}</Badge>
                        <Badge>{getTypeLabel(minute.type)}</Badge>
                        {getStatusBadge(minute.status)}
                      </div>
                      <CardTitle className="text-xl mb-2">{minute.title}</CardTitle>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Data: {format(new Date(minute.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                        <p>Local: {minute.location}</p>
                        <p>Responsável: {minute.profiles.full_name}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {minute.pdf_url && (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => window.open(minute.pdf_url!, "_blank")}
                          title="Baixar PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => navigate(`/atas/${minute.id}`)}
                        title="Ver detalhes"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default Minutes;
