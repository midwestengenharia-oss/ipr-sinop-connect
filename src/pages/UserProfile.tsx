import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import Cropper from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { getCroppedImg } from "@/lib/imageCropUtils";
import { Loader2, Camera, Save } from "lucide-react";

interface Profile {
    id: string;
    full_name: string;
    email: string;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    photo_url?: string | null;
    bio?: string | null;
    role: "admin" | "leader" | "member";
}

export default function UserProfile() {
    const { toast } = useToast();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [formData, setFormData] = useState({
        full_name: "",
        phone: "",
        address: "",
        city: "",
        state: "",
        photo_url: "",
        bio: "",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Crop state
    const [isCropOpen, setIsCropOpen] = useState(false);
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

        if (error) {
            toast({
                title: "Erro ao carregar perfil",
                description: error.message,
                variant: "destructive",
            });
        } else {
            setProfile(data);
            setFormData({
                full_name: data.full_name || "",
                phone: data.phone || "",
                address: data.address || "",
                city: data.city || "",
                state: data.state || "",
                photo_url: data.photo_url || "",
                bio: data.bio || "",
            });
        }

        setLoading(false);
    };

    const handleSave = async () => {
        if (!profile) return;
        setSaving(true);

        const { error } = await supabase
            .from("profiles")
            .update({
                full_name: formData.full_name,
                phone: formData.phone,
                address: formData.address,
                city: formData.city,
                state: formData.state,
                photo_url: formData.photo_url,
                bio: formData.bio,
                updated_at: new Date().toISOString(),
            })
            .eq("id", profile.id);

        if (error) {
            toast({
                title: "Erro ao salvar perfil",
                description: error.message,
                variant: "destructive",
            });
        } else {
            toast({ title: "Perfil atualizado com sucesso!" });
            await loadProfile();
        }

        setSaving(false);
    };

    const onCropComplete = (_: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

    const uploadCroppedImage = async () => {
        if (!profile || !imageSrc || !croppedAreaPixels) return;

        try {
            const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
            const filePath = `${profile.id}/profile.jpg`;

            const { error: uploadError } = await supabase.storage
                .from("avatars")
                .upload(filePath, croppedImageBlob, {
                    contentType: "image/jpeg",
                    upsert: true,
                });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

            await supabase
                .from("profiles")
                .update({ photo_url: data.publicUrl })
                .eq("id", profile.id);

            setFormData((prev) => ({ ...prev, photo_url: data.publicUrl }));
            toast({ title: "Foto de perfil atualizada!" });
            setIsCropOpen(false);
        } catch (error: any) {
            toast({
                title: "Erro ao salvar imagem",
                description: error.message,
                variant: "destructive",
            });
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => setImageSrc(reader.result as string);
            reader.readAsDataURL(file);
            setIsCropOpen(true);
        }
    };

    if (loading)
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );

    return (
        <div className="min-h-screen bg-muted">
            <Navbar userRole={profile?.role} userName={profile?.full_name} />

            <main className="container mx-auto px-4 py-8">
                <Card className="max-w-2xl mx-auto">
                    <CardHeader>
                        <CardTitle>Meu Perfil</CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* Avatar */}
                        <div className="flex flex-col items-center space-y-3">
                            <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gray-100 border">
                                {formData.photo_url ? (
                                    <img
                                        src={formData.photo_url}
                                        alt="Avatar"
                                        className="object-cover w-full h-full"
                                    />
                                ) : (
                                    <Camera className="h-12 w-12 text-gray-400 absolute inset-0 m-auto" />
                                )}
                            </div>

                            <Label
                                htmlFor="avatar-upload"
                                className="cursor-pointer text-sm text-primary hover:underline"
                            >
                                Alterar foto
                            </Label>
                            <input
                                id="avatar-upload"
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>

                        {/* Dados pessoais */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label>Nome completo</Label>
                                <Input
                                    value={formData.full_name}
                                    onChange={(e) =>
                                        setFormData({ ...formData, full_name: e.target.value })
                                    }
                                />
                            </div>
                            <div>
                                <Label>Telefone</Label>
                                <Input
                                    value={formData.phone}
                                    onChange={(e) =>
                                        setFormData({ ...formData, phone: e.target.value })
                                    }
                                />
                            </div>
                            <div className="md:col-span-2">
                                <Label>Endereço</Label>
                                <Input
                                    value={formData.address}
                                    onChange={(e) =>
                                        setFormData({ ...formData, address: e.target.value })
                                    }
                                />
                            </div>
                            <div>
                                <Label>Cidade</Label>
                                <Input
                                    value={formData.city}
                                    onChange={(e) =>
                                        setFormData({ ...formData, city: e.target.value })
                                    }
                                />
                            </div>
                            <div>
                                <Label>Estado</Label>
                                <Input
                                    value={formData.state}
                                    onChange={(e) =>
                                        setFormData({ ...formData, state: e.target.value })
                                    }
                                />
                            </div>
                        </div>

                        {/* Bio */}
                        <div>
                            <Label>Biografia</Label>
                            <Textarea
                                value={formData.bio}
                                onChange={(e) =>
                                    setFormData({ ...formData, bio: e.target.value })
                                }
                                placeholder="Fale um pouco sobre você..."
                                className="resize-none h-24"
                            />
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Salvando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-4 w-4 mr-2" />
                                        Salvar alterações
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </main>

            {/* Crop Dialog */}
            <Dialog open={isCropOpen} onOpenChange={setIsCropOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Recortar imagem</DialogTitle>
                    </DialogHeader>
                    <div className="relative w-full h-[400px] bg-gray-900">
                        {imageSrc && (
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={(_a, area) => setCroppedAreaPixels(area)}
                            />
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCropOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={uploadCroppedImage}>Salvar recorte</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
