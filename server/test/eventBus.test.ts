import { describe, expect, it } from "vitest";
import { EventBus } from "../src/events/eventBus.js";

const event = (projectId = "p1") => ({
  type: "project.updated" as const,
  projectId,
  actorId: "u1",
  at: new Date().toISOString(),
});

describe("EventBus", () => {
  it("delivers events only to subscribers of the matching project", () => {
    const bus = new EventBus();
    const received: string[] = [];
    bus.subscribe("p1", (e) => received.push(e.type));
    bus.subscribe("p2", (e) => received.push(`other:${e.type}`));
    expect(bus.publish(event("p1"))).toBe(1);
    expect(received).toEqual(["project.updated"]);
  });

  it("unsubscribes cleanly and reports subscriber counts", () => {
    const bus = new EventBus();
    const unsubscribe = bus.subscribe("p1", () => {});
    expect(bus.subscriberCount("p1")).toBe(1);
    unsubscribe();
    expect(bus.subscriberCount("p1")).toBe(0);
    expect(bus.publish(event("p1"))).toBe(0);
  });

  it("clears all subscribers", () => {
    const bus = new EventBus();
    bus.subscribe("p1", () => {});
    bus.subscribe("p2", () => {});
    bus.clear();
    expect(bus.subscriberCount("p1")).toBe(0);
    expect(bus.subscriberCount("p2")).toBe(0);
  });
});
