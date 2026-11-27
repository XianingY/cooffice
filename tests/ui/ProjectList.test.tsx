import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Api } from "../../src/api/endpoints";
import { ProjectList } from "../../src/components/ProjectList";

const items = [
  { id: "p1", name: "Quarterly", version: 2, createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z" },
  { id: "p2", name: "Personal", version: 1, createdAt: "2026-11-01T00:00:00Z", updatedAt: "2026-11-01T00:00:00Z" },
];

function mockApi(
  listImpl: (query: { limit?: number; offset?: number; search?: string }) => Promise<unknown>,
  removeImpl: (id: string) => Promise<void> = async () => undefined,
) {
  return {
    projects: {
      list: vi.fn(listImpl),
      remove: vi.fn(removeImpl),
    },
  } as unknown as Api;
}

describe("ProjectList", () => {
  it("loads projects, highlights the active one and debounces search queries", async () => {
    const api = mockApi(async () => ({ items, total: 2, limit: 20, offset: 0 }));
    const user = userEvent.setup();
    render(<ProjectList api={api} activeProjectId="p1" onOpen={() => {}} />);

    const activeBtn = (await screen.findByText("Quarterly")).closest("button");
    expect(activeBtn).toHaveAttribute("aria-current", "true");

    await user.type(screen.getByLabelText("搜索项目"), "Quarter");
    await waitFor(() =>
      expect(api.projects.list).toHaveBeenLastCalledWith({ limit: 20, offset: 0, search: "Quarter" }),
    );
    // Debouncing collapses rapid keystrokes instead of querying on every character.
    expect(vi.mocked(api.projects.list).mock.calls.length).toBeLessThan(6);
  });

  it("supports two-step deletion and notifies the parent", async () => {
    const remove = vi.fn(async () => undefined);
    const onDeleted = vi.fn();
    const api = mockApi(async () => ({ items, total: 2, limit: 20, offset: 0 }), remove);
    const user = userEvent.setup();
    render(<ProjectList api={api} onOpen={() => {}} onDeleted={onDeleted} />);

    await screen.findByText("Quarterly");
    await user.click(screen.getByRole("button", { name: "删除 Quarterly" }));
    expect(remove).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("p1"));
    expect(onDeleted).toHaveBeenCalledWith("p1");
    expect(screen.queryByText("Quarterly")).toBeNull();
  });

  it("renders pagination controls when total exceeds one page", async () => {
    const api = mockApi(async (query) => ({
      items: query.offset === 20 ? [items[1]] : [items[0]],
      total: 25,
      limit: 20,
      offset: query.offset ?? 0,
    }));
    const user = userEvent.setup();
    render(<ProjectList api={api} onOpen={() => {}} />);

    await screen.findByText("Quarterly");
    expect(screen.getByText(/第 1 \/ 2 页/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() =>
      expect(api.projects.list).toHaveBeenLastCalledWith({ limit: 20, offset: 20, search: undefined }),
    );
    expect(await screen.findByText("Personal")).toBeInTheDocument();
  });

  it("shows a readable error when loading fails", async () => {
    const api = mockApi(async () => { throw new Error("offline"); });
    render(<ProjectList api={api} onOpen={() => {}} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("无法加载项目列表");
  });
});
