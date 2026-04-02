export interface EmployeeContext {
  userId: string;
  employeeCode: string;
  profileId: string;
}

export interface AgentInvocationResult<T = Record<string, unknown>> {
  text: string;
  metadata: T | null;
}
