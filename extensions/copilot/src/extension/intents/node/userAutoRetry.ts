/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as l10n from '@vscode/l10n';
import type { ChatResponseStream } from 'vscode';
import { ChatFetchResponseType, ChatResponse } from '../../../platform/chat/common/commonTypes';
import { ConfigKey, IConfigurationService } from '../../../platform/configuration/common/configurationService';
import { ILogService } from '../../../platform/log/common/logService';
import { DeferredPromise, timeout } from '../../../util/vs/base/common/async';
import { CancellationToken } from '../../../util/vs/base/common/cancellation';

/**
 * Whether the failure is transient enough that retrying the identical request could succeed.
 * Excludes cancellations and anything caused by the prompt itself, which would fail again the same way.
 */
export function isRetriableFailure(response: ChatResponse): boolean {
	switch (response.type) {
		case ChatFetchResponseType.RateLimited:
		case ChatFetchResponseType.QuotaExceeded:
		case ChatFetchResponseType.ExtensionBlocked:
		case ChatFetchResponseType.InvalidStatefulMarker:
		case ChatFetchResponseType.Failed:
		case ChatFetchResponseType.NetworkError:
		case ChatFetchResponseType.BadRequest:
		case ChatFetchResponseType.NotFound:
		case ChatFetchResponseType.Unknown:
		case ChatFetchResponseType.AgentFailedDependency:
			return true;
		default:
			return false;
	}
}

/**
 * Silent retry of failed requests on the user's behalf, driven by the `chat.autoRetry.*` settings.
 * Kept out of `ToolCallingLoop` so upstream merges only touch a few hook lines there.
 */
export class UserAutoRetry {
	private attempt = 0;
	private progressDeferred: DeferredPromise<string> | undefined;

	constructor(
		private readonly configurationService: IConfigurationService,
		private readonly logService: ILogService,
	) { }

	shouldRetry(response: ChatResponse): boolean {
		if (response.type === ChatFetchResponseType.Success || !this.configurationService.getConfig(ConfigKey.AutoRetryEnabled)) {
			return false;
		}
		const maxAttempts = this.configurationService.getConfig(ConfigKey.AutoRetryMaxAttempts);
		if (maxAttempts > 0 && this.attempt >= maxAttempts) {
			return false;
		}
		return isRetriableFailure(response);
	}

	/** Called for every completed round; a successful request ends the retry sequence. */
	onResponse(response: ChatResponse): void {
		if (response.type === ChatFetchResponseType.Success) {
			this.attempt = 0;
			this.resolveProgress();
		}
	}

	/**
	 * Waits out the configured interval while showing a progress line with the attempt count.
	 * Returns `false` if the wait was cancelled, in which case the loop must stop.
	 */
	async wait(response: ChatResponse, outputStream: ChatResponseStream | undefined, token: CancellationToken): Promise<boolean> {
		this.attempt++;
		this.logService.info(`[ToolCallingLoop] Silently auto-retrying on error (attempt ${this.attempt}): ${response.type}`);

		const configuredInterval = this.configurationService.getConfig(ConfigKey.AutoRetryIntervalSeconds);
		const intervalSeconds = Number.isFinite(configuredInterval) && configuredInterval > 0 ? configuredInterval : 60;

		// The progress API can't update a line in place, so each attempt settles the previous line and starts a new one.
		this.progressDeferred?.complete(l10n.t('Retry {0} failed', this.attempt - 1));
		const deferred = new DeferredPromise<string>();
		this.progressDeferred = deferred;
		outputStream?.progress(l10n.t('Request failed, retrying (attempt {0})...', this.attempt), () => deferred.p);

		try {
			await timeout(intervalSeconds * 1000, token);
			return true;
		} catch {
			this.resolveProgress();
			return false;
		}
	}

	resolveProgress(): void {
		this.progressDeferred?.complete(l10n.t('Retried the request'));
		this.progressDeferred = undefined;
	}
}
