export interface WorkflowStatus {
  id: string;

  name: string;

  color: string;

  order: number;

  active: boolean;

  limit?: number;

  createdAt?: string;
}