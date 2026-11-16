import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Api } from "../../src/api/endpoints";
import { ProjectList } from "../../src/components/ProjectList";

const items = [
  { id: "p1", name: "Quarterly", version: 1, createdAt: "now", updatedAt: "now" },
  { id: "p2", name: "Personal", version: 1, createdAt: "now", updatedAt: "now" },
];

function mockApi(listImpl: (query: { search?: string }) => Promise<unknown>) {
  return { projects: { list: vi.fn(listImpl) } } as unknown as Api;
}

describe("ProjectList", () => {
  it("loads projects and re-queries when searching", async () => {
    const api = mockApi(async () => ({ items, total: 2, limit: 50, offset: 0 }));
    const userEventInstance = userEvent.setup();
    render(<ProjectList api={api} onOpen={() => {}} />);

    expect(await screen.findByText("Quarterly")).toBeInTheDocument();
    await userEventInstance.type(screen.getByLabelText("搜索项目"), "Quarter");
    await waitFor(() => expect(api.projects.list).toHaveBeenLastCalledWith({ limit: 50, search: "Quarter" }));
  });

  it("shows a readable error when loading fails", async () => {
    const api = mockApi(async () => { throw new Error("offline"); });
    render(<ProjectList api={api} onOpen={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("无法加载项目列表");
  });
});
