Hooks.on("init", () => {
    game.settings.register("dgr-harms-way", "initialized", {
        name: "Initialization",
        scope: "world",
        config: false,
        default: false,
        type: Boolean,
    });

    game.settings.registerMenu("dgr-harms-way", "init-dialog", {
        name: "DGR Harm's Way Initialization",
        label: "Initialize",
        hint:
            "This will import the content from the Degenesis Harm's Way Adventure Module",
        type: DGRHarmsWayInitWrapper,
        restricted: true,
    });
});

Hooks.on("ready", () => {
    if (!game.settings.get("dgr-harms-way", "initialized") && game.user.isGM) {
        new DGRHarmsWayInitialization().render(true);
    }
});

class DGRHarmsWayInitWrapper extends FormApplication {
    render() {
        new DGRHarmsWayInitialization().render(true);
    }
}

class DGRHarmsWayInitialization extends Dialog {
    constructor() {
        super({
            title: "Degenesis Rebirth Harm's Way Initialization",
            content: `<p class="notes">Initialize DGR Harm's Way Module?<br><br>This will import all Actors, Items, Journals, and Scenes into your world, sort them into folders, and place map pins</p>
            <ul>
            <li>X Actors</li>
            <li>Y Journal Entries</li>
            <li>Z Items</li>
            <li>A Scenes</li>
            <li>B Folders organizing the above</li>
            </ul>
            `,

            buttons: {
                initialize: {
                    label: "Initialize",
                    callback: async () => {
                        game.settings.set("dgr-harms-way", "initialized", true);
                        await new DGRHarmsWayInitialization().initialize();
                        ui.notifications.notify("Initialization Complete");
                    },
                },
                no: {
                    label: "No",
                    callback: () => {
                        game.settings.set("dgr-harms-way", "initialized", true);
                        ui.notifications.notify("Skipped Initialization.");
                    },
                },
            },
        });

        this.folders = {
            Scene: {},
            Item: {},
            Actor: {},
            JournalEntry: {},
        };
        this.SceneFolders = {};
        this.ActorFolders = {};
        this.ItemFolders = {};
        this.JournalEntryFolders = {};
        this.journals = {};
        this.actors = {};
        this.scenes = {};
        this.moduleKey = "dgr-harms-way";
    }

    async initialize() {
        return new Promise((resolve) => {
            fetch(`modules/${this.moduleKey}/initialization.json`)
                .then(async (r) => r.json())
                .then(async (json) => {
                    let createdFolders = await Folder.create(json);
                    for (let folder of createdFolders)
                        this.folders[folder.data.type][
                            folder.data.name
                        ] = folder;

                    for (let folderType in this.folders) {
                        for (let folder in this.folders[folderType]) {
                            let parent = this.folders[folderType][
                                folder
                            ].getFlag(this.moduleKey, "initialization-parent");
                            if (parent) {
                                let parentId = this.folders[folderType][parent]
                                    .data._id;
                                await this.folders[folderType][folder].update({
                                    parent: parentId,
                                });
                            }
                        }
                    }

                    await this.initializeEntities();
                    await this.initializeScenes();
                    resolve();
                });
        });
    }

    async initializeEntities() {
        let journalPack = `${this.moduleKey}.dgr-harms-way-journals`;
        let journalPackContent = await game.packs.get(journalPack).getContent();

        journalPackContent.forEach((entity) => {
            let entityObject = entity.toObject();

            if (entityObject.name.includes("(I)"))
                entityObject.folder = game.folders.find(
                    (folder) => folder.name === "SCENE 1"
                ).id;
            if (entityObject.name.includes("(II)"))
                entityObject.folder = game.folders.find(
                    (folder) => folder.name === "SCENE 2"
                ).id;
            if (entityObject.name.includes("(III)"))
                entityObject.folder = game.folders.find(
                    (folder) => folder.name === "SCENE 3"
                ).id;
            if (entityObject.name.includes("(IV)"))
                entityObject.folder = game.folders.find(
                    (folder) => folder.name === "SCENE 4"
                ).id;
            if (entityObject.name.includes("(V)"))
                entityObject.folder = game.folders.find(
                    (folder) => folder.name === "SCENE 5"
                ).id;
            if (entityObject.name.includes("(VI)"))
                entityObject.folder = game.folders.find(
                    (folder) => folder.name === "SCENE 6"
                ).id;
            if (entityObject.name.includes("(E)"))
                entityObject.folder = game.folders.find(
                    (folder) => folder.name === "EPILOGUE"
                ).id;
            if (entityObject.name.includes("(H)"))
                entityObject.folder = game.folders.find(
                    (folder) => folder.name === "HANDOUTS"
                ).id;
            if (entityObject.name.includes("(C)"))
                entityObject.folder = game.folders.find(
                    (folder) => folder.name === "CHARACTERS"
                ).id;

            // Now create that entry
            JournalEntry.create(entityObject);
        });

        // Initialise other entities (items, actors) here
    }

    // Init scenes here
    async initializeScenes() {
        let scenesPack = `${this.moduleKey}.dgr-harms-way-scenes`;
        let scenesPackContent = await game.packs.get(scenesPack).getContent();

        scenesPackContent.forEach((entity) => {
            let entityObject = entity.toObject();

            if (entityObject.name.includes("(I)"))
                entityObject.folder = game.folders.find(
                    (folder) => folder.name === "INTRODUCTION"
                ).id;
        });
    }
}
