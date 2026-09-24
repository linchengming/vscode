/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from 'vitest';
import { ChatFetchResponseType, ChatResponse } from '../../../../platform/chat/common/commonTypes';
import { ConfigKey, IConfigurationService } from '../../../../platform/configuration/common/configurationService';
import { ILogService } from '../../../../platform/log/common/logService';
import { isRetriableFailure, UserAutoRetry } from '../../node/userAutoRetry';

function response(type: ChatFetchResponseType): ChatResponse {
	return { type, reason: 'test', requestId: 'req-1', serverRequestId: undefined } as ChatResponse;
}

function createRetry(config: { enabled: boolean; maxAttempts?: number }): UserAutoRetry {
	const configurationService = {
		getConfig: (key: unknown) => {
			if (key === ConfigKey.AutoRetryEnabled) { return config.enabled; }
			if (key === ConfigKey.AutoRetryMaxAttempts) { return config.maxAttempts ?? 0; }
			if (key === ConfigKey.AutoRetryIntervalSeconds) { return 60; }
			return undefined;
		},
	} as unknown as IConfigurationService;
	const logService = { info: () => { } } as unknown as ILogService;
	return new UserAutoRetry(configurationService, logService);
}

describe('isRetriableFailure', () => {
	it.each([
		ChatFetchResponseType.RateLimited,
		ChatFetchResponseType.QuotaExceeded,
		ChatFetchResponseType.ExtensionBlocked,
		ChatFetchResponseType.InvalidStatefulMarker,
		ChatFetchResponseType.Failed,
		ChatFetchResponseType.NetworkError,
		ChatFetchResponseType.BadRequest,
		ChatFetchResponseType.NotFound,
		ChatFetchResponseType.Unknown,
		ChatFetchResponseType.AgentFailedDependency,
	])('retries %s', type => {
		expect(isRetriableFailure(response(type))).toBe(true);
	});

	it.each([
		ChatFetchResponseType.Canceled,
		ChatFetchResponseType.Refusal,
		ChatFetchResponseType.PromptFiltered,
		ChatFetchResponseType.Length,
		ChatFetchResponseType.AgentUnauthorized,
		ChatFetchResponseType.Success,
	])('does not retry %s', type => {
		expect(isRetriableFailure(response(type))).toBe(false);
	});
});

describe('UserAutoRetry.shouldRetry', () => {
	it('does nothing when disabled', () => {
		expect(createRetry({ enabled: false }).shouldRetry(response(ChatFetchResponseType.RateLimited))).toBe(false);
	});

	it('retries transient failures when enabled', () => {
		expect(createRetry({ enabled: true }).shouldRetry(response(ChatFetchResponseType.RateLimited))).toBe(true);
	});

	it('never retries a success', () => {
		expect(createRetry({ enabled: true }).shouldRetry(response(ChatFetchResponseType.Success))).toBe(false);
	});
});
