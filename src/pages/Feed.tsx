// src/pages/Feed.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import Navbar from "@/components/Navbar";

import {
    Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Loader2, Image as ImageIcon, Send, Heart, MessageCircle,
    ChevronDown, MoreVertical, Pin, PinOff, Edit2, Trash2, Check, X
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from "@/components/ui/tooltip";
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Role = "admin" | "leader" | "member";

interface Profile {
    id: string;
    full_name: string;
    email: string;
    role: Role;
    photo_url: string | null;
    status: "ativo" | "inativo";
}

interface CommentRow {
    id: string;
    content: string;
    created_at: string;
    author_id: string;
    profiles: { full_name: string; photo_url: string | null };
}

interface LikeRow {
    user_id: string;
    profiles: { full_name: string; photo_url: string | null };
}

interface PostRow {
    id: string;
    author_id: string;
    content: string;
    image_url: string | null;
    created_at: string;
    is_pinned: boolean | null;
    profiles?: { full_name: string; photo_url: string | null } | null;
    post_comments?: CommentRow[];
    post_likes?: LikeRow[];
}

const PAGE_SIZE = 10;
const WEEKLY_LIMIT: Record<Role, number> = {
    admin: 9999,
    leader: 4,
    member: 3,
};

export default function Feed() {
    const { toast } = useToast();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);

    const [posts, setPosts] = useState<PostRow[]>([]);
    const [busy, setBusy] = useState(false);
    const [page, setPage] = useState(0);

    // composer
    const [postText, setPostText] = useState("");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const canPost = useMemo(() => !!profile && profile.status === "ativo", [profile]);
    const canModerate = useMemo(() => profile?.role === "admin" || profile?.role === "leader", [profile]);

    useEffect(() => {
        boot();
    }, []);

    const boot = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                window.location.href = "/auth";
                return;
            }

            const { data: me, error: meErr } = await supabase
                .from("profiles")
                .select("id, full_name, email, role, photo_url, status")
                .eq("id", session.user.id)
                .single();

            if (meErr) throw meErr;
            setProfile(me);

            await loadPage(0, true);
        } catch (e: any) {
            toast({ title: "Erro ao iniciar", description: e.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    const loadPage = async (pageIndex: number, replace = false) => {
        setBusy(true);
        try {
            const from = pageIndex * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            const { data, error } = await supabase
                .from("posts")
                .select(`
          id, author_id, content, image_url, created_at, is_pinned,
          profiles:author_id(full_name, photo_url),
          post_comments(
            id, content, created_at, author_id,
            profiles(full_name, photo_url)
          ),
          post_likes(
            user_id,
            profiles(full_name, photo_url)
          )
        `)
                .order("is_pinned", { ascending: false, nullsFirst: false })
                .order("created_at", { ascending: false })
                .range(from, to);

            if (error) throw error;

            setPosts((prev) => (replace ? (data as PostRow[]) : [...prev, ...(data as PostRow[])]));
            setPage(pageIndex);
        } catch (e: any) {
            toast({ title: "Erro ao carregar feed", description: e.message, variant: "destructive" });
        } finally {
            setBusy(false);
        }
    };

    const checkWeeklyLimit = async () => {
        if (!profile) return false;
        const limit = WEEKLY_LIMIT[profile.role];
        if (limit >= 9999) return true;
        const { count, error } = await supabase
            .from("posts")
            .select("*", { count: "exact", head: true })
            .eq("author_id", profile.id)
            .gte("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString());
        if (error) return true; // fallback permissivo
        return (count || 0) < limit;
    };

    const handleCreatePost = async () => {
        if (!profile) return;
        if (!postText.trim() && !imageFile) {
            toast({ title: "Conteúdo vazio", description: "Escreva algo ou envie uma imagem." });
            return;
        }

        const allowed = await checkWeeklyLimit();
        if (!allowed) {
            toast({
                title: "Limite semanal atingido 🙏",
                description:
                    profile.role === "member"
                        ? "Membros podem publicar 3 vezes por semana."
                        : "Você alcançou seu limite semanal.",
                variant: "destructive",
            });
            return;
        }

        setUploading(true);
        try {
            let image_url: string | null = null;
            if (imageFile) {
                const filePath = `images/${profile.id}/${Date.now()}_${imageFile.name}`;
                const { error: upErr } = await supabase.storage.from("posts").upload(filePath, imageFile, { upsert: false });
                if (upErr) throw upErr;
                const { data: pub } = supabase.storage.from("posts").getPublicUrl(filePath);
                image_url = pub.publicUrl;
            }

            const { error: insErr } = await supabase.from("posts").insert({
                author_id: profile.id,
                content: postText.trim(),
                image_url,
            });
            if (insErr) throw insErr;

            setPostText("");
            setImageFile(null);
            if (fileRef.current) fileRef.current.value = "";
            toast({ title: "Publicado com sucesso!" });
            await loadPage(0, true);
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (e: any) {
            toast({ title: "Erro ao publicar", description: e.message, variant: "destructive" });
        } finally {
            setUploading(false);
        }
    };

    const handleToggleLike = async (postId: string) => {
        if (!profile) return;
        try {
            const { data: existing } = await supabase
                .from("post_likes")
                .select("id")
                .eq("post_id", postId)
                .eq("user_id", profile.id)
                .maybeSingle();

            if (existing) {
                await supabase.from("post_likes").delete().eq("id", existing.id);
                setPosts((prev) =>
                    prev.map((p) =>
                        p.id === postId
                            ? { ...p, post_likes: p.post_likes?.filter((l) => l.user_id !== profile.id) }
                            : p
                    )
                );
            } else {
                await supabase.from("post_likes").insert({ post_id: postId, user_id: profile.id });
                setPosts((prev) =>
                    prev.map((p) =>
                        p.id === postId
                            ? {
                                ...p,
                                post_likes: [
                                    ...(p.post_likes || []),
                                    { user_id: profile.id, profiles: { full_name: profile.full_name, photo_url: profile.photo_url } },
                                ],
                            }
                            : p
                    )
                );
            }
        } catch (e: any) {
            toast({ title: "Erro ao curtir/descurtir", description: e.message, variant: "destructive" });
        }
    };

    const handleAddComment = async (postId: string, text: string) => {
        if (!profile || !text.trim()) return;
        try {
            const { error } = await supabase.from("post_comments").insert({
                post_id: postId,
                author_id: profile.id,
                content: text.trim(),
            });
            if (error) throw error;
            // atualização local leve: adiciona comentário no estado
            setPosts((prev) =>
                prev.map((p) =>
                    p.id === postId
                        ? {
                            ...p,
                            post_comments: [
                                ...(p.post_comments || []),
                                {
                                    id: crypto.randomUUID(),
                                    content: text.trim(),
                                    created_at: new Date().toISOString(),
                                    author_id: profile.id,
                                    profiles: { full_name: profile.full_name, photo_url: profile.photo_url },
                                },
                            ],
                        }
                        : p
                )
            );
        } catch (e: any) {
            toast({ title: "Erro ao comentar", description: e.message, variant: "destructive" });
        }
    };

    // Editar post
    const handleSavePost = async (postId: string, newText: string) => {
        try {
            const { error } = await supabase.from("posts").update({ content: newText.trim() }).eq("id", postId);
            if (error) throw error;
            setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, content: newText.trim() } : p)));
            toast({ title: "Post atualizado" });
        } catch (e: any) {
            toast({ title: "Erro ao atualizar post", description: e.message, variant: "destructive" });
        }
    };

    const handleDeletePost = async (postId: string) => {
        try {
            const { error } = await supabase.from("posts").delete().eq("id", postId);
            if (error) throw error;
            setPosts((prev) => prev.filter((p) => p.id !== postId));
            toast({ title: "Post excluído" });
        } catch (e: any) {
            toast({ title: "Erro ao excluir post", description: e.message, variant: "destructive" });
        }
    };

    // Fixar/Desafixar
    const handleTogglePin = async (postId: string, nextPinned: boolean) => {
        try {
            const { error } = await supabase.from("posts").update({ is_pinned: nextPinned }).eq("id", postId);
            if (error) throw error;
            setPosts((prev) =>
                prev
                    .map((p) => (p.id === postId ? { ...p, is_pinned: nextPinned } : p))
                    .sort((a, b) => {
                        const ap = a.is_pinned ? 1 : 0;
                        const bp = b.is_pinned ? 1 : 0;
                        if (ap !== bp) return bp - ap; // pin first
                        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                    })
            );
            toast({ title: nextPinned ? "Fixado no mural" : "Removido do mural" });
        } catch (e: any) {
            toast({ title: "Erro ao atualizar mural", description: e.message, variant: "destructive" });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const pinned = posts.filter((p) => !!p.is_pinned);
    const regular = posts.filter((p) => !p.is_pinned);

    return (
        <div className="min-h-screen bg-muted">
            <Navbar userRole={profile?.role} userName={profile?.full_name} />
            <main className="container mx-auto px-4 py-6 max-w-3xl">
                {/* Composer */}
                {canPost && (
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>Compartilhar bênção</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex gap-3">
                                <Avatar className="h-10 w-10 shrink-0">
                                    <AvatarImage src={profile?.photo_url ?? undefined} />
                                    <AvatarFallback>
                                        {profile?.full_name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <Textarea
                                    placeholder="O que Deus tem feito? Alguma foto da célula? 🙏"
                                    value={postText}
                                    onChange={(e) => setPostText(e.target.value)}
                                    className="min-h-[90px]"
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Input
                                        ref={fileRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                                        className="hidden"
                                    />
                                    <Button variant="outline" onClick={() => fileRef.current?.click()}>
                                        <ImageIcon className="h-4 w-4 mr-2" />
                                        Imagem
                                    </Button>
                                    {imageFile && <span className="text-xs text-muted-foreground">{imageFile.name}</span>}
                                </div>

                                <Button onClick={handleCreatePost} disabled={uploading}>
                                    {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                                    Publicar
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Mural (fixados) */}
                {pinned.length > 0 && (
                    <section className="space-y-4 mb-6">
                        {pinned.map((post) => (
                            <PostCard
                                key={post.id}
                                post={post}
                                userId={profile?.id || ""}
                                canModerate={!!canModerate}
                                isOwner={post.author_id === profile?.id}
                                onToggleLike={handleToggleLike}
                                onComment={handleAddComment}
                                onSavePost={handleSavePost}
                                onDeletePost={handleDeletePost}
                                onTogglePin={handleTogglePin}
                            />
                        ))}
                    </section>
                )}

                {/* Feed regular */}
                <section className="space-y-4">
                    {regular.map((post) => (
                        <PostCard
                            key={post.id}
                            post={post}
                            userId={profile?.id || ""}
                            canModerate={!!canModerate}
                            isOwner={post.author_id === profile?.id}
                            onToggleLike={handleToggleLike}
                            onComment={handleAddComment}
                            onSavePost={handleSavePost}
                            onDeletePost={handleDeletePost}
                            onTogglePin={handleTogglePin}
                        />
                    ))}
                </section>

                {/* Paginação */}
                <div className="flex justify-center mt-6">
                    <Button variant="outline" onClick={() => loadPage(page + 1)} disabled={busy}>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                        Carregar mais
                    </Button>
                </div>
            </main>
        </div>
    );
}

/* ================= PostCard ================= */

function PostCard({
    post,
    userId,
    canModerate,
    isOwner,
    onToggleLike,
    onComment,
    onSavePost,
    onDeletePost,
    onTogglePin,
}: {
    post: PostRow;
    userId: string;
    canModerate: boolean;
    isOwner: boolean;
    onToggleLike: (id: string) => void;
    onComment: (id: string, text: string) => void;
    onSavePost: (id: string, text: string) => void;
    onDeletePost: (id: string) => void;
    onTogglePin: (id: string, nextPinned: boolean) => void;
}) {
    const [comment, setComment] = useState("");
    const [editing, setEditing] = useState(false);
    const [editText, setEditText] = useState(post.content || "");

    const initials = (post.profiles?.full_name || "Membro")
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    const hasLiked = post.post_likes?.some((l) => l.user_id === userId);
    const likeNames = (post.post_likes || []).map((l) => l.profiles?.full_name).join(", ");

    const handleSave = () => {
        if (editText.trim() !== post.content?.trim()) {
            onSavePost(post.id, editText);
        }
        setEditing(false);
    };

    return (
        <Card className={`overflow-hidden ${post.is_pinned ? "ring-1 ring-primary/40" : ""}`}>
            <CardHeader className="flex-row items-center gap-3">
                <Link to={`/perfil/${post.author_id}`} className="flex items-center gap-3 hover:opacity-80 transition">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={post.profiles?.photo_url ?? undefined} />
                        <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                </Link>

                <div className="flex-1 flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                        <Link
                            to={`/perfil/${post.author_id}`}
                            className="font-medium hover:underline hover:text-primary transition-colors"
                        >
                            {post.profiles?.full_name || "Membro"}
                        </Link>
                        <div className="flex items-center gap-2">
                            {post.is_pinned && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                    <Pin className="h-3 w-3" /> Fixado
                                </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
                            </span>
                        </div>
                    </div>

                    {/* Menu de ações */}
                    {(isOwner || canModerate) && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-5 w-5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                {canModerate && (
                                    <DropdownMenuItem onClick={() => onTogglePin(post.id, !post.is_pinned)}>
                                        {post.is_pinned ? <><PinOff className="h-4 w-4 mr-2" /> Remover do mural</> : <><Pin className="h-4 w-4 mr-2" /> Fixar no mural</>}
                                    </DropdownMenuItem>
                                )}
                                {isOwner && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setEditing(true)}>
                                            <Edit2 className="h-4 w-4 mr-2" /> Editar
                                        </DropdownMenuItem>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <DropdownMenuItem className="text-red-600 focus:text-red-600">
                                                    <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                                </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Excluir publicação?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Esta ação não pode ser desfeita.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => onDeletePost(post.id)}>
                                                        Excluir
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </CardHeader>

            {post.image_url && (
                <img src={post.image_url} alt="post" className="w-full max-h-[600px] object-cover" />
            )}

            <CardContent className="space-y-3">
                {/* Conteúdo / Edição */}
                {!editing ? (
                    <p className="text-sm whitespace-pre-wrap">{post.content}</p>
                ) : (
                    <div className="space-y-2">
                        <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} />
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => { setEditing(false); setEditText(post.content || ""); }}>
                                <X className="h-4 w-4 mr-1" /> Cancelar
                            </Button>
                            <Button onClick={handleSave}>
                                <Check className="h-4 w-4 mr-1" /> Salvar
                            </Button>
                        </div>
                    </div>
                )}

                {/* Ações: like & contadores */}
                <div className="flex items-center gap-4">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={hasLiked ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => onToggleLike(post.id)}
                                >
                                    <Heart className={`h-4 w-4 mr-1 ${hasLiked ? "fill-red-500 text-red-500" : ""}`} />
                                    {post.post_likes?.length || 0}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="text-sm">{likeNames || "Seja o primeiro a curtir"}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <MessageCircle className="h-4 w-4" /> {post.post_comments?.length || 0}
                    </div>
                </div>

                {/* Comentários (últimos 3) + caixa */}
                <CommentsList
                    post={post}
                    meId={userId}
                />

                <div className="flex gap-2 mt-2">
                    <Input
                        placeholder="Escreva um comentário…"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && comment.trim()) {
                                onComment(post.id, comment);
                                setComment("");
                            }
                        }}
                    />
                    <Button onClick={() => { if (comment.trim()) { onComment(post.id, comment); setComment(""); } }}>
                        Enviar
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

/* ============== Comments ============== */

function CommentsList({ post, meId }: { post: PostRow; meId: string }) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState("");

    const lastThree = (post.post_comments || []).slice(-3);

    const startEdit = (c: CommentRow) => {
        setEditingId(c.id);
        setEditingText(c.content);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditingText("");
    };

    const saveEdit = async (c: CommentRow) => {
        try {
            const { error } = await supabase
                .from("post_comments")
                .update({ content: editingText.trim() })
                .eq("id", c.id);
            if (error) throw error;

            // otimismo local
            // Encontrar o comentário do estado post e atualizar. Como CommentsList não tem setter do post,
            // simples abordagem: recarregar página atual via history (leve), mas preferimos dispatch custom.
            // Aqui, para manter simples e estável, faremos um "location.reload()" leve só se precisar.
            // Como o restante do app está todo client-side, vamos optar por atualizar o objeto diretamente:
            c.content = editingText.trim();

            cancelEdit();
        } catch (e: any) {
            // fallback simples
            cancelEdit();
        }
    };

    const deleteComment = async (c: CommentRow) => {
        try {
            await supabase.from("post_comments").delete().eq("id", c.id);
            // remover do array local
            const idx = (post.post_comments || []).findIndex((x) => x.id === c.id);
            if (idx >= 0) (post.post_comments as CommentRow[]).splice(idx, 1);
        } catch (e) {
            // ignore silent
        }
    };

    return (
        <div className="space-y-3">
            {lastThree.map((c) => {
                const isMine = c.author_id === meId;
                return (
                    <div key={c.id} className="flex items-start gap-3">
                        <Avatar className="h-8 w-8 border border-border shadow-sm">
                            <AvatarImage src={c.profiles?.photo_url ?? undefined} />
                            <AvatarFallback>
                                {c.profiles?.full_name?.split(" ").map((n) => n[0]).join("")}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 bg-primary/10 rounded-2xl px-4 py-2 shadow-sm">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-sm truncate">{c.profiles?.full_name}</span>
                                        <span className="text-[10px] text-muted-foreground">
                                            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                                        </span>
                                    </div>
                                    {editingId === c.id ? (
                                        <div className="mt-1 space-y-2">
                                            <Textarea
                                                value={editingText}
                                                onChange={(e) => setEditingText(e.target.value)}
                                                className="min-h-[70px]"
                                            />
                                            <div className="flex gap-2 justify-end">
                                                <Button variant="outline" size="sm" onClick={cancelEdit}>
                                                    <X className="h-3 w-3 mr-1" /> Cancelar
                                                </Button>
                                                <Button size="sm" onClick={() => saveEdit(c)}>
                                                    <Check className="h-3 w-3 mr-1" /> Salvar
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm leading-snug mt-1 whitespace-pre-wrap">{c.content}</p>
                                    )}
                                </div>

                                {isMine && editingId !== c.id && (
                                    <div className="flex items-center gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => startEdit(c)} title="Editar comentário">
                                            <Edit2 className="h-4 w-4" />
                                        </Button>

                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" title="Excluir comentário">
                                                    <Trash2 className="h-4 w-4 text-red-600" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Excluir comentário?</AlertDialogTitle>
                                                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => deleteComment(c)}>Excluir</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
