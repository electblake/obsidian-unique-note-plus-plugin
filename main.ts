import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import * as fs from 'fs'
import * as path from 'path'
// Remember to rename these classes and interfaces!

interface UniqueNotePlusSettings {
	foo: string;
}

const DEFAULT_ZK_PREFIXER_FORMAT = 'YYYYMMDDHHmm'

const DEFAULT_SETTINGS: UniqueNotePlusSettings = {
	foo: 'default'
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

	async convertToUniqueNote() {
		const file = this.currentFile()
		const title = file?.name
		const ctime = window.moment(file?.stat.ctime)
		if (!title || !ctime) {
			console.error('Failed to Load Unique Notes Settings', { title, ctime })
			new Notice('Failed to Load Unique Notes Settings, check console for details')
			return
		}

		const settings = this.getZkPrefixerSettings()

		// create new file name
		const targetFile = ctime.format(settings.format) + ' ' + title
		this.app.fileManager.renameFile(file, path.join(settings.folder, targetFile))
	}

	async getUniqueNoteSettings() {
		return this.app.vault.adapter.list(this.app.vault.configDir)
	}

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'unique-note-plus-convert',
			name: 'Convert to Unique Note',
			callback: () => {
				this.convertToUniqueNote()
			}
		})


		this.registerEvent(this.app.vault.on('create', () => {
      console.log('a new file has entered the arena')
    }));

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

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

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
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.foo)
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.foo = value;
					await this.plugin.saveSettings();
				}));
	}
}
