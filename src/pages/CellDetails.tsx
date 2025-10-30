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
    Locate,
} from "lucide-react";

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIconUrl from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

interface Profile {
    id: string;
    full_name: string;
    role: "admin" | "leader" | "Líder" | "member";
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
    Líder: { full_name: string };
    co_Líder: { full_name: string } | null;
}

interface MemberRow {
    id: string;
    member_id: string;
    role?: "member" | "visitor" | "Co-líder" | "Líder";
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

    // LOCATION state (CEP, address fields and map coords)
    const [cep, setCep] = useState("");
    const [logradouro, setLogradouro] = useState("");
    const [bairro, setBairro] = useState("");
    const [cidade, setCidade] = useState("");
    const [uf, setUf] = useState("");
    const [numero, setNumero] = useState("");
    const [coords, setCoords] = useState<[number, number] | null>(null);

    // Default Leaflet marker icon (works with bundlers)
    const markerIcon = L.icon({
        iconUrl: markerIconUrl as unknown as string,
        iconRetinaUrl: markerIcon2x as unknown as string,
        shadowUrl: markerShadow as unknown as string,
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        tooltipAnchor: [16, -28],
        shadowSize: [41, 41],
    });

    // CEP → ViaCEP + Geocoding com múltiplas APIs
    const buscarCep = async () => {
        if (!cep) return;

        console.log('🔎 Iniciando busca por CEP:', cep);

        try {
            const res = await fetch(`https://viacep.com.br/ws/${cep.replace("-", "")}/json/`);
            const data = await res.json();

            console.log('📮 Resposta ViaCEP:', data);

            if (data.erro) {
                toast({ title: "CEP não encontrado", variant: "destructive" });
                return;
            }
            const log = data.logradouro || "";
            const bai = data.bairro || "";
            const cid = data.localidade || "";
            const ufv = data.uf || "";

            console.log('📍 Endereço extraído:', { logradouro: log, bairro: bai, cidade: cid, uf: ufv });

            setLogradouro(log);
            setBairro(bai);
            setCidade(cid);
            setUf(ufv);
            toast({ title: "Endereço encontrado!" });

            // Buscar coordenadas com múltiplas APIs
            console.log('🌍 Iniciando busca de coordenadas...');
            let coords = await buscarCoordenadas(log, bai, cid, ufv, cep);

            if (coords) {
                console.log('✅ Coordenadas finais:', coords);
                setCoords(coords);
            } else {
                console.log('❌ Nenhuma API conseguiu encontrar coordenadas');
                toast({
                    title: "Não foi possível obter coordenadas automaticamente",
                    description: "Clique no mapa para definir a localização manualmente.",
                    variant: "default"
                });
            }
        } catch (err) {
            console.error('❌ Erro ao buscar CEP:', err);
            toast({ title: "Erro ao buscar CEP", variant: "destructive" });
        }
    };

    // Função para buscar coordenadas com múltiplas APIs (fallback em cascata)
    const buscarCoordenadas = async (
        logradouro: string,
        bairro: string,
        cidade: string,
        uf: string,
        cep: string
    ): Promise<[number, number] | null> => {
        // API Keys das variáveis de ambiente
        const GEOAPIFY_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY;
        // const OPENCAGE_KEY = import.meta.env.VITE_OPENCAGE_API_KEY; // DESATIVADO

        // Tentativa 1: Geoapify (se tiver API key)
        if (GEOAPIFY_KEY) {
            const coords = await buscarComGeoapify(logradouro, cidade, uf, GEOAPIFY_KEY);
            if (coords) {
                toast({ title: "Coordenadas encontradas!", description: "Via Geoapify API" });
                return coords;
            }
        }

        // Tentativa 2: Nominatim (grátis, sem API key)
        const coords = await buscarComNominatim(logradouro, bairro, cidade, uf, cep);
        if (coords) {
            toast({ title: "Coordenadas encontradas!", description: "Via OpenStreetMap" });
            return coords;
        }

        return null;
    };

    // Geoapify API - Principal API de Geocoding
    const buscarComGeoapify = async (
        logradouro: string,
        cidade: string,
        uf: string,
        apiKey: string
    ): Promise<[number, number] | null> => {
        try {
            // Montar query com endereço completo
            const q = [logradouro, cidade, uf, 'Brasil'].filter(Boolean).join(', ');

            const params = new URLSearchParams({
                text: q,
                apiKey: apiKey,
                lang: 'pt',
                limit: '1',
                filter: 'countrycode:br', // Filtrar apenas Brasil
                bias: 'countrycode:br',    // Priorizar Brasil
            });

            console.log('🔍 Buscando com Geoapify:', q);

            const res = await fetch(`https://api.geoapify.com/v1/geocode/search?${params}`);
            const data = await res.json();

            console.log('📍 Resposta Geoapify:', data);

            if (data.features && data.features.length > 0) {
                const [lng, lat] = data.features[0].geometry.coordinates;
                const properties = data.features[0].properties;

                console.log('✅ Coordenadas encontradas:', { lat, lng, endereco: properties.formatted });

                return [lat, lng];
            } else {
                console.log('⚠️ Geoapify não retornou resultados');
            }
        } catch (err) {
            console.error('❌ Geoapify falhou:', err);
        }
        return null;
    };

    // Nominatim (OpenStreetMap) API - Fallback Grátis
    const buscarComNominatim = async (
        logradouro: string,
        bairro: string,
        cidade: string,
        uf: string,
        cep: string
    ): Promise<[number, number] | null> => {
        console.log('🗺️ Tentando Nominatim como fallback...');

        // Usar proxy CORS para desenvolvimento local
        const CORS_PROXY = 'https://corsproxy.io/?';
        const headers = { 'User-Agent': 'IPR-Sinop-Connect/1.0' };

        // Tentativa 1: Endereço estruturado completo
        if (logradouro && cidade && uf) {
            try {
                const params = new URLSearchParams({
                    format: 'json',
                    street: logradouro,
                    city: cidade,
                    state: uf,
                    country: 'Brasil',
                    limit: '1',
                    addressdetails: '1',
                });

                await new Promise(resolve => setTimeout(resolve, 1000));
                const url = `https://nominatim.openstreetmap.org/search?${params}`;
                const res = await fetch(CORS_PROXY + encodeURIComponent(url));
                const data = await res.json();

                console.log('📍 Nominatim (tentativa 1 - estruturado):', data);

                if (Array.isArray(data) && data.length > 0) {
                    const { lat, lon } = data[0];
                    if (lat && lon) {
                        console.log('✅ Coordenadas Nominatim:', { lat, lon });
                        return [parseFloat(lat), parseFloat(lon)];
                    }
                }
            } catch (err) {
                console.log('⚠️ Nominatim tentativa 1 falhou:', err);
            }
        }

        // Tentativa 2: Query simples (cidade + estado)
        if (cidade && uf) {
            try {
                const q = `${cidade}, ${uf}, Brasil`;
                await new Promise(resolve => setTimeout(resolve, 1000));
                const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
                const res = await fetch(CORS_PROXY + encodeURIComponent(url));
                const data = await res.json();

                console.log('📍 Nominatim (tentativa 2 - cidade):', data);

                if (Array.isArray(data) && data.length > 0) {
                    const { lat, lon } = data[0];
                    if (lat && lon) {
                        console.log('✅ Coordenadas aproximadas (cidade):', { lat, lon });
                        return [parseFloat(lat), parseFloat(lon)];
                    }
                }
            } catch (err) {
                console.log('⚠️ Nominatim tentativa 2 falhou:', err);
            }
        }

        // Tentativa 3: Por CEP
        try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&postalcode=${encodeURIComponent(cep.replace("-", ""))}&country=Brazil`;
            const res = await fetch(CORS_PROXY + encodeURIComponent(url));
            const data = await res.json();

            console.log('📍 Nominatim (tentativa 3 - CEP):', data);

            if (Array.isArray(data) && data.length > 0) {
                const { lat, lon } = data[0];
                if (lat && lon) {
                    console.log('✅ Coordenadas por CEP:', { lat, lon });
                    return [parseFloat(lat), parseFloat(lon)];
                }
            }
        } catch (err) {
            console.log('⚠️ Nominatim tentativa 3 falhou:', err);
        }

        console.log('❌ Nominatim: Nenhuma tentativa teve sucesso');
        return null;
    };

    // Mapa → clique
    const MapClickHandler = () => {
        useMapEvents({
            click: (e) => {
                setCoords([e.latlng.lat, e.latlng.lng]);
            },
        });
        return null;
    };

    const RecenterOnCoords = ({ coords }: { coords: [number, number] }) => {
        const map = useMap();
        useEffect(() => {
            map.setView(coords, 16);
        }, [coords, map]);
        return null;
    };

    // Salvar localização
    const salvarLocalizacao = async () => {
        try {
            if (!coords) {
                toast({ title: "Selecione um ponto no mapa", variant: "destructive" });
                return;
            }
            // validated update with error handling below
            const { error } = await supabase
                .from("cells")
                .update({
                    address: logradouro,
                    number: numero || null,
                    neighborhood: bairro || null,
                    city: cidade || null,
                    state: uf || null,
                    latitude: coords[0],
                    longitude: coords[1],
                })
                .eq("id", id as string);
            if (error) {
                toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
                return;
            }
            await loadCell();
            toast({ title: "Localização atualizada com sucesso!" });
        } catch (e: any) {
            toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
        }
    };

    // permissões
    const canManage = useMemo(() => {
        if (!profile || !cell) return false;
        if (profile.role === "admin") return true;
        if ((profile.role === "Líder" || profile.role === "leader") && profile.id === cell.leader_id) return true;
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
        // 1. Buscar a célula
        const { data: cellData, error: cellError } = await supabase
            .from("cells")
            .select("*")
            .eq("id", id)
            .single();

        if (cellError) {
            throw cellError;
        }

        // 2. Buscar o líder
        let liderData = null;
        if (cellData.leader_id) {
            const { data, error } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", cellData.leader_id)
                .single();

            if (!error && data) {
                liderData = data;
            }
        }

        // 3. Buscar o co-líder
        let coLiderData = null;
        if (cellData.co_leader_id) {
            const { data, error } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", cellData.co_leader_id)
                .single();

            if (!error && data) {
                coLiderData = data;
            }
        }

        // 4. Combinar os dados
        const combinedData = {
            ...cellData,
            Líder: liderData,
            co_Líder: coLiderData,
        };

        setCell(combinedData as Cell);

        // Initialize location fields if available on the record
        const c: any = cellData || {};
        setLogradouro(c.address || "");
        setBairro(c.neighborhood || "");
        setCidade(c.city || "");
        setUf(c.state || "");
        setNumero(c.number || "");
        if (c.latitude && c.longitude) {
            setCoords([Number(c.latitude), Number(c.longitude)]);
        }
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
            toast({ title: "Data obrigatória", description: "Informe a data da reunião.", variant: "destructive" });
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
            toast({
                title: "Falha ao realizar ação",
                description: `Detalhes: ${error.message}`,
                variant: "destructive"
            });
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
                        <TabsTrigger value="location">Localização</TabsTrigger>
                    </TabsList>

                    {/* ============ Info ============ */}
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
                                <p><strong>Líder:</strong> {cell.Líder?.full_name}</p>
                                {cell.co_Líder && (
                                    <p><strong>Co-líder:</strong> {cell.co_Líder.full_name}</p>
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
                                                        {meet.topic ? ` – ${meet.topic}` : ""}
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

                    {/* === Nova aba Localização === */}
                    <TabsContent value="location" className="mt-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Localização da Célula</CardTitle>
                                <CardDescription>Busque pelo CEP e selecione o ponto no mapa</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <div>
                                        <Label>CEP</Label>
                                        <div className="flex gap-2">
                                            <Input value={cep} onChange={(e) => setCep(e.target.value)} placeholder="78550-000" />
                                            <Button onClick={buscarCep}>Buscar</Button>
                                        </div>
                                    </div>
                                    <div>
                                        <Label>Rua</Label>
                                        <Input value={logradouro} readOnly />
                                    </div>
                                    <div>
                                        <Label>Bairro</Label>
                                        <Input value={bairro} readOnly />
                                    </div>
                                    <div>
                                        <Label>Cidade</Label>
                                        <Input value={cidade} readOnly />
                                    </div>
                                    <div>
                                        <Label>UF</Label>
                                        <Input value={uf} readOnly />
                                    </div>
                                    <div>
                                        <Label>Número</Label>
                                        <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex: 429/A" />
                                    </div>
                                </div>

                                <div className="h-[400px] rounded-md overflow-hidden border">
                                    <MapContainer
                                        center={coords || [-11.8604, -55.509]}
                                        zoom={13}
                                        style={{ height: "100%", width: "100%" }}
                                    >
                                        <TileLayer
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                            attribution="© OpenStreetMap"
                                        />
                                        {coords && <Marker position={coords} icon={markerIcon} />}
                                        {coords && <RecenterOnCoords coords={coords} />}
                                        <MapClickHandler />
                                    </MapContainer>
                                </div>

                                <div className="flex justify-end">
                                    <Button onClick={salvarLocalizacao} disabled={!canManage}>
                                        <Locate className="h-4 w-4 mr-2" /> Salvar alterações
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
};

export default CellDetails;