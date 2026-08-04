"use server";

import { mockCases } from "@/lib/data/mockCases";
import { Case } from "@/lib/models/case";

export async function getCases(): Promise<Case[]> {
  return mockCases;
}

export async function getCaseById(id: string): Promise<Case | null> {
  return mockCases.find((item) => item.id === id) ?? null;
}

export async function createCase(data: Case) {
  mockCases.unshift(data);

  return data;
}

export async function updateCase(id: string, data: Partial<Case>) {
  const index = mockCases.findIndex((item) => item.id === id);

  if (index === -1) return null;

  mockCases[index] = {
    ...mockCases[index],
    ...data,
  };

  return mockCases[index];
}

export async function deleteCase(id: string) {
  const index = mockCases.findIndex((item) => item.id === id);

  if (index === -1) return false;

  mockCases.splice(index, 1);

  return true;
}