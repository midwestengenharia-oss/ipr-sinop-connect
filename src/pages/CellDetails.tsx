import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
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
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
    Loader2,
    Users,
    MapPin,
    Calendar,
    PlusCircle,
    Trash2,
} from "lucide-react";

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
    leader_id: string | null;
    co_leader_id: string | null;
    leader: { full_name: string };
    co_leader: { full_name: string } | null;
}

interface MemberRow {
    id: string;
    member_id: string;
    role?: "member" | "visitor" | "co-lider" | "leader";
    joined_at: string;
    profile: { full_name: string };
}

interface MeetingRow {
    id: string;
    cell_id: string;
    meeting_date: string; // date
    topic: string | null;
    notes: string | null;
    created_at: string;
    attendance: { member_id: string; present: boolean }[];
}

const CellDetails = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [cell, setCell] = useState<Cell | null>(null);

    // MEMBERS
    const [members, setMembers] = useState<MemberRow[]>([]);
    const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
    const [selectedProfileToAdd, setSelectedProfileToAdd] = useState<string>("");
    const [addingMember, setAddingMember] = useState(false);
    const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

    // MEETINGS
    const [meetings, setMeetings] = useState<MeetingRow[]>([]);
    const [creatingMeeting, setCreatingMeeting] = useState(false);
    const [newMeeting, setNewMeeting] = useState({
        meeting_date: "",
        topic: "",
        notes: "",
    });
    const [loading, setLoading] = useState(true);

    // Permissions
    const canManage = useMemo(() => {
        if (!profile || !cell) return false;
        if (profile.role === "admin") return true;
        if (profile.role === "leader" && profile.id === cell.leader_id) return true;
        return false;
    }, [profile, cell]);

    useEffect(() => {
        checkAuthAndLoad();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const checkAuthAndLoad = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                navigate("/auth");
                return;
            }

            const { data: profileData, error: profileError } = await supabase
                .from("profiles")
                .select("id, full_name, role")
                .eq("id", session.user.id)
                .single();
            if (profileError) throw profileError;
            setProfile(profileData);

            await Promise.all([loadCell(), loadMembers(), loadMeetings(), loadAllProfiles()]);
        } catch (error: any) {
            toast({
                title: "Erro ao carregar",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const loadCell = async () => {
        const { data, error } = await supabase
            .from("cells")
            .select(`
        *,
        leader:profiles!fk_cells_leader(full_name),
        co_leader:profiles!fk_cells_co_leader(full_name)
      `)
            .eq("id", id)
            .single();

        if (error) {
            throw error;
        }
        setCell(data as Cell);
    };

    const loadMembers = async () => {
        const { data, error } = await supabase
            .from("cell_members")
            .select(`
        id,
        member_id,
        role,
        joined_at,
        profile:profiles(full_name)
      `)
            .eq("cell_id", id)
            .order("joined_at", { ascending: false });
        if (error) {
            throw error;
        }
        setMembers((data || []) as MemberRow[]);
    };

    const loadAllProfiles = async () => {
        const { data, error } = await supabase
            .from("profiles")
            .select("id, full_name, role")
            .order("full_name");
        if (error) {
            throw error;
        }
        setAllProfiles((data || []) as Profile[]);
    };

    const loadMeetings = async () => {
        const { data, error } = await supabase
            .from("cell_meetings")
            .select(`
        id,
        cell_id,
        meeting_date,
        topic,
        notes,
        created_at,
        attendance:cell_attendance(member_id, present)
      `)
            .eq("cell_id", id)
            .order("meeting_date", { ascending: false });
        if (error) {
            throw error;
        }
        setMeetings((data || []) as MeetingRow[]);
    };

    // ===== MEMBERS CRUD =====
    const handleAddMember = async () => {
        if (!selectedProfileToAdd) {
            toast({ title: "Selecione um membro", description: "Escolha um perfil para adicionar." });
            return;
        }
        try {
            setAddingMember(true);
            const alreadyIn = members.some(m => m.member_id === selectedProfileToAdd);
            if (alreadyIn) {
                toast({
                    title: "Membro já vinculado",
                    description: "Este perfil já está na célula.",
                });
                return;
            }
            const { error } = await supabase
                .from("cell_members")
                .insert({
                    cell_id: id,
                    member_id: selectedProfileToAdd,
                    role: "member",
                });
            if (error) throw error;

            setSelectedProfileToAdd("");
            await loadMembers();
            toast({ title: "Membro adicionado", description: "O membro foi vinculado à célula." });
        } catch (error: any) {
            toast({ title: "Erro ao adicionar membro", description: error.message, variant: "destructive" });
        } finally {
            setAddingMember(false);
        }
    };

    const handleRemoveMember = async (cellMemberId: string) => {
        try {
            setRemovingMemberId(cellMemberId);
            const { error } = await supabase
                .from("cell_members")
                .delete()
                .eq("id", cellMemberId);
            if (error) throw error;

            await loadMembers();
            toast({ title: "Membro removido", description: "Vínculo removido com sucesso." });
        } catch (error: any) {
            toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
        } finally {
            setRemovingMemberId(null);
        }
    };

    // ===== MEETINGS & ATTENDANCE =====
    const handleCreateMeeting = async () => {
        if (!newMeeting.meeting_date) {
            toast({ title: "Data obrigatória", description: "Informe a data da reunião." });
            return;
        }
        try {
            setCreatingMeeting(true);
            const { error } = await supabase
                .from("cell_meetings")
                .insert({
                    cell_id: id,
                    meeting_date: newMeeting.meeting_date,
                    topic: newMeeting.topic || null,
                    notes: newMeeting.notes || null,
                });
            if (error) throw error;

            setNewMeeting({ meeting_date: "", topic: "", notes: "" });
            await loadMeetings();
            toast({ title: "Reunião criada", description: "Agora você pode marcar a presença dos membros." });
        } catch (error: any) {
            toast({ title: "Erro ao criar reunião", description: error.message, variant: "destructive" });
        } finally {
            setCreatingMeeting(false);
        }
    };

    const setAttendance = async (meetingId: string, memberId: string, present: boolean) => {
        try {
            // tenta encontrar presença existente
            const { data: existing, error: selError } = await supabase
                .from("cell_attendance")
                .select("id")
                .eq("meeting_id", meetingId)
                .eq("member_id", memberId)
                .maybeSingle();
            if (selError) throw selError;

            if (existing?.id) {
                // update
                const { error: upError } = await supabase
                    .from("cell_attendance")
                    .update({ present })
                    .eq("id", existing.id);
                if (upError) throw upError;
            } else {
                // insert
                const { error: insError } = await supabase
                    .from("cell_attendance")
                    .insert({ meeting_id: meetingId, member_id: memberId, present });
                if (insError) throw insError;
            }

            // refetch meetings to reflect change
            await loadMeetings();
        } catch (error: any) {
            toast({ title: "Erro ao marcar presença", description: error.message, variant: "destructive" });
        }
    };

    // perfis disponíveis para adicionar (exclui já membros)
    const candidateProfiles = useMemo(() => {
        const currentIds = new Set(members.map(m => m.member_id));
        return allProfiles.filter(p => !currentIds.has(p.id));
    }, [allProfiles, members]);

    // renderização condicional (sem interromper hooks)
    if (loading || !cell) {
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
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold">{cell.name}</h1>
                        <p className="text-muted-foreground">
                            Detalhes, membros e frequência da célula
                        </p>
                    </div>
                </div>

                <Tabs defaultValue="info" className="w-full">
                    <TabsList>
                        <TabsTrigger value="info">Informações</TabsTrigger>
                        <TabsTrigger value="members">Membros</TabsTrigger>
                        <TabsTrigger value="meetings">Frequência</TabsTrigger>
                    </TabsList>

                    {/* ============ INFO ============ */}
                    <TabsContent value="info" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Informações da Célula</CardTitle>
                                <CardDescription>Dados gerais do grupo</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <p><strong>Endereço:</strong> {cell.address}</p>
                                {cell.neighborhood && (
                                    <p><MapPin className="inline h-4 w-4 mr-1" /> {cell.neighborhood}</p>
                                )}
                                {cell.meeting_day && (
                                    <p>
                                        <Calendar className="inline h-4 w-4 mr-1" />
                                        {cell.meeting_day} {cell.meeting_time ? `às ${cell.meeting_time}` : ""}
                                    </p>
                                )}
                                <p><strong>Líder:</strong> {cell.leader?.full_name}</p>
                                {cell.co_leader && (
                                    <p><strong>Co-líder:</strong> {cell.co_leader.full_name}</p>
                                )}
                                {cell.description && (
                                    <div className="pt-2">
                                        <strong>Descrição:</strong>
                                        <p className="text-muted-foreground mt-1">{cell.description}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ============ MEMBERS ============ */}
                    <TabsContent value="members" className="mt-4">
                        <Card>
                            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <CardTitle>Membros</CardTitle>
                                    <CardDescription>Gerencie quem pertence à célula</CardDescription>
                                </div>

                                {canManage && (
                                    <div className="flex gap-2 items-end">
                                        <div className="w-64">
                                            <Label htmlFor="addMember">Adicionar membro</Label>
                                            <Select value={selectedProfileToAdd} onValueChange={setSelectedProfileToAdd}>
                                                <SelectTrigger id="addMember">
                                                    <SelectValue placeholder="Selecione um perfil" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {candidateProfiles.length === 0 ? (
                                                        <SelectItem value="__none" disabled>Nenhum disponível</SelectItem>
                                                    ) : candidateProfiles.map((p) => (
                                                        <SelectItem key={p.id} value={p.id}>
                                                            {p.full_name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button onClick={handleAddMember} disabled={addingMember || !selectedProfileToAdd || selectedProfileToAdd === "__none"}>
                                            {addingMember ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                            Adicionar
                                        </Button>
                                    </div>
                                )}
                            </CardHeader>

                            <CardContent>
                                <Table>
                                    {members.length === 0 && (
                                        <TableCaption>Nenhum membro vinculado ainda.</TableCaption>
                                    )}
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nome</TableHead>
                                            <TableHead>Função</TableHead>
                                            <TableHead>Desde</TableHead>
                                            <TableHead className="text-right">Ações</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {members.map((m) => (
                                            <TableRow key={m.id}>
                                                <TableCell>{m.profile?.full_name}</TableCell>
                                                <TableCell>{m.role || "member"}</TableCell>
                                                <TableCell>{new Date(m.joined_at).toLocaleDateString()}</TableCell>
                                                <TableCell className="text-right">
                                                    {canManage ? (
                                                        <Button
                                                            variant="destructive"
                                                            size="icon"
                                                            onClick={() => handleRemoveMember(m.id)}
                                                            disabled={removingMemberId === m.id}
                                                            title="Remover do grupo"
                                                        >
                                                            {removingMemberId === m.id
                                                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                                                : <Trash2 className="h-4 w-4" />
                                                            }
                                                        </Button>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">Sem permissão</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ============ MEETINGS / FREQUENCY ============ */}
                    <TabsContent value="meetings" className="mt-4">
                        <Card>
                            <CardHeader className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                                <div>
                                    <CardTitle>Frequência</CardTitle>
                                    <CardDescription>Crie reuniões e marque presença dos membros</CardDescription>
                                </div>

                                {canManage && (
                                    <div className="flex gap-2 items-end">
                                        <div>
                                            <Label>Data</Label>
                                            <Input
                                                type="date"
                                                value={newMeeting.meeting_date}
                                                onChange={(e) => setNewMeeting({ ...newMeeting, meeting_date: e.target.value })}
                                            />
                                        </div>
                                        <div className="w-48">
                                            <Label>Tema (opcional)</Label>
                                            <Input
                                                placeholder="Tema / assunto"
                                                value={newMeeting.topic}
                                                onChange={(e) => setNewMeeting({ ...newMeeting, topic: e.target.value })}
                                            />
                                        </div>
                                        <div className="w-64">
                                            <Label>Notas (opcional)</Label>
                                            <Input
                                                placeholder="Observações"
                                                value={newMeeting.notes}
                                                onChange={(e) => setNewMeeting({ ...newMeeting, notes: e.target.value })}
                                            />
                                        </div>
                                        <Button onClick={handleCreateMeeting} disabled={creatingMeeting || !newMeeting.meeting_date}>
                                            {creatingMeeting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                            Criar reunião
                                        </Button>
                                    </div>
                                )}
                            </CardHeader>

                            <CardContent className="space-y-6">
                                {meetings.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Nenhuma reunião registrada ainda.</p>
                                ) : (
                                    meetings.map((meet) => {
                                        // mapa de presenças desta reunião
                                        const presentSet = new Set(meet.attendance?.filter(a => a.present).map(a => a.member_id));

                                        return (
                                            <Card key={meet.id} className="border border-muted">
                                                <CardHeader className="pb-2">
                                                    <CardTitle className="text-lg">
                                                        {new Date(meet.meeting_date).toLocaleDateString()}
                                                        {meet.topic ? ` — ${meet.topic}` : ""}
                                                    </CardTitle>
                                                    {meet.notes && (
                                                        <CardDescription>{meet.notes}</CardDescription>
                                                    )}
                                                </CardHeader>
                                                <CardContent>
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Membro</TableHead>
                                                                <TableHead>Presente</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {members.map((m) => {
                                                                const isPresent = presentSet.has(m.member_id);
                                                                return (
                                                                    <TableRow key={m.id + meet.id}>
                                                                        <TableCell>{m.profile?.full_name}</TableCell>
                                                                        <TableCell>
                                                                            <div className="flex items-center gap-2">
                                                                                <Checkbox
                                                                                    checked={isPresent}
                                                                                    onCheckedChange={(checked) =>
                                                                                        setAttendance(
                                                                                            meet.id,
                                                                                            m.member_id,
                                                                                            Boolean(checked)
                                                                                        )
                                                                                    }
                                                                                    disabled={!canManage}
                                                                                />
                                                                                <span className="text-xs text-muted-foreground">
                                                                                    {isPresent ? "Presente" : "Ausente"}
                                                                                </span>
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                );
                                                            })}
                                                        </TableBody>
                                                    </Table>
                                                </CardContent>
                                            </Card>
                                        );
                                    })
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
};

export default CellDetails;
