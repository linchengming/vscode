/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../../base/common/buffer.js';
import { hash } from '../../../../base/common/hash.js';
import { URI } from '../../../../base/common/uri.js';
import { IFileService } from '../../../files/common/files.js';
import { ISessionDataService } from '../../common/sessionDataService.js';
import type { TerminalCommandResult } from '../../common/state/protocol/state.js';
import { terminalOutputPreview } from '../shared/terminalOutputContent.js';

export const TERMINAL_OUTPUT_ARTIFACT_THRESHOLD_BYTES = 20 * 1024;

export function shouldPersistTerminalOutput(output: string): boolean {
	return VSBuffer.fromString(output).byteLength > TERMINAL_OUTPUT_ARTIFACT_THRESHOLD_BYTES;
}

export interface IRetainedTerminalOutput {
	readonly result: TerminalCommandResult;
	readonly artifact: URI;
}

/**
 * Codex does not save large command output itself, so write it under the
 * owning chat's session data where the historical terminal can read it.
 */
export async function persistTerminalOutput(options: {
	readonly owner: URI;
	readonly toolCallId: string;
	readonly output: string;
	readonly exitCode?: number;
}, sessionDataService: ISessionDataService, fileService: IFileService): Promise<IRetainedTerminalOutput> {
	const directory = URI.joinPath(sessionDataService.getSessionDataDir(options.owner), 'terminal-output');
	const name = `${(hash(options.toolCallId) >>> 0).toString(36)}.txt`;
	const resource = URI.joinPath(directory, name);
	await fileService.createFolder(directory);
	const bytes = VSBuffer.fromString(options.output);
	await fileService.writeFile(resource, bytes);
	return {
		result: {
			...(options.exitCode !== undefined ? { exitCode: options.exitCode } : {}),
			preview: terminalOutputPreview(options.output),
			truncated: true,
		},
		artifact: resource,
	};
}
