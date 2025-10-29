import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Grid, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Profile {
    id: string;
    full_name: string;
    bio?: string | null;
    city?: string | null;
    phone?: string | null;
    role: "admin" | "leader" | "member";
    photo_url?: string | null;
    created_at: string;
}

interface Post {
    id: string;
    content: string;
    image_url: string | null;
    created_at: string;
    likes: number;
}

export default function UserPublicProfile() {
    const { id } = useParams();
    const { toast } = useToast();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) loadProfileAndPosts(id);
    }, [id]);

    const loadProfileAndPosts = async (userId: string) => {
        setLoading(true);
        try {
            const { data: prof, error: profErr } = await supabase
                .from("profiles")
                .select("id, full_name, bio, city, phone, role, photo_url, created_at")
                .eq("id", userId)
                .single();

            if (profErr) throw profErr;
            setProfile(prof);

            const { data: userPosts, error: postErr } = await supabase
                .from("posts")
                .select("id, content, image_url, created_at, likes")
                .eq("author_id", userId)
                .order("created_at", { ascending: false });

            if (postErr) throw postErr;
            setPosts(userPosts || []);
        } catch (err: any) {
            toast({
                title: "Erro ao carregar perfil",
                description: err.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    if (loading)
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );

    if (!profile)
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-muted-foreground">Perfil não encontrado.</p>
            </div>
        );

    return (
        <div className="min-h-screen bg-muted">
            <Navbar />

            <main className="container mx-auto px-4 py-6 max-w-3xl">
                {/* Cabeçalho do perfil */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pb-6 border-b border-border">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-24 w-24 border-2 border-primary">
                            <AvatarImage src={profile.photo_url || undefined} />
                            <AvatarFallback>
                                {profile.full_name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .substring(0, 2)
                                    .toUpperCase()}
                            </AvatarFallback>
                        </Avatar>

                        <div>
                            <h1 className="text-2xl font-semibold">{profile.full_name}</h1>
                            <p className="text-sm text-muted-foreground capitalize">
                                {profile.role === "admin"
                                    ? "Administrador"
                                    : profile.role === "leader"
                                        ? "Líder"
                                        : "Membro"}
                            </p>

                            {profile.city && (
                                <p className="text-sm text-muted-foreground">{profile.city}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                                Entrou em{" "}
                                {format(new Date(profile.created_at), "MMMM 'de' yyyy", {
                                    locale: ptBR,
                                })}
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 justify-center sm:justify-end">
                        <div className="text-center">
                            <p className="font-semibold text-lg">{posts.length}</p>
                            <p className="text-xs text-muted-foreground">Publicações</p>
                        </div>
                        <div className="text-center">
                            <p className="font-semibold text-lg">
                                {posts.reduce((acc, p) => acc + (p.likes || 0), 0)}
                            </p>
                            <p className="text-xs text-muted-foreground">Curtidas</p>
                        </div>
                    </div>
                </div>

                {/* Bio */}
                {profile.bio && (
                    <p className="mt-4 text-sm leading-relaxed whitespace-pre-wrap">
                        {profile.bio}
                    </p>
                )}

                {/* Grade de postagens */}
                <section className="mt-8">
                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                        <Grid className="h-4 w-4 text-primary" /> Publicações
                    </h2>

                    {posts.length === 0 ? (
                        <p className="text-muted-foreground text-center py-10">
                            Nenhuma publicação ainda.
                        </p>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {posts.map((post) => (
                                <Card
                                    key={post.id}
                                    className="overflow-hidden cursor-pointer hover:opacity-80 transition-all"
                                >
                                    {post.image_url ? (
                                        <img
                                            src={post.image_url}
                                            alt="Post"
                                            className="w-full h-48 object-cover"
                                        />
                                    ) : (
                                        <div className="flex flex-col justify-center items-center h-48 bg-accent/30 text-muted-foreground p-3 text-center">
                                            <ImageIcon className="h-6 w-6 mb-2" />
                                            <p className="text-xs line-clamp-3">{post.content}</p>
                                        </div>
                                    )}
                                </Card>
                            ))}
                        </div>
                    )}
                </section>

                <div className="mt-8 text-center">
                    <Link to="/feed">
                        <Button variant="outline">Voltar ao Feed</Button>
                    </Link>
                </div>
            </main>
        </div>
    );
}
