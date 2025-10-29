import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Download, Archive, Brain } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";

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
  summary?: any;
  profiles: {
    full_name: string;
  };
}

interface Log {
  id: string;
  description: string;
  created_at: string;
  action?: string;
}

interface MinuteModalProps {
  open: boolean;
  onClose: () => void;
  minute: Minute | null;
  profile: Profile | null;
  onUpdated?: () => void;
}

const MinuteModal = ({ open, onClose, minute, profile, onUpdated }: MinuteModalProps) => {
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [currentMinute, setCurrentMinute] = useState<Minute | null>(minute);

  const canEdit = profile?.role === "admin" || profile?.role === "leader";

  // 🔄 Recarrega dados sempre que o modal for aberto
  useEffect(() => {
    if (open && minute) {
      reloadMinute(minute.id);
      loadLogs(minute.id);
    }
  }, [open, minute]);

  // 🔁 Função para buscar dados atualizados do Supabase
  const reloadMinute = async (id: string) => {
    const { data, error } = await supabase
      .from("minutes")
      .select("*")
      .eq("id", id)
      .single();

    if (!error && data) {
      setCurrentMinute(data);
    }
  };

  const loadLogs = async (minuteId: string) => {
    try {
      setLoadingLogs(true);
      const { data, error } = await supabase
        .from("minutes_logs")
        .select(`
        id,
        description,
        created_at,
        action,
        profiles!inner (
          full_name
        )
      `)
        .eq("minute_id", minuteId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar histórico",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingLogs(false);
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
      return <Badge className="bg-green-600">Assinada e Arquivada</Badge>;
    }
    return <Badge variant="secondary">Em Andamento</Badge>;
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file || !currentMinute) return;

      if (file.type !== "application/pdf") {
        toast({
          title: "Formato inválido",
          description: "Envie apenas arquivos PDF.",
          variant: "destructive",
        });
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: "O tamanho máximo permitido é 10MB.",
          variant: "destructive",
        });
        return;
      }

      setUploading(true);
      const filePath = `minutes/${currentMinute.id}/${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("documents").getPublicUrl(filePath);
      const pdfUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from("minutes")
        .update({ pdf_url: pdfUrl, updated_at: new Date().toISOString() })
        .eq("id", currentMinute.id);

      if (updateError) throw updateError;

      await supabase.from("minutes_logs").insert({
        minute_id: currentMinute.id,
        user_id: profile?.id,
        action: "upload",
        description: `Documento anexado por ${profile?.full_name}`,
      });

      toast({
        title: "PDF anexado com sucesso!",
        description: "O documento foi salvo no sistema.",
      });

      reloadMinute(currentMinute.id);
      loadLogs(currentMinute.id);
    } catch (error: any) {
      toast({
        title: "Erro ao enviar PDF",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleArchive = async () => {
    if (!currentMinute) return;

    if (!currentMinute.pdf_url) {
      toast({
        title: "Não é possível arquivar",
        description: "Anexe o documento PDF antes de arquivar esta ata.",
        variant: "destructive",
      });
      return;
    }

    setUpdating(true);

    try {
      const { error } = await supabase
        .from("minutes")
        .update({ status: "assinada_arquivada", updated_at: new Date().toISOString() })
        .eq("id", currentMinute.id);

      if (error) throw error;

      await supabase.from("minutes_logs").insert({
        minute_id: currentMinute.id,
        user_id: profile?.id,
        action: "archive",
        description: `Ata arquivada por ${profile?.full_name}`,
      });

      toast({
        title: "Ata arquivada",
        description: "A ata foi marcada como assinada e arquivada.",
      });

      reloadMinute(currentMinute.id);
      loadLogs(currentMinute.id);
    } catch (error: any) {
      toast({
        title: "Erro ao arquivar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleAISummary = async () => {
    if (!currentMinute?.pdf_url) {
      toast({
        title: "PDF necessário",
        description: "Anexe um documento antes de gerar o resumo com IA.",
        variant: "destructive",
      });
      return;
    }

    setGeneratingAI(true);

    try {
      const res = await fetch("https://n8nwebhook.simplexsolucoes.com.br/webhook/ai-minute-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minute_id: currentMinute.id }),
      });

      if (!res.ok) throw new Error("Erro ao processar a requisição de IA");

      toast({
        title: "Resumo gerado com sucesso!",
        description: "A IA analisou a ata e atualizou o resumo.",
      });

      await reloadMinute(currentMinute.id);
    } catch (error: any) {
      toast({
        title: "Erro ao gerar resumo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGeneratingAI(false);
    }
  };

  const formatCuiabaTime = (raw: string) => {
    const hasTZ = /[zZ]|[+\-]\d{2}:?\d{2}$/.test(raw);
    const iso = hasTZ ? raw : `${raw.replace(" ", "T")}Z`;
    const date = new Date(iso);

    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Cuiaba",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  if (!currentMinute) return null;

  // 🧠 Parser seguro do resumo
  let parsedSummary: any = null;
  if (currentMinute.summary) {
    try {
      parsedSummary =
        typeof currentMinute.summary === "string"
          ? JSON.parse(currentMinute.summary)
          : currentMinute.summary;
    } catch {
      parsedSummary = null;
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl md:max-w-4xl w-full px-4 md:px-8 overflow-y-auto max-h-[95vh]">
        <DialogHeader>
          <DialogTitle>Detalhes da Ata</DialogTitle>
        </DialogHeader>

        <Card className="border-none shadow-none mt-3">
          <CardHeader className="pb-2">
            <div className="flex flex-col md:flex-row justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <Badge variant="outline">{currentMinute.number}</Badge>
                  <Badge>{getTypeLabel(currentMinute.type)}</Badge>
                  {getStatusBadge(currentMinute.status)}
                </div>
                <CardTitle className="text-lg md:text-2xl font-semibold">
                  {currentMinute.title}
                </CardTitle>
              </div>

              {canEdit && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleArchive}
                    disabled={updating || currentMinute.status === "assinada_arquivada"}
                  >
                    {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleAISummary}
                    disabled={generatingAI}
                  >
                    {generatingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-6 text-sm text-muted-foreground">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <p>
                <strong>📅 Data:</strong>{" "}
                {format(new Date(currentMinute.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
              <p>
                <strong>📍 Local:</strong> {currentMinute.location}
              </p>
              <p className="sm:col-span-2">
                <strong>👤 Responsável:</strong> {currentMinute.profiles?.full_name}
              </p>
            </div>

            {/* ====== PDF + Resumo ====== */}
            <div className="mt-4 border-t pt-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Documento PDF
              </h3>

              {currentMinute.pdf_url ? (
                <Button
                  onClick={() => window.open(currentMinute.pdf_url!, "_blank")}
                  variant="default"
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Abrir PDF
                </Button>
              ) : (
                <p className="text-muted-foreground mt-1">Nenhum PDF anexado.</p>
              )}

              {/* 🧠 Resumo */}
              <div className="mt-6 border rounded-xl p-4 md:p-5 bg-muted/10 shadow-sm">
                <h3 className="font-semibold mb-3 flex items-center gap-2 text-base">
                  <Brain className="h-4 w-4 text-primary" />
                  Resumo da Ata
                </h3>

                {parsedSummary ? (
                  <div className="space-y-3 leading-relaxed">
                    <div>
                      <p className="font-semibold text-foreground">🧾 Resumo:</p>
                      <p>{parsedSummary.summary}</p>
                    </div>

                    {parsedSummary.decisions?.length > 0 && (
                      <div>
                        <p className="font-semibold text-foreground">📋 Decisões:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {parsedSummary.decisions.map((d: any, i: number) => (
                            <li key={i}>
                              {d.decisionText} — <strong>{d.responsibleFullName}</strong>{" "}
                              ({format(new Date(d.dueDate), "dd/MM/yyyy")})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {parsedSummary.pendingItems?.length > 0 && (
                      <div>
                        <p className="font-semibold text-foreground">⏳ Pendências:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {parsedSummary.pendingItems.map((p: any, i: number) => (
                            <li key={i}>
                              {p.itemText} — <strong>{p.responsibleFullName}</strong>{" "}
                              ({format(new Date(p.expectedDate), "dd/MM/yyyy")})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {parsedSummary.participants?.length > 0 && (
                      <div>
                        <p className="font-semibold text-foreground">👥 Participantes:</p>
                        <p>{parsedSummary.participants.map((p: any) => p.fullName).join(", ")}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum resumo disponível. Clique no botão “Gerar Resumo com IA”.
                  </p>
                )}
              </div>
            </div>

            {/* ====== Histórico ====== */}
            <Separator className="my-5" />
            <div>
              <h3 className="font-semibold mb-3">Histórico de Alterações</h3>
              {loadingLogs ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...
                </div>
              ) : logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma ação registrada.</p>
              ) : (
                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {logs.map((log) => (
                    <div key={log.id} className="text-sm text-muted-foreground border-b pb-2">
                      <p>
                        {log.description}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {formatCuiabaTime(log.created_at)}
                      </p>
                    </div>
                  ))}

                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
};

export default MinuteModal;
