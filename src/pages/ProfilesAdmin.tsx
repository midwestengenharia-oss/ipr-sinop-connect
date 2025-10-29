import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Loader2,
    Shield,
    CheckCircle2,
    XCircle,
    Search,
    ChevronLeft,
    ChevronRight,
    Eye,
    Pencil,
    Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Profile {
    id: string;
    full_name: string;
    email: string;
    role: "admin" | "leader" | "member";
    status: "ativo" | "inativo";
    created_at: string;
    photo_url?: string | null;
}

export default function ProfilesAdmin() {
    const navigate = useNavigate();
    const { toast } = useToast();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    const limit = 20;

    useEffect(() => {
        checkAuthAndLoad();
    }, []);

    useEffect(() => {
        loadProfiles();
    }, [page, roleFilter, statusFilter]);

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
            await loadProfiles();
        } catch (error: any) {
            toast({
                title: "Erro ao carregar perfil",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const loadProfiles = async () => {
        try {
            setLoading(true);

            let query = supabase
                .from("profiles")
                .select("*", { count: "exact" })
                .order("created_at", { ascending: false })
                .range((page - 1) * limit, page * limit - 1);

            if (search.trim()) {
                query = query.or(
                    `full_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%`
                );
            }

            if (roleFilter !== "all") query = query.eq("role", roleFilter);
            if (statusFilter !== "all") query = query.eq("status", statusFilter);

            const { data, error, count } = await query;
            if (error) throw error;

            setProfiles(data || []);
            setTotalCount(count || 0);
        } catch (error: any) {
            toast({
                title: "Erro ao carregar usuários",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const updateProfile = async (id: string, field: keyof Profile, value: string) => {
        try {
            const { error } = await supabase
                .from("profiles")
                .update({ [field]: value, updated_at: new Date().toISOString() })
                .eq("id", id);

            if (error) throw error;

            toast({ title: "Perfil atualizado com sucesso!" });
            await loadProfiles();
        } catch (error: any) {
            toast({
                title: "Erro ao atualizar",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja remover este usuário?")) return;

        try {
            const { error } = await supabase.from("profiles").delete().eq("id", id);
            if (error) throw error;

            toast({ title: "Usuário removido com sucesso!" });
            await loadProfiles();
        } catch (error: any) {
            toast({
                title: "Erro ao remover usuário",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const totalPages = Math.ceil(totalCount / limit);

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

            <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                {/* ===== Header ===== */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <h2 className="text-2xl font-semibold flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        Gestão de Perfis
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Todos novos usuários entram como{" "}
                        <strong className="text-primary">Membro</strong>.
                    </p>
                </div>

                {/* ===== Filtros ===== */}
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="relative w-full md:w-1/3">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Pesquisar por nome ou e-mail..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9"
                            onKeyDown={(e) => e.key === "Enter" && loadProfiles()}
                        />
                    </div>

                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                        <SelectTrigger className="w-full md:w-48">
                            <SelectValue placeholder="Função" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas funções</SelectItem>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="leader">Líder</SelectItem>
                            <SelectItem value="member">Membro</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full md:w-48">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos status</SelectItem>
                            <SelectItem value="ativo">Ativos</SelectItem>
                            <SelectItem value="inativo">Inativos</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button variant="outline" onClick={() => loadProfiles()}>
                        Recarregar
                    </Button>
                </div>

                {/* ===== Tabela ===== */}
                {profiles.length === 0 ? (
                    <p className="text-center text-muted-foreground py-10">
                        Nenhum usuário encontrado.
                    </p>
                ) : (
                    <div className="rounded-md border bg-white shadow-sm overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Usuário</TableHead>
                                    <TableHead>E-mail</TableHead>
                                    <TableHead>Função</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Criado em</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {profiles.map((p) => (
                                    <TableRow key={p.id} className={`${p.status === "inativo" ? "opacity-60" : ""}`}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9 border">
                                                    <AvatarImage src={p.photo_url || undefined} />
                                                    <AvatarFallback>
                                                        {p.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <div className="font-medium">{p.full_name}</div>
                                                    <Badge
                                                        variant={
                                                            p.role === "admin"
                                                                ? "default"
                                                                : p.role === "leader"
                                                                    ? "secondary"
                                                                    : "outline"
                                                        }
                                                        className="capitalize mt-1"
                                                    >
                                                        {p.role}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </TableCell>

                                        <TableCell className="text-sm">{p.email}</TableCell>

                                        <TableCell>
                                            <Select value={p.role} onValueChange={(v) => updateProfile(p.id, "role", v)}>
                                                <SelectTrigger className="w-36">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="admin">Administrador</SelectItem>
                                                    <SelectItem value="leader">Líder</SelectItem>
                                                    <SelectItem value="member">Membro</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>

                                        <TableCell>
                                            <Select value={p.status} onValueChange={(v) => updateProfile(p.id, "status", v)}>
                                                <SelectTrigger className="w-32">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="ativo">
                                                        <div className="flex items-center gap-2">
                                                            <CheckCircle2 className="h-4 w-4 text-green-600" /> Ativo
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="inativo">
                                                        <div className="flex items-center gap-2">
                                                            <XCircle className="h-4 w-4 text-red-600" /> Inativo
                                                        </div>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>

                                        <TableCell>
                                            {new Date(p.created_at).toLocaleDateString("pt-BR")}
                                        </TableCell>

                                        <TableCell className="text-right space-x-2">
                                            <Button size="sm" variant="outline" onClick={() => navigate(`/perfil/${p.id}`)}>
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => updateProfile(p.id, "role", p.role)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button size="sm" variant="destructive" onClick={() => handleDelete(p.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}

                {/* ===== Paginação ===== */}
                <div className="flex items-center justify-between pt-6">
                    <p className="text-sm text-muted-foreground">
                        Página {page} de {totalPages} ({totalCount} usuários)
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            disabled={page === 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                        </Button>
                        <Button
                            variant="outline"
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        >
                            Próxima <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            </main>
        </div>
    );
}
