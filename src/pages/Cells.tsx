import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users,
  PlusCircle,
  Loader2,
  MapPin,
  Calendar,
  Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Profile {
  id: string;
  full_name: string;
  role: "admin" | "leader" | "member";
}

interface Cell {
  id: string;
  name: string;
  address: string;
  neighborhood: string | null;
  meeting_day: string | null;
  meeting_time: string | null;
  description: string | null;
  leader: {
    full_name: string;
  };
  co_leader: {
    full_name: string;
  } | null;
}

const Cells = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [cells, setCells] = useState<Cell[]>([]);
  const [leaders, setLeaders] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    neighborhood: "",
    meeting_day: "",
    meeting_time: "",
    description: "",
    co_leader_id: "",
  });

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

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

      const { data: leadersData } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("role", ["leader", "admin"])
        .order("full_name");

      setLeaders(leadersData || []);

      await loadCells();
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

  const loadCells = async () => {
    try {
      const { data, error } = await supabase
        .from("cells")
        .select(`
          *,
          leader:profiles!fk_cells_leader(full_name),
          co_leader:profiles!fk_cells_co_leader(full_name)
        `)
        .order("name");

      if (error) throw error;
      setCells(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar células",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSaveCell = async () => {
    if (!profile) return;
    try {
      setSaving(true);

      const { data, error } = await supabase
        .from("cells")
        .insert({
          ...formData,
          leader_id: profile.id,
          co_leader_id: formData.co_leader_id || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Célula criada com sucesso!",
        description: `A célula "${data.name}" foi registrada.`,
      });

      setOpenDialog(false);
      setFormData({
        name: "",
        address: "",
        neighborhood: "",
        meeting_day: "",
        meeting_time: "",
        description: "",
        co_leader_id: "",
      });

      await loadCells();
    } catch (error: any) {
      toast({
        title: "Erro ao criar célula",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const canCreateCell = profile?.role === "admin" || profile?.role === "leader";

  return (
    <div className="min-h-screen bg-muted">
      <Navbar
        userRole={profile?.role}
        userName={profile?.full_name}
        userPhoto={profile?.photo_url}
      />


      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">Células</h1>
            <p className="text-lg text-muted-foreground">
              Grupos de relacionamento da IPR Sinop
            </p>
          </div>

          {canCreateCell && (
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
              <DialogTrigger asChild>
                <Button>
                  <PlusCircle className="h-5 w-5 mr-2" />
                  Nova Célula
                </Button>
              </DialogTrigger>

              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Nova Célula</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <Label>Nome da célula</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Ex: Célula Família Esperança"
                    />
                  </div>

                  <div>
                    <Label>Endereço</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) =>
                        setFormData({ ...formData, address: e.target.value })
                      }
                      placeholder="Rua, número, bairro..."
                    />
                  </div>

                  <div>
                    <Label>Bairro</Label>
                    <Input
                      value={formData.neighborhood}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          neighborhood: e.target.value,
                        })
                      }
                      placeholder="Ex: Jardim das Palmeiras"
                    />
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label>Dia da reunião</Label>
                      <Select
                        value={formData.meeting_day}
                        onValueChange={(v) =>
                          setFormData({ ...formData, meeting_day: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o dia" />
                        </SelectTrigger>
                        <SelectContent>
                          {[
                            "Domingo",
                            "Segunda",
                            "Terça",
                            "Quarta",
                            "Quinta",
                            "Sexta",
                            "Sábado",
                          ].map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex-1">
                      <Label>Horário</Label>
                      <Input
                        type="time"
                        value={formData.meeting_time}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            meeting_time: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Co-líder</Label>
                    <Select
                      value={formData.co_leader_id}
                      onValueChange={(v) =>
                        setFormData({ ...formData, co_leader_id: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um co-líder" />
                      </SelectTrigger>
                      <SelectContent>
                        {leaders.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Descrição</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      placeholder="Breve descrição da célula (opcional)"
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={handleSaveCell} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        "Salvar"
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Cells Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cells.length === 0 ? (
            <Card className="col-span-full">
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">
                  Nenhuma célula cadastrada
                </p>
              </CardContent>
            </Card>
          ) : (
            cells.map((cell) => (
              <Card key={cell.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-start justify-between">
                    <span className="text-lg">{cell.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/celulas/${cell.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    <div className="space-y-2 mt-2">
                      <div className="flex items-start gap-2">
                        <Users className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium">
                            Líder: {cell.leader.full_name}
                          </p>
                          {cell.co_leader && (
                            <p className="text-muted-foreground">
                              Co-líder: {cell.co_leader.full_name}
                            </p>
                          )}
                        </div>
                      </div>

                      {cell.neighborhood && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          <span>{cell.neighborhood}</span>
                        </div>
                      )}

                      {cell.meeting_day && cell.meeting_time && (
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 flex-shrink-0" />
                          <span>
                            {cell.meeting_day} às {cell.meeting_time}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardDescription>
                </CardHeader>
                {cell.description && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {cell.description}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default Cells;
