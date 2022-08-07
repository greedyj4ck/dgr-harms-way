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
                    
                    // Initialize Journals
                    await this.initializeEntities();

                    // Initialize Scenes
                    await this.initializeScenes();

                     // Initialize Actors
                    await this.initializeActors();
                    resolve();
                });
        });
    }

    async initializeEntities() {
        let journalPack = `${this.moduleKey}.dgr-harms-way-journals`;
        let journalGamePack = await game.packs.get(journalPack).migrate()
        let journalPackContent = await journalGamePack .getDocuments();

        journalPackContent.forEach((entity) => {
            let entityObject = entity.toObject();

            entityObject.folder = game.folders.find(
                (folder) => folder.name === "HARM'S WAY"
              ).id;

            // Now create that entry
            JournalEntry.create(entityObject);
        });

        // Initialise other entities (items, actors) here
    }

    // Init scenes here
    async initializeScenes() {
        let scenesPack = `${this.moduleKey}.dgr-harms-way-scenes`;
        let scenesGamePack =  await game.packs.get(scenesPack).migrate()
        let scenesPackContent = await scenesGamePack.getDocuments();

        console.log(scenesPackContent);

        scenesPackContent.forEach((entity) => {
            let entityObject = entity.toObject();

            if (entityObject.name.includes("(I)"))
                entityObject.folder = game.folders.find(
                    (folder) => folder.name === "INTRODUCTION"
                ).id;
            if (entityObject.name.includes("(JUS)"))
                entityObject.folder = game.folders.find(
                    (folder) => folder.name === "JUSTITIAN"
                ).id;
            if (entityObject.name.includes("(SC"))
                entityObject.folder = game.folders.find(
                    (folder) => folder.name === "SCENES"
                ).id;

            console.log(`Creating Scene ${entityObject.name}`);
            // Now create that scene and the thumbnail
            Scene.create(entityObject).then(async (scene) => {
                let thumb = await scene.createThumbnail();
                scene.update({ thumb: thumb.thumb });
            });
        });
    }

    // Init actors here
    async initializeActors() {
        let actorsPack = `${this.moduleKey}.dgr-harms-way-actors`;
        let actorsGamePack =  await game.packs.get(actorsPack).migrate()
        let actorsPackContent = await actorsGamePack.getDocuments();

        console.log(actorsPackContent);

        actorsPackContent.forEach((entity) => {
            let entityObject = entity.toObject();

            entityObject.folder = game.folders.find(
                (folder) => folder.name === "PREPARED CHARACTERS"
            ).id;

            console.log(`Creating Actor ${entityObject.name}`);

            Actor.create(entityObject);
        });
    }
}

// Helper function to merging journal files to single object

function JournalMerge(foldername){

    const folderName = foldername; // Change this.
    const folder = game.folders.find(f => {
      return (f.name === folderName) && (f.type === "JournalEntry");
    });
    if ( !folder ) return;
    const sort = folder.sorting === "m"
      ? SidebarDirectory._sortStandard
      : SidebarDirectory._sortAlphabetical;
    const contents = folder.contents.sort(sort);
    const pages = contents.flatMap((entry, i) => {
      const pages = [];
      // Preserve sort order in the folder.
      let sort = (i + 1) * 200_000;
      const textPage = entry.pages.find(p => p.type === "text")?.toObject();
      const imagePage = entry.pages.find(p => p.type === "image")?.toObject();
      if ( textPage ) {
        textPage.title.show = true;
        textPage.sort = sort;
        pages.push(textPage);
        sort -= 100_000;
      }
      if ( imagePage ) {
        imagePage.sort = sort;
        pages.push(imagePage);
      }
      return pages;
    });
    JournalEntry.implementation.create({
      pages,
      name: folder.name,
      folder: folder.folder?.id
    });
    };
    
    