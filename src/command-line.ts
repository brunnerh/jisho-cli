import commandLineArgs from 'command-line-args';

export type ColorOption = 'auto' | 'never' | 'always';
export const ColorOptionsList: ColorOption[] = ['auto', 'never', 'always'];
export function isValidColorOption(option: string): option is ColorOption
{
	return ColorOptionsList.includes(<any>option);
}

export interface CommandLineArgs
{
	/** Show help? */
	help: boolean;

	/** Interactive? */
	interactive: boolean;

	/** Show results top to bottom? */
	reverse: boolean;

	/** Color, should be one of the types of {@link ColorOption}. */
	color: string;

	/** Search term. */
	term?: string;
}

export type OptionDefinition<T extends keyof CommandLineArgs = keyof CommandLineArgs> =
	Omit<commandLineArgs.OptionDefinition, 'name'> &
	{ name: T; };
