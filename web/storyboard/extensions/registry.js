export class StoryboardExtensionRegistry {
    constructor() {
        this.extensions = new Map();
        this.toolbarExtensions = [];
        this.canvasClasses = new Set();
    }

    register(extension) {
        if (!extension || !extension.type) {
            throw new Error("Storyboard extension requires a unique type.");
        }
        if (this.extensions.has(extension.type)) {
            throw new Error(`Storyboard extension type "${extension.type}" is already registered.`);
        }
        this.extensions.set(extension.type, extension);
        if (extension.toolbar) {
            this.toolbarExtensions.push(extension);
        }
        if (extension.canvasClass) {
            this.canvasClasses.add(extension.canvasClass);
        }
    }

    get(type) {
        return this.extensions.get(type) || null;
    }

    listToolbarExtensions() {
        return [...this.toolbarExtensions];
    }

    getCanvasClasses() {
        return Array.from(this.canvasClasses);
    }

    listAll() {
        return Array.from(this.extensions.values());
    }
}

export function createStoryboardExtensionRegistry(...extensionGroups) {
    const registry = new StoryboardExtensionRegistry();
    extensionGroups.flat().filter(Boolean).forEach(extension => registry.register(extension));
    return registry;
}
