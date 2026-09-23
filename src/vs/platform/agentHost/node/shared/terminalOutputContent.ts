/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { ToolResultContentType, type TerminalCommandResult, type ToolResultTerminalContent } from '../../common/state/protocol/state.js';
import { buildNonPtyShellTerminalUri } from './nonPtyShellTerminal.js';

export const TERMINAL_OUTPUT_PREVIEW_CHARACTER_LIMIT = 500;

export function terminalOutputPreview(...parts: readonly (string | undefined)[]): string | undefined {
	const output = parts.filter((part): part is string => !!part).join('\n');
	return output ? output.slice(0, TERMINAL_OUTPUT_PREVIEW_CHARACTER_LIMIT) : undefined;
}

export function terminalOutputContent(session: URI | string, toolCallId: string, title: string, result: TerminalCommandResult): ToolResultTerminalContent {
	return {
		type: ToolResultContentType.Terminal,
		resource: buildNonPtyShellTerminalUri(session, toolCallId),
		title,
		isPty: false,
		result,
	};
}
