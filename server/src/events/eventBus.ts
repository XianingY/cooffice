export interface DomainEvent {
  type: "project.created" | "project.updated" | "project.deleted" | "report.generated";
  projectId: string;
  actorId: string;
  at: string;
}

type Listener = (event: DomainEvent) => void;

/** Minimal in-process pub/sub for SSE. No external broker for single-node use. */
export class EventBus {
  private readonly listeners = new Map<string, Set<Listener>>();

  subscribe(projectId: string, listener: Listener): () => void {
    const set = this.listeners.get(projectId) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(projectId, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(projectId);
    };
  }

  publish(event: DomainEvent): number {
    const set = this.listeners.get(event.projectId);
    if (!set) return 0;
    for (const listener of set) listener(event);
    return set.size;
  }

  subscriberCount(projectId: string): number {
    return this.listeners.get(projectId)?.size ?? 0;
  }

  clear(): void {
    this.listeners.clear();
  }
}
