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
        let packList = [`${this.moduleKey}.dgr-harms-way-journals`];

        // Folder IDs
        let journalFolderIds = {};
        let journalFoldersToFetchID = [
            "SCENE 1",
            "SCENE 2",
            "SCENE 3",
            "SCENE 4",
            "SCENE 5",
            "SCENE 6",
            "EPILOGUE",
            "HANDOUTS",
        ];
        journalFoldersToFetchID.forEach((folder) => {
            folderId = game.folders.getName(folder)._id;
            journalFolderIds[folder] = folderId;
        });

        for (let pack of packList) {
            let content = await game.packs.get(pack).getContent();
            for (let entity of content) {
                if (entity.name.includes("(I)"))
                    entity.data.folder = folderIds["SCENE 1"];
                if (entity.name.includes("(II)"))
                    entity.data.folder = folderIds["SCENE 2"];
                if (entity.name.includes("(III)"))
                    entity.data.folder = folderIds["SCENE 3"];
                if (entity.name.includes("(IV)"))
                    entity.data.folder = folderIds["SCENE 4"];
                if (entity.name.includes("(V)"))
                    entity.data.folder = folderIds["SCENE 5"];
                if (entity.name.includes("(E)"))
                    entity.data.folder = folderIds["EPILOGUE"];
                if (entity.name.includes("(H)"))
                    entity.data.folder = folderIds["HANDOUTS"];
            }

            switch (content[0].entity) {
                case "Actor":
                    ui.notifications.notify("Initializing Actors");
                    let createdActors = await Actor.create(
                        content.map((c) => c.data)
                    );
                    for (let actor of createdActors)
                        this.actors[actor.data.name] = actor;
                    break;
                case "Item":
                    ui.notifications.notify("Initializing Items");
                    await Item.create(content.map((c) => c.data));
                    break;
                case "JournalEntry":
                    ui.notifications.notify("Initializing Journals");
                    let createdEntries = await JournalEntry.create(
                        content.map((c) => c.data)
                    );
                    for (let entry of createdEntries)
                        this.journals[entry.data.name] = entry;
                    break;
            }
        }
    }

    async initializeScenes() {
        ui.notifications.notify("Initializing Scenes");
        let m = game.packs.get(`${this.moduleKey}.dgr-harms-way-scenes`);
        let maps = await m.getContent();
        for (let map of maps) {
            let folder = map.getFlag(this.moduleKey, "initialization-folder");
            if (folder)
                map.data.folder = this.folders["Scene"][folder].data._id;

            let journalName = map.getFlag(this.moduleKey, "scene-note");
            if (journalName)
                map.data.journal = this.journals[journalName].data._id;
            map.data.notes.forEach((n) => {
                try {
                    n.entryId = this.journals[
                        getProperty(
                            n,
                            `flags.${this.moduleKey}.initialization-entryName`
                        )
                    ].data._id;
                } catch (e) {
                    console.log("dgr | INITIALIZATION ERROR: " + e);
                }
            });
            map.data.tokens.forEach((t) => {
                try {
                    t.actorId = this.actors[
                        getProperty(
                            t,
                            `flags.${this.moduleKey}.initialization-actorName`
                        )
                    ].data._id;
                } catch (e) {
                    console.log("dgr | INITIALIZATION ERROR: " + e);
                }
            });
        }
        await Scene.create(maps.map((m) => m.data)).then((sceneArray) => {
            sceneArray.forEach(async (s) => {
                let thumb = await s.createThumbnail();
                s.update({ thumb: thumb.thumb });
            });
        });
    }
}

class DGRHarmsWayInitializationSetup {
    static async setup() {
        WFRP4eDotRInitializationSetup.displayFolders();
        WFRP4eDotRInitializationSetup.setFolderFlags();
        WFRP4eDotRInitializationSetup.setSceneNotes();
        WFRP4eDotRInitializationSetup.setEmbeddedEntities();
    }

    static async displayFolders() {
        let array = [];
        game.folders.entities.forEach(async (f) => {
            if (f.data.parent)
                await f.setFlag(
                    "dgr-harms-way",
                    "initialization-parent",
                    game.folders.get(f.data.parent).data.name
                );
        });
        game.folders.entities.forEach((f) => {
            array.push(f.data);
        });
        console.log(JSON.stringify(array));
    }

    static async setFolderFlags() {
        for (let scene of game.scenes.entities)
            await scene.update({
                "flags.dgr-harms-way": {
                    "initialization-folder": game.folders.get(scene.data.folder)
                        .data.name,
                    sort: scene.data.sort,
                },
            });
        for (let actor of game.actors.entities)
            await actor.update({
                "flags.dgr-harms-way": {
                    "initialization-folder": game.folders.get(actor.data.folder)
                        .data.name,
                    sort: actor.data.sort,
                },
            });
        for (let item of game.items.entities)
            await item.update({
                "flags.dgr-harms-way": {
                    "initialization-folder": game.folders.get(item.data.folder)
                        .data.name,
                    sort: item.data.sort,
                },
            });
        for (let journal of game.journal.entities)
            await journal.update({
                "flags.dgr-harms-way": {
                    "initialization-folder": game.folders.get(
                        journal.data.folder
                    ).data.name,
                    sort: journal.data.sort,
                },
            });
    }

    static async setSceneNotes() {
        for (let scene of game.scenes.entities)
            if (scene.data.journal)
                await scene.setFlag(
                    "dgr-harms-way",
                    "scene-note",
                    game.journal.get(scene.data.journal).data.name
                );
    }

    static async setEmbeddedEntities() {
        for (let scene of game.scenes.entities) {
            let notes = duplicate(scene.data.notes);
            for (let note of notes) {
                setProperty(
                    note,
                    "flags.dgr-harms-way.initialization-entryName",
                    game.journal.get(note.entryId).data.name
                );
            }
            let tokens = duplicate(scene.data.tokens);
            for (let token of tokens) {
                setProperty(
                    token,
                    "flags.dgr-harms-way.initialization-actorName",
                    game.actors.get(token.actorId).data.name
                );
            }
            await scene.update({ notes: notes, tokens: tokens });
        }
    }
}
