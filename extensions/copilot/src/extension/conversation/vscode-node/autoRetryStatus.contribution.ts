/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ConfigKey, IConfigurationService } from '../../../platform/configuration/common/configurationService';
import { Disposable } from '../../../util/vs/base/common/lifecycle';

const autoRetryEnabledContextKey = 'github.copilot.chat.autoRetryEnabled';

/**
 * Contributes the auto-retry toggle shown in the chat input status bar and keeps its
 * context key in sync with `github.copilot.chat.autoRetry.enabled`.
 */
export class AutoRetryStatusContribution extends Disposable {
	constructor(
		@IConfigurationService private readonly _configurationService: IConfigurationService,
	) {
		super();

		this._updateContextKey();

		this._register(vscode.commands.registerCommand('github.copilot.chat.autoRetry.enable', async () => {
			await this._configurationService.setConfig(ConfigKey.AutoRetryEnabled, true);
		}));
		this._register(vscode.commands.registerCommand('github.copilot.chat.autoRetry.disable', async () => {
			await this._configurationService.setConfig(ConfigKey.AutoRetryEnabled, false);
		}));

		this._register(this._configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(ConfigKey.AutoRetryEnabled.fullyQualifiedId)) {
				this._updateContextKey();
			}
		}));
	}

	private _updateContextKey(): void {
		const enabled = this._configurationService.getConfig(ConfigKey.AutoRetryEnabled);
		vscode.commands.executeCommand('setContext', autoRetryEnabledContextKey, enabled);
	}
}
