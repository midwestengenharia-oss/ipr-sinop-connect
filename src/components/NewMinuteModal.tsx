import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

interface NewMinuteModalProps {
    open: boolean;
    onClose: () => void;
    onCreated: () => void;
}

const NewMinuteModal = ({ open, onClose, onCreated }: NewMinuteModalProps) => {
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        number: "",
        title: "",
        type: "",
        date: "",
        location: "",
        file: null as File | null,
    });

    const handleChange = (key: string, value: any) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type !== "application/pdf") {
            toast({
                title: "Arquivo inválido",
                description: "Envie apenas arquivos PDF.",
                variant: "destructive",
            });
            return;
        }
        handleChange("file", file || null);
    };

    const handleSubmit = async () => {
        if (!form.number || !form.title || !form.type || !form.date || !form.location) {
            toast({
                title: "Campos obrigatórios",
                description: "Preencha todos os campos antes de salvar.",
                variant: "destructive",
            });
            return;
        }

        setLoading(true);

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session) throw new Error("Usuário não autenticado.");

            let pdfUrl: string | null = null;

            // Se houver arquivo, envia para o bucket
            if (form.file) {
                const filePath = `minutes/${session.user.id}/${Date.now()}_${form.file.name}`;

                const { error: uploadError } = await supabase.storage
                    .from("documents")
                    .upload(filePath, form.file, {
                        cacheControl: "3600",
                        upsert: false,
                    });

                if (uploadError) throw uploadError;

                const { data: publicUrlData } = supabase.storage
                    .from("documents")
                    .getPublicUrl(filePath);

                pdfUrl = publicUrlData.publicUrl;
            }

            const { error } = await supabase.from("minutes").insert([
                {
                    number: form.number,
                    title: form.title,
                    type: form.type,
                    date: form.date,
                    location: form.location,
                    status: "em_andamento",
                    responsible_user_id: session.user.id,
                    pdf_url: pdfUrl,
                },
            ]);

            if (error) throw error;

            toast({
                title: "Ata criada com sucesso",
                description: pdfUrl
                    ? "A ata foi registrada e o PDF anexado."
                    : "A ata foi registrada com sucesso.",
            });

            setForm({
                number: "",
                title: "",
                type: "",
                date: "",
                location: "",
                file: null,
            });

            onCreated();
            onClose();
        } catch (error: any) {
            toast({
                title: "Erro ao criar ata",
                description: error.message,
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Nova Ata</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div>
                        <Label htmlFor="number">Número da Ata</Label>
                        <Input
                            id="number"
                            value={form.number}
                            onChange={(e) => handleChange("number", e.target.value)}
                            placeholder="Ex: 05/2025"
                        />
                    </div>

                    <div>
                        <Label htmlFor="title">Título</Label>
                        <Input
                            id="title"
                            value={form.title}
                            onChange={(e) => handleChange("title", e.target.value)}
                            placeholder="Ex: Reunião do Conselho"
                        />
                    </div>

                    <div>
                        <Label htmlFor="type">Tipo</Label>
                        <Select onValueChange={(value) => handleChange("type", value)}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="conselho">Conselho</SelectItem>
                                <SelectItem value="assembleia">Assembleia</SelectItem>
                                <SelectItem value="ministerio">Ministério</SelectItem>
                                <SelectItem value="celula">Célula</SelectItem>
                                <SelectItem value="outro">Outro</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="date">Data</Label>
                        <Input
                            id="date"
                            type="date"
                            value={form.date}
                            onChange={(e) => handleChange("date", e.target.value)}
                        />
                    </div>

                    <div>
                        <Label htmlFor="location">Local</Label>
                        <Input
                            id="location"
                            value={form.location}
                            onChange={(e) => handleChange("location", e.target.value)}
                            placeholder="Ex: Sala de reuniões"
                        />
                    </div>

                    <div>
                        <Label htmlFor="file">Anexar PDF (opcional)</Label>
                        <Input
                            id="file"
                            type="file"
                            accept="application/pdf"
                            onChange={handleFileChange}
                        />
                        {form.file && (
                            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                <Upload className="h-4 w-4" /> {form.file.name}
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Salvar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default NewMinuteModal;
