import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Profile {
    id: string;
    full_name: string;
    role: "admin" | "leader" | "member";
}

interface FormData {
    name: string;
    address: string;
    neighborhood?: string;
    meeting_day?: string;
    meeting_time?: string;
    description?: string;
    co_leader_id?: string | null;
}

const NewCell = () => {
    const { register, handleSubmit, setValue } = useForm<FormData>();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [leaders, setLeaders] = useState<Profile[]>([]);

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

            // Buscar perfil logado
            const { data: profileData, error: profileError } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", session.user.id)
                .single();

            if (profileError) throw profileError;
            setProfile(profileData);

            // Buscar líderes disponíveis (para co-lideres)
            const { data: leadersData, error: leadersError } = await supabase
                .from("profiles")
                .select("id, full_name, role")
                .in("role", ["leader", "admin"])
                .order("full_name");

            if (leadersError) throw leadersError;
            setLeaders(leadersData || []);
        } catch (error: any) {
            console.error("Erro:", error);
            toast({
                title: "Erro ao carregar dados",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (formData: FormData) => {
        if (!profile) return;

        try {
            setSaving(true);
            const { data, error } = await supabase
                .from("cells")
                .select(`
    *,
    leader:profiles!fk_cells_leader(full_name),
    co_leader:profiles!fk_cells_co_leader(full_name)
  `)
                .order("name");


            if (error) throw error;

            toast({
                title: "Célula criada com sucesso!",
                description: `A célula "${formData.name}" foi registrada.`,
            });

            navigate(`/celulas/${data.id}`);
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

    return (
        <div className="min-h-screen bg-muted">
            <Navbar userRole={profile?.role} userName={profile?.full_name} />

            <main className="container mx-auto px-4 py-8">
                <Card className="max-w-2xl mx-auto shadow-md">
                    <CardHeader>
                        <CardTitle className="text-2xl font-semibold">
                            Nova Célula
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            <div>
                                <Label htmlFor="name">Nome da célula</Label>
                                <Input id="name" placeholder="Ex: Célula Família Esperança" {...register("name", { required: true })} />
                            </div>

                            <div>
                                <Label htmlFor="address">Endereço</Label>
                                <Input id="address" placeholder="Rua, número, bairro..." {...register("address", { required: true })} />
                            </div>

                            <div>
                                <Label htmlFor="neighborhood">Bairro</Label>
                                <Input id="neighborhood" placeholder="Ex: Jardim das Palmeiras" {...register("neighborhood")} />
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <Label htmlFor="meeting_day">Dia da reunião</Label>
                                    <Select onValueChange={(value) => setValue("meeting_day", value)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione o dia" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Domingo">Domingo</SelectItem>
                                            <SelectItem value="Segunda">Segunda</SelectItem>
                                            <SelectItem value="Terça">Terça</SelectItem>
                                            <SelectItem value="Quarta">Quarta</SelectItem>
                                            <SelectItem value="Quinta">Quinta</SelectItem>
                                            <SelectItem value="Sexta">Sexta</SelectItem>
                                            <SelectItem value="Sábado">Sábado</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex-1">
                                    <Label htmlFor="meeting_time">Horário</Label>
                                    <Input id="meeting_time" type="time" {...register("meeting_time")} />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="co_leader">Co-líder</Label>
                                <Select onValueChange={(value) => setValue("co_leader_id", value)}>
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
                                <Label htmlFor="description">Descrição</Label>
                                <Textarea
                                    id="description"
                                    placeholder="Breve descrição da célula (opcional)"
                                    {...register("description")}
                                />
                            </div>

                            <div className="flex justify-end">
                                <Button type="submit" disabled={saving}>
                                    {saving ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Salvando...
                                        </>
                                    ) : (
                                        "Salvar Célula"
                                    )}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
};

export default NewCell;
