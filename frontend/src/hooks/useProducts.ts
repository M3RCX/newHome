import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { NewContribution } from "../lib/types";

const PRODUCTS_KEY = ["products"] as const;

export function useProducts() {
  return useQuery({ queryKey: PRODUCTS_KEY, queryFn: api.listProducts });
}

export function useContribute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ slug, input }: { slug: string; input: NewContribution }) => api.contribute(slug, input),
    // Sucesso ou conflito (409): a lista mudou, busca de novo.
    onSettled: () => queryClient.invalidateQueries({ queryKey: PRODUCTS_KEY }),
  });
}
