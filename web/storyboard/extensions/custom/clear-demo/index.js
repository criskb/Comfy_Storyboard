export const clearDemoStoryboardExtension = {
    id: "custom.clear-demo",
    type: "clear_demo_pack",
    title: "Clear Demo",
    toolbar: {
        buttonId: "storyboard-clear-demo-pack",
        label: "Clear Demo",
        title: "Remove the tagged demo sandbox items from the board",
        iconKey: "delete",
        section: "Sandbox Actions",
    },
    onTrigger(workspace) {
        if (!workspace?.boardData?.items) return false;
        const beforeCount = workspace.boardData.items.length;
        workspace.boardData.items = workspace.boardData.items.filter(
            (item) => item?.sandbox_collection !== "custom_demo"
        );
        if (workspace.boardData.items.length === beforeCount) return false;
        const remainingIds = new Set(workspace.boardData.items.map((item) => item.id));
        workspace.boardData.selection = (workspace.boardData.selection || []).filter((id) => remainingIds.has(id));
        return { handled: true };
    },
};
