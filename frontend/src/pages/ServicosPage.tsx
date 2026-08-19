import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, Power, Trash2, Wrench } from "lucide-react";

import { api } from "../lib/api";
import { formatCurrency } from "../lib/finance";
import { getApiErrorMessages } from "../lib/errors";
import { ServiceFormModal } from "../components/modals/ServiceFormModal";
import { ConfirmDeleteModal } from "../components/modals/ConfirmDeleteModal";
import { useToast } from "../components/ui/Toast";
import { cn } from "../lib/utils";
import type { Service } from "../types/api";

export function ServicosPage() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);

  const servicesQuery = useQuery<Service[]>({
    queryKey: ["services"],
    queryFn: () => api.get<Service[]>("/api/services").then((r) => r.data),
  });
  const services = servicesQuery.data ?? [];

  const toggleActive = useMutation({
    mutationFn: async (service: Service) => {
      await api.patch(`/api/services/${service._id}`, { active: !service.active });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["services"] }),
  });

  const removeService = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/services/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      addToast("Serviço excluído com sucesso.", "success");
      setDeleteTarget(null);
    },
    onError: (error) => {
      addToast(getApiErrorMessages(error, "Não foi possível excluir o serviço.")[0], "error");
      setDeleteTarget(null);
    },
  });

  const openCreate = () => {
    setEditingService(null);
    setFormOpen(true);
  };
  const openEdit = (service: Service) => {
    setEditingService(service);
    setFormOpen(true);
  };

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            to="/agenda"
            className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary transition hover:text-text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar para Agenda
          </Link>
          <h1 className="font-sans text-3xl font-bold">Serviços</h1>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-accent-gold px-4 py-3 text-sm font-bold text-black transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Novo Serviço
        </button>
      </header>

      {servicesQuery.isLoading ? (
        <div className="rounded-2xl border border-bg-muted bg-bg-card p-5 text-sm text-text-secondary">
          Carregando serviços...
        </div>
      ) : services.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-bg-muted bg-bg-card p-8 text-center">
          <Wrench className="mx-auto h-10 w-10 text-accent-gold" />
          <h2 className="mt-4 text-xl font-semibold text-white">Nenhum serviço cadastrado</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Cadastre os serviços oferecidos para poder agendá-los na Agenda.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-accent-gold px-4 py-3 text-sm font-bold text-black transition hover:brightness-110"
          >
            <Plus className="h-4 w-4" />
            Criar primeiro serviço
          </button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {services.map((service) => (
            <article
              key={service._id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-2xl border bg-bg-card p-4",
                service.active ? "border-bg-muted" : "border-bg-muted opacity-60",
              )}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate text-base font-semibold text-white">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: service.color }}
                    title="Cor no relatório de ganhos"
                  />
                  {service.name}
                </p>
                {service.type && <p className="text-xs text-text-secondary">{service.type}</p>}
                <p className="mt-1 text-sm font-semibold text-accent-gold">{formatCurrency(service.defaultValue)}</p>
                {!service.active && (
                  <span className="mt-1 inline-block rounded-full bg-bg-muted px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                    Inativo
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleActive.mutate(service)}
                  title={service.active ? "Desativar" : "Ativar"}
                  className="grid h-9 w-9 place-items-center rounded-xl text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
                >
                  <Power className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(service)}
                  title="Editar"
                  className="grid h-9 w-9 place-items-center rounded-xl text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(service)}
                  title="Excluir"
                  className="grid h-9 w-9 place-items-center rounded-xl text-accent-red transition hover:bg-accent-red/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <ServiceFormModal open={formOpen} service={editingService} onClose={() => setFormOpen(false)} />

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onDeleteOne={() => deleteTarget && removeService.mutate(deleteTarget._id)}
        accountName={deleteTarget?.name ?? ""}
      />
    </section>
  );
}
