import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFile, TFolder } from 'obsidian';
import * as fs from 'fs'
import * as path from 'path'
// Remember to rename these classes and interfaces!


enum TagPlacement {
	'frontmatter' = 'frontmatter',
	'append' = 'append'
}
interface UniqueNotePlusSettings {
	recursiveFolders: boolean;
	folderAsTag: boolean;
	tagPlacement: TagPlacement
}

const DEFAULT_ZK_PREFIXER_FORMAT = 'YYYYMMDDHHmm'

const DEFAULT_SETTINGS: UniqueNotePlusSettings = {
	recursiveFolders: false,
	folderAsTag: false,
	tagPlacement: TagPlacement.append
}

const slugify = (str: string) => str
	.toLowerCase()
	.trim()
	.replace(/[^\w\s-]/g, '')
	.replace(/[\s_-]+/g, '-')
	.replace(/^-+|-+$/g, '')

function isFolder(file: TAbstractFile): file is TFolder {
	return file instanceof TFolder
}

function isFile(file: TAbstractFile): file is TFile {
	return file instanceof TFile
}

export default class UniqueNotePlusPlugin extends Plugin {
	settings: UniqueNotePlusSettings;

	currentFile(): TFile | undefined {
    return this.app.workspace.getActiveViewOfType(MarkdownView)?.file;
  }

	getZkPrefixerSettings() {
		// @ts-ignore
		const root = this.app.vault.adapter.basePath
		const settings = {
			folder: '',
			format: DEFAULT_ZK_PREFIXER_FORMAT,
			template: '',
		}

		// load core unique note settings (aka zk-prefixer)
		try {
			const importedSettings = JSON.parse(fs.readFileSync(path.resolve(path.join(root, '.obsidian/zk-prefixer.json')), 'utf8'))
			if (importedSettings.folder) {
				settings.folder = importedSettings.folder
			}
			if (importedSettings.format && importedSettings.format.trim().length) {
				settings.format = importedSettings.format
			}
			// console.log('settings', settings)
		} catch (err) {
			console.error('Failed to Load Unique Notes Settings', err)
			new Notice('Failed to Load Unique Notes Settings, check console for details')
			throw new Error('Failed to Load Unique Notes Settings')
		}

		if (!settings.folder) {
			console.error('Failed to Load Unique Notes Settings', { settings })
			new Notice('Failed to Load Unique Notes Settings, check console for details')
			throw new Error('Failed to Load Unique Notes Settings')
		}
		return settings
	}

	async convertToUniqueNote(file?: TFile) {
		if (!file) {
			file = this.currentFile()
		}
		const title = file?.name
		const ctime = window.moment(file?.stat.ctime)
		if (!title || !ctime) {
			console.error('Failed to Load Unique Notes Settings', { title, ctime })
			new Notice('Failed to Load Unique Notes Settings, check console for details')
			return
		}

		const settings = this.getZkPrefixerSettings()
		const pluginSettings = this.settings

		// create new file name
		const targetFile = ctime.format(settings.format) + ' ' + title
		if (!file) {
			console.error('Failed to Load Unique Notes Settings', { file })
			new Notice('Failed to Load Unique Notes Settings, check console for details')
			return
		}

		// add folder as tag to frontmatter
		if (pluginSettings.folderAsTag) {
			const folderTag = slugify(file?.parent.name)

			if (pluginSettings.tagPlacement === TagPlacement.frontmatter) {
				await this.app.fileManager.processFrontMatter(file, (frontMatter) => {
					frontMatter = frontMatter || {}
					if (file?.parent.name) {
						const tags = new Set<string>(frontMatter.tags || [])
						tags.add(slugify(file?.parent.name))
						frontMatter.tags = Array.from(tags)
					}
					return frontMatter
				})
			}
			if (pluginSettings.tagPlacement === TagPlacement.append) {
				// @ts-ignore
				const root = this.app.vault.adapter.basePath
				fs.appendFileSync(path.join(root, file.path), `\n\n#${folderTag}`)
			}
		}

		await this.app.fileManager.renameFile(file, path.join(settings.folder, targetFile))
		
	}

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new SampleSettingTab(this.app, this));

		this.addCommand({
			id: 'unique-note-plus-convert',
			name: 'Convert to Unique Note',
			callback: () => {
				this.convertToUniqueNote()
			}
		})

		const pluginSettings = this.settings

		// register file-menu right-click option
		this.registerEvent(
      this.app.workspace.on("file-menu", (menu, object) => {
				const file = isFile(object) ? object as TFile : null
				const folder = isFolder(object) ? object as TFolder : null
				if (file) {
					// selected single file
					console.log('file-menu', 'single file?', file)
					menu.addItem((item) => {
						item
							.setTitle("Convert to Unique Note")
							.setIcon("document")
							.onClick(async () => {
								console.log('file', file)
								await this.convertToUniqueNote(file as TFile)
							});
					});
				}

				function childrenFiles(files: TFile[], folder: TFolder): TFile[] {
					folder.children.forEach((child) => {
						if (isFile(child)) {
							files.push(child)
						} else if (isFolder(child) && pluginSettings.recursiveFolders) {
							files = childrenFiles(files, child)
						}
					})
					return files
				}

				if (folder) {
					menu.addItem((item) => {
						item
							.setTitle("Convert folder children to Unique Notes")
							.setIcon("document")
							.onClick(async () => {
								if (folder && folder.children.length) {
									const files = childrenFiles([], folder)
									for (const file of files) {
										await this.convertToUniqueNote(file as TFile)
									}
								}
							});
					});
				}
      })
    );

		// // This creates an icon in the left ribbon.
		// const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
		// 	// Called when the user clicks the icon.
		// 	new Notice('Hello You!');
		// });
		// // Perform additional things with the ribbon
		// ribbonIconEl.addClass('unique-note-plus-ribbon-class');

		// // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		// const statusBarItemEl = this.addStatusBarItem();
		// statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		// this.addCommand({
		// 	id: 'open-sample-modal-simple',
		// 	name: 'Open sample modal (simple)',
		// 	callback: () => {
		// 		new SampleModal(this.app).open();
		// 	}
		// });
		// This adds an editor command that can perform some operation on the current editor instance
		// this.addCommand({
		// 	id: 'sample-editor-command',
		// 	name: 'Sample editor command',
		// 	editorCallback: (editor: Editor, view: MarkdownView) => {
		// 		console.log(editor.getSelection());
		// 		editor.replaceSelection('Sample Editor Command');
		// 	}
		// });
		// // This adds a complex command that can check whether the current state of the app allows execution of the command
		// this.addCommand({
		// 	id: 'open-sample-modal-complex',
		// 	name: 'Open sample modal (complex)',
		// 	checkCallback: (checking: boolean) => {
		// 		// Conditions to check
		// 		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		// 		if (markdownView) {
		// 			// If checking is true, we're simply "checking" if the command can be run.
		// 			// If checking is false, then we want to actually perform the operation.
		// 			if (!checking) {
		// 				new SampleModal(this.app).open();
		// 			}

		// 			// This command will only show up in Command Palette when the check function returns true
		// 			return true;
		// 		}
		// 	}
		// });

		// // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// // Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		// 	console.log('click', evt);
		// });

		// // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	private textBox: HTMLInputElement;
	constructor(app: App) {
		super(app);

		// modal title
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: UniqueNotePlusPlugin;

	constructor(app: App, plugin: UniqueNotePlusPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
    const { folderAsTag, recursiveFolders, tagPlacement } = this.plugin.settings;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Unique Note Plus Settings'});
		containerEl.createEl("hr");
		containerEl.createEl('h3', {text: 'Convert Settings'});

		new Setting(containerEl)
			.setName("Convert - Recursively select children in folders")
			.setDesc(
				"When converting a folder, recursively select children"
			)
			.addToggle((setting) =>
				setting.setValue(recursiveFolders).onChange(async (value) => {
					this.plugin.settings.recursiveFolders = value;
					await this.plugin.saveSettings();
					this.display();
				})
			);
		new Setting(containerEl)
				.setName('Convert - Folder as tag')
				.setDesc('When converting a note, add the folder name as a tag')
				.addToggle((setting) =>
					setting.setValue(folderAsTag).onChange(async (value) => {
						this.plugin.settings.folderAsTag = value;
						await this.plugin.saveSettings();
						this.display();
					})
				);
		if (folderAsTag) {
			new Setting(containerEl)
				.setName("Convert - Folder as Tag - Placement Rule")
				.setDesc(
					"Frontmatter means adding tag to frontmatter. " +
						"Append updates note content with tag at end of note. "
				)
				.addDropdown((setting) =>
					setting
					.addOption(TagPlacement.append, "Append")	
					.addOption(TagPlacement.frontmatter, "Frontmatter")
						.setDisabled(!folderAsTag)
						.setValue(tagPlacement)
						.onChange(async (value) => {
							this.plugin.settings.tagPlacement = value as TagPlacement;
							await this.plugin.saveSettings();
							this.display();
						})
				);
		}
	}
}
