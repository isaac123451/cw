export interface TeamMember {
  id: string;

  name: string;

  role: string;

  email: string;

  online: boolean;

  /** Casos atribuídos ao integrante no módulo Reclame Aqui. */
  openCases: number;
}

export interface Team {
  id: string;

  name: string;

  description: string;

  department: string;

  leader: string;

  active: boolean;

  members: TeamMember[];
}
