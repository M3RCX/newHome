import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type Contribution } from "../lib/adminApi";

export const adminKeys = {
  products: ["admin", "products"] as const,
  product: (id: string) => ["admin", "products", id] as const,
  summary: ["admin", "summary"] as const,
};

export const useAdminProducts = () => useQuery({ queryKey: adminKeys.products, queryFn: adminApi.listProducts });

export const useAdminProduct = (id: string | undefined) =>
  useQuery({ queryKey: adminKeys.product(id ?? ""), queryFn: () => adminApi.getProduct(id!), enabled: !!id });

export const useSummary = () => useQuery({ queryKey: adminKeys.summary, queryFn: adminApi.summary });

// Qualquer mudança no admin afeta a lista do admin, o resumo e a lista pública.
function useInvalidateAll() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["admin"] }),
      qc.invalidateQueries({ queryKey: ["products"] }),
    ]);
}

export function useSaveProduct() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, form }: { id?: string; form: FormData }) =>
      id ? adminApi.updateProduct(id, form) : adminApi.createProduct(form),
    onSuccess: invalidate,
  });
}

export function useDeleteProduct() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: adminApi.deleteProduct, onSuccess: invalidate });
}

export function useCreateContribution() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: adminApi.createContribution, onSettled: invalidate });
}

export function useUpdateContribution() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Pick<Contribution, "guestName" | "mode" | "amountCents">> }) =>
      adminApi.updateContribution(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteContribution() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: adminApi.deleteContribution, onSuccess: invalidate });
}
