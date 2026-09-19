import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OrcamentosPage } from "./OrcamentosPage";
import type { Budget, BudgetsListResponse } from "../types/api";

const apiGet = vi.fn();

vi.mock("../lib/api", () => ({
  api: { get: (...args: unknown[]) => apiGet(...args), patch: vi.fn() },
}));

vi.mock("../components/ui/Toast", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("../components/modals/BudgetStatusReasonModal", () => ({
  BudgetStatusReasonModal: () => null,
}));

vi.mock("../components/modals/BudgetEditModal", () => ({
  BudgetEditModal: () => null,
}));

const PAGE_SIZE = 20;

function makeBudget(sequenceNumber: number): Budget {
  return {
    _id: `budget-${sequenceNumber}`,
    userId: "user-1",
    sequenceNumber,
    clientId: "client-1",
    type: "SERVICOS",
    items: [],
    itemsTotal: 100,
    travelCost: 0,
    discount: 0,
    total: 100,
    status: "APROVADO",
    createdAt: new Date(2026, 0, sequenceNumber).toISOString(),
    updatedAt: new Date(2026, 0, sequenceNumber).toISOString(),
  };
}

/** Simula a API: `total` orçamentos, mais recentes primeiro, paginados. */
function mockApi(total: number) {
  const all = Array.from({ length: total }, (_, i) => makeBudget(total - i));
  apiGet.mockImplementation((url: string, config?: { params?: { page?: number; limit?: number } }) => {
    if (url === "/api/orcamentos/budgets") {
      const page = config?.params?.page ?? 1;
      const limit = config?.params?.limit ?? 10;
      const response: BudgetsListResponse = {
        items: all.slice((page - 1) * limit, page * limit),
        total,
        page,
        limit,
      };
      return Promise.resolve({ data: response });
    }
    if (url === "/api/orcamentos/budgets/stats/conversion") {
      return Promise.resolve({
        data: { total, sent: 0, approved: 0, rejected: 0, conversionRate: 0, totalValueApproved: 0 },
      });
    }
    if (url === "/api/orcamentos/clients") {
      return Promise.resolve({ data: [{ _id: "client-1", name: "Cliente Um" }] });
    }
    return Promise.reject(new Error(`URL inesperada: ${url}`));
  });
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <OrcamentosPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const rows = () => screen.getAllByRole("row").slice(1); // sem o cabeçalho

// Folga acima do padrão (1s): com a suíte inteira rodando em paralelo o jsdom fica lento.
const waitForRows = (count: number) => waitFor(() => expect(rows()).toHaveLength(count), { timeout: 5_000 });

describe("OrcamentosPage — paginação", () => {
  beforeEach(() => {
    apiGet.mockReset();
  });

  it("mostra o total e permite carregar os orçamentos antigos além da primeira página", async () => {
    mockApi(45);
    renderPage();

    await waitForRows(PAGE_SIZE);
    expect(screen.getByText("Mostrando 20 de 45 orçamentos")).toBeTruthy();
    // Os mais recentes vêm primeiro; o mais antigo (#0001) ainda não está na tela.
    expect(screen.getByText("#0045")).toBeTruthy();
    expect(screen.queryByText("#0001")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    await waitForRows(PAGE_SIZE * 2);
    expect(screen.getByText("Mostrando 40 de 45 orçamentos")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
    await waitForRows(45);
    expect(screen.getByText("Mostrando 45 de 45 orçamentos")).toBeTruthy();
    expect(screen.getByText("#0001")).toBeTruthy();
    // Tudo carregado: não há mais o que buscar.
    expect(screen.queryByRole("button", { name: "Carregar mais" })).toBeNull();

    // As páginas foram pedidas em sequência, com o mesmo tamanho.
    const budgetCalls = apiGet.mock.calls.filter(([url]) => url === "/api/orcamentos/budgets");
    expect(budgetCalls.map(([, config]) => config.params.page)).toEqual([1, 2, 3]);
    expect(budgetCalls.every(([, config]) => config.params.limit === PAGE_SIZE)).toBe(true);
  });

  it("não oferece 'Carregar mais' quando tudo cabe na primeira página", async () => {
    mockApi(7);
    renderPage();

    await waitForRows(7);
    expect(screen.getByText("Mostrando 7 de 7 orçamentos")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Carregar mais" })).toBeNull();
  });

  it("filtra por status sem misturar as páginas do filtro anterior", async () => {
    mockApi(25);
    renderPage();
    await waitForRows(PAGE_SIZE);

    fireEvent.click(screen.getByRole("button", { name: "Aprovado" }));
    await waitFor(() => {
      const budgetCalls = apiGet.mock.calls.filter(([url]) => url === "/api/orcamentos/budgets");
      expect(budgetCalls.at(-1)?.[1].params).toMatchObject({ page: 1, status: "APROVADO" });
    });
  });
});
